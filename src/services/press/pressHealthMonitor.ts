/**
 * Press inbox health monitor — 2026-04-22
 *
 * Safety layer that complements the warmup scheduler.  Runs hourly via
 * cron and inspects each of the 5 presse@* inboxes independently.  If
 * any inbox's bounce rate or complaint rate on recent sends exceeds a
 * conservative threshold, we:
 *   1. Pause that inbox (add to AppSetting["press_paused_inboxes"]).
 *   2. Fire a Telegram alert on the admin press chat.
 *
 * Paused inboxes are skipped by pickInboxForContact().  A full pause of
 * the whole campaign happens if 3+ inboxes are unhealthy at once.
 *
 * Thresholds are INTENTIONALLY more conservative than broadcastManager's
 * 5% bounce / 0.1% complaint — press cold outreach is higher-risk
 * because the recipient list is scraped, and the 5 domains are fresher.
 */
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { sendTelegramMessage } from "../notifications/telegramService.js";

const log = createChildLogger("press-health");

export const PRESS_PAUSED_INBOXES_KEY = "press_paused_inboxes";
export const PRESS_GLOBAL_PAUSED_KEY = "press_outreach_paused";

// Tighter than broadcastManager — press outreach is cold + scraped list
export const PRESS_BOUNCE_THRESHOLD = 0.03; // 3%
export const PRESS_COMPLAINT_THRESHOLD = 0.001; // 0.1%
export const MIN_SENDS_FOR_EVAL = 5; // don't judge until we have signal

const TRACKED_INBOXES = [
  "presse@hub-travelers.com",
  "presse@plane-liberty.com",
  "presse@planevilain.com",
  "presse@emilia-mullerd.com",
  "presse@providers-expat.com",
];

// ---------------------------------------------------------------------------
// Paused-inbox list helpers
// ---------------------------------------------------------------------------

export async function getPausedInboxes(): Promise<string[]> {
  const setting = await prisma.appSetting.findUnique({ where: { key: PRESS_PAUSED_INBOXES_KEY } });
  const value = setting?.value as { inboxes?: string[] } | undefined;
  return Array.isArray(value?.inboxes) ? value!.inboxes! : [];
}

export async function pauseInbox(inbox: string, reason: string): Promise<void> {
  const current = new Set(await getPausedInboxes());
  if (current.has(inbox)) return;
  current.add(inbox);
  await prisma.appSetting.upsert({
    where: { key: PRESS_PAUSED_INBOXES_KEY },
    create: { key: PRESS_PAUSED_INBOXES_KEY, value: { inboxes: Array.from(current), reasons: { [inbox]: reason } } },
    update: { value: { inboxes: Array.from(current), reasons: { [inbox]: reason } } },
  });
  log.warn({ inbox, reason }, "Press inbox paused");
}

export async function resumeInbox(inbox: string): Promise<void> {
  const current = new Set(await getPausedInboxes());
  if (!current.has(inbox)) return;
  current.delete(inbox);
  await prisma.appSetting.upsert({
    where: { key: PRESS_PAUSED_INBOXES_KEY },
    create: { key: PRESS_PAUSED_INBOXES_KEY, value: { inboxes: Array.from(current) } },
    update: { value: { inboxes: Array.from(current) } },
  });
  log.info({ inbox }, "Press inbox resumed");
}

// ---------------------------------------------------------------------------
// Global press-outreach pause (kill switch)
// ---------------------------------------------------------------------------

export async function isPressGloballyPaused(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: PRESS_GLOBAL_PAUSED_KEY } });
  return Boolean((setting?.value as { paused?: boolean } | undefined)?.paused);
}

export async function setPressGlobalPause(paused: boolean, reason?: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PRESS_GLOBAL_PAUSED_KEY },
    create: { key: PRESS_GLOBAL_PAUSED_KEY, value: { paused, reason: reason ?? null, updatedAt: new Date().toISOString() } },
    update: { value: { paused, reason: reason ?? null, updatedAt: new Date().toISOString() } },
  });
  log.warn({ paused, reason }, "Press outreach global pause state changed");
}

// ---------------------------------------------------------------------------
// Per-inbox stats via sent_emails (fromEmail = inbox, status, bounceType)
// ---------------------------------------------------------------------------

export interface InboxHealthReport {
  inbox: string;
  sent: number;
  bounced: number;
  complained: number;
  bounceRate: number;
  complaintRate: number;
  healthy: boolean;
  paused: boolean;
  reasons: string[];
}

