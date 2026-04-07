// ---------------------------------------------------------------------------
// Reply Worker - Process incoming email replies via IMAP
// ---------------------------------------------------------------------------

import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { checkForReplies, processReply } from "../../services/outreach/imapMonitor.js";

const log = createChildLogger("reply-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface ImapCheckJobData {
  type: "imap-check";
}

type ReplyJobData = ImapCheckJobData;

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processReplyJob(job: Job<ReplyJobData>): Promise<void> {
  const { type } = job.data;

  if (type !== "imap-check") {
    log.warn({ type, jobId: job.id }, "Unknown reply job type, skipping.");
    return;
  }

  log.info({ jobId: job.id }, "Starting IMAP reply check.");

  const replies = await checkForReplies();

  if (replies.length === 0) {
    log.debug("No new replies found.");
    await job.updateProgress(100);
    return;
  }

  log.info({ count: replies.length }, "Found new replies to process.");

  for (let i = 0; i < replies.length; i++) {
    try {
      await processReply(replies[i]!);
    } catch (err) {
      log.error({ err, from: replies[i]?.from }, "Failed to process reply.");
    }
    await job.updateProgress(Math.round(((i + 1) / replies.length) * 100));
  }

  log.info({ processed: replies.length }, "IMAP reply check complete.");
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<ReplyJobData> | null = null;

/**
 * Start the reply BullMQ worker.
 * Processes 'imap-check' jobs that poll the IMAP inbox for incoming replies.
 */
export function startReplyWorker(): Worker<ReplyJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<ReplyJobData>(
    QUEUE_NAMES.REPLY,
    processReplyJob,
    {
      connection,
      concurrency: 1, // only one IMAP check at a time
    },
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Reply job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Reply job failed.");
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Reply worker error.");
  });

  log.info("Reply worker started.");
  return worker;
}
