import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("weekly-report");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyReportData {
  /** ISO date of the report period start (Monday) */
  periodStart: string;
  /** ISO date of the report period end (Sunday) */
  periodEnd: string;
  generatedAt: string;

  // Crawling / discovery
  newProspectsDiscovered: number;
  newProspectsBySource: Record<string, number>;

  // Enrichment
  prospectsEnriched: number;

  // Emails
  emailsSentTotal: number;
  emailsSentInitial: number;
  emailsSentFollowups: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  replyRate: number;

  // Enrollments
  enrollmentsStarted: number;
  enrollmentsStopped: number;
  enrollmentsCompleted: number;

  // Backlinks
  backlinksWon: number;
  backlinksLost: number;
  backlinksVerified: number;

  // Top performers
  topCampaigns: Array<{
    id: number;
    name: string;
    enrolled: number;
    replied: number;
    won: number;
    replyRate: number;
  }>;
  topEngagedProspects: Array<{
    id: number;
    domain: string;
    replyCount: number;
    category: string;
  }>;

  // Comparison with previous week (null if no previous data)
  previousWeek: {
    newProspectsDiscovered: number;
    emailsSentTotal: number;
    backlinksWon: number;
    backlinksLost: number;
    replyRate: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Helper: get week boundaries (Mon-Sun)
// ---------------------------------------------------------------------------

function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Get Monday of the week
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export async function generateWeeklyReport(
  referenceDate?: Date
): Promise<WeeklyReportData> {
  const now = referenceDate ?? new Date();
  const { start, end } = getWeekBoundaries(now);
  const dateRange = { gte: start, lte: end };

  log.info(
    { periodStart: start.toISOString(), periodEnd: end.toISOString() },
    "Generating weekly report"
  );

  // Previous week boundaries
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prevEnd = new Date(start);
  prevEnd.setUTCMilliseconds(-1);
  const prevDateRange = { gte: prevStart, lte: prevEnd };

  // ── Current week queries ──────────────────────────────────────────────

  const [
    newProspectsTotal,
    prospectsManual,
    prospectsCsv,
    prospectsScraper,
    prospectsEnriched,
    sentEmailsAll,
    sentEmailsInitial,
    sentEmailsFollowups,
    sentEmailsOpened,
    sentEmailsClicked,
    sentEmailsBounced,
    repliesReceived,
    enrollmentsStarted,
    enrollmentsStopped,
    enrollmentsCompleted,
    backlinksWon,
    backlinksLost,
    backlinksVerified,
    topCampaignsRaw,
    topEngagedRaw,
    // Previous week
    prevProspects,
    prevEmailsSent,
    prevBacklinksWon,
    prevBacklinksLost,
    prevReplies,
    prevEmailsTotal,
  ] = await Promise.all([
    // New prospects
    prisma.prospect.count({ where: { createdAt: dateRange } }),
    prisma.prospect.count({ where: { createdAt: dateRange, source: "manual" } }),
    prisma.prospect.count({ where: { createdAt: dateRange, source: "csv_import" } }),
    prisma.prospect.count({ where: { createdAt: dateRange, source: "scraper" } }),

    // Enrichments completed
    prisma.event.count({
      where: { createdAt: dateRange, eventType: "enrichment_completed" },
    }),

    // Emails sent
    prisma.sentEmail.count({ where: { sentAt: dateRange } }),
    prisma.sentEmail.count({ where: { sentAt: dateRange, stepNumber: 0 } }),
    prisma.sentEmail.count({ where: { sentAt: dateRange, stepNumber: { gt: 0 } } }),

    // Opens, clicks, bounces (from SentEmail tracking fields)
    prisma.sentEmail.count({
      where: { sentAt: dateRange, openCount: { gt: 0 } },
    }),
    prisma.sentEmail.count({
      where: { sentAt: dateRange, clickCount: { gt: 0 } },
    }),
    prisma.sentEmail.count({
      where: { sentAt: dateRange, bouncedAt: { not: null } },
    }),

    // Replies
    prisma.event.count({
      where: { createdAt: dateRange, eventType: { in: ["reply_received", "REPLY_CLASSIFIED"] } },
    }),

    // Enrollments
    prisma.enrollment.count({ where: { enrolledAt: dateRange } }),
    prisma.enrollment.count({
      where: {
        status: "stopped",
        enrolledAt: dateRange,
      },
    }),
    prisma.enrollment.count({
      where: {
        status: "completed",
        completedAt: dateRange,
      },
    }),

    // Backlinks
    prisma.backlink.count({ where: { createdAt: dateRange, isLive: true } }),
    prisma.backlink.count({ where: { lostAt: dateRange } }),
    prisma.backlink.count({
      where: { lastVerifiedAt: dateRange, isVerified: true },
    }),

    // Top 5 campaigns by reply rate (this week's enrollments)
    prisma.campaign.findMany({
      where: { totalEnrolled: { gt: 0 }, isActive: true },
      select: {
        id: true,
        name: true,
        totalEnrolled: true,
        totalReplied: true,
        totalWon: true,
      },
      orderBy: { totalReplied: "desc" },
      take: 5,
    }),

    // Top 5 most engaged prospects (most reply events this week)
    prisma.event.groupBy({
      by: ["prospectId"],
      where: {
        createdAt: dateRange,
        eventType: { in: ["reply_received", "REPLY_CLASSIFIED"] },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    // ── Previous week queries ─────────────────────────────────────────
    prisma.prospect.count({ where: { createdAt: prevDateRange } }),
    prisma.sentEmail.count({ where: { sentAt: prevDateRange } }),
    prisma.backlink.count({ where: { createdAt: prevDateRange, isLive: true } }),
    prisma.backlink.count({ where: { lostAt: prevDateRange } }),
    prisma.event.count({
      where: { createdAt: prevDateRange, eventType: { in: ["reply_received", "REPLY_CLASSIFIED"] } },
    }),
    prisma.sentEmail.count({ where: { sentAt: prevDateRange } }),
  ]);

  // Resolve prospect details for top engaged
  const topEngagedProspects = await Promise.all(
    topEngagedRaw.map(async (row) => {
      const prospect = await prisma.prospect.findUnique({
        where: { id: row.prospectId },
        select: { id: true, domain: true, category: true },
      });
      return {
        id: prospect?.id ?? row.prospectId,
        domain: prospect?.domain ?? "unknown",
        replyCount: row._count.id,
        category: prospect?.category ?? "other",
      };
    })
  );

  // Compute rates
  const safeDiv = (num: number, den: number): number =>
    den > 0 ? Math.round((num / den) * 10000) / 100 : 0;

  const openRate = safeDiv(sentEmailsOpened, sentEmailsAll);
  const clickRate = safeDiv(sentEmailsClicked, sentEmailsAll);
  const bounceRate = safeDiv(sentEmailsBounced, sentEmailsAll);
  const replyRate = safeDiv(repliesReceived, sentEmailsAll);

  const prevReplyRate = safeDiv(prevReplies, prevEmailsTotal);

  const topCampaigns = topCampaignsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    enrolled: c.totalEnrolled,
    replied: c.totalReplied,
    won: c.totalWon,
    replyRate: safeDiv(c.totalReplied, c.totalEnrolled),
  }));

  const report: WeeklyReportData = {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),

    newProspectsDiscovered: newProspectsTotal,
    newProspectsBySource: {
      manual: prospectsManual,
      csv_import: prospectsCsv,
      scraper: prospectsScraper,
    },

    prospectsEnriched,

    emailsSentTotal: sentEmailsAll,
    emailsSentInitial: sentEmailsInitial,
    emailsSentFollowups: sentEmailsFollowups,
    openRate,
    clickRate,
    bounceRate,
    replyRate,

    enrollmentsStarted,
    enrollmentsStopped,
    enrollmentsCompleted,

    backlinksWon,
    backlinksLost,
    backlinksVerified,

    topCampaigns,
    topEngagedProspects,

    previousWeek: {
      newProspectsDiscovered: prevProspects,
      emailsSentTotal: prevEmailsSent,
      backlinksWon: prevBacklinksWon,
      backlinksLost: prevBacklinksLost,
      replyRate: prevReplyRate,
    },
  };

  return report;
}

// ---------------------------------------------------------------------------
// Store report in Redis (90-day TTL)
// ---------------------------------------------------------------------------

export async function storeWeeklyReport(report: WeeklyReportData): Promise<void> {
  const key = `backlink-engine:weekly-report:${report.periodStart}`;
  const ttlSeconds = 90 * 24 * 60 * 60;
  await redis.set(key, JSON.stringify(report), "EX", ttlSeconds);
  log.info({ periodStart: report.periodStart }, "Weekly report stored in Redis.");
}

// ---------------------------------------------------------------------------
// Retrieve stored report from Redis
// ---------------------------------------------------------------------------

export async function getStoredWeeklyReport(
  date?: string
): Promise<WeeklyReportData | null> {
  let key: string;

  if (date) {
    // Find the Monday of the week containing the given date
    const d = new Date(date);
    const { start } = getWeekBoundaries(d);
    key = `backlink-engine:weekly-report:${start.toISOString().slice(0, 10)}`;
  } else {
    // Find the most recent report: check this week and last week
    const now = new Date();
    const { start: thisWeekStart } = getWeekBoundaries(now);
    key = `backlink-engine:weekly-report:${thisWeekStart.toISOString().slice(0, 10)}`;

    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as WeeklyReportData;
    }

    // Try previous week
    const lastWeek = new Date(now);
    lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
    const { start: lastWeekStart } = getWeekBoundaries(lastWeek);
    key = `backlink-engine:weekly-report:${lastWeekStart.toISOString().slice(0, 10)}`;
  }

  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as WeeklyReportData;
}

