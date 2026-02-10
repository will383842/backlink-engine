import Redis from "ioredis";
import { logger } from "../utils/logger.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * ioredis singleton shared across the application.
 * Used by BullMQ workers/queues and any caching layer.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: true,
  retryStrategy(times: number): number | null {
    if (times > 20) {
      logger.error("Redis: max reconnection attempts reached, giving up.");
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 5_000);
    logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})...`);
    return delay;
  },
});

// ---- Connection events ---------------------------------------------------

redis.on("connect", () => {
  logger.info("Redis: connection established.");
});

redis.on("ready", () => {
  logger.info("Redis: ready to accept commands.");
});

redis.on("error", (err: Error) => {
  logger.error({ err }, "Redis: connection error.");
});

redis.on("close", () => {
  logger.warn("Redis: connection closed.");
});

redis.on("reconnecting", () => {
  logger.info("Redis: reconnecting...");
});

// ---- Helpers -------------------------------------------------------------

/**
 * Gracefully disconnect from Redis.
 * Call this from your main shutdown handler.
 */
export async function disconnectRedis(): Promise<void> {
  logger.info("Disconnecting Redis client...");
  await redis.quit();
  logger.info("Redis client disconnected.");
}

/**
 * Create a duplicate connection (e.g. for BullMQ subscriber).
 * BullMQ requires separate connections for workers.
 */
export function createRedisConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
