import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";

const log = createChildLogger("enrichment-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface AutoScoreJobData {
  type: "auto-score";
  prospectId: number;
}

interface BatchEnrichNewJobData {
  type: "batch-enrich-new";
}

type EnrichmentJobData = AutoScoreJobData | BatchEnrichNewJobData;

// ---------------------------------------------------------------------------
// External API helpers
// ---------------------------------------------------------------------------

const OPEN_PAGERANK_API_KEY = process.env.OPEN_PAGERANK_API_KEY ?? "";
const GOOGLE_SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY ?? "";

/**
 * Query the Open PageRank API for a domain's PageRank score.
 * @see https://www.domcop.com/openpagerank/documentation
 */
async function fetchOpenPageRank(domain: string): Promise<number | null> {
  if (!OPEN_PAGERANK_API_KEY) {
    log.warn("OPEN_PAGERANK_API_KEY not set, skipping PageRank lookup.");
    return null;
  }

  try {
    const url = `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      headers: { "API-OPR": OPEN_PAGERANK_API_KEY },
    });

    if (!res.ok) {
      log.warn({ status: res.status, domain }, "Open PageRank API error.");
      return null;
    }

    const body = (await res.json()) as {
      status_code: number;
      response: Array<{
        status_code: number;
        page_rank_integer: number;
        page_rank_decimal: number;
        domain: string;
      }>;
    };

    const entry = body.response?.[0];
    if (entry && entry.status_code === 200) {
      return entry.page_rank_decimal;
    }

    return null;
  } catch (err) {
    log.error({ err, domain }, "Failed to fetch Open PageRank.");
    return null;
  }
}

/**
 * Query the Moz Free API for Domain Authority (DA).
 *
 * NOTE: This is a placeholder. The Moz free API has been deprecated
 * in favour of their paid Links API. Replace with your Moz API v2
 * credentials once available.
 */
async function fetchMozDomainAuthority(domain: string): Promise<number | null> {
  const mozAccessId = process.env.MOZ_ACCESS_ID ?? "";
  const mozSecretKey = process.env.MOZ_SECRET_KEY ?? "";

  if (!mozAccessId || !mozSecretKey) {
    log.warn("MOZ_ACCESS_ID / MOZ_SECRET_KEY not set, skipping Moz DA lookup.");
    return null;
  }

  try {
    // Moz Links API v2 endpoint (paid)
    const res = await fetch("https://lsapi.seomoz.com/v2/url_metrics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${mozAccessId}:${mozSecretKey}`).toString("base64"),
      },
      body: JSON.stringify({
        targets: [domain],
      }),
    });

    if (!res.ok) {
      log.warn({ status: res.status, domain }, "Moz API error.");
      return null;
    }

    const body = (await res.json()) as {
      results: Array<{ domain_authority: number }>;
    };

    return body.results?.[0]?.domain_authority ?? null;
  } catch (err) {
    log.error({ err, domain }, "Failed to fetch Moz DA.");
    return null;
  }
}

/**
 * Check if a domain is flagged by Google Safe Browsing.
 * Returns a spam score increment (0 = clean, 100 = flagged).
 */
