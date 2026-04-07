// ---------------------------------------------------------------------------
// Crawl Rate Limiter - Conservative single-IP protection
// ---------------------------------------------------------------------------
//
// IMPORTANT: This engine runs on a single IP (Hetzner VPS) shared with
// sos-expat.com services. Rate limits MUST be very conservative to avoid
// IP bans that would affect the main business.
//
// Strategy:
//   - Per-domain limiting: max 1 req per DOMAIN_COOLDOWN_SEC (default: 10s)
//   - Global limiting: max GLOBAL_MAX_PER_MINUTE requests total (default: 6/min)
//   - Random jitter: 2-5 seconds added between each request
//   - Respectful: stop immediately on 429/403, backoff for 1 hour per domain
// ---------------------------------------------------------------------------

import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("rate-limiter");

/** Seconds between requests to the SAME domain */
const DOMAIN_COOLDOWN_SEC = parseInt(process.env["CRAWL_DOMAIN_COOLDOWN"] ?? "10", 10);

/** Max requests per minute GLOBALLY (across all domains) */
const GLOBAL_MAX_PER_MINUTE = parseInt(process.env["CRAWL_GLOBAL_MAX_PER_MIN"] ?? "6", 10);

/** How long to block a domain after a 429/403 (seconds) */
const BLOCK_DURATION_SEC = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Domain blocking (when we receive 429 or 403)
// ---------------------------------------------------------------------------

/**
 * Block a domain for BLOCK_DURATION_SEC after receiving a ban signal (403/429).
 */
export async function blockDomain(domain: string): Promise<void> {
  try {
    await redis.set(`crawl:blocked:${domain}`, "1", "EX", BLOCK_DURATION_SEC);
    log.warn({ domain, blockDurationSec: BLOCK_DURATION_SEC }, "Domain blocked after ban signal.");
  } catch {
    // Redis down — can't block, proceed with caution
  }
}

/**
 * Check if a domain is currently blocked.
 */
export async function isDomainBlocked(domain: string): Promise<boolean> {
  try {
    return (await redis.exists(`crawl:blocked:${domain}`)) === 1;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Per-domain rate limiting
// ---------------------------------------------------------------------------

/**
 * Check if we can make a request to this domain (respects cooldown).
 */
async function canRequestDomain(domain: string): Promise<boolean> {
  try {
    const key = `crawl:domain:${domain}`;
    const isNew = await redis.set(key, "1", "EX", DOMAIN_COOLDOWN_SEC, "NX");
    return !!isNew;
  } catch {
    return true; // Fail open
  }
}

// ---------------------------------------------------------------------------
// Global rate limiting
// ---------------------------------------------------------------------------

/**
 * Check global rate limit (max N requests per minute across ALL domains).
 */
async function canRequestGlobal(): Promise<boolean> {
  try {
    const key = "crawl:global:minute";
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);
    }
    return current <= GLOBAL_MAX_PER_MINUTE;
  } catch {
    return true; // Fail open
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wait until rate limits allow a request to the given domain.
 * Adds random jitter (2-5s) between requests to appear human.
 *
 * @param sourceKey - Domain or source identifier
 * @returns true if allowed, false if domain is blocked (should skip)
 */
export async function waitForRateLimit(
  sourceKey: string,
): Promise<boolean> {
  // Check if domain is blocked (429/403 received earlier)
  if (await isDomainBlocked(sourceKey)) {
    log.debug({ sourceKey }, "Domain is blocked, skipping.");
    return false;
  }

  let attempts = 0;
  const maxAttempts = 60; // max ~2 minutes wait

  while (attempts < maxAttempts) {
    const domainOk = await canRequestDomain(sourceKey);
    const globalOk = await canRequestGlobal();

    if (domainOk && globalOk) {
      // Add random jitter to appear human (2-5 seconds)
      const jitter = 2000 + Math.random() * 3000;
      await new Promise((resolve) => setTimeout(resolve, jitter));
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }

  log.warn({ sourceKey }, "Rate limit wait timeout, skipping request.");
  return false;
}

/**
 * Legacy compatibility: simple rate limit check (returns void, always waits).
 * @deprecated Use waitForRateLimit() which returns boolean (false = blocked domain).
 */
export async function acquireRateLimit(
  sourceKey: string,
): Promise<boolean> {
  return waitForRateLimit(sourceKey);
}
