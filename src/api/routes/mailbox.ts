// ---------------------------------------------------------------------------
// Mailbox API V2 — stats + warmup + blacklists + readiness score
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import { Resolver } from "node:dns/promises";

// Use Quad9 DNS (9.9.9.9) for RBL lookups — Spamhaus blocks Google/Cloudflare public resolvers
const rblResolver = new Resolver();
rblResolver.setServers(["9.9.9.9", "149.112.112.112"]);

import { createChildLogger } from "../../utils/logger.js";

const execAsync = promisify(exec);
const log = createChildLogger("mailbox");

const TRACKED_INBOXES = [
  "presse@hub-travelers.com",
  "presse@plane-liberty.com",
  "presse@planevilain.com",
  "presse@emilia-mullerd.com",
  "presse@providers-expat.com",
];

const VPS_IP = process.env.VPS_HOST_IP || "204.168.180.175";

const BLACKLISTS = [
  "zen.spamhaus.org",
  "b.barracudacentral.org",
  "bl.spamcop.net",
  "dnsbl.sorbs.net",
  "psbl.surriel.com",
  "cbl.abuseat.org",
  "ubl.unsubscore.com",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InboxStat {
  fromEmail: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  health: "good" | "warning" | "bad" | "unknown";
}

interface WarmupStat {
  fromEmail: string;
  today: number;       // outbound sends today (Mailflow-triggered)
  last7Days: number;   // outbound sends last 7 days
  totalAll: number;
  success: number;
  failures: number;       // failures over 7d window
  failures72h: number;    // failures last 72h (recent only)
  lastFailure: string | null; // timestamp of last failure
  successRate: number;
  lastActivity: string | null;
  inboundToday?: number;  // inbound Mailflow emails received today
  inbound7d?: number;     // inbound last 7d
}

interface BlacklistResult {
  name: string;
  listed: boolean;
  reply: string | null;
}

interface ReadinessScore {
  fromEmail: string;
  score: number; // 0-100
  verdict: "ready" | "wait" | "problem";
  checks: Array<{ name: string; passed: boolean; weight: number; detail: string }>;
}

// ---------------------------------------------------------------------------
// Helpers: sent_emails aggregation (cold campaigns)
// ---------------------------------------------------------------------------

function computeHealth(s: Omit<InboxStat, "health">): InboxStat["health"] {
  if (s.sent < 5) return "unknown";
  if (s.bounceRate > 5 || s.complained > 0) return "bad";
  if (s.openRate >= 25) return "good";
  if (s.openRate >= 15) return "warning";
  return "bad";
}

async function collectColdStats(days: number): Promise<{ inboxes: InboxStat[]; totals: Record<string, number> }> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const inboxes: InboxStat[] = await Promise.all(
    TRACKED_INBOXES.map(async (fromEmail): Promise<InboxStat> => {
      const where = { fromEmail, sentAt: { gte: since } };
      const [sent, delivered, opened, clicked, bounced, hardBounced, complained] =
        await Promise.all([
          prisma.sentEmail.count({ where }).catch(() => 0),
          prisma.sentEmail
            .count({ where: { ...where, status: { in: ["delivered", "opened", "clicked"] } } })
            .catch(() => 0),
          prisma.sentEmail.count({ where: { ...where, openCount: { gt: 0 } } }).catch(() => 0),
          prisma.sentEmail.count({ where: { ...where, clickCount: { gt: 0 } } }).catch(() => 0),
          prisma.sentEmail.count({ where: { ...where, status: "bounced" } }).catch(() => 0),
          prisma.sentEmail.count({ where: { ...where, bounceType: "hard" } }).catch(() => 0),
          prisma.sentEmail.count({ where: { ...where, complainedAt: { not: null } } }).catch(() => 0),
        ]);
      const openRate = sent > 0 ? (opened / sent) * 100 : 0;
      const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
      const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;
      const base: Omit<InboxStat, "health"> = {
        fromEmail, sent, delivered, opened, clicked, bounced, hardBounced, complained,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        bounceRate: Math.round(bounceRate * 10) / 10,
      };
      return { ...base, health: computeHealth(base) };
    }),
  );

  const totals = inboxes.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      delivered: acc.delivered + r.delivered,
      opened: acc.opened + r.opened,
      clicked: acc.clicked + r.clicked,
      bounced: acc.bounced + r.bounced,
      complained: acc.complained + r.complained,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 },
  );
  return { inboxes, totals };
}

