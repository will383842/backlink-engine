// ---------------------------------------------------------------------------
// Per-worker automation toggles
// ---------------------------------------------------------------------------
//
// Stores enable/disable flags for each BullMQ worker in AppSetting under the
// key `automation.workers`. Workers call isWorkerEnabled() at the start of
// each scheduled job; if disabled, the job no-ops (logs and returns).
//
// Cache: 30 seconds in-memory — cheap, and the UI toggle is near-instant in
// practice because schedulers fire at minute granularity.
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("automation-toggles");

export const WORKER_NAMES = [
  "enrichment",
  "autoEnrollment",
  "outreach",
  "reply",
  "verification",
  "reporting",
  "sequence",
  "crawling",
  "broadcast",
] as const;

export type WorkerName = (typeof WORKER_NAMES)[number];

export type WorkerToggles = Record<WorkerName, boolean>;

const SETTING_KEY = "automation.workers";
const CACHE_TTL_MS = 30_000;

let cache: { value: WorkerToggles; fetchedAt: number } | null = null;

function defaultToggles(): WorkerToggles {
  return {
    enrichment: true,
    autoEnrollment: true,
    outreach: true,
    reply: true,
    verification: true,
    reporting: true,
    sequence: true,
    crawling: true,
    broadcast: true,
  };
}

function mergeWithDefaults(raw: unknown): WorkerToggles {
  const defaults = defaultToggles();
  if (!raw || typeof raw !== "object") return defaults;
  const partial = raw as Partial<Record<WorkerName, unknown>>;
  const merged = { ...defaults };
  for (const name of WORKER_NAMES) {
    const value = partial[name];
    if (typeof value === "boolean") merged[name] = value;
  }
  return merged;
}

export async function getWorkerToggles(forceRefresh = false): Promise<WorkerToggles> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  const toggles = mergeWithDefaults(row?.value);
  cache = { value: toggles, fetchedAt: Date.now() };
  return toggles;
}

export async function isWorkerEnabled(name: WorkerName): Promise<boolean> {
  const toggles = await getWorkerToggles();
  return toggles[name] !== false;
}

export async function setWorkerEnabled(name: WorkerName, enabled: boolean): Promise<WorkerToggles> {
  const current = await getWorkerToggles(true);
  const next = { ...current, [name]: enabled };

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: next as unknown as import("@prisma/client").Prisma.InputJsonValue },
    update: { value: next as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });

  cache = { value: next, fetchedAt: Date.now() };
  log.info({ worker: name, enabled }, "Worker toggle updated.");
  return next;
}

export async function setAllWorkers(enabled: boolean): Promise<WorkerToggles> {
  const next: WorkerToggles = {
    enrichment: enabled,
    autoEnrollment: enabled,
    outreach: enabled,
    reply: enabled,
    verification: enabled,
    reporting: enabled,
    sequence: enabled,
    crawling: enabled,
    broadcast: enabled,
  };

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: next as unknown as import("@prisma/client").Prisma.InputJsonValue },
    update: { value: next as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });

  cache = { value: next, fetchedAt: Date.now() };
  log.info({ enabled }, "All worker toggles updated.");
  return next;
}
