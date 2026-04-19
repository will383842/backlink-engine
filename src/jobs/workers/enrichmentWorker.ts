import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { calculateScore } from "../../services/enrichment/scoreCalculator.js";
import { detectLanguageFromUrl, detectLanguageFromDomain } from "../../services/enrichment/languageDetector.js";
import { detectCountryFromDomain } from "../../services/enrichment/countryDetector.js";
import { getTimezoneForCountry } from "../../data/countries.js";
import { detectAndAssignTags } from "../../services/tags/tagDetector.js";
import { scrapeAndValidateEmails, scrapeEmailsDeep, extractNameFromEmailContext } from "../../services/scraping/emailScraper.js";
import { detectContactForm, findContactFormUrl } from "../../services/scraping/contactFormDetector.js";
import { canAutoEnroll, isProspectEligible } from "../../services/autoEnrollment/config.js";
import { findBestCampaign, isAlreadyEnrolled } from "../../services/autoEnrollment/campaignSelector.js";
import { enrollProspect } from "../../services/outreach/enrollmentManager.js";
import { getLlmClient } from "../../llm/index.js";
import { isWorkerEnabled } from "../../services/automation/automationToggles.js";
import type { OpportunityType } from "@prisma/client";

const log = createChildLogger("enrichment-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface AutoScoreJobData {
  type: "auto-score";
  prospectId: number;
  /**
   * When true, bypass the "only NEW/ENRICHING" status gate so the job can
   * re-process an already-enriched prospect (used for form re-detection after
   * expanding the contact-path list).
   */
  force?: boolean;
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
/**
 * Heuristic-based PageRank fallback when no API key is configured.
 * Returns a pseudo-PageRank (0-10 scale) based on domain characteristics.
 */
function heuristicPageRank(domain: string): number {
  let score = 3; // Base neutral score

  // TLD-based adjustments
  const tld = domain.split(".").pop()?.toLowerCase() || "";
  if (["gov", "edu", "mil", "int"].includes(tld)) score += 4; // Official = high trust
  else if (["org", "ngo"].includes(tld)) score += 1.5;
  else if (["com", "net"].includes(tld)) score += 0.5;

  // Subdomain penalty (subdomains usually have lower authority than root)
  const parts = domain.split(".").length;
  if (parts > 2) score -= 0.5;

  // Famous domain bonus (hardcoded shortcuts for top media/universities)
  const famousDomains = [
    "bfmtv.com", "lemonde.fr", "lefigaro.fr", "nytimes.com", "theguardian.com",
    "bbc.com", "cnn.com", "reuters.com", "bloomberg.com", "economist.com",
    "wsj.com", "forbes.com", "wikipedia.org",
  ];
  if (famousDomains.some((f) => domain.endsWith(f))) score += 3;

  // Domain length penalty (very long = likely low quality)
  const domainBase = domain.split(".")[0] || "";
  if (domainBase.length > 20) score -= 1;
  if (domainBase.length < 4) score += 0.5;

  return Math.max(0, Math.min(10, score));
}

async function fetchOpenPageRank(domain: string): Promise<number | null> {
  // Fallback to heuristic if no API key (silent — no log spam)
  if (!OPEN_PAGERANK_API_KEY) {
    return heuristicPageRank(domain);
  }

  try {
    const url = `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      headers: { "API-OPR": OPEN_PAGERANK_API_KEY },
    });

    if (!res.ok) {
      log.warn({ status: res.status, domain }, "Open PageRank API error.");
      return heuristicPageRank(domain);
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

    return heuristicPageRank(domain);
  } catch (err) {
    log.error({ err, domain }, "Failed to fetch Open PageRank.");
    return heuristicPageRank(domain);
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

async function enrichSingleProspect(prospectId: number, force = false): Promise<void> {
  // 1. Fetch the prospect from DB
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) {
    log.warn({ prospectId }, "Prospect not found, skipping enrichment.");
    return;
  }

  // Skip if already enriched or being enriched by another worker.
  // `force` bypass is used by scripts that need to re-run enrichment on
  // already-processed prospects (e.g. after expanding the contact-path
  // detection list). When forced, we do NOT touch the prospect status.
  if (!force && prospect.status !== "NEW" && prospect.status !== "ENRICHING") {
    log.debug({ prospectId, status: prospect.status }, "Prospect not in NEW status, skipping.");
    return;
  }

  const domain = prospect.domain;

  if (force) {
    log.info({ prospectId, domain, originalStatus: prospect.status }, "Forced re-enrichment requested — keeping existing status.");
  } else {
    // 2. Update status to ENRICHING (atomic check to prevent concurrent processing)
    const updated = await prisma.prospect.updateMany({
      where: { id: prospectId, status: { in: ["NEW", "ENRICHING"] } },
      data: { status: "ENRICHING" },
    });
    if (updated.count === 0) {
      log.debug({ prospectId }, "Prospect already being processed, skipping.");
      return;
    }
  }

  try {

  // 3. Detect language and country (ENHANCED - always detect)
  let detectedLanguage: string;
  let detectedCountry: string;

  // Get first source URL for language detection
  const sourceUrl = await prisma.sourceUrl.findFirst({
    where: { prospectId },
    select: { url: true },
  });

  if (sourceUrl) {
    // Try URL content detection first (most accurate)
    const urlLang = await detectLanguageFromUrl(sourceUrl.url);

    // Use URL detection if successful, otherwise use TLD-based detection
    detectedLanguage = urlLang || detectLanguageFromDomain(domain);
  } else {
    // No source URL, use TLD-based detection
    detectedLanguage = detectLanguageFromDomain(domain);
  }

  // Country detection (TLD + keyword + character analysis)
  detectedCountry = detectCountryFromDomain(domain);

  // Timezone detection based on country
  const detectedTimezone = getTimezoneForCountry(detectedCountry);

  log.info(
    {
      prospectId,
      domain,
      detectedLanguage,
      detectedCountry,
      detectedTimezone,
      hadExistingLanguage: !!prospect.language,
      hadExistingCountry: !!prospect.country,
      hadExistingTimezone: !!prospect.timezone,
    },
    "Language, country, and timezone detected"
  );

  // 3.5. DEEP scrape emails — homepage + contact/about/legal pages
  const existingContacts = await prisma.contact.count({ where: { prospectId } });

  if (existingContacts === 0) {
    try {
      // Use domain homepage for deep scrape (more pages = more emails)
      const scrapeUrl = `https://${domain}`;
      log.info({ prospectId, url: scrapeUrl }, "Deep scraping emails (multi-page)");

      // Step 1: Deep scrape (homepage + contact + about + legal + impressum...)
      const deepEmails = await scrapeEmailsDeep(scrapeUrl);

      // Step 2: Validate each email
      const scrapedEmails = await Promise.all(
        deepEmails.map(async (item) => ({
          ...item,
          validation: await (await import("../../services/email/emailValidator.js")).validateEmail(item.email),
          firstName: undefined as string | undefined,
          lastName: undefined as string | undefined,
        })),
      ).then((results) =>
        results.filter((r) => r.validation.status !== "invalid" && r.validation.status !== "disposable"),
      );

      if (scrapedEmails.length > 0) {
        log.info({ prospectId, count: scrapedEmails.length }, `Found ${scrapedEmails.length} valid emails`);

        // Create contacts for scraped emails (limit to 3 best emails)
        const bestEmails = scrapedEmails
          .filter(e => e.validation.status === "verified" || e.validation.status === "risky")
          .slice(0, 3);

        for (const item of bestEmails) {
          try {
            await prisma.contact.create({
              data: {
                prospectId,
                email: item.email,
                emailNormalized: item.email.toLowerCase(),
                firstName: item.firstName || null,  // Already extracted!
                lastName: item.lastName || null,    // Already extracted!
                emailStatus: item.validation.status as any,
                discoveredVia: "auto_scraper",
                // Inherit sourceContactType from parent prospect so every
                // contact can be targeted by campaigns (100% coverage).
                sourceContactType: prospect.sourceContactType ?? "scraped",
              },
            });

            log.info(
              { prospectId, email: item.email, firstName: item.firstName, lastName: item.lastName },
              "Auto-created contact from scraper"
            );
          } catch (err) {
            // Ignore duplicate email errors
            log.debug({ err, email: item.email }, "Failed to create contact (probably duplicate)");
          }
        }

        // Log event
        await prisma.event.create({
          data: {
            prospectId,
            eventType: "emails_scraped",
            eventSource: "enrichment_worker",
            data: {
              scrapedCount: scrapedEmails.length,
              createdCount: bestEmails.length,
              emails: bestEmails.map(e => ({ email: e.email, firstName: e.firstName, lastName: e.lastName })),
            } as any,
          },
        });
      } else {
        log.debug({ prospectId }, "No valid emails found on page");
      }
    } catch (err) {
      log.error({ err, prospectId }, "Failed to scrape emails");
      // Don't fail enrichment if scraping fails
    }
  }

  // 3.6. Auto-detect contact form (if not already detected)
  let hasContactForm = !!prospect.contactFormUrl;  // Track if form detected (for score calculation)

  // Form detection only needs the domain, not a sourceUrl. Earlier code gated
  // on sourceUrl which silently skipped ~92% of manually-imported prospects
  // that were inserted without a source_urls row. We now always run it when
  // the prospect has no form yet.
  if (!prospect.contactFormUrl) {
    try {
      log.info({ prospectId, domain }, "Detecting contact form");

      // Try homepage first (most common location)
      const homepageUrl = `https://${domain}`;
      let formResult = await detectContactForm(homepageUrl);

      // If not found on homepage, try to find contact page link and check there
      if (!formResult.hasContactForm) {
        const contactPageUrl = await findContactFormUrl(homepageUrl);
        if (contactPageUrl) {
          log.debug({ prospectId, contactPageUrl }, "Found contact page, checking for form");
          formResult = await detectContactForm(contactPageUrl);
        }
      }

      if (formResult.hasContactForm) {
        log.info(
          {
            prospectId,
            url: formResult.contactFormUrl,
            fields: formResult.formFields,
            hasCaptcha: formResult.hasCaptcha,
            confidence: formResult.confidence,
          },
          "Contact form detected"
        );

        // Update prospect with form data
        await prisma.prospect.update({
          where: { id: prospectId },
          data: {
            contactFormUrl: formResult.contactFormUrl,
            contactFormFields: formResult.formFields as any,
            hasCaptcha: formResult.hasCaptcha,
          },
        });

        // Track for score calculation
        hasContactForm = true;

        // Log event
        await prisma.event.create({
          data: {
            prospectId,
            eventType: "contact_form_detected",
            eventSource: "enrichment_worker",
            data: {
              url: formResult.contactFormUrl,
              fields: formResult.formFields,
              hasCaptcha: formResult.hasCaptcha,
              confidence: formResult.confidence,
              method: formResult.detectionMethod,
            } as any,
          },
        });
      } else {
        log.debug({ prospectId }, "No contact form found");
      }
    } catch (err) {
      log.error({ err, prospectId }, "Failed to detect contact form");
      // Don't fail enrichment if form detection fails
    }
  }

  // 4. Call external APIs in parallel
  const [openPageRank, mozDa, spamPenalty] = await Promise.all([
    fetchOpenPageRank(domain),
    fetchMozDomainAuthority(domain),
    checkGoogleSafeBrowsing(domain),
  ]);

  // 4b. LLM-based thematic classification & opportunity detection
  let thematicRelevance: number | null = null;
  let thematicCategories: string[] | null = null;
  let opportunityType: OpportunityType | null = null;
  let opportunityNotes: string | null = null;

  try {
    const llm = getLlmClient();
    const [thematic, opportunity] = await Promise.all([
      llm.classifyThematic(domain),
      llm.detectOpportunity(domain),
    ]);

    if (thematic.relevance > 0) {
      thematicRelevance = thematic.relevance;
      thematicCategories = thematic.themes;
    }

    const validOpportunityTypes: OpportunityType[] = [
      "guest_post", "resource_link", "mention", "partnership",
      "affiliate", "interview", "guest_content", "broken_link",
      "skyscraper", "infographic",
    ];

    if (
      opportunity.confidence > 0.3 &&
      validOpportunityTypes.includes(opportunity.opportunityType as OpportunityType)
    ) {
      opportunityType = opportunity.opportunityType as OpportunityType;
      opportunityNotes = opportunity.notes || null;
    }

    log.info(
      { prospectId, domain, thematicRelevance, opportunityType },
      "LLM classification complete.",
    );
  } catch (err) {
    log.warn({ err, prospectId }, "LLM classification failed, continuing without.");
  }

  // 5. Determine tier from score first (needed for score calculation)
  let preliminaryScore = 0;
  if (openPageRank !== null) preliminaryScore += Math.min(openPageRank, 10) * 4;
  if (mozDa !== null) preliminaryScore += (mozDa / 100) * 40;
  if (preliminaryScore === 0) preliminaryScore = 25;
  if (hasContactForm) preliminaryScore += 10;  // FIXED: Use tracked value instead of prospect.contactFormUrl
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
    linkNeighborhoodScore: null,
    relevanceScore: thematicRelevance,
    hasSocialPresence: false,
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
    ...(thematicRelevance !== null && { thematicRelevance }),
    ...(thematicCategories !== null && { thematicCategories }),
    ...(opportunityType !== null && { opportunityType }),
    ...(opportunityNotes !== null && { opportunityNotes }),
  };

  // ALWAYS update language, country, and timezone (override user input if detection is better)
  // Priority: User input > URL detection > TLD detection
  if (!prospect.language) {
    // No user input → use detection
    updateData["language"] = detectedLanguage;
  } else {
    // User provided language → keep it (unless it's invalid)
    // Accept any ISO 639-1 language code (2-3 chars)
    if (!prospect.language || prospect.language.length > 5) {
      log.warn(
        { prospectId, invalidLanguage: prospect.language },
        "Invalid language detected, replacing with auto-detected value"
      );
      updateData["language"] = detectedLanguage;
    }
  }

  if (!prospect.country) {
    // No user input → use detection
    updateData["country"] = detectedCountry;
  }
  // Note: If user provided country, we keep it (they know better than TLD heuristic)

  // Always update timezone based on country (auto-sync with country)
  if (!prospect.timezone || prospect.country !== detectedCountry) {
    updateData["timezone"] = detectedTimezone;
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
        thematicRelevance,
        thematicCategories,
        opportunityType,
      },
    },
  });

  log.info(
    { prospectId, domain, finalScore, tier, detectedLanguage, detectedCountry, detectedTimezone, thematicRelevance, opportunityType },
    "Enrichment complete."
  );

  // 11. Auto-detect and assign tags
  try {
    // Check if prospect has verified email
    const hasVerifiedEmail = await prisma.contact.findFirst({
      where: {
        prospectId,
        emailStatus: "verified",
      },
    });

    const tags = await detectAndAssignTags(prospectId, domain, undefined, {
      category: prospect.category,
      tier,
      score: finalScore,
      country: detectedCountry,
      hasVerifiedEmail: !!hasVerifiedEmail,
    });

    log.info({ prospectId, tags }, `Auto-assigned ${tags.length} tags`);
  } catch (err) {
    log.error({ err, prospectId }, "Failed to auto-assign tags");
    // Don't fail enrichment if tagging fails
  }

  // 12. Try auto-enrollment if enabled
  await autoEnrollIfEligible(prospectId);

  } catch (err) {
    // Recovery: reset prospect status so it can be retried
    log.error({ err, prospectId, domain }, "Enrichment failed, resetting status to NEW.");
    try {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "NEW" },
      });
    } catch {
      log.error({ prospectId }, "Failed to reset prospect status after enrichment failure.");
    }
    throw err; // Re-throw so BullMQ marks job as failed and retries
  }
}

