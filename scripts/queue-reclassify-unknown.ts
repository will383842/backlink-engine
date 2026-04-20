// Enqueue a reclassify-contact-type job for every contact currently stored
// with sourceContactType='unknown'. The worker uses the LLM + scraped
// homepage content to infer a proper type (blog, presse, avocat, etc.).
//
// Dedupe per-contact via jobId, so re-running the script is safe.
import { PrismaClient } from "@prisma/client";
import { enrichmentQueue, setupQueues } from "../src/jobs/queue.js";

const prisma = new PrismaClient();
setupQueues();

const BATCH_SIZE = 500;

async function main() {
  const total = await prisma.contact.count({
    where: { sourceContactType: "unknown", optedOut: false, emailStatus: { not: "invalid" } },
  });
  console.log(`=== Enqueueing reclassify-contact-type for ${total} 'unknown' contacts ===\n`);
  if (total === 0) { console.log("Nothing to do."); process.exit(0); }

  let enqueued = 0;
  let lastId = 0;
  while (true) {
    const batch = await prisma.contact.findMany({
      where: {
        sourceContactType: "unknown",
        optedOut: false,
        emailStatus: { not: "invalid" },
        id: { gt: lastId },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    await enrichmentQueue.addBulk(
      batch.map((c) => ({
        name: "reclassify-contact-type",
        data: { type: "reclassify-contact-type" as const, contactId: c.id },
        opts: {
          jobId: `reclassify-${c.id}`,
          attempts: 2,
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

  console.log(`\n=== Done: ${enqueued} reclassify jobs queued ===`);
  console.log("Each job calls LLM with homepage+email context and updates contact.sourceContactType.");
  console.log("Track progress: SELECT sourceContactType, COUNT(*) FROM contacts WHERE optedOut=false GROUP BY sourceContactType;");
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
