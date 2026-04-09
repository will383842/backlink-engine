import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("domain-rotator");

const REDIS_KEY = "sending:domain:index";
const SETTINGS_KEY = "sending_domains";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendingDomain {
  domain: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  active: boolean;
}

const REPLY_TO = process.env.REPLY_TO_EMAIL || "replies@life-expat.com";
const FROM_NAME = process.env.FROM_NAME || "SOS Expat";

const DEFAULT_DOMAINS: SendingDomain[] = [
  { domain: "hub-travelers.com", fromEmail: "contact@hub-travelers.com", fromName: FROM_NAME, replyTo: REPLY_TO, active: true },
  { domain: "plane-liberty.com", fromEmail: "contact@plane-liberty.com", fromName: FROM_NAME, replyTo: REPLY_TO, active: true },
  { domain: "providers-expat.com", fromEmail: "contact@providers-expat.com", fromName: FROM_NAME, replyTo: REPLY_TO, active: true },
  { domain: "emilia-mullerd.com", fromEmail: "contact@emilia-mullerd.com", fromName: FROM_NAME, replyTo: REPLY_TO, active: true },
  { domain: "planevilain.com", fromEmail: "contact@planevilain.com", fromName: FROM_NAME, replyTo: REPLY_TO, active: true },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the list of active sending domains.
 */
export async function getSendingDomains(): Promise<SendingDomain[]> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    if (setting?.value) {
      const domains = setting.value as unknown as SendingDomain[];
      return domains.filter((d) => d.active);
    }
  } catch {
    // DB error — use defaults
  }
  return DEFAULT_DOMAINS.filter((d) => d.active);
}

/**
 * Get the next sending domain in round-robin rotation.
 * Uses Redis atomic counter for fairness across workers.
 */
export async function getNextSendingDomain(): Promise<SendingDomain> {
  const domains = await getSendingDomains();

  if (domains.length === 0) {
    // Fallback to first default
    return DEFAULT_DOMAINS[0];
  }

  if (domains.length === 1) {
    return domains[0];
  }

  try {
    const index = await redis.incr(REDIS_KEY);
    // Set TTL on first use (24h)
    if (index === 1) {
      await redis.expire(REDIS_KEY, 86400);
    }
    const selected = domains[(index - 1) % domains.length];
    log.debug({ domain: selected.domain, index }, "Domain selected (round-robin).");
    return selected;
  } catch {
    // Redis error — random fallback
    return domains[Math.floor(Math.random() * domains.length)];
  }
}

/**
 * Disable a domain (e.g., when bounce rate is too high).
 */
export async function disableDomain(domain: string): Promise<void> {
  const domains = await getSendingDomains();
  const updated = domains.map((d) => ({
    ...d,
    active: d.domain === domain ? false : d.active,
  }));

  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: updated as never },
    update: { value: updated as never },
  });

  log.warn({ domain }, "Sending domain disabled due to high bounce rate.");
}
