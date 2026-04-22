/**
 * Press campaign daily Telegram digest — 2026-04-22
 *
 * Runs once a day at 20:00 UTC.  Summarizes the day's press-outreach
 * activity and pushes it to the admin press chat so the owner knows
 * the campaign is healthy without having to log into the dashboard.
 */
import { prisma } from "../../config/database.js";
import { PressContactStatus } from "@prisma/client";
import { createChildLogger } from "../../utils/logger.js";
import { sendTelegramMessage } from "../notifications/telegramService.js";
import {
  getPressWarmupState,
  getPressDailyCap,
  getPressSentToday,
} from "./pressWarmup.js";
import {
  getAllInboxesHealth,
  getPausedInboxes,
  isPressGloballyPaused,
} from "./pressHealthMonitor.js";

const log = createChildLogger("press-daily-digest");

async function getTelegramConfig(): Promise<{ botToken: string; chatId: string } | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "telegram_notifications" } });
  const cfg = setting?.value as
    | { enabled?: boolean; botToken?: string; chatId?: string; pressChatId?: string }
    | undefined;
  if (!cfg?.enabled || !cfg.botToken) return null;
  const chatId = cfg.pressChatId ?? cfg.chatId ?? process.env.TELEGRAM_PRESS_CHAT_ID ?? "7560535072";
  return { botToken: cfg.botToken, chatId };
}

export async function sendPressDailyDigest(): Promise<{ sent: boolean; reason?: string }> {
  const cfg = await getTelegramConfig();
  if (!cfg) {
    log.info("Telegram not configured, skipping press daily digest");
    return { sent: false, reason: "no_telegram_config" };
  }

  const [
    warmupState,
    todayCap,
    sentToday,
    pendingTotal,
    sentTotal,
    respondedTotal,
    bouncedTotal,
    skippedTotal,
    inboxHealth,
    pausedInboxes,
    globalPaused,
  ] = await Promise.all([
    getPressWarmupState(),
    getPressDailyCap(),
    getPressSentToday(),
    prisma.pressContact.count({ where: { status: PressContactStatus.PENDING } }),
    prisma.pressContact.count({
      where: {
        status: {
          in: [
            PressContactStatus.SENT,
            PressContactStatus.FOLLOW_UP_1,
            PressContactStatus.FOLLOW_UP_2,
            PressContactStatus.RESPONDED,
            PressContactStatus.PUBLISHED,
          ],
        },
      },
    }),
    prisma.pressContact.count({
      where: {
        status: { in: [PressContactStatus.RESPONDED, PressContactStatus.PUBLISHED] },
      },
    }),
    prisma.pressContact.count({ where: { status: PressContactStatus.BOUNCED } }),
    prisma.pressContact.count({ where: { status: PressContactStatus.SKIPPED } }),
    getAllInboxesHealth(24),
    getPausedInboxes(),
    isPressGloballyPaused(),
  ]);

  const totalContacts = pendingTotal + sentTotal + bouncedTotal + skippedTotal;
  const remainingCampaign = pendingTotal;
  const nextDayCap = warmupState.schedule[Math.min(warmupState.currentDay + 1, warmupState.schedule.length - 1)] ??
    warmupState.schedule[warmupState.schedule.length - 1] ?? 250;

  // Aggregate inbox numbers
  const totalSent24h = inboxHealth.reduce((acc, r) => acc + r.sent, 0);
  const totalBounced24h = inboxHealth.reduce((acc, r) => acc + r.bounced, 0);
  const totalComplained24h = inboxHealth.reduce((acc, r) => acc + r.complained, 0);
  const bounceRate24h = totalSent24h > 0 ? (totalBounced24h / totalSent24h) * 100 : 0;

  // Per-inbox one-liner
  const inboxLines = inboxHealth
    .map((r) => {
      const host = r.inbox.split("@")[1] ?? r.inbox;
      const status = r.paused ? "⏸️" : r.healthy ? "✅" : "⚠️";
      return `  ${status} ${host}: ${r.sent} envois, ${r.bounced} bounces`;
    })
    .join("\n");

  const statusLine = globalPaused
    ? "🆘 <b>CAMPAGNE EN PAUSE GLOBALE</b>"
    : pausedInboxes.length > 0
      ? `⚠️ ${pausedInboxes.length}/5 inboxes en pause`
      : "✅ Toutes inboxes actives";

  const lines = [
    `📊 <b>Campagne presse — Jour ${warmupState.currentDay + 1}/${warmupState.schedule.length}</b>`,
    ``,
    statusLine,
    ``,
    `<b>Aujourd'hui</b>`,
    `  • Envoyés : ${sentToday} / ${todayCap}`,
    `  • Bounces : ${totalBounced24h} (${bounceRate24h.toFixed(2)}%)`,
    `  • Plaintes : ${totalComplained24h}`,
    ``,
    `<b>Cumul campagne</b>`,
    `  • Envoyés au total : ${sentTotal}/${totalContacts}`,
    `  • Réponses reçues : ${respondedTotal} 📬`,
    `  • Bounced : ${bouncedTotal} · Skipped : ${skippedTotal}`,
    `  • Restants à envoyer : ${remainingCampaign}`,
    ``,
    `<b>Inboxes (24h)</b>`,
    inboxLines,
    ``,
    `<b>Demain</b>`,
    `  • Nouveau cap : ${nextDayCap} emails (jour ${warmupState.currentDay + 2})`,
  ];

  try {
    await sendTelegramMessage(cfg.botToken, cfg.chatId, lines.join("\n"), "HTML");
    log.info({ sentToday, sentTotal, respondedTotal }, "Press daily digest sent");
    return { sent: true };
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Press daily digest Telegram failed");
    return { sent: false, reason: (err as Error).message };
  }
}
