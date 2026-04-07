// ---------------------------------------------------------------------------
// Competitor Backlink Crawler - Discover competitor backlinks via APIs
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";
import { extractDomain } from "../../utils/urlNormalizer.js";
import { waitForRateLimit } from "./rateLimiter.js";
import type { CrawlHit } from "./blogCrawler.js";

const log = createChildLogger("competitor-backlink-crawler");

interface MozLinksResult {
  results?: Array<{
    anchor_text?: string;
    source?: {
      page?: string;
      root_domain?: string;
    };
  }>;
}

interface CommonCrawlResult {
  url: string;
  status?: string;
}

/**
 * Crawl competitor backlinks using Moz Links API.
 * Falls back to CommonCrawl if Moz is unavailable.
 */
export async function crawlCompetitorBacklinks(
  competitorDomains: string[],
): Promise<CrawlHit[]> {
  const allHits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  for (const domain of competitorDomains) {
    let hits: CrawlHit[];

    // Try Moz API first
    const mozAccessId = process.env["MOZ_ACCESS_ID"];
    const mozSecretKey = process.env["MOZ_SECRET_KEY"];

    if (mozAccessId && mozSecretKey) {
      hits = await fetchMozBacklinks(domain, mozAccessId, mozSecretKey);
    } else {
      // Fallback to CommonCrawl
      hits = await fetchCommonCrawlLinks(domain);
    }

    for (const hit of hits) {
      if (!seenDomains.has(hit.domain)) {
        seenDomains.add(hit.domain);
        allHits.push(hit);
      }
    }
  }

  log.info(
    { competitors: competitorDomains.length, found: allHits.length },
    "Competitor backlink crawl complete.",
  );
  return allHits;
}

async function fetchMozBacklinks(
  targetDomain: string,
  accessId: string,
  secretKey: string,
): Promise<CrawlHit[]> {
  await waitForRateLimit("moz-api");

  try {
    const response = await fetch("https://lsapi.seomoz.com/v2/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${accessId}:${secretKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        target: targetDomain,
        target_scope: "root_domain",
        filter: "external+nofollow",
        limit: 100,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log.warn({ targetDomain, status: response.status }, "Moz API request failed.");
      return [];
    }

    const data = (await response.json()) as MozLinksResult;
    if (!data.results) return [];

    return data.results
      .filter((r) => r.source?.root_domain)
      .map((r) => ({
        url: r.source!.page ?? `https://${r.source!.root_domain!}`,
        domain: r.source!.root_domain!,
        title: null,
        metaDescription: r.anchor_text ?? null,
      }));
  } catch (err) {
    log.error({ err, targetDomain }, "Moz API failed.");
    return [];
  }
}

async function fetchCommonCrawlLinks(targetDomain: string): Promise<CrawlHit[]> {
  await waitForRateLimit("commoncrawl");

  try {
    // Use the latest CommonCrawl index
    const response = await fetch(
      `https://index.commoncrawl.org/CC-MAIN-2025-13-index?url=*.${targetDomain}&output=json&limit=200`,
      { signal: AbortSignal.timeout(30_000) },
    );

    if (!response.ok) {
      log.warn({ targetDomain, status: response.status }, "CommonCrawl request failed.");
      return [];
    }

    const text = await response.text();
    const lines = text.trim().split("\n").filter(Boolean);

    const hits: CrawlHit[] = [];
    const seenDomains = new Set<string>();

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as CommonCrawlResult;
        const domain = extractDomain(record.url);
        if (!domain || seenDomains.has(domain) || domain === targetDomain) continue;

        seenDomains.add(domain);
        hits.push({
          url: record.url,
          domain,
          title: null,
          metaDescription: null,
        });
      } catch {
        // Skip invalid JSON lines
      }
    }

    return hits;
  } catch (err) {
    log.error({ err, targetDomain }, "CommonCrawl request failed.");
    return [];
  }
}