// ---------------------------------------------------------------------------
// Auto-enrollment after enrichment
// ---------------------------------------------------------------------------

/**
 * Automatically enroll a prospect in the best matching campaign if eligible.
 * This is called after enrichment completes successfully.
 */
async function autoEnrollIfEligible(prospectId: number): Promise<void> {
  try {
    // 1. Check if auto-enrollment is globally enabled and within throttle limits
    const throttleCheck = await canAutoEnroll();
    if (!throttleCheck.allowed) {
      log.debug(
        { prospectId, reason: throttleCheck.reason },
        "Auto-enrollment blocked by throttle."
      );
      return;
    }

    // 2. Check if prospect meets eligibility criteria
    const eligibilityCheck = await isProspectEligible(prospectId);
    if (!eligibilityCheck.eligible) {
      log.debug(
        { prospectId, reason: eligibilityCheck.reason },
        "Prospect not eligible for auto-enrollment."
      );
      return;
    }

    // 3. Check if already enrolled in any campaign
    const alreadyEnrolled = await isAlreadyEnrolled(prospectId);
    if (alreadyEnrolled) {
      log.debug(
        { prospectId },
        "Prospect already enrolled in a campaign, skipping auto-enrollment."
      );
      return;
    }

    // 4. Find the best matching campaign
    const campaign = await findBestCampaign(prospectId);
    if (!campaign) {
      log.debug({ prospectId }, "No suitable campaign found for auto-enrollment.");
      return;
    }

    // 5. ENROLL!
    log.info(
      { prospectId, campaignId: campaign.id, campaignName: campaign.name },
      "Auto-enrolling prospect into campaign."
    );

    await enrollProspect(prospectId, campaign.id);

    log.info(
      { prospectId, campaignId: campaign.id },
      "Auto-enrollment successful!"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ err: message, prospectId }, "Auto-enrollment failed.");

    // Log failure event but don't throw (enrichment itself succeeded)
    await prisma.event.create({
      data: {
        prospectId,
        eventType: "auto_enrollment_failed",
        eventSource: "enrichment_worker",
        data: { error: message },
      },
    });
  }
}

async function processEnrichmentJob(job: Job<EnrichmentJobData>): Promise<void> {
  if (!(await isWorkerEnabled("enrichment"))) {
    log.info({ jobId: job.id, type: job.data.type }, "enrichment worker disabled, skipping job.");
    return;
  }

  const { type } = job.data;

  switch (type) {
    case "auto-score": {
      const { prospectId, force } = job.data;
      log.info({ prospectId, jobId: job.id, force: !!force }, "Starting enrichment for prospect.");
      await enrichSingleProspect(prospectId, !!force);
      await job.updateProgress(100);
      break;
    }

    case "batch-enrich-new": {
      log.info({ jobId: job.id }, "Starting batch enrichment for new prospects.");

      // Find up to 50 prospects that are NEW and have not been scored yet
      const newProspects = await prisma.prospect.findMany({
        where: { status: "NEW", score: 0 },
        select: { id: true },
        take: 100,
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
      concurrency: 6,
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
