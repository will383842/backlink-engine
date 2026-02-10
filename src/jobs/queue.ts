import { Queue } from "bullmq";
import { redis } from "../config/redis.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("queue");

// ---------------------------------------------------------------------------
// Queue names
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  ENRICHMENT: "enrichment",
  OUTREACH: "outreach",
  REPLY: "reply",
  VERIFICATION: "verification",
  REPORTING: "reporting",
} as const;

// ---------------------------------------------------------------------------
// Queue instances (lazily initialised via setupQueues)
// ---------------------------------------------------------------------------

export let enrichmentQueue: Queue;
export let outreachQueue: Queue;
export let replyQueue: Queue;
export let verificationQueue: Queue;
export let reportingQueue: Queue;

// ---------------------------------------------------------------------------
// Common default job options
// ---------------------------------------------------------------------------

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1_000 },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Create all BullMQ queues and bind them to the shared Redis connection.
 * Call once at application startup.
 */
export function setupQueues(): void {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  enrichmentQueue = new Queue(QUEUE_NAMES.ENRICHMENT, {
    connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
    },
  });

  outreachQueue = new Queue(QUEUE_NAMES.OUTREACH, {
    connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 5, // outreach retries are more aggressive
    },
  });

  replyQueue = new Queue(QUEUE_NAMES.REPLY, {
    connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
    },
  });

  verificationQueue = new Queue(QUEUE_NAMES.VERIFICATION, {
    connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 2,
    },
  });

  reportingQueue = new Queue(QUEUE_NAMES.REPORTING, {
    connection,
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 1,
    },
  });

  log.info("All BullMQ queues initialised.");
}

/**
 * Close all queue connections gracefully.
 * Call from your shutdown handler.
 */
export async function closeQueues(): Promise<void> {
  log.info("Closing all BullMQ queues...");
  await Promise.all([
    enrichmentQueue?.close(),
    outreachQueue?.close(),
    replyQueue?.close(),
    verificationQueue?.close(),
    reportingQueue?.close(),
  ]);
  log.info("All BullMQ queues closed.");
}
