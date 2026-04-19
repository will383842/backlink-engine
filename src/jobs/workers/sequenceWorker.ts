// ---------------------------------------------------------------------------
// Sequence Worker - Advance follow-up email sequences via BullMQ
// ---------------------------------------------------------------------------

import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { advanceEligibleEnrollments } from "../../services/outreach/sequenceAdvancer.js";
import { isWorkerEnabled } from "../../services/automation/automationToggles.js";

const log = createChildLogger("sequence-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface AdvanceSequenceJobData {
  type: "advance-sequence";
}

type SequenceJobData = AdvanceSequenceJobData;

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processSequenceJob(job: Job<SequenceJobData>): Promise<void> {
  if (!(await isWorkerEnabled("sequence"))) {
    log.info({ jobId: job.id }, "sequence worker disabled, skipping job.");
    return;
  }

  const { type } = job.data;

  if (type !== "advance-sequence") {
    log.warn({ type, jobId: job.id }, "Unknown sequence job type, skipping.");
    return;
  }

  log.info({ jobId: job.id }, "Starting sequence advancement cycle.");

  const result = await advanceEligibleEnrollments();

  await job.updateProgress(100);

  log.info(
    {
      jobId: job.id,
      advanced: result.advanced,
      completed: result.completed,
      stopped: result.stopped,
      skipped: result.skipped,
      quotaExhausted: result.quotaExhausted,
    },
    "Sequence advancement cycle complete.",
  );
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<SequenceJobData> | null = null;

/**
 * Start the sequence BullMQ worker.
 * Processes 'advance-sequence' jobs that advance enrollments through
 * their follow-up email sequences.
 */
export function startSequenceWorker(): Worker<SequenceJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<SequenceJobData>(
    QUEUE_NAMES.SEQUENCE,
    processSequenceJob,
    {
      connection,
      concurrency: 1, // only one advancement cycle at a time
      limiter: { max: 1, duration: 60_000 }, // max 1 job per minute
    },
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Sequence job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Sequence job failed.");
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Sequence worker error.");
  });

  log.info("Sequence worker started.");
  return worker;
}
