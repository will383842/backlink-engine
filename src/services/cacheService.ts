import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

/**
 * Generic cache service for reducing database load.
 * Uses Redis with automatic JSON serialization.
 */

// ─────────────────────────────────────────────────────────────
// Generic cache helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get value from cache, or compute and store it if missing.
 *
 * @param key - Redis cache key
 * @param ttlSeconds - Time-to-live in seconds
 * @param factory - Async function to compute value if cache miss
 * @returns Cached or computed value
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  factory: () => Promise<T>,
): Promise<T> {
  try {
    // Try cache first
    const cached = await redis.get(key);
    if (cached) {
      logger.debug({ key }, "Cache HIT");
      return JSON.parse(cached) as T;
    }

    // Cache miss: compute value
    logger.debug({ key }, "Cache MISS - computing...");
    const value = await factory();

    // Store in cache with TTL
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    logger.debug({ key, ttl: ttlSeconds }, "Cache SET");

    return value;
  } catch (err) {
    // On Redis error, log but continue with direct computation
    logger.warn({ err, key }, "Cache error - falling back to direct computation");
    return factory();
  }
}

/**
 * Invalidate cache keys matching a pattern.
 *
 * @param pattern - Redis key pattern (e.g., "dashboard:*")
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info({ pattern, count: keys.length }, "Cache invalidated");
    }
  } catch (err) {
    logger.error({ err, pattern }, "Failed to invalidate cache");
  }
}

/**
 * Invalidate a single cache key.
 *
 * @param key - Redis cache key
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    await redis.del(key);
    logger.debug({ key }, "Cache key invalidated");
  } catch (err) {
    logger.error({ err, key }, "Failed to invalidate cache key");
  }
}

// ─────────────────────────────────────────────────────────────
// Dashboard-specific cache helpers
// ─────────────────────────────────────────────────────────────

/**
 * Cache key prefixes for dashboard endpoints.
 * TTL: 60 seconds (dashboard refreshes every 10-15s on frontend)
 */
export const DASHBOARD_CACHE = {
  TODAY: "dashboard:today",
  STATS: "dashboard:stats",
  PIPELINE: "dashboard:pipeline",
  TTL: 60, // 1 minute
} as const;

/**
 * Invalidate all dashboard caches.
 * Call this when prospects, events, or backlinks are mutated.
 */
export async function invalidateDashboard(): Promise<void> {
  await invalidatePattern("dashboard:*");
}
