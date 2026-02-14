import {
  enrichmentQueue,
  outreachQueue,
  replyQueue,
  verificationQueue,
  reportingQueue,
} from "../queue.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("cron-scheduler");

/**
 * Set up all recurring (cron) jobs using BullMQ's repeatable job feature.
 *
 * Schedule overview:
 *  - Enrichment auto-score:        every 5 minutes (new prospects)
 *  - Auto-enrollment:              every 10 minutes (enroll ready prospects)
 *  - Outreach retry-failed:        every hour
 *  - Reply IMAP check:             every 5 minutes
 *  - Verification check-backlinks: every Sunday at 02:00
 *  - Verification check-link-loss: every Sunday at 03:00
 *  - Reporting daily-stats:        every day at 23:59
 *
 * All cron expressions use UTC.
 * Call this function AFTER setupQueues() has been invoked.
 */
export async function setupCronJobs(): Promise<void> {
  log.info("Setting up cron jobs...");

  // -----------------------------------------------------------------------
  // 1. Enrichment: auto-score new prospects every 5 minutes
  // -----------------------------------------------------------------------
  await enrichmentQueue.upsertJobScheduler(
    "enrichment-auto-score",
    {
      pattern: "*/5 * * * *", // every 5 minutes
    },
    {
      name: "auto-score-new-prospects",
      data: { type: "batch-enrich-new" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: enrichment auto-score (every 5 min).");

  // -----------------------------------------------------------------------
  // 2. Auto-enrollment: enroll ready prospects every 10 minutes
  // -----------------------------------------------------------------------
  await outreachQueue.upsertJobScheduler(
    "auto-enrollment",
    {
      pattern: "*/10 * * * *", // every 10 minutes
    },
    {
      name: "auto-enroll-prospects",
      data: {
        type: "auto-enrollment",
        triggeredAt: new Date().toISOString(),
      },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: auto-enrollment (every 10 min).");

  // -----------------------------------------------------------------------
  // 3. Outreach: retry failed MailWizz calls every hour
  // -----------------------------------------------------------------------
  await outreachQueue.upsertJobScheduler(
    "outreach-retry-failed",
    {
      pattern: "0 * * * *", // every hour at :00
    },
    {
      name: "retry-failed-outreach",
      data: { type: "retry-failed" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: outreach retry-failed (every hour).");

  // -----------------------------------------------------------------------
  // 4. Reply: IMAP check every 5 minutes
  // -----------------------------------------------------------------------
  await replyQueue.upsertJobScheduler(
    "reply-imap-check",
    {
      pattern: "*/5 * * * *", // every 5 minutes
    },
    {
      name: "imap-check",
      data: { type: "imap-check" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: reply IMAP check (every 5 min).");

  // -----------------------------------------------------------------------
  // 5. Verification: check all backlinks every Sunday at 02:00 UTC
  // -----------------------------------------------------------------------
  await verificationQueue.upsertJobScheduler(
    "verification-check-backlinks",
    {
      pattern: "0 2 * * 0", // Sunday 02:00 UTC
    },
    {
      name: "check-backlinks",
      data: { type: "check-backlinks" },
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
  log.info("Scheduled: verification check-backlinks (Sunday 02:00 UTC).");

  // -----------------------------------------------------------------------
  // 6. Verification: check for link loss every Sunday at 03:00 UTC
  // -----------------------------------------------------------------------
  await verificationQueue.upsertJobScheduler(
    "verification-check-link-loss",
    {
      pattern: "0 3 * * 0", // Sunday 03:00 UTC
    },
    {
      name: "check-link-loss",
      data: { type: "check-link-loss" },
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
  log.info("Scheduled: verification check-link-loss (Sunday 03:00 UTC).");

  // -----------------------------------------------------------------------
  // 7. Reporting: daily stats every day at 23:59 UTC
  // -----------------------------------------------------------------------
  await reportingQueue.upsertJobScheduler(
    "reporting-daily-stats",
    {
      pattern: "59 23 * * *", // every day at 23:59 UTC
    },
    {
      name: "daily-stats",
      data: { type: "daily-stats" },
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 60 },
      },
    }
  );
  log.info("Scheduled: reporting daily-stats (daily 23:59 UTC).");

  log.info("All cron jobs scheduled successfully.");
}
