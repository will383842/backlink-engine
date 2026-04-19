// ---------------------------------------------------------------------------
// Crawling Worker - Execute source crawls via BullMQ
// ---------------------------------------------------------------------------

import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { executeCrawl, crawlAllSources } from "../../services/crawling/crawlOrchestrator.js";
import { isWorkerEnabled } from "../../services/automation/automationToggles.js";

const log = createChildLogger("crawling-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface CrawlSourceJobData {
  type: "crawl-source";
  sourceId: number;
}

interface CrawlAllJobData {
  type: "crawl-all";
}

type CrawlingJobData = CrawlSourceJobData | CrawlAllJobData;

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processCrawlingJob(job: Job<CrawlingJobData>): Promise<void> {
  if (!(await isWorkerEnabled("crawling"))) {
    log.info({ jobId: job.id, type: job.data.type }, "crawling worker disabled, skipping job.");
    return;
  }

  const { type } = job.data;

  if (type === "crawl-source") {
    const { sourceId } = job.data as CrawlSourceJobData;
    log.info({ jobId: job.id, sourceId }, "Starting single source crawl.");

    const stats = await executeCrawl(sourceId);
    await job.updateProgress(100);

    log.info({ jobId: job.id, sourceId, ...stats }, "Single source crawl complete.");
  } else if (type === "crawl-all") {
    log.info({ jobId: job.id }, "Starting crawl of all active sources.");

    const result = await crawlAllSources();
    await job.updateProgress(100);

    log.info(
      { jobId: job.id, ...result },
      "Crawl of all sources complete.",
    );
  } else {
    log.warn({ type, jobId: job.id }, "Unknown crawling job type, skipping.");
  }
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<CrawlingJobData> | null = null;

export function startCrawlingWorker(): Worker<CrawlingJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<CrawlingJobData>(
    QUEUE_NAMES.CRAWLING,
    processCrawlingJob,
    {
      connection,
      concurrency: 1, // one crawl at a time (resource-intensive)
      limiter: { max: 2, duration: 60_000 },
    },
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Crawling job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Crawling job failed.");
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Crawling worker error.");
  });

  log.info("Crawling worker started.");
  return worker;
}
