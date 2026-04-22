/**
 * Press-outreach warmup scheduler — 2026-04-22
 *
 * Mirrors `src/services/broadcast/warmupScheduler.ts` but for the press
 * campaign.  Rather than binding to a Campaign row (press-outreach has no
 * Campaign record), state is stored in a single AppSetting row:
 *
 *   key:   "press_warmup"
 *   value: {
 *     currentDay: number,        // 0 on first launch, advanced daily
 *     schedule: number[],        // daily caps, TOTAL across 5 inboxes
 *     lastAdvancedAt: string,    // ISO date of last advance
 *     perInboxCap?: number,      // soft cap per inbox (optional)
 *   }
 *
 * Daily schedule (conservative — fits warmup state of the 5 presse@*
 * inboxes where Mailflow has only been active ~2 weeks):
 *   Day 1: 25   (5/inbox)
 *   Day 2: 50   (10/inbox)
 *   Day 3: 100  (20/inbox)
 *   Day 4: 150  (30/inbox)
 *   Day 5: 200  (40/inbox)
 *   Day 6+: 250 (50/inbox — steady-state cap)
 *
 * This means a 651-contact campaign takes ~6 days to clear safely.
 */
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("press-warmup");

export const PRESS_WARMUP_KEY = "press_warmup";

// Ultra-conservative schedule (2026-04-22).  The 5 presse@* inboxes have
// only been in Mailflow auto-warmup since 2026-04-17 — too fresh for an
// aggressive ramp.  This 13-step schedule takes a 651-contact campaign
// over ~10 days instead of the previous 6.  Each inbox tops out at 50
// cold sends/day — under half of industry-safe reputable-warm maxima.
//
// Day 1:  5    (1/inbox)
// Day 2:  10   (2/inbox)
// Day 3:  15   (3/inbox)
// Day 4:  25   (5/inbox)
// Day 5:  40   (8/inbox)
// Day 6:  60   (12/inbox)
// Day 7:  80   (16/inbox)
// Day 8:  100  (20/inbox)
// Day 9:  125  (25/inbox)
// Day 10: 150  (30/inbox)
// Day 11: 175  (35/inbox)
// Day 12: 200  (40/inbox)
// Day 13+: 250 (50/inbox — steady state)
export const DEFAULT_PRESS_WARMUP_SCHEDULE = [5, 10, 15, 25, 40, 60, 80, 100, 125, 150, 175, 200, 250];
export const DEFAULT_PRESS_PER_INBOX_CAP = 50;

interface PressWarmupState {
  currentDay: number;
  schedule: number[];
  lastAdvancedAt: string;
  perInboxCap: number;
}

// ---------------------------------------------------------------------------
// State load / save
// ---------------------------------------------------------------------------

export async function getPressWarmupState(): Promise<PressWarmupState> {
  const setting = await prisma.appSetting.findUnique({ where: { key: PRESS_WARMUP_KEY } });
  const raw = (setting?.value ?? {}) as Partial<PressWarmupState>;
  return {
    currentDay: typeof raw.currentDay === "number" ? raw.currentDay : 0,
    schedule: Array.isArray(raw.schedule) ? raw.schedule : DEFAULT_PRESS_WARMUP_SCHEDULE,
    lastAdvancedAt: typeof raw.lastAdvancedAt === "string" ? raw.lastAdvancedAt : new Date(0).toISOString(),
    perInboxCap: typeof raw.perInboxCap === "number" ? raw.perInboxCap : DEFAULT_PRESS_PER_INBOX_CAP,
  };
}

async function savePressWarmupState(state: PressWarmupState): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PRESS_WARMUP_KEY },
    create: { key: PRESS_WARMUP_KEY, value: state as unknown as object },
    update: { value: state as unknown as object },
  });
}

// ---------------------------------------------------------------------------
// Daily cap resolution
// ---------------------------------------------------------------------------

export function getDailyCapForDay(state: PressWarmupState, day: number): number {
  const idx = Math.min(day, state.schedule.length - 1);
  return state.schedule[idx] ?? state.schedule[state.schedule.length - 1] ?? 50;
}

