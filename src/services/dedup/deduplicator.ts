// ---------------------------------------------------------------------------
// Deduplicator - Check for duplicate URLs and domains before ingestion
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { normalizeUrl, extractDomain } from "../../utils/urlNormalizer.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("dedup");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DedupResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** Reason for duplication */
  reason?: "url_exists" | "domain_exists";
  /** The ID of the existing prospect */
  existingProspectId?: number;
  /** Current status of the existing prospect */
  existingStatus?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a URL (or its domain) already exists in the database.
 *
 * Dedup strategy (two-level):
 * 1. **URL-level**: Normalize the URL and check `source_urls.url_normalized`
 * 2. **Domain-level**: Extract domain and check `prospects.domain`
 *
 * If a URL match is found, it takes priority. Otherwise, a domain match
 * is returned.
 *
 * @param url - Raw URL to check
 * @returns Dedup result indicating whether a duplicate exists
 */
export async function checkDuplicate(url: string): Promise<DedupResult> {
  try {
    const normalized = normalizeUrl(url);
    const domain = extractDomain(url);

    log.debug({ url, normalized, domain }, "Checking for duplicates");

    // Level 1: Check for exact URL match in source_urls
    const existingUrl = await prisma.sourceUrl.findUnique({
      where: { urlNormalized: normalized },
      select: {
        prospectId: true,
        prospect: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (existingUrl) {
      log.debug(
        { url: normalized, prospectId: existingUrl.prospectId },
        "URL-level duplicate found",
      );
      return {
        isDuplicate: true,
        reason: "url_exists",
        existingProspectId: existingUrl.prospect.id,
        existingStatus: existingUrl.prospect.status,
      };
    }

    // Level 2: Check for domain match in prospects
    const existingDomain = await prisma.prospect.findUnique({
      where: { domain },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingDomain) {
      log.debug(
        { domain, prospectId: existingDomain.id },
        "Domain-level duplicate found",
      );
      return {
        isDuplicate: true,
        reason: "domain_exists",
        existingProspectId: existingDomain.id,
        existingStatus: existingDomain.status,
      };
    }

    // No duplicate found
    return { isDuplicate: false };
  } catch (err) {
    log.error({ err, url }, "Error checking for duplicates");
    // On error, return not-duplicate to avoid blocking ingestion
    // The ingestProspect function has its own duplicate check as a safety net
    return { isDuplicate: false };
  }
}

/**
 * Batch check multiple URLs for duplicates.
 * More efficient than calling checkDuplicate() for each URL individually.
 *
 * @param urls - Array of raw URLs to check
 * @returns Map of URL to DedupResult
 */
export async function checkDuplicateBatch(
  urls: string[],
): Promise<Map<string, DedupResult>> {
  const results = new Map<string, DedupResult>();

  // Normalize all URLs and extract domains
  const entries = urls.map((url) => {
    try {
      return {
        raw: url,
        normalized: normalizeUrl(url),
        domain: extractDomain(url),
      };
    } catch {
      return { raw: url, normalized: null, domain: null };
    }
  });

  const validEntries = entries.filter(
    (e): e is { raw: string; normalized: string; domain: string } =>
      e.normalized !== null && e.domain !== null,
  );

  // Batch query: check all normalized URLs at once
  const normalizedUrls = validEntries.map((e) => e.normalized);
  const existingUrls = await prisma.sourceUrl.findMany({
    where: { urlNormalized: { in: normalizedUrls } },
    select: {
      urlNormalized: true,
      prospect: { select: { id: true, status: true } },
    },
  });

  const urlMap = new Map(
    existingUrls.map((u) => [u.urlNormalized, u.prospect]),
  );

  // Batch query: check all domains at once
  const domains = [...new Set(validEntries.map((e) => e.domain))];
  const existingDomains = await prisma.prospect.findMany({
    where: { domain: { in: domains } },
    select: { id: true, domain: true, status: true },
  });

  const domainMap = new Map(existingDomains.map((d) => [d.domain, d]));

  // Build results
  for (const entry of entries) {
    if (!entry.normalized || !entry.domain) {
      results.set(entry.raw, { isDuplicate: false });
      continue;
    }

    const urlMatch = urlMap.get(entry.normalized);
    if (urlMatch) {
      results.set(entry.raw, {
        isDuplicate: true,
        reason: "url_exists",
        existingProspectId: urlMatch.id,
        existingStatus: urlMatch.status,
      });
      continue;
    }

    const domainMatch = domainMap.get(entry.domain);
    if (domainMatch) {
      results.set(entry.raw, {
        isDuplicate: true,
        reason: "domain_exists",
        existingProspectId: domainMatch.id,
        existingStatus: domainMatch.status,
      });
      continue;
    }

    results.set(entry.raw, { isDuplicate: false });
  }

  log.info(
    {
      total: urls.length,
      duplicates: [...results.values()].filter((r) => r.isDuplicate).length,
    },
    "Batch duplicate check complete",
  );

  return results;
}
