import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("isp-throttler");

// ---------------------------------------------------------------------------
// ISP rate limits (emails per minute)
// ---------------------------------------------------------------------------

const ISP_LIMITS: Record<string, number> = {
  // Google
  "gmail.com": 25,
  "googlemail.com": 25,
  // Microsoft
  "outlook.com": 20,
  "hotmail.com": 20,
  "live.com": 20,
  "msn.com": 20,
  // Yahoo
  "yahoo.com": 10,
  "yahoo.fr": 10,
  "yahoo.co.uk": 10,
  "ymail.com": 10,
  // Apple
  "icloud.com": 15,
  "me.com": 15,
  "mac.com": 15,
  // French ISPs
  "orange.fr": 20,
  "wanadoo.fr": 20,
  "free.fr": 20,
  "sfr.fr": 20,
  "laposte.net": 20,
  // Default for unknown
  "_default": 30,
};

const THROTTLE_WINDOW = 60; // 1 minute window

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the ISP domain from an email address.
 */
function getIspDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "_default";
}

/**
 * Get the Redis key for an ISP's rate limit counter.
 */
function redisKey(ispDomain: string): string {
  return `isp:throttle:${ispDomain}`;
}

/**
 * Check if we can send an email to this ISP right now.
 * Returns true if under the rate limit.
 */
export async function canSendToIsp(email: string): Promise<boolean> {
  const isp = getIspDomain(email);
  const limit = ISP_LIMITS[isp] ?? ISP_LIMITS["_default"];

  try {
    const current = await redis.get(redisKey(isp));
    const count = current ? parseInt(current, 10) : 0;
    return count < limit;
  } catch {
    // Redis error — allow (fail open)
    return true;
  }
}

/**
 * Record that an email was sent to this ISP.
 * Call this AFTER successful send.
 */
export async function recordSendToIsp(email: string): Promise<void> {
  const isp = getIspDomain(email);
  const key = redisKey(isp);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, THROTTLE_WINDOW);
    }
    log.debug({ isp, count }, "ISP send recorded.");
  } catch {
    // Redis error — ignore
  }
}

/**
 * Get current throttle status for an ISP (for monitoring).
 */
export async function getIspThrottleStatus(email: string): Promise<{ isp: string; current: number; limit: number; canSend: boolean }> {
  const isp = getIspDomain(email);
  const limit = ISP_LIMITS[isp] ?? ISP_LIMITS["_default"];

  try {
    const current = parseInt(await redis.get(redisKey(isp)) ?? "0", 10);
    return { isp, current, limit, canSend: current < limit };
  } catch {
    return { isp, current: 0, limit, canSend: true };
  }
}