export async function getInboxHealth(inbox: string, sinceHours = 24): Promise<InboxHealthReport> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const paused = (await getPausedInboxes()).includes(inbox);

  const [sent, bounced, complained] = await Promise.all([
    prisma.sentEmail.count({ where: { fromEmail: inbox, sentAt: { gte: since } } }),
    prisma.sentEmail.count({ where: { fromEmail: inbox, sentAt: { gte: since }, status: "bounced" } }),
    prisma.sentEmail.count({ where: { fromEmail: inbox, sentAt: { gte: since }, complainedAt: { not: null } } }),
  ]);

  const bounceRate = sent > 0 ? bounced / sent : 0;
  const complaintRate = sent > 0 ? complained / sent : 0;
  const reasons: string[] = [];

  if (sent >= MIN_SENDS_FOR_EVAL) {
    if (bounceRate > PRESS_BOUNCE_THRESHOLD) reasons.push(`bounce_rate_${(bounceRate * 100).toFixed(1)}%`);
    if (complaintRate > PRESS_COMPLAINT_THRESHOLD) reasons.push(`complaint_rate_${(complaintRate * 100).toFixed(2)}%`);
  }

  const healthy = reasons.length === 0;
  return { inbox, sent, bounced, complained, bounceRate, complaintRate, healthy, paused, reasons };
}

export async function getAllInboxesHealth(sinceHours = 24): Promise<InboxHealthReport[]> {
  return Promise.all(TRACKED_INBOXES.map((inbox) => getInboxHealth(inbox, sinceHours)));
}

// ---------------------------------------------------------------------------
// Main check — called by hourly cron
// ---------------------------------------------------------------------------

export async function runPressHealthCheck(): Promise<{
  paused: string[];
  unhealthy: string[];
  globalPaused: boolean;
  reports: InboxHealthReport[];
}> {
  const reports = await getAllInboxesHealth(24);
  const newlyPaused: string[] = [];
  const unhealthy = reports.filter((r) => !r.healthy).map((r) => r.inbox);

  for (const report of reports) {
    if (!report.healthy && !report.paused) {
      await pauseInbox(report.inbox, report.reasons.join(", "));
      newlyPaused.push(report.inbox);
      await notifyPressInboxAlert(report);
    }
  }

  // Global kill switch: if 3+ of 5 inboxes are unhealthy, pause the
  // campaign entirely to avoid compounding the reputation damage.
  const globalShouldPause = unhealthy.length >= 3;
  const alreadyGlobal = await isPressGloballyPaused();

  if (globalShouldPause && !alreadyGlobal) {
    await setPressGlobalPause(true, `${unhealthy.length}/5 inboxes unhealthy`);
    await notifyPressGlobalPause(unhealthy, reports);
  }

  return { paused: newlyPaused, unhealthy, globalPaused: globalShouldPause, reports };
}

// ---------------------------------------------------------------------------
// Telegram notifications
// ---------------------------------------------------------------------------

async function getTelegramConfig(): Promise<{ botToken: string; chatId: string } | null> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "telegram_notifications" } });
    const cfg = setting?.value as
      | { enabled?: boolean; botToken?: string; chatId?: string; pressChatId?: string }
      | undefined;
    if (!cfg?.enabled || !cfg.botToken) return null;
    const chatId = cfg.pressChatId ?? cfg.chatId ?? process.env.TELEGRAM_PRESS_CHAT_ID ?? "7560535072";
    return { botToken: cfg.botToken, chatId };
  } catch {
    return null;
  }
}

async function notifyPressInboxAlert(report: InboxHealthReport): Promise<void> {
  const cfg = await getTelegramConfig();
  if (!cfg) return;
  const lines = [
    `🚨 <b>Inbox presse pausée</b>`,
    `Inbox: <code>${report.inbox}</code>`,
    `Raisons: ${report.reasons.join(", ")}`,
    `Stats 24h: ${report.sent} envois, ${report.bounced} bounces, ${report.complained} plaintes`,
    `Bounce rate: ${(report.bounceRate * 100).toFixed(2)}%`,
    `Complaint rate: ${(report.complaintRate * 100).toFixed(3)}%`,
    ``,
    `⏸️ Cette inbox ne sera plus sollicitée jusqu'à réactivation manuelle (POST /api/press/inboxes/resume).`,
  ];
  try {
    await sendTelegramMessage(cfg.botToken, cfg.chatId, lines.join("\n"), "HTML");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Telegram alert failed");
  }
}

async function notifyPressGlobalPause(unhealthy: string[], reports: InboxHealthReport[]): Promise<void> {
  const cfg = await getTelegramConfig();
  if (!cfg) return;
  const summary = reports.map((r) => `  • ${r.inbox.split("@")[1]}: ${r.sent}s, ${r.bounced}b (${(r.bounceRate * 100).toFixed(1)}%)`).join("\n");
  const lines = [
    `🆘 <b>CAMPAGNE PRESSE EN PAUSE GLOBALE</b>`,
    ``,
    `${unhealthy.length}/5 inboxes en détresse → pause automatique.`,
    ``,
    `<b>État des 5 inboxes (24h):</b>`,
    summary,
    ``,
    `La campagne reprend manuellement via POST /api/press/resume une fois les causes investiguées.`,
  ];
  try {
    await sendTelegramMessage(cfg.botToken, cfg.chatId, lines.join("\n"), "HTML");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Telegram global-pause alert failed");
  }
}
