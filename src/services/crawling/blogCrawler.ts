// ---------------------------------------------------------------------------
// Blog Crawler - Crawl known blog directories for prospect domains
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";
import { createChildLogger } from "../../utils/logger.js";
import { extractDomain } from "../../utils/urlNormalizer.js";
import { waitForRateLimit, blockDomain } from "./rateLimiter.js";
import { proxyFetch } from "../../config/proxy.js";

const log = createChildLogger("blog-crawler");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface CrawlHit {
  url: string;
  domain: string;
  title: string | null;
  metaDescription: string | null;
}

/**
 * Crawl a blog directory page and extract blog URLs.
 *
 * @param baseUrl - The directory page URL to crawl
 * @param linkSelector - Optional CSS selector for blog links (default: "a[href]")
 * @param sourceKey - Rate limiter key
 */
export async function crawlBlogDirectory(
  baseUrl: string,
  linkSelector: string = "a[href]",
  sourceKey: string = "blog-directory",
): Promise<CrawlHit[]> {
  log.info({ baseUrl }, "Crawling blog directory.");

  const allowed = await waitForRateLimit(sourceKey);
  if (!allowed) {
    log.info({ baseUrl }, "Domain blocked or rate limited, skipping.");
    return [];
  }

  const response = await proxyFetch(baseUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      await blockDomain(sourceKey);
      log.warn({ baseUrl, status: response.status }, "Blocked by site, domain added to cooldown.");
    } else {
      log.warn({ baseUrl, status: response.status }, "Failed to fetch directory page.");
    }
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const hits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  $(linkSelector).each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Skip internal links, anchors, and non-HTTP URLs
    if (href.startsWith("#") || href.startsWith("javascript:")) return;

    let fullUrl: string;
    try {
      fullUrl = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    // Only external links
    const domain = extractDomain(fullUrl);
    if (!domain) return;

    const baseDomain = extractDomain(baseUrl);
    if (domain === baseDomain) return;

    // Deduplicate by domain
    if (seenDomains.has(domain)) return;
    seenDomains.add(domain);

    const title = $(el).text().trim() || null;

    hits.push({
      url: fullUrl,
      domain,
      title,
      metaDescription: null,
    });
  });

  log.info({ baseUrl, found: hits.length }, "Blog directory crawl complete.");
  return hits;
}

/**
 * Crawl multiple pages of a paginated directory.
 */
export async function crawlPaginatedDirectory(
  baseUrl: string,
  maxPages: number = 5,
  linkSelector: string = "a[href]",
  paginationPattern: string = "?page={page}",
  sourceKey: string = "blog-directory",
): Promise<CrawlHit[]> {
  const allHits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1
      ? baseUrl
      : baseUrl + paginationPattern.replace("{page}", String(page));

    const hits = await crawlBlogDirectory(pageUrl, linkSelector, sourceKey);

    for (const hit of hits) {
      if (!seenDomains.has(hit.domain)) {
        seenDomains.add(hit.domain);
        allHits.push(hit);
      }
    }

    // If no results on this page, stop
    if (hits.length === 0) break;
  }

  return allHits;
}