export async function getPressDailyCap(): Promise<number> {
  const state = await getPressWarmupState();
  return getDailyCapForDay(state, state.currentDay);
}

// ---------------------------------------------------------------------------
// Sent-today counter — counts SENT (and terminal-after-SENT) PressContacts
// whose sentAt is in [startOfUtcDay, now).
// ---------------------------------------------------------------------------

export async function getPressSentToday(): Promise<number> {
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return prisma.pressContact.count({
    where: {
      sentAt: { gte: startUtc },
    },
  });
}

export async function getPressRemainingToday(): Promise<number> {
  const [cap, sent] = await Promise.all([getPressDailyCap(), getPressSentToday()]);
  return Math.max(0, cap - sent);
}

// ---------------------------------------------------------------------------
// Warmup day advance (called daily by cron — hooks into cronScheduler)
// Only advances when at least one email was sent yesterday (otherwise pause
// = no warmup progress — classic IP-warming rule).
// ---------------------------------------------------------------------------

export async function advancePressWarmupDay(): Promise<{ advanced: boolean; newDay: number }> {
  const state = await getPressWarmupState();
  const now = new Date();
  const startYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const sentYesterday = await prisma.pressContact.count({
    where: {
      sentAt: { gte: startYesterday, lt: startToday },
    },
  });

  if (sentYesterday === 0) {
    log.debug({ currentDay: state.currentDay }, "No press emails sent yesterday, not advancing warmup day");
    return { advanced: false, newDay: state.currentDay };
  }

  // Don't overflow — stay at the last entry (steady-state cap)
  const newDay = Math.min(state.currentDay + 1, state.schedule.length - 1);
  await savePressWarmupState({ ...state, currentDay: newDay, lastAdvancedAt: now.toISOString() });
  log.info({ previousDay: state.currentDay, newDay, sentYesterday, newCap: getDailyCapForDay(state, newDay) }, "Press warmup day advanced");
  return { advanced: true, newDay };
}

// ---------------------------------------------------------------------------
// Scheduling helper — given N contacts, return an array of delay-ms per
// contact that respects the warmup schedule.  Includes a small random
// jitter (±2 min) to avoid pattern detection.  Spreads each day's batch
// evenly across a 12-hour business window (08:00-20:00 UTC) to look human.
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  index: number;
  day: number;
  delayMs: number;
}

export async function buildPressSchedule(numContacts: number): Promise<{
  entries: ScheduleEntry[];
  daysNeeded: number;
  daysBreakdown: Array<{ day: number; cap: number; willSend: number }>;
}> {
  const state = await getPressWarmupState();
  const entries: ScheduleEntry[] = [];
  const daysBreakdown: Array<{ day: number; cap: number; willSend: number }> = [];

  let remainingTodayCap = await getPressRemainingToday();
  let index = 0;
  let dayOffset = 0;
  const BUSINESS_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h window per day
  const JITTER_MS = 2 * 60 * 1000; // ±2 min

  while (index < numContacts) {
    const effectiveDay = state.currentDay + dayOffset;
    const cap = dayOffset === 0 ? remainingTodayCap : getDailyCapForDay(state, effectiveDay);
    const willSend = Math.min(cap, numContacts - index);
    daysBreakdown.push({ day: effectiveDay, cap, willSend });

    if (willSend === 0) {
      // Day fully consumed — skip to tomorrow
      dayOffset++;
      remainingTodayCap = 0;
      continue;
    }

    // Distribute evenly across business window with jitter
    const stepMs = willSend > 1 ? BUSINESS_WINDOW_MS / (willSend - 1) : 0;
    const dayStartMs = dayOffset * 24 * 60 * 60 * 1000;

    for (let i = 0; i < willSend; i++) {
      const base = dayStartMs + i * stepMs;
      const jitter = (Math.random() - 0.5) * 2 * JITTER_MS;
      entries.push({ index, day: effectiveDay, delayMs: Math.max(0, Math.round(base + jitter)) });
      index++;
    }

    dayOffset++;
  }

  return { entries, daysNeeded: dayOffset, daysBreakdown };
}
