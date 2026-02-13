import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { calculateScore } from "../../services/enrichment/scoreCalculator.js";
import { detectLanguageFromUrl, detectLanguageFromDomain } from "../../services/enrichment/languageDetector.js";
import { detectCountryFromDomain } from "../../services/enrichment/countryDetector.js";

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
// Score calculation (using centralized scoreCalculator service)
// ---------------------------------------------------------------------------
// FIX: Use centralized scoreCalculator instead of duplicate inline formula

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

  // 3. Detect language and country if not already set (smart enrichment)
  let detectedLanguage: string | null = null;
  let detectedCountry: string | null = null;

  if (!prospect.language || !prospect.country) {
    // Get first source URL for language detection
    const sourceUrl = await prisma.sourceUrl.findFirst({
      where: { prospectId },
      select: { url: true },
    });

    if (sourceUrl && !prospect.language) {
      // Try URL content detection first
      detectedLanguage = await detectLanguageFromUrl(sourceUrl.url);

      // Fallback to domain TLD if URL detection fails
      if (!detectedLanguage) {
        detectedLanguage = detectLanguageFromDomain(domain);
      }
    }

    if (!prospect.country) {
      detectedCountry = detectCountryFromDomain(domain);
    }
  }

  // 4. Call external APIs in parallel
  const [openPageRank, mozDa, spamPenalty] = await Promise.all([
    fetchOpenPageRank(domain),
    fetchMozDomainAuthority(domain),
    checkGoogleSafeBrowsing(domain),
  ]);

  // 5. Determine tier from score first (needed for score calculation)
  let preliminaryScore = 0;
  if (openPageRank !== null) preliminaryScore += Math.min(openPageRank, 10) * 4;
  if (mozDa !== null) preliminaryScore += (mozDa / 100) * 40;
  if (preliminaryScore === 0) preliminaryScore = 25;
  if (!!prospect.contactFormUrl) preliminaryScore += 10;
  preliminaryScore -= spamPenalty;

  let tier: number;
  if (preliminaryScore >= 70) tier = 1;
  else if (preliminaryScore >= 40) tier = 2;
  else if (preliminaryScore >= 20) tier = 3;
  else tier = 4;

  // 6. Calculate final composite score using scoreCalculator
  const compositeScore = calculateScore({
    openPagerank: openPageRank,
    mozDa,
    tier,
    linkNeighborhoodScore: null,  // TODO: Add neighborhood analysis
    relevanceScore: null,         // TODO: Add content relevance
    hasSocialPresence: false,     // TODO: Add social detection
  });

  // 7. Apply spam penalty
  const finalScore = Math.max(0, Math.min(100, Math.round(compositeScore - spamPenalty)));

  // 8. Build conditional update data (smart enrichment - preserve existing values)
  const updateData: Record<string, unknown> = {
    openPagerank: openPageRank,
    mozDa,
    spamScore: spamPenalty,
    score: finalScore,
    tier,
    status: "READY_TO_CONTACT",
  };

  // Only update language if not already set
  if (!prospect.language && detectedLanguage) {
    updateData["language"] = detectedLanguage;
  }

  // Only update country if not already set
  if (!prospect.country && detectedCountry) {
    updateData["country"] = detectedCountry;
  }

  // 9. Update prospect in DB
  await prisma.prospect.update({
    where: { id: prospectId },
    data: updateData,
  });

  // 10. Log enrichment event
  await prisma.event.create({
    data: {
      prospectId,
      eventType: "enrichment_completed",
      eventSource: "enrichment_worker",
      data: {
        openPageRank,
        mozDa,
        spamPenalty,
        compositeScore: finalScore,
        tier,
        detectedLanguage: detectedLanguage ?? null,
        detectedCountry: detectedCountry ?? null,
      },
    },
  });

  log.info(
    { prospectId, domain, finalScore, tier, detectedLanguage, detectedCountry },
    "Enrichment complete."
  );
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
