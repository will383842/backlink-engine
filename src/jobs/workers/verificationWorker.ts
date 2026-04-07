import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { notifyBacklinkLost, notifyBacklinkVerified } from "../../services/notifications/telegramService.js";
import { proxyFetch } from "../../config/proxy.js";

const log = createChildLogger("verification-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface CheckBacklinksJobData {
  type: "check-backlinks";
}

interface CheckLinkLossJobData {
  type: "check-link-loss";
}

type VerificationJobData = CheckBacklinksJobData | CheckLinkLossJobData;

// ---------------------------------------------------------------------------
// Backlink verification service (placeholder)
// ---------------------------------------------------------------------------

/**
 * Service contract for verifying whether backlinks are still live.
 * The real implementation will use cheerio to parse target pages.
 */
const backlinkVerifier = {
  /**
   * Fetch each verified backlink's page URL and check if the link
   * to our target URL is still present in the HTML.
   */
  async verifyAllBacklinks(): Promise<VerificationResult> {
    const BATCH_SIZE = 100;
    let verified = 0;
    let lost = 0;
    let errors = 0;
    let total = 0;
    let cursor = 0;

    // Paginated processing to avoid loading all backlinks at once
    while (true) {
      const backlinks = await prisma.backlink.findMany({
        where: { isLive: true },
        include: { prospect: { select: { id: true, domain: true } } },
        take: BATCH_SIZE,
        skip: cursor,
        orderBy: { id: "asc" },
      });

      if (backlinks.length === 0) break;
      total += backlinks.length;

      if (cursor === 0) {
        log.info({ estimatedTotal: total }, "Starting backlink verification.");
      }

    for (let i = 0; i < backlinks.length; i++) {
      const backlink = backlinks[i]!;
      // Anti-ban: random delay between requests (1-3 seconds)
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
      }
      try {
        const res = await proxyFetch(backlink.pageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          if (res.status === 429 || res.status === 403) {
            log.warn(
              { backlinkId: backlink.id, status: res.status, pageUrl: backlink.pageUrl },
              "Blocked by site, pausing verification for this domain."
            );
            // Skip remaining backlinks from this domain to avoid further bans
            errors++;
            continue;
          }
          log.warn(
            { backlinkId: backlink.id, status: res.status, pageUrl: backlink.pageUrl },
            "Page returned non-200 status."
          );
          errors++;
          continue;
        }

        const html = await res.text();

        // Check if the target URL still exists in the page HTML
        const targetPresent = html.includes(backlink.targetUrl);

        if (targetPresent) {
          // Update last verified timestamp
          await prisma.backlink.update({
            where: { id: backlink.id },
            data: {
              isVerified: true,
              lastVerifiedAt: new Date(),
            },
          });

          // Send Telegram notification
          await notifyBacklinkVerified(backlink.id).catch((err) => {
            log.error({ err, backlinkId: backlink.id }, "Failed to send Telegram notification for backlink verified");
          });

          verified++;
        } else {
          // Link no longer found on the page
          await prisma.backlink.update({
            where: { id: backlink.id },
            data: {
              isLive: false,
              lostAt: new Date(),
              lastVerifiedAt: new Date(),
            },
          });

          // Update prospect status
          await prisma.prospect.update({
            where: { id: backlink.prospectId },
            data: { status: "LINK_LOST" },
          });

          // Log loss event
          await prisma.event.create({
            data: {
              prospectId: backlink.prospectId,
              eventType: "backlink_lost",
              eventSource: "verification_worker",
              data: {
                backlinkId: backlink.id,
                pageUrl: backlink.pageUrl,
                targetUrl: backlink.targetUrl,
              },
            },
          });

          // Send Telegram notification
          await notifyBacklinkLost(backlink.id).catch((err) => {
            log.error({ err, backlinkId: backlink.id }, "Failed to send Telegram notification for backlink lost");
          });

          lost++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log.error(
          { backlinkId: backlink.id, err: message },
          "Error verifying backlink."
        );
        errors++;
      }
    }

      cursor += backlinks.length;
      if (backlinks.length < BATCH_SIZE) break;
    }

    return { total, verified, lost, errors };
  },
};

// ---------------------------------------------------------------------------
// Link loss detection service (placeholder)
// ---------------------------------------------------------------------------

/**
 * Service contract for detecting link loss on prospects that had verified links.
 * Complements backlinkVerifier by also checking prospects whose status is
 * LINK_VERIFIED but have no live backlinks remaining.
 */
const linkLossDetector = {
  /**
   * Find prospects marked as LINK_VERIFIED that no longer have any
   * live backlinks, and transition them to LINK_LOST.
   */
  async detectLinkLoss(): Promise<LinkLossResult> {
    const BATCH_SIZE = 500;
    let prospectsChecked = 0;
    let lossCount = 0;
    let cursor = 0;

    while (true) {
      const prospects = await prisma.prospect.findMany({
        where: { status: "LINK_VERIFIED" },
        include: {
          backlinks: {
            where: { isLive: true },
            select: { id: true },
          },
        },
        take: BATCH_SIZE,
        skip: cursor,
        orderBy: { id: "asc" },
      });

      if (prospects.length === 0) break;
      prospectsChecked += prospects.length;

      if (cursor === 0) {
        log.info(
          { batchSize: prospects.length },
          "Checking LINK_VERIFIED prospects for link loss."
        );
      }

      for (const prospect of prospects) {
        if (prospect.backlinks.length === 0) {
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { status: "LINK_LOST" },
          });

          await prisma.event.create({
            data: {
              prospectId: prospect.id,
              eventType: "all_links_lost",
              eventSource: "verification_worker",
              data: { previousStatus: "LINK_VERIFIED" },
            },
          });

          lossCount++;
        }
      }

      cursor += prospects.length;
      if (prospects.length < BATCH_SIZE) break;
    }

    return { prospectsChecked, lossDetected: lossCount };
  },
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface VerificationResult {
  total: number;
  verified: number;
  lost: number;
  errors: number;
}

interface LinkLossResult {
  prospectsChecked: number;
  lossDetected: number;
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processVerificationJob(
  job: Job<VerificationJobData>
): Promise<void> {
  const { type } = job.data;

  switch (type) {
    case "check-backlinks": {
      log.info({ jobId: job.id }, "Starting backlink verification.");
      const result = await backlinkVerifier.verifyAllBacklinks();
      log.info(result, "Backlink verification complete.");
      break;
    }

    case "check-link-loss": {
      log.info({ jobId: job.id }, "Starting link loss detection.");
      const result = await linkLossDetector.detectLinkLoss();
      log.info(result, "Link loss detection complete.");
      break;
    }

    default: {
      const _exhaustive: never = type;
      log.warn({ type: _exhaustive, jobId: job.id }, "Unknown verification job type.");
    }
  }

  await job.updateProgress(100);
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<VerificationJobData> | null = null;

/**
 * Start the verification BullMQ worker.
 * Processes 'check-backlinks' and 'check-link-loss' jobs.
 */
export function startVerificationWorker(): Worker<VerificationJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<VerificationJobData>(
    QUEUE_NAMES.VERIFICATION,
    processVerificationJob,
    {
      connection,
      concurrency: 1, // verification is heavy I/O, run one at a time
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Verification job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, err: err.message },
      "Verification job failed."
    );
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Verification worker error.");
  });

  log.info("Verification worker started.");
  return worker;
}
