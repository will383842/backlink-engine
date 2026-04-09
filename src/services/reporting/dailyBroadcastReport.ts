import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("daily-broadcast-report");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignDailyStats {
  id: number;
  name: string;
  isActive: boolean;
  currentWarmupDay: number;
  dailyLimit: number;
  sentToday: number;
  deliveredToday: number;
  openedToday: number;
  clickedToday: number;
  bouncedToday: number;
  complainedToday: number;
  failedToday: number;
  totalSent: number;
  totalEligible: number;
  progressPct: number;
}

interface DailyBroadcastReport {
  date: string;
  campaigns: CampaignDailyStats[];
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
  };
  alerts: string[];
}

// ---------------------------------------------------------------------------
// Generate daily report
// ---------------------------------------------------------------------------

export async function generateDailyBroadcastReport(): Promise<DailyBroadcastReport> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStr = startOfDay.toISOString().slice(0, 10);

  // Get all broadcast campaigns (active + recently paused)
  const campaigns = await prisma.campaign.findMany({
    where: {
      campaignType: "broadcast",
      OR: [
        { isActive: true },
        { totalSent: { gt: 0 } }, // Include inactive campaigns that have sent emails
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const alerts: string[] = [];
  const campaignStats: CampaignDailyStats[] = [];
  const totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 };

  for (const camp of campaigns) {
    // Count emails sent today for this campaign
    const [sentToday, deliveredToday, openedToday, clickedToday, bouncedToday, complainedToday, failedToday] =
      await Promise.all([
        prisma.sentEmail.count({ where: { campaignId: camp.id, sentAt: { gte: startOfDay }, status: { not: "draft" } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, deliveredAt: { gte: startOfDay } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, firstOpenedAt: { gte: startOfDay } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, firstClickedAt: { gte: startOfDay } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, bouncedAt: { gte: startOfDay } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, complainedAt: { gte: startOfDay } } }),
        prisma.sentEmail.count({ where: { campaignId: camp.id, status: "failed", sentAt: { gte: startOfDay } } }),
      ]);

    // Calculate daily limit from warmup schedule
    const schedule = (camp.warmupSchedule as number[]) ?? [5, 10, 20, 40, 75, 150, 300, 500];
    const dailyLimit = schedule[Math.min(camp.currentWarmupDay, schedule.length - 1)] ?? 50;

    // Count total eligible remaining
    const totalEnrolled = await prisma.enrollment.count({ where: { campaignId: camp.id } });
    const totalEligible = Math.max(0, camp.totalSent > 0 ? (camp.totalSent + (camp.totalEnrolled - totalEnrolled)) : 0);

    // Progress
    const totalTarget = totalEnrolled + totalEligible;
    const progressPct = totalTarget > 0 ? Math.round((totalEnrolled / totalTarget) * 100) : 0;

    // Alerts
    if (camp.totalSent > 10) {
      const bounceRate = camp.totalBounced / camp.totalSent;
      const complaintRate = camp.totalComplained / camp.totalSent;
      if (bounceRate > 0.03) alerts.push(`Bounce rate elevee sur "${camp.name}": ${(bounceRate * 100).toFixed(1)}%`);
      if (complaintRate > 0.001) alerts.push(`Plaintes sur "${camp.name}": ${(complaintRate * 100).toFixed(2)}%`);
      if (!camp.isActive && bounceRate > 0.05) alerts.push(`"${camp.name}" AUTO-PAUSEE (bounce ${(bounceRate * 100).toFixed(1)}% > 5%)`);
    }
    if (failedToday > 0) alerts.push(`${failedToday} email(s) echoue(s) sur "${camp.name}"`);

    campaignStats.push({
      id: camp.id,
      name: camp.name,
      isActive: camp.isActive,
      currentWarmupDay: camp.currentWarmupDay,
      dailyLimit,
      sentToday,
      deliveredToday,
      openedToday,
      clickedToday,
      bouncedToday,
      complainedToday,
      failedToday,
      totalSent: camp.totalSent,
      totalEligible,
      progressPct,
    });

    totals.sent += sentToday;
    totals.delivered += deliveredToday;
    totals.opened += openedToday;
    totals.clicked += clickedToday;
    totals.bounced += bouncedToday;
    totals.complained += complainedToday;
    totals.failed += failedToday;
  }

  return { date: dateStr, campaigns: campaignStats, totals, alerts };
}

// ---------------------------------------------------------------------------
// Format for Telegram
// ---------------------------------------------------------------------------

export function formatDailyBroadcastTelegram(report: DailyBroadcastReport): string {
  const lines: string[] = [];

  lines.push(`📡 <b>Rapport Broadcast — ${report.date}</b>`);
  lines.push("");

  // Alerts first
  if (report.alerts.length > 0) {
    lines.push("🚨 <b>ALERTES</b>");
    for (const alert of report.alerts) {
      lines.push(`  ⚠️ ${alert}`);
    }
    lines.push("");
  }

  // Totals
  if (report.totals.sent > 0 || report.campaigns.some((c) => c.isActive)) {
    lines.push("<b>Totaux du jour :</b>");
    lines.push(`  📤 Envoyes : ${report.totals.sent}`);
    if (report.totals.delivered > 0) lines.push(`  ✅ Delivres : ${report.totals.delivered}`);
    if (report.totals.opened > 0) lines.push(`  👁 Ouverts : ${report.totals.opened}`);
    if (report.totals.clicked > 0) lines.push(`  🖱 Cliques : ${report.totals.clicked}`);
    if (report.totals.bounced > 0) lines.push(`  ❌ Bounces : ${report.totals.bounced}`);
    if (report.totals.complained > 0) lines.push(`  🚫 Plaintes : ${report.totals.complained}`);
    if (report.totals.failed > 0) lines.push(`  💥 Echoues : ${report.totals.failed}`);
    lines.push("");
  }

  // Per-campaign detail
  for (const camp of report.campaigns) {
    const status = camp.isActive ? "🟢" : "⏸";
    lines.push(`${status} <b>${camp.name}</b>`);
    lines.push(`  Warmup J${camp.currentWarmupDay + 1} (${camp.dailyLimit}/jour) | Envoyes: ${camp.sentToday}/${camp.dailyLimit}`);
    lines.push(`  Total: ${camp.totalSent} | Progres: ${camp.progressPct}%`);

    if (camp.bouncedToday > 0 || camp.failedToday > 0) {
      const issues: string[] = [];
      if (camp.bouncedToday > 0) issues.push(`${camp.bouncedToday} bounce`);
      if (camp.failedToday > 0) issues.push(`${camp.failedToday} echec`);
      lines.push(`  ⚠️ ${issues.join(", ")}`);
    }
    lines.push("");
  }

  if (report.campaigns.length === 0) {
    lines.push("<i>Aucune campagne broadcast active.</i>");
  }

  // Trim to Telegram max (4096 chars)
  const result = lines.join("\n");
  return result.length > 4000 ? result.slice(0, 3990) + "\n..." : result;
}
