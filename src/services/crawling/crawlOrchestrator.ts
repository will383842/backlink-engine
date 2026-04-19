// ---------------------------------------------------------------------------
// Crawl Orchestrator - Dispatch to correct crawler and auto-create prospects
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { extractDomain } from "../../utils/urlNormalizer.js";
import { checkDuplicate } from "../dedup/deduplicator.js";
import { crawlBlogDirectory, type CrawlHit } from "./blogCrawler.js";
import { searchForProspects, generateExpatQueries } from "./serpApiClient.js";
import { crawlCompetitorBacklinks } from "./competitorBacklinkCrawler.js";
import { detectWriteForUsPages } from "./writeForUsDetector.js";
import { enrichmentQueue } from "../../jobs/queue.js";

const log = createChildLogger("crawl-orchestrator");

interface CrawlStats {
  found: number;
  newResults: number;
  duplicates: number;
  prospectsCreated: number;
}

/**
 * Execute a crawl for a specific source.
 */
export async function executeCrawl(sourceId: number): Promise<CrawlStats> {
  const source = await prisma.crawlSource.findUniqueOrThrow({
    where: { id: sourceId },
  });

  log.info({ sourceId, name: source.name, type: source.type }, "Starting crawl.");

  const config = (source.config ?? {}) as Record<string, unknown>;
  let hits: CrawlHit[] = [];

  switch (source.type) {
    case "blog_directory":
      if (source.baseUrl) {
        hits = await crawlBlogDirectory(
          source.baseUrl,
          (config.linkSelector as string) ?? "a[href]",
          `blog-${sourceId}`,
        );
      }
      break;

    case "search_engine": {
      // Disabled by default — direct Google scraping risks IP ban and
      // SerpAPI is paid. Use blog_directory / competitor_backlinks /
      // write_for_us instead. Set CRAWLING_SEARCH_ENGINE_ENABLED=true to
      // re-enable (requires SERPAPI_KEY or accepting IP ban risk).
      if (process.env["CRAWLING_SEARCH_ENGINE_ENABLED"] !== "true") {
        log.warn(
          { sourceId, name: source.name },
          "search_engine source skipped: disabled by default. Set CRAWLING_SEARCH_ENGINE_ENABLED=true to enable.",
        );
        break;
      }

      const queries = (config.queries as string[]) ?? [];
      const countries = (config.countries as string[]) ?? [];
      const languages = (config.languages as string[]) ?? ["en"];

      const allQueries = [
        ...queries,
        ...languages.flatMap((lang: string) => generateExpatQueries(countries, lang)),
      ];

      if (allQueries.length > 0) {
        hits = await searchForProspects(allQueries, 50);
      }
      break;
    }

    case "competitor_backlinks": {
      const competitorDomains = (config.competitorDomains as string[]) ?? [];
      if (competitorDomains.length > 0) {
        hits = await crawlCompetitorBacklinks(competitorDomains);
      }
      break;
    }

    case "write_for_us": {
      const footprints = (config.footprints as string[]) ?? [];
      hits = await detectWriteForUsPages(footprints.length > 0 ? footprints : undefined);
      break;
    }
  }

  // Process hits: dedup and create crawl results + prospects
  const stats = await processHits(sourceId, hits);

  // Update source lastCrawledAt
  await prisma.crawlSource.update({
    where: { id: sourceId },
    data: { lastCrawledAt: new Date() },
  });

  log.info(
    { sourceId, name: source.name, ...stats },
    "Crawl complete.",
  );

  return stats;
}

/**
 * Execute crawls for all active sources.
 */
export async function crawlAllSources(): Promise<{
  sourcesProcessed: number;
  totalStats: CrawlStats;
}> {
  const sources = await prisma.crawlSource.findMany({
    where: { isActive: true },
    orderBy: { lastCrawledAt: "asc" }, // oldest first
  });

  const totalStats: CrawlStats = {
    found: 0,
    newResults: 0,
    duplicates: 0,
    prospectsCreated: 0,
  };

  for (const source of sources) {
    try {
      const stats = await executeCrawl(source.id);
      totalStats.found += stats.found;
      totalStats.newResults += stats.newResults;
      totalStats.duplicates += stats.duplicates;
      totalStats.prospectsCreated += stats.prospectsCreated;
    } catch (err) {
      log.error({ err, sourceId: source.id, name: source.name }, "Crawl failed for source.");
    }
  }

  return { sourcesProcessed: sources.length, totalStats };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function processHits(sourceId: number, hits: CrawlHit[]): Promise<CrawlStats> {
  const stats: CrawlStats = {
    found: hits.length,
    newResults: 0,
    duplicates: 0,
    prospectsCreated: 0,
  };

  for (const hit of hits) {
    const domain = extractDomain(hit.url) ?? hit.domain;
    if (!domain) continue;

    // Check if crawl result already exists for this source+domain
    const existingResult = await prisma.crawlResult.findUnique({
      where: { crawlSourceId_domain: { crawlSourceId: sourceId, domain } },
    });

    if (existingResult) {
      stats.duplicates++;
      continue;
    }

    // Check if prospect already exists
    const isDuplicate = await checkDuplicate(hit.url);

    // Create crawl result
    const crawlResult = await prisma.crawlResult.create({
      data: {
        crawlSourceId: sourceId,
        url: hit.url,
        domain,
        title: hit.title,
        metaDescription: hit.metaDescription,
        status: isDuplicate ? "rejected" : "new_result",
      },
    });

    if (isDuplicate) {
      stats.duplicates++;
      continue;
    }

    stats.newResults++;

    // Auto-create prospect
    // NOTE: sourceContactType is mandatory for reporting / campaign targeting.
    // Scraper-origin prospects default to "scraped" (no human-typed source).
    // Enrichment worker will propagate this value to any auto-created contact.
    try {
      const prospect = await prisma.prospect.create({
        data: {
          domain,
          source: "scraper",
          status: "NEW",
          sourceContactType: "scraped",
          sourceUrls: {
            create: {
              url: hit.url,
              urlNormalized: hit.url.toLowerCase(),
              title: hit.title,
              metaDescription: hit.metaDescription,
              discoveredVia: `crawl_source:${sourceId}`,
            },
          },
        },
      });

      // Link crawl result to prospect
      await prisma.crawlResult.update({
        where: { id: crawlResult.id },
        data: { prospectId: prospect.id, status: "processed" },
      });

      // Enqueue enrichment
      await enrichmentQueue.add("enrich-crawled-prospect", {
        type: "auto-score",
        prospectId: prospect.id,
      });

      stats.prospectsCreated++;
    } catch (err) {
      // Prospect creation might fail due to unique constraint on domain
      log.debug({ err, domain }, "Prospect creation skipped (likely duplicate).");
    }
  }

  return stats;
}