// ---------------------------------------------------------------------------
// Format report for Telegram (HTML, max 4096 chars)
// ---------------------------------------------------------------------------

function trend(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "";
  if (previous === 0) return " \u{1F4C8}"; // up arrow emoji for new activity
  const diff = current - previous;
  if (diff > 0) return ` \u{1F4C8}+${diff}`;
  if (diff < 0) return ` \u{1F4C9}${diff}`;
  return " \u{1F7F0}"; // equals
}

function trendPct(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "";
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff > 0) return ` \u{1F4C8}+${diff}%`;
  if (diff < 0) return ` \u{1F4C9}${diff}%`;
  return "";
}

export function formatWeeklyReportTelegram(report: WeeklyReportData): string {
  const prev = report.previousWeek;

  const lines: string[] = [
    `\u{1F4CA} <b>Rapport Hebdomadaire Backlink Engine</b>`,
    `${report.periodStart} \u{2192} ${report.periodEnd}`,
    ``,
    `\u{1F50D} <b>D\u00e9couverte</b>`,
    `  Nouveaux prospects: <b>${report.newProspectsDiscovered}</b>${prev ? trend(report.newProspectsDiscovered, prev.newProspectsDiscovered) : ""}`,
    `  - Scraper: ${report.newProspectsBySource.scraper ?? 0}`,
    `  - CSV: ${report.newProspectsBySource.csv_import ?? 0}`,
    `  - Manuel: ${report.newProspectsBySource.manual ?? 0}`,
    `  Enrichis: <b>${report.prospectsEnriched}</b>`,
    ``,
    `\u{2709}\u{FE0F} <b>Emails</b>`,
    `  Envoy\u00e9s: <b>${report.emailsSentTotal}</b>${prev ? trend(report.emailsSentTotal, prev.emailsSentTotal) : ""}`,
    `  - Initiaux: ${report.emailsSentInitial}`,
    `  - Follow-ups: ${report.emailsSentFollowups}`,
    `  Taux ouverture: <b>${report.openRate}%</b>`,
    `  Taux clic: <b>${report.clickRate}%</b>`,
    `  Taux bounce: <b>${report.bounceRate}%</b>`,
    `  Taux r\u00e9ponse: <b>${report.replyRate}%</b>${prev ? trendPct(report.replyRate, prev.replyRate) : ""}`,
    ``,
    `\u{1F504} <b>Enrollments</b>`,
    `  D\u00e9marr\u00e9s: ${report.enrollmentsStarted}`,
    `  Arr\u00eat\u00e9s: ${report.enrollmentsStopped}`,
    `  Compl\u00e9t\u00e9s: ${report.enrollmentsCompleted}`,
    ``,
    `\u{1F517} <b>Backlinks</b>`,
    `  Gagn\u00e9s: <b>${report.backlinksWon}</b>${prev ? trend(report.backlinksWon, prev.backlinksWon) : ""}`,
    `  Perdus: <b>${report.backlinksLost}</b>${prev ? trend(report.backlinksLost, prev.backlinksLost) : ""}`,
    `  V\u00e9rifi\u00e9s: ${report.backlinksVerified}`,
  ];

  // Top 5 campaigns
  if (report.topCampaigns.length > 0) {
    lines.push(``);
    lines.push(`\u{1F3C6} <b>Top Campagnes</b>`);
    for (const c of report.topCampaigns) {
      lines.push(`  ${c.name}: ${c.replied}/${c.enrolled} r\u00e9ponses (${c.replyRate}%) - ${c.won} won`);
    }
  }

  // Top 5 engaged prospects
  if (report.topEngagedProspects.length > 0) {
    lines.push(``);
    lines.push(`\u{1F4AC} <b>Prospects les plus engag\u00e9s</b>`);
    for (const p of report.topEngagedProspects) {
      lines.push(`  ${p.domain} (${p.category}): ${p.replyCount} r\u00e9ponse(s)`);
    }
  }

  const text = lines.join("\n");

  // Telegram limit is 4096 chars - truncate if needed
  if (text.length > 4090) {
    return text.slice(0, 4087) + "...";
  }

  return text;
}
