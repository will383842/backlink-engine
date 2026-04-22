import {
  enrichmentQueue,
  outreachQueue,
  autoEnrollmentQueue,
  replyQueue,
  verificationQueue,
  reportingQueue,
  sequenceQueue,
  crawlingQueue,
  broadcastQueue,
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
 *  - Reporting weekly-stats:       every Sunday at 20:00 (+ Telegram notification)
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
      pattern: "*/2 * * * *", // every 2 minutes (accelerated)
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
  log.info("Scheduled: enrichment auto-score (every 2 min).");

  // -----------------------------------------------------------------------
  // 2. Auto-enrollment: enroll ready prospects every 10 minutes
  // -----------------------------------------------------------------------
  await autoEnrollmentQueue.upsertJobScheduler(
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

  // -----------------------------------------------------------------------
  // 8. Sequence: advance follow-up emails every 10 minutes
  // -----------------------------------------------------------------------
  await sequenceQueue.upsertJobScheduler(
    "sequence-advance",
    {
      pattern: "*/10 * * * *", // every 10 minutes
    },
    {
      name: "advance-sequence",
      data: { type: "advance-sequence" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: sequence advance (every 10 min).");

  // -----------------------------------------------------------------------
  // 9. Crawling: crawl all active sources daily at 02:00 UTC
  // -----------------------------------------------------------------------
  await crawlingQueue.upsertJobScheduler(
    "crawling-daily",
    {
      pattern: "0 2 * * *", // daily at 02:00 UTC
    },
    {
      name: "crawl-all-sources",
      data: { type: "crawl-all" },
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 60 },
      },
    }
  );
  log.info("Scheduled: crawling daily (02:00 UTC).");

  // -----------------------------------------------------------------------
  // 10. Weekly report: every Sunday at 20:00 UTC
  // -----------------------------------------------------------------------
  await reportingQueue.upsertJobScheduler(
    "reporting-weekly",
    {
      pattern: "0 20 * * 0", // Sunday 20:00 UTC
    },
    {
      name: "weekly-report",
      data: { type: "weekly-stats" },
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
  log.info("Scheduled: weekly report (Sunday 20:00 UTC).");

  // -----------------------------------------------------------------------
  // 11. Broadcast: process active campaigns every 10 minutes
  // -----------------------------------------------------------------------
  await broadcastQueue.upsertJobScheduler(
    "broadcast-process",
    {
      pattern: "*/10 * * * *", // every 10 minutes
    },
    {
      name: "process-broadcast",
      data: { type: "process-broadcast" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: broadcast processing (every 10 min).");

  // -----------------------------------------------------------------------
  // 12. Broadcast sequence: advance enrollments through multi-step sequences
  // -----------------------------------------------------------------------
  await broadcastQueue.upsertJobScheduler(
    "broadcast-sequence-advance",
    {
      pattern: "*/10 * * * *", // every 10 minutes
    },
    {
      name: "advance-broadcast-sequence",
      data: { type: "advance-broadcast-sequence" },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }
  );
  log.info("Scheduled: broadcast sequence advance (every 10 min).");

  // -----------------------------------------------------------------------
  // 13. Broadcast warmup: advance warmup day at 00:05 UTC daily (was #12)
  // -----------------------------------------------------------------------
  await broadcastQueue.upsertJobScheduler(
    "broadcast-warmup-advance",
    {
      pattern: "5 0 * * *", // daily at 00:05 UTC
    },
    {
      name: "advance-warmup",
      data: { type: "advance-warmup" },
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    }
  );
  log.info("Scheduled: broadcast warmup advance (daily 00:05 UTC).");

  // -----------------------------------------------------------------------
  // Press inbox health check — every hour at :15
  // Checks bounce/complaint rate per presse@* inbox, auto-pauses any
  // that crosses the threshold (3% bounce / 0.1% complaint on 24h).
  // Global pause triggered if 3+ inboxes unhealthy at once.
  // -----------------------------------------------------------------------
  await broadcastQueue.upsertJobScheduler(
    "press-health-check",
    {
      pattern: "15 * * * *", // every hour at :15
    },
    {
      name: "press-health-check",
      data: { type: "press-health-check" },
      opts: {
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 48 },
      },
    }
  );
  log.info("Scheduled: press inbox health check (hourly at :15).");

  // -----------------------------------------------------------------------
  // Press daily digest — every day at 20:00 UTC
  // Pushes Telegram summary: sent today / cumul / bounces / replies /
  // next-day cap + per-inbox status lines.
  // -----------------------------------------------------------------------
  await broadcastQueue.upsertJobScheduler(
    "press-daily-digest",
    {
      pattern: "0 20 * * *", // every day at 20:00 UTC
    },
    {
      name: "press-daily-digest",
      data: { type: "press-daily-digest" },
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    }
  );
  log.info("Scheduled: press daily digest (20:00 UTC).");

  // -----------------------------------------------------------------------
  // 14. Daily broadcast report: every day at 21:00 UTC
  // -----------------------------------------------------------------------
  await reportingQueue.upsertJobScheduler(
    "reporting-daily-broadcast",
    {
      pattern: "0 21 * * *", // daily at 21:00 UTC
    },
    {
      name: "daily-broadcast-report",
      data: { type: "daily-broadcast-report" },
      opts: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    }
  );
  log.info("Scheduled: daily broadcast report (21:00 UTC).");

  log.info("All cron jobs scheduled successfully.");
}