// ---------------------------------------------------------------------------
// Helpers: PMTA warmup (Mailflow) stats
// ---------------------------------------------------------------------------

// V2 warmup detection: uses both PMTA CSV (outbound Mailflow-triggered sends
// via AWS us-east-1 submission auth) AND Postfix mail.log (inbound Mailflow
// warmup emails). Mailflow works P2P: outbound recipients are real pool
// inboxes (gmail/outlook/etc.), not @mailflow.io.
async function collectWarmupStats(): Promise<WarmupStat[]> {
  const pmtaDir = "/var/log/pmta";
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const sevenAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const stats: Record<string, WarmupStat & { inboundToday?: number; inbound7d?: number }> =
    Object.fromEntries(
      TRACKED_INBOXES.map((fe) => [fe, {
        fromEmail: fe, today: 0, last7Days: 0, totalAll: 0,
        success: 0, failures: 0, failures72h: 0, lastFailure: null,
        successRate: 0, lastActivity: null,
        inboundToday: 0, inbound7d: 0,
      }]),
    );

  const threeDaysAgoStr = new Date(Date.now() - 72 * 3600_000).toISOString().slice(0, 10);

  // ---------- 1. OUTBOUND via PMTA CSV (all sends from presse@*) ----------
  let pmtaFiles: string[] = [];
  try {
    pmtaFiles = (await readdir(pmtaDir))
      .filter((f) => f.startsWith("acct-") && f.endsWith(".csv"))
      .filter((f) => {
        const m = f.match(/^acct-(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] >= sevenAgoStr : false;
      })
      .sort();
  } catch {
    /* no access */
  }

  for (const file of pmtaFiles) {
    let content: string;
    try { content = await readFile(path.join(pmtaDir, file), "utf-8"); } catch { continue; }
    for (const line of content.split("\n")) {
      if (!line.startsWith("d,") && !line.startsWith("b,")) continue;
      const f = line.split(",");
      if (f.length < 8) continue;
      const orig = f[3];
      if (!orig || !stats[orig]) continue;
      const s = stats[orig];
      s.totalAll++;
      const ok = f[0] === "d" && f[7]?.startsWith("2.");
      if (ok) s.success++;
      else {
        s.failures++;
        // Failure within last 72h only
        if (f[1]?.slice(0, 10) >= threeDaysAgoStr) {
          s.failures72h = (s.failures72h ?? 0) + 1;
          if (!s.lastFailure || f[1] > s.lastFailure) s.lastFailure = f[1] ?? null;
        }
      }
      if (f[1]?.startsWith(today)) s.today++;
      if (f[1]?.slice(0, 10) >= sevenAgoStr) s.last7Days++;
      if (!s.lastActivity || f[1] > s.lastActivity) s.lastActivity = f[1] ?? null;
    }
  }

  // ---------- 2. INBOUND via Postfix mail.log (orig_to=<presse@...>) -----
  try {
    const mailLog = await readFile("/var/log/mail.log", "utf-8");
    const lines = mailLog.split("\n");
    for (const line of lines) {
      if (!line.includes("lmtp") || !line.includes("orig_to=<presse@") || !line.includes("Saved")) continue;
      const mFrom = line.match(/orig_to=<(presse@[^>]+)>/);
      const mDate = line.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!mFrom || !mDate) continue;
      const email = mFrom[1];
      const dateStr = mDate[1];
      const rec = stats[email];
      if (!rec) continue;
      if (dateStr === today) rec.inboundToday = (rec.inboundToday ?? 0) + 1;
      if (dateStr >= sevenAgoStr) rec.inbound7d = (rec.inbound7d ?? 0) + 1;
    }
  } catch {
    /* log not accessible */
  }

  // ---------- 3. Compute rates + merge inbound as bonus counters ----------
  for (const s of Object.values(stats)) {
    s.successRate = s.totalAll > 0 ? Math.round((s.success / s.totalAll) * 1000) / 10 : 0;
    // Total "activity" = sends + inbound (a warmup exchange = 1 send + 1 receive)
    (s as any).inboundToday = s.inboundToday ?? 0;
    (s as any).inbound7d = s.inbound7d ?? 0;
  }

  return Object.values(stats).map((s) => ({
    fromEmail: s.fromEmail,
    today: s.today,
    last7Days: s.last7Days,
    totalAll: s.totalAll,
    success: s.success,
    failures: s.failures,
    failures72h: (s as any).failures72h ?? 0,
    lastFailure: (s as any).lastFailure ?? null,
    successRate: s.successRate,
    lastActivity: s.lastActivity,
    inboundToday: (s as any).inboundToday,
    inbound7d: (s as any).inbound7d,
  }) as WarmupStat & { inboundToday: number; inbound7d: number });
}

