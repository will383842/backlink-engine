// Press audit follow-up — enqueue enrichment for incomplete press prospects.
// Scoped to category='media' + sourceContactType='presse' to avoid spilling
// into non-press prospects.
//
// Enqueues:
//   • scrape-homepage for the 300 prospects where homepageTitle IS NULL (C3 bucket)
//   • auto-score (force=true) for the 476 prospects without any contact (E9 bucket)
//
// Idempotent: deterministic jobId per prospect means re-runs dedupe.

import { PrismaClient } from "@prisma/client";
import { enrichmentQueue, setupQueues } from "../src/jobs/queue.js";

const prisma = new PrismaClient();
setupQueues();

const BATCH_SIZE = 500;
const PRESS_FILTER = {
  OR: [
    { category: "media" as const },
    { sourceContactType: { equals: "presse" } },
  ],
};

async function enqueueHomepageBackfill() {
  const ids = await prisma.prospect.findMany({
    where: {
      AND: [
        PRESS_FILTER,
        { homepageTitle: null, homepageMeta: null, aboutSnippet: null },
        { status: { notIn: ["DO_NOT_CONTACT", "LOST"] } },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  console.log(`[C3] press prospects without homepage scrape: ${ids.length}`);
  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    await enrichmentQueue.addBulk(
      batch.map((p) => ({
        name: "scrape-homepage",
        data: { type: "scrape-homepage" as const, prospectId: p.id },
        opts: {
          jobId: `scrape-homepage-${p.id}`,
          attempts: 3,
          backoff: { type: "exponential" as const, delay: 30_000 },
          removeOnComplete: { count: 500, age: 86_400 },
          removeOnFail: { count: 200, age: 604_800 },
        },
      })),
    );
    console.log(`  [C3] enqueued ${Math.min(i + BATCH_SIZE, ids.length)}/${ids.length}`);
  }
  return ids.length;
}

async function enqueueDeepEnrich() {
  const ids = await prisma.prospect.findMany({
    where: {
      AND: [
        PRESS_FILTER,
        { contacts: { none: {} } },
        { status: { notIn: ["DO_NOT_CONTACT", "LOST"] } },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  console.log(`[E9] press prospects without any contact: ${ids.length}`);
  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    await enrichmentQueue.addBulk(
      batch.map((p) => ({
        name: "auto-score",
        data: { type: "auto-score" as const, prospectId: p.id, force: true },
        opts: {
          jobId: `press-audit-deep-enrich-${p.id}`,
          attempts: 2,
          backoff: { type: "exponential" as const, delay: 60_000 },
          removeOnComplete: { count: 500, age: 86_400 },
          removeOnFail: { count: 200, age: 604_800 },
        },
      })),
    );
    console.log(`  [E9] enqueued ${Math.min(i + BATCH_SIZE, ids.length)}/${ids.length}`);
  }
  return ids.length;
}

async function main() {
  const startedAt = Date.now();
  const c3 = await enqueueHomepageBackfill();
  const e9 = await enqueueDeepEnrich();

  console.log("\n=== Press rattrapage enqueued ===");
  console.log(`  C3 scrape-homepage : ${c3}`);
  console.log(`  E9 deep-enrich     : ${e9}`);
  console.log(`  Duration           : ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log("\nProgress observable via Bull Board or direct Redis queue inspection.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); process.exit(0); });