async function checkGoogleSafeBrowsing(domain: string): Promise<number> {
  if (!GOOGLE_SAFE_BROWSING_API_KEY) {
    log.warn("GOOGLE_SAFE_BROWSING_API_KEY not set, skipping safety check.");
    return 0;
  }

  try {
    const url = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "backlink-engine",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: `https://${domain}/` }],
        },
      }),
    });

    if (!res.ok) {
      log.warn({ status: res.status, domain }, "Google Safe Browsing API error.");
      return 0;
    }

    const body = (await res.json()) as { matches?: unknown[] };
    if (body.matches && body.matches.length > 0) {
      log.warn({ domain, matches: body.matches.length }, "Domain flagged by Safe Browsing.");
      return 100;
    }

    return 0;
  } catch (err) {
    log.error({ err, domain }, "Failed to check Google Safe Browsing.");
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

/**
 * Compute a composite quality score (0-100) from enrichment signals.
 */
function calculateCompositeScore(params: {
  openPageRank: number | null;
  mozDa: number | null;
  spamScore: number;
  hasContactForm: boolean;
}): number {
  let score = 0;
  let factors = 0;

  // Open PageRank contributes up to 10 points mapped to 0-40
  if (params.openPageRank !== null) {
    score += Math.min(params.openPageRank, 10) * 4; // max 40
    factors++;
  }

  // Moz DA is already 0-100, scale to 0-40
  if (params.mozDa !== null) {
    score += (params.mozDa / 100) * 40;
    factors++;
  }

  // If we have no external signals, base score on basic signals
  if (factors === 0) {
    score = 25; // neutral baseline
  }

  // Contact form availability bonus
  if (params.hasContactForm) {
    score += 10;
  }

  // Spam penalty
  score -= params.spamScore;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function enrichSingleProspect(prospectId: number): Promise<void> {
  // 1. Fetch the prospect from DB
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) {
    log.warn({ prospectId }, "Prospect not found, skipping enrichment.");
    return;
  }

  const domain = prospect.domain;

  // 2. Update status to ENRICHING
  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "ENRICHING" },
  });

  // 3. Call external APIs in parallel
  const [openPageRank, mozDa, spamPenalty] = await Promise.all([
    fetchOpenPageRank(domain),
    fetchMozDomainAuthority(domain),
    checkGoogleSafeBrowsing(domain),
  ]);

  // 4. Calculate composite score
  const compositeScore = calculateCompositeScore({
    openPageRank,
    mozDa,
    spamScore: spamPenalty,
    hasContactForm: !!prospect.contactFormUrl,
  });

  // 5. Determine tier from score
  let tier: number;
  if (compositeScore >= 70) tier = 1;
  else if (compositeScore >= 40) tier = 2;
  else if (compositeScore >= 20) tier = 3;
  else tier = 4;

  // 6. Update prospect in DB
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      openPagerank: openPageRank,
      mozDa,
      spamScore: prospect.spamScore + spamPenalty,
      score: compositeScore,
      tier,
      status: "READY_TO_CONTACT",
    },
  });

  // 7. Log enrichment event
  await prisma.event.create({
    data: {
      prospectId,
      eventType: "enrichment_completed",
      eventSource: "enrichment_worker",
      data: {
        openPageRank,
        mozDa,
        spamPenalty,
        compositeScore,
        tier,
      },
    },
  });

  log.info({ prospectId, domain, compositeScore, tier }, "Enrichment complete.");
}

async function processEnrichmentJob(job: Job<EnrichmentJobData>): Promise<void> {
  const { type } = job.data;

  switch (type) {
    case "auto-score": {
      const { prospectId } = job.data;
      log.info({ prospectId, jobId: job.id }, "Starting enrichment for prospect.");
      await enrichSingleProspect(prospectId);
      await job.updateProgress(100);
      break;
    }

    case "batch-enrich-new": {
      log.info({ jobId: job.id }, "Starting batch enrichment for new prospects.");

      // Find up to 50 prospects that are NEW and have not been scored yet
      const newProspects = await prisma.prospect.findMany({
        where: { status: "NEW", score: 0 },
        select: { id: true },
        take: 50,
      });

      if (newProspects.length === 0) {
        log.debug("No new prospects to enrich.");
        await job.updateProgress(100);
        return;
      }

      log.info({ count: newProspects.length }, "Found new prospects to enrich.");

      for (let i = 0; i < newProspects.length; i++) {
        await enrichSingleProspect(newProspects[i]!.id);
        await job.updateProgress(Math.round(((i + 1) / newProspects.length) * 100));
      }

      log.info({ enriched: newProspects.length }, "Batch enrichment complete.");
      break;
    }

    default: {
      const _exhaustive: never = type;
      log.warn({ type: _exhaustive, jobId: job.id }, "Unknown enrichment job type, skipping.");
    }
  }
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<EnrichmentJobData> | null = null;

/**
 * Start the enrichment BullMQ worker.
 * Processes 'auto-score' jobs that enrich prospects with external API data.
 */
export function startEnrichmentWorker(): Worker<EnrichmentJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<EnrichmentJobData>(
    QUEUE_NAMES.ENRICHMENT,
    processEnrichmentJob,
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs per minute (respect API rate limits)
      },
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Enrichment job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, err: err.message },
      "Enrichment job failed."
    );
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Enrichment worker error.");
  });

  log.info("Enrichment worker started.");
  return worker;
}
