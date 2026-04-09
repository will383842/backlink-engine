import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("warmup-scheduler");

const DEFAULT_WARMUP_SCHEDULE = [5, 10, 20, 40, 75, 150, 300, 500];

/**
 * Get the daily sending limit for a broadcast campaign based on its warmup schedule.
 */
export async function getBroadcastDailyLimit(campaignId: number): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { warmupSchedule: true, currentWarmupDay: true },
  });

  if (!campaign) return 0;

  const schedule = (campaign.warmupSchedule as number[]) ?? DEFAULT_WARMUP_SCHEDULE;
  const day = campaign.currentWarmupDay;

  // If past the schedule, use the last (max) value
  return schedule[Math.min(day, schedule.length - 1)] ?? schedule[schedule.length - 1] ?? 50;
}

/**
 * Count how many broadcast emails were sent today for a given campaign.
 */
export async function getBroadcastSentToday(campaignId: number): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return prisma.sentEmail.count({
    where: {
      campaignId,
      sentAt: { gte: startOfDay },
      status: { not: "failed" },
    },
  });
}

/**
 * Get remaining sending quota for today.
 */
export async function getBroadcastRemainingToday(campaignId: number): Promise<number> {
  const [limit, sent] = await Promise.all([
    getBroadcastDailyLimit(campaignId),
    getBroadcastSentToday(campaignId),
  ]);
  return Math.max(0, limit - sent);
}

/**
 * Advance the warmup day counter (called once daily by cron).
 * Only advances if at least one email was sent yesterday.
 */
export async function advanceWarmupDay(campaignId: number): Promise<void> {
  const now = new Date();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sentYesterday = await prisma.sentEmail.count({
    where: {
      campaignId,
      sentAt: { gte: startOfYesterday, lt: startOfToday },
      status: { not: "failed" },
    },
  });

  if (sentYesterday > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { currentWarmupDay: { increment: 1 } },
    });
    log.info({ campaignId, sentYesterday }, "Warmup day advanced.");
  }
}

/**
 * Advance warmup for all active broadcast campaigns.
 */
export async function advanceAllWarmups(): Promise<void> {
  const campaigns = await prisma.campaign.findMany({
    where: { campaignType: "broadcast", isActive: true },
    select: { id: true },
  });

  for (const c of campaigns) {
    await advanceWarmupDay(c.id);
  }
}
