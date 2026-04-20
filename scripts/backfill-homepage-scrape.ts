// Backfill homepage content on prospects that pre-date the homepage scraper.
// Targets: prospects with status READY_TO_CONTACT and no homepageTitle yet.
// Processes in batches with bounded concurrency to avoid overloading the
// network + being rate-limited by target sites.

import { PrismaClient } from "@prisma/client";
import { scrapeHomepageContent } from "../src/services/enrichment/homepageScraper.js";

const prisma = new PrismaClient();

const CONCURRENCY = 5; // simultaneous scrapes
const BATCH_SIZE = 100; // prospects loaded per DB round-trip
const PROGRESS_EVERY = 25; // log every N scrapes

async function scrapeOne(prospect: { id: number; domain: string }): Promise<{ ok: boolean; reason?: string }> {
  try {
    const content = await scrapeHomepageContent(prospect.domain);
    // Update only the fields that came back non-null — preserve partial results
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        ...(content.homepageTitle !== null && { homepageTitle: content.homepageTitle }),
        ...(content.homepageMeta !== null && { homepageMeta: content.homepageMeta }),
        ...(content.latestArticleTitles !== null && { latestArticleTitles: content.latestArticleTitles }),
        ...(content.aboutSnippet !== null && { aboutSnippet: content.aboutSnippet }),
      },
    });
    const hasAny =
      content.homepageTitle !== null ||
      content.homepageMeta !== null ||
      (content.latestArticleTitles?.length ?? 0) > 0 ||
      content.aboutSnippet !== null;
    return { ok: hasAny, reason: hasAny ? undefined : "empty_response" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

async function runBatch(prospects: { id: number; domain: string }[]): Promise<{ scraped: number; empty: number; failed: number }> {
  let scraped = 0;
  let empty = 0;
  let failed = 0;

  // Simple N-worker pool: each worker pulls next prospect from the shared queue.
  const queue = [...prospects];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const p = queue.shift();
        if (!p) return;
        const r = await scrapeOne(p);
        if (r.ok) scraped++;
        else if (r.reason === "empty_response") empty++;
        else failed++;
      }
    })());
  }
  await Promise.all(workers);
  return { scraped, empty, failed };
}

async function main() {
  const startedAt = Date.now();

  const totalEligible = await prisma.prospect.count({
    where: {
      status: "READY_TO_CONTACT",
      homepageTitle: null,
      language: { not: null },
    },
  });
  console.log(`=== Backfill homepage scrape — ${totalEligible} prospects eligible ===\n`);

  if (totalEligible === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  let totalScraped = 0;
  let totalEmpty = 0;
  let totalFailed = 0;
  let processed = 0;
  let lastId = 0;

  while (true) {
    const batch = await prisma.prospect.findMany({
      where: {
        status: "READY_TO_CONTACT",
        homepageTitle: null,
        language: { not: null },
        id: { gt: lastId },
      },
      select: { id: true, domain: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const results = await runBatch(batch);
    totalScraped += results.scraped;
    totalEmpty += results.empty;
    totalFailed += results.failed;
    processed += batch.length;
    lastId = batch[batch.length - 1].id;

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const rate = processed / Math.max(1, elapsed);
    const remaining = Math.round((totalEligible - processed) / Math.max(0.1, rate));
    console.log(
      `[${processed}/${totalEligible}] scraped=${totalScraped} empty=${totalEmpty} failed=${totalFailed} ` +
      `| ${rate.toFixed(1)}/s, eta ~${Math.floor(remaining / 60)}m${remaining % 60}s`,
    );
  }

  const totalElapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n=== Done in ${Math.floor(totalElapsed / 60)}m${totalElapsed % 60}s ===`);
  console.log(`  scraped: ${totalScraped} (${(totalScraped * 100 / Math.max(1, processed)).toFixed(1)}%)`);
  console.log(`  empty:   ${totalEmpty}`);
  console.log(`  failed:  ${totalFailed}`);
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
