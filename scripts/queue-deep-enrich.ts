// Re-enqueue full auto-score enrichment (with force=true) for every prospect
// that currently has zero contact rows. Re-runs the complete scrape pipeline
// (email discovery, contact form detection, homepage scrape, LLM classify)
// so prospects first-pass-scraped before the new extractors have another
// chance to produce a contactable email.
//
// Uses the existing "auto-score" BullMQ job — no new job type needed.
// Idempotent: jobId per prospect so re-runs dedupe.
import { PrismaClient } from "@prisma/client";
import { enrichmentQueue, setupQueues } from "../src/jobs/queue.js";

const prisma = new PrismaClient();
setupQueues();

const BATCH_SIZE = 500;

async function main() {
  const total = await prisma.prospect.count({
    where: { contacts: { none: {} } },
  });
  console.log(`=== Enqueueing deep re-enrichment for ${total} prospects with no contact ===\n`);
  if (total === 0) { console.log("Nothing to do."); process.exit(0); }

  let enqueued = 0;
  let lastId = 0;
  while (true) {
    const batch = await prisma.prospect.findMany({
      where: { contacts: { none: {} }, id: { gt: lastId } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    await enrichmentQueue.addBulk(
      batch.map((p) => ({
        name: "auto-score",
        data: { type: "auto-score" as const, prospectId: p.id, force: true },
        opts: {
          jobId: `deep-enrich-${p.id}`,
          attempts: 2,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: { count: 500, age: 86_400 },
          removeOnFail: { count: 200, age: 604_800 },
        },
      })),
    );
    enqueued += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`  enqueued ${enqueued}/${total}`);
  }

  console.log(`\n=== Done: ${enqueued} deep-enrich jobs queued ===`);
  console.log("Each job re-runs scrapeAndValidateEmails + scrapeEmailsDeep + detectContactForm +");
  console.log("scrapeHomepageContent + LLM classify. Processing ~1 prospect every 10-15s per worker.");
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