// ---------------------------------------------------------------------------
// Helpers: Blacklist check (DNS RBL)
// ---------------------------------------------------------------------------

function reverseIp(ip: string): string {
  return ip.split(".").reverse().join(".");
}

async function checkBlacklist(ip: string, bl: string): Promise<BlacklistResult> {
  const lookup = `${reverseIp(ip)}.${bl}`;
  try {
    const addrs = await rblResolver.resolve4(lookup);
    return { name: bl, listed: true, reply: addrs[0] ?? null };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { name: bl, listed: false, reply: null };
    }
    return { name: bl, listed: false, reply: `err:${code ?? "unknown"}` };
  }
}

async function collectBlacklists(): Promise<{ ip: string; results: BlacklistResult[]; listedCount: number }> {
  const results = await Promise.all(BLACKLISTS.map((bl) => checkBlacklist(VPS_IP, bl)));
  const listedCount = results.filter((r) => r.listed).length;
  return { ip: VPS_IP, results, listedCount };
}

// ---------------------------------------------------------------------------
// Helpers: Readiness score per inbox
// ---------------------------------------------------------------------------

function computeReadiness(
  fromEmail: string,
  cold: InboxStat,
  warmup: WarmupStat,
  blacklistListed: number,
): ReadinessScore {
  const checks: ReadinessScore["checks"] = [];

  // 1. Warmup active (today > 0)
  const warmupActive = warmup.today > 0;
  checks.push({
    name: "Warmup actif aujourd'hui",
    passed: warmupActive,
    weight: 20,
    detail: warmupActive ? `${warmup.today} envois aujourd'hui` : "Aucune activité Mailflow aujourd'hui",
  });

  // 2. Warmup stable sur 7 jours (>= 7 envois)
  const warmupStable = warmup.last7Days >= 7;
  checks.push({
    name: "Warmup stable (7j)",
    passed: warmupStable,
    weight: 15,
    detail: `${warmup.last7Days} envois / 7 jours`,
  });

  // 3. Warmup succès >= 95%
  const warmupReliable = warmup.totalAll >= 10 ? warmup.successRate >= 95 : false;
  checks.push({
    name: "Warmup délivré à ≥ 95%",
    passed: warmupReliable,
    weight: 10,
    detail: warmup.totalAll > 0 ? `${warmup.successRate}% de succès` : "Pas assez de données",
  });

  // 3bis. Volume warmup suffisant (≥ 50 echanges sur 7j = seuil industrie pour cold)
  const warmupVolume7d =
    (warmup.last7Days ?? 0) + ((warmup as any).inbound7d ?? 0);
  const volumeSufficient = warmupVolume7d >= 50;
  checks.push({
    name: "Volume warmup suffisant (≥ 50 sur 7j)",
    passed: volumeSufficient,
    weight: 15,
    detail: `${warmupVolume7d} échanges sur 7j (envois + réceptions)`,
  });

  // 4. Pas de blacklists
  const notBlacklisted = blacklistListed === 0;
  checks.push({
    name: "Blacklists clean",
    passed: notBlacklisted,
    weight: 20,
    detail: notBlacklisted ? `Clean sur ${BLACKLISTS.length} RBL` : `Listed sur ${blacklistListed} RBL ⚠️`,
  });

  // 5. Bounces faibles si cold actif (optionnel si pas de cold)
  if (cold.sent > 0) {
    const lowBounce = cold.bounceRate < 3;
    checks.push({
      name: "Bounces < 3% (cold)",
      passed: lowBounce,
      weight: 15,
      detail: `${cold.bounceRate}% sur ${cold.sent} envois`,
    });
  } else {
    checks.push({
      name: "Bounces (cold)",
      passed: true,
      weight: 15,
      detail: "Pas encore d'envois cold",
    });
  }

  // 6. Plaintes zéro si cold actif
  if (cold.sent > 0) {
    const noComplaint = cold.complained === 0;
    checks.push({
      name: "Zéro plainte spam (cold)",
      passed: noComplaint,
      weight: 10,
      detail: noComplaint ? "0 plainte" : `${cold.complained} plainte(s) ⚠️`,
    });
  } else {
    checks.push({
      name: "Plaintes (cold)",
      passed: true,
      weight: 10,
      detail: "Pas encore d'envois cold",
    });
  }

  // Compute weighted score
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  let score = Math.round((earnedWeight / totalWeight) * 100);

  // Cap volume warmup: le score ne peut pas depasser ces seuils selon le volume total
  // car un warmup trop faible ne garantit pas la reputation, meme si tout le reste est OK
  const warmupVolTotal =
    (warmup.last7Days ?? 0) + ((warmup as any).inbound7d ?? 0);
  if (warmupVolTotal < 50) {
    score = Math.min(score, 65); // < 50 echanges = jamais "ready"
  } else if (warmupVolTotal < 100) {
    score = Math.min(score, 79); // 50-100 = "wait" (jamais "ready")
  }
  // >= 100 : pas de cap, score total applicable

  let verdict: ReadinessScore["verdict"];
  if (blacklistListed > 0) verdict = "problem";
  else if (score >= 80) verdict = "ready";
  else if (score >= 50) verdict = "wait";
  else verdict = "problem";

  return { fromEmail, score, verdict, checks };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function mailboxRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET /stats ─── cold-campaigns stats (existant, préservé) ─────
  app.get<{ Querystring: { days?: string } }>(
    "/stats",
    async (request, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(request.query.days || "7", 10) || 7));
      const { inboxes, totals } = await collectColdStats(days);
      const globalOpenRate = totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0;
      return reply.send({
        data: {
          inboxes,
          totals: { ...totals, openRate: Math.round(globalOpenRate * 10) / 10 },
          period: { days, since: new Date(Date.now() - days * 86400_000).toISOString() },
        },
      });
    },
  );

  // ───── GET /timeline ─── daily sends/opens per inbox (existant) ─────
  app.get<{ Querystring: { days?: string } }>(
    "/timeline",
    async (request, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(request.query.days || "14", 10) || 14));
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      const rows = await prisma.$queryRawUnsafe<
        Array<{ day: string; from_email: string; sent: bigint; opened: bigint }>
      >(
        `SELECT date_trunc('day', "sentAt")::date::text AS day, "fromEmail" AS from_email,
                COUNT(*)::bigint AS sent,
                SUM(CASE WHEN "openCount" > 0 THEN 1 ELSE 0 END)::bigint AS opened
         FROM sent_emails
         WHERE "sentAt" >= $1 AND "fromEmail" IS NOT NULL
         GROUP BY 1, 2 ORDER BY 1, 2`,
        since,
      ).catch(() => []);
      const timeline = rows.map((r) => ({
        day: r.day, fromEmail: r.from_email, sent: Number(r.sent), opened: Number(r.opened),
      }));
      return reply.send({ data: { timeline, period: { days } } });
    },
  );

  // ───── GET /warmup-stats ─── Mailflow warmup activity (PMTA logs) ───
  app.get("/warmup-stats", async (_req, reply) => {
    try {
      const stats = await collectWarmupStats();
      return reply.send({ data: { inboxes: stats, source: "pmta_acct_csv" } });
    } catch (err) {
      log.error({ err: String(err) }, "warmup-stats failed");
      return reply.code(500).send({ error: "Failed to collect warmup stats" });
    }
  });

  // ───── GET /blacklists ─── RBL check for VPS IP ─────────────────────
  app.get("/blacklists", async (_req, reply) => {
    const result = await collectBlacklists();
    return reply.send({ data: result });
  });

  // ───── GET /readiness ─── per-inbox readiness score 0-100 ───────────
  app.get("/readiness", async (_req, reply) => {
    const [coldRes, warmups, bl] = await Promise.all([
      collectColdStats(30),
      collectWarmupStats(),
      collectBlacklists(),
    ]);
    const coldByEmail = new Map(coldRes.inboxes.map((i) => [i.fromEmail, i]));
    const warmupByEmail = new Map(warmups.map((w) => [w.fromEmail, w]));
    const scores: ReadinessScore[] = TRACKED_INBOXES.map((fromEmail) => {
      const cold = coldByEmail.get(fromEmail)!;
      const warmup = warmupByEmail.get(fromEmail)!;
      return computeReadiness(fromEmail, cold, warmup, bl.listedCount);
    });
    return reply.send({
      data: {
        scores,
        blacklists: bl,
        postmasterToolsUrl: "https://postmaster.google.com/managedomains",
        microsoftSndsUrl: "https://sendersupport.olc.protection.outlook.com/snds/",
      },
    });
  });


  // ───── GET /warmup-timeline ─── daily send count per inbox from PMTA ───
  app.get<{ Querystring: { days?: string } }>(
    "/warmup-timeline",
    async (request, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(request.query.days || "14", 10) || 14));
      const sinceStr = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

      let rows: Array<{ day: string; fromEmail: string; sends: number; receives: number }> = [];
      try {
        const files = (await readdir("/var/log/pmta"))
          .filter((f) => f.startsWith("acct-") && f.endsWith(".csv"))
          .filter((f) => {
            const m = f.match(/^acct-(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] >= sinceStr : false;
          })
          .sort();

        const byDay: Record<string, Record<string, { sends: number; receives: number }>> = {};
        for (const file of files) {
          let content: string;
          try { content = await readFile(path.join("/var/log/pmta", file), "utf-8"); } catch { continue; }
          for (const line of content.split("\n")) {
            if (!line.startsWith("d,")) continue;
            const f = line.split(",");
            if (!f[3] || !TRACKED_INBOXES.includes(f[3]) || !f[1]) continue;
            const day = f[1].slice(0, 10);
            byDay[day] = byDay[day] ?? {};
            byDay[day][f[3]] = byDay[day][f[3]] ?? { sends: 0, receives: 0 };
            byDay[day][f[3]].sends++;
          }
        }

        // Count INBOUND via Postfix mail.log (orig_to=<presse@...>)
        try {
          const mailLog = await readFile("/var/log/mail.log", "utf-8");
          for (const line of mailLog.split("\n")) {
            if (!line.includes("lmtp") || !line.includes("orig_to=<presse@") || !line.includes("Saved")) continue;
            const mFrom = line.match(/orig_to=<(presse@[^>]+)>/);
            const mDate = line.match(/^(\d{4}-\d{2}-\d{2})/);
            if (!mFrom || !mDate || mDate[1] < sinceStr) continue;
            const day = mDate[1];
            const email = mFrom[1];
            if (!TRACKED_INBOXES.includes(email)) continue;
            byDay[day] = byDay[day] ?? {};
            byDay[day][email] = byDay[day][email] ?? { sends: 0, receives: 0 };
            byDay[day][email].receives++;
          }
        } catch { /* no mail.log */ }

        for (const [day, inboxes] of Object.entries(byDay)) {
          for (const [fromEmail, counts] of Object.entries(inboxes)) {
            rows.push({ day, fromEmail, sends: counts.sends, receives: counts.receives });
          }
        }
        rows.sort((a, b) => a.day.localeCompare(b.day) || a.fromEmail.localeCompare(b.fromEmail));
      } catch (err) {
        log.warn({ err: String(err) }, "warmup-timeline failed");
      }

      return reply.send({ data: { timeline: rows, period: { days, since: sinceStr } } });
    },
  );
}
