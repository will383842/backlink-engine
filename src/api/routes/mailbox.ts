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
  today: number;
  last7Days: number;
  totalAll: number;
  success: number;
  failures: number;
  successRate: number;
  lastActivity: string | null;
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

async function collectWarmupStats(): Promise<WarmupStat[]> {
  const pmtaDir = "/var/log/pmta";
  let files: string[];
  try {
    files = (await readdir(pmtaDir)).filter((f) => f.startsWith("acct-") && f.endsWith(".csv"));
  } catch {
    return TRACKED_INBOXES.map((fromEmail) => ({
      fromEmail, today: 0, last7Days: 0, totalAll: 0, success: 0, failures: 0, successRate: 0, lastActivity: null,
    }));
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Keep only files from last 8 days
  const recentFiles = files
    .filter((f) => {
      const m = f.match(/^acct-(\d{4}-\d{2}-\d{2})/);
      if (!m) return false;
      return new Date(m[1]) >= sevenDaysAgo;
    })
    .sort();

  // Stat accumulator per inbox
  const stats: Record<string, WarmupStat> = Object.fromEntries(
    TRACKED_INBOXES.map((fe) => [fe, {
      fromEmail: fe, today: 0, last7Days: 0, totalAll: 0, success: 0, failures: 0, successRate: 0, lastActivity: null,
    }]),
  );

  for (const file of recentFiles) {
    let content: string;
    try {
      content = await readFile(path.join(pmtaDir, file), "utf-8");
    } catch {
      continue;
    }

    // CSV format: type,timeLogged,timeQueued,orig,rcpt,orcpt,dsnAction,dsnStatus,dsnDiag,...
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.startsWith("d,") && !line.startsWith("b,")) continue; // d = delivered, b = bounce
      // Simple CSV split (fields don't contain commas for our needs — PMTA escapes them)
      const fields = line.split(",");
      if (fields.length < 8) continue;

      const type = fields[0];
      const timeLogged = fields[1];
      const orig = fields[3];
      const rcpt = fields[4];
      const dsnStatus = fields[7];

      if (!orig || !stats[orig]) continue;
      if (!rcpt) continue;

      // Only count Mailflow warmup traffic
      if (!rcpt.includes("mailflow.io")) continue;

      const s = stats[orig];
      s.totalAll++;

      const success = type === "d" && dsnStatus.startsWith("2.");
      if (success) s.success++;
      else s.failures++;

      // Today?
      if (timeLogged.startsWith(today)) s.today++;
      // 7 days?
      const dateStr = timeLogged.slice(0, 10);
      if (dateStr && dateStr >= sevenDaysAgo.toISOString().slice(0, 10)) s.last7Days++;

      // Track last activity
      if (!s.lastActivity || timeLogged > s.lastActivity) s.lastActivity = timeLogged;
    }
  }

  // Compute success rate
  for (const s of Object.values(stats)) {
    s.successRate = s.totalAll > 0 ? Math.round((s.success / s.totalAll) * 1000) / 10 : 0;
  }

  return Object.values(stats);
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
    weight: 15,
    detail: warmup.totalAll > 0 ? `${warmup.successRate}% de succès` : "Pas assez de données",
  });

  // 4. Pas de blacklists
  const notBlacklisted = blacklistListed === 0;
  checks.push({
    name: "Blacklists clean",
    passed: notBlacklisted,
    weight: 25,
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
  const score = Math.round((earnedWeight / totalWeight) * 100);

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
}
