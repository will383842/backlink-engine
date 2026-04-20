// Enqueue a homepage-scrape job per eligible prospect. Survives redeploys
// thanks to BullMQ persistence; each job retries on failure; worker
// concurrency bounds throughput naturally.
//
// Usage (inside the bl-app container):
//   npx tsx scripts/queue-homepage-backfill.ts
//
// The script exits after enqueuing. Progress is observable via:
//   npx tsx scripts/count-eligible.ts
// or in the BullMQ dashboard (Bull Board) if running.

import { PrismaClient } from "@prisma/client";
import { enrichmentQueue } from "../src/jobs/queue.js";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function main() {
  const total = await prisma.prospect.count({
    where: {
      status: "READY_TO_CONTACT",
      homepageTitle: null,
      language: { not: null },
    },
  });
  console.log(`=== Enqueueing scrape-homepage jobs for ${total} prospects ===\n`);

  if (total === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  let enqueued = 0;
  let lastId = 0;
  while (true) {
    const batch = await prisma.prospect.findMany({
      where: {
        status: "READY_TO_CONTACT",
        homepageTitle: null,
        language: { not: null },
        id: { gt: lastId },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    // Bulk-add jobs with retry + dedupe key.
    await enrichmentQueue.addBulk(
      batch.map((p) => ({
        name: "scrape-homepage",
        data: { type: "scrape-homepage" as const, prospectId: p.id },
        opts: {
          // Dedupe: if a job for the same prospect is already in the queue,
          // BullMQ will skip the new one (same jobId).
          jobId: `scrape-homepage:${p.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 1000, age: 86_400 },
          removeOnFail: { count: 500, age: 604_800 },
        },
      })),
    );
    enqueued += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`  enqueued ${enqueued}/${total}`);
  }

  console.log(`\n=== Done: ${enqueued} jobs enqueued ===`);
  console.log("Watch progress with:");
  console.log("  npx tsx scripts/count-eligible.ts");
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
