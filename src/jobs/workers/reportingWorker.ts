import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";

const log = createChildLogger("reporting-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface DailyStatsJobData {
  type: "daily-stats";
  /** Optional ISO date string to generate stats for. Defaults to today. */
  date?: string;
}

type ReportingJobData = DailyStatsJobData;

// ---------------------------------------------------------------------------
// Daily stats shape
// ---------------------------------------------------------------------------

interface DailyStats {
  date: string;
  prospectsAdded: {
    total: number;
    bySource: Record<string, number>;
  };
  emailsSent: number;
  repliesReceived: number;
  backlinksWon: number;
  backlinksLost: number;
  formContacts: number;
  enrichmentsCompleted: number;
  activeEnrollments: number;
}

// ---------------------------------------------------------------------------
// Stats aggregation
// ---------------------------------------------------------------------------

/**
 * Query the database for statistics covering a single day.
 */
async function aggregateDailyStats(date: Date): Promise<DailyStats> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dateRange = { gte: dayStart, lte: dayEnd };

  // Run all queries in parallel for performance
  const [
    prospectsAddedTotal,
    prospectsManual,
    prospectsCsv,
    prospectsScraper,
    emailsSent,
    repliesReceived,
    backlinksWon,
    backlinksLost,
    formContacts,
    enrichmentsCompleted,
    activeEnrollments,
  ] = await Promise.all([
    // Prospects added today (all sources)
    prisma.prospect.count({
      where: { createdAt: dateRange },
    }),

    // Prospects added via manual
    prisma.prospect.count({
      where: { createdAt: dateRange, source: "manual" },
    }),

    // Prospects added via CSV import
    prisma.prospect.count({
      where: { createdAt: dateRange, source: "csv_import" },
    }),

    // Prospects added via scraper
    prisma.prospect.count({
      where: { createdAt: dateRange, source: "scraper" },
    }),

    // Emails sent (events of type email_sent)
    prisma.event.count({
      where: { createdAt: dateRange, eventType: "email_sent" },
    }),

    // Replies received
    prisma.event.count({
      where: { createdAt: dateRange, eventType: "reply_received" },
    }),

    // Backlinks won (new backlinks created today that are live)
    prisma.backlink.count({
      where: { createdAt: dateRange, isLive: true },
    }),

    // Backlinks lost today
    prisma.backlink.count({
      where: { lostAt: dateRange },
    }),

    // Form contacts (events of type contact_form_submitted)
    prisma.event.count({
      where: { createdAt: dateRange, eventType: "contact_form_submitted" },
    }),

    // Enrichments completed
    prisma.event.count({
      where: { createdAt: dateRange, eventType: "enrichment_completed" },
    }),

    // Active enrollments (snapshot, not date-filtered)
    prisma.enrollment.count({
      where: { status: "active" },
    }),
  ]);

  return {
    date: dayStart.toISOString().slice(0, 10),
    prospectsAdded: {
      total: prospectsAddedTotal,
      bySource: {
        manual: prospectsManual,
        csv_import: prospectsCsv,
        scraper: prospectsScraper,
      },
    },
    emailsSent,
    repliesReceived,
    backlinksWon,
    backlinksLost,
    formContacts,
    enrichmentsCompleted,
    activeEnrollments,
  };
}

// ---------------------------------------------------------------------------
// Stats storage
// ---------------------------------------------------------------------------

/**
 * Store daily stats as a JSON blob in Redis (with 90-day TTL)
 * and also log them for any external log aggregation.
 */
async function storeDailyStats(stats: DailyStats): Promise<void> {
  const key = `backlink-engine:daily-stats:${stats.date}`;
  const ttlSeconds = 90 * 24 * 60 * 60; // 90 days

  await redis.set(key, JSON.stringify(stats), "EX", ttlSeconds);

  // Also log the full stats object for structured log consumers
  log.info({ dailyStats: stats }, `Daily stats stored for ${stats.date}.`);
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processReportingJob(job: Job<ReportingJobData>): Promise<void> {
  const { type, date } = job.data;

  if (type !== "daily-stats") {
    log.warn({ type, jobId: job.id }, "Unknown reporting job type, skipping.");
    return;
  }

  const targetDate = date ? new Date(date) : new Date();
  log.info(
    { jobId: job.id, date: targetDate.toISOString().slice(0, 10) },
    "Generating daily stats report."
  );

  await job.updateProgress(10);

  const stats = await aggregateDailyStats(targetDate);

  await job.updateProgress(80);

  await storeDailyStats(stats);

  await job.updateProgress(100);

  log.info(
    {
      date: stats.date,
      prospects: stats.prospectsAdded.total,
      emails: stats.emailsSent,
      replies: stats.repliesReceived,
      won: stats.backlinksWon,
      lost: stats.backlinksLost,
    },
    "Daily stats report complete."
  );
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<ReportingJobData> | null = null;

/**
 * Start the reporting BullMQ worker.
 * Processes 'daily-stats' jobs that aggregate and store daily KPIs.
 */
export function startReportingWorker(): Worker<ReportingJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<ReportingJobData>(
    QUEUE_NAMES.REPORTING,
    processReportingJob,
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Reporting job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, err: err.message },
      "Reporting job failed."
    );
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Reporting worker error.");
  });

  log.info("Reporting worker started.");
  return worker;
}
