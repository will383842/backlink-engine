// ---------------------------------------------------------------------------
// Re-enrich existing prospects that have no contactFormUrl yet.
//
// Queues an `enrichment` job per prospect so the normal worker handles it
// (rate-limit, proxy rotation, error resilience) instead of hammering sites
// from a one-shot script.
//
// Usage (on the VPS):
//   docker exec bl-app npx tsx /app/scripts/reenrich-missing-forms.ts [--limit=500]
//
// Safe to run multiple times: jobs are deduplicated by prospectId via the
// enrichment worker's internal logic.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const prisma = new PrismaClient();

// Standalone Queue client — the app's exported enrichmentQueue is only
// initialised inside the main process via setupQueues(), so we create our
// own connection here. Matches the in-app redis module which reads REDIS_URL.
const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});
const enrichmentQueue = new Queue("enrichment", { connection: redisConnection });

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "0", 10) : 0;

  console.log("=== Finding prospects without contactFormUrl ===");
  const where = { contactFormUrl: null as string | null };
  const total = await prisma.prospect.count({ where });

  const take = limit > 0 ? Math.min(limit, total) : total;
  console.log({ total_without_form: total, will_enqueue: take });

  const prospects = await prisma.prospect.findMany({
    where,
    select: { id: true, domain: true, score: true },
    orderBy: [{ score: "desc" }, { id: "asc" }], // prioritise high-score prospects
    take,
  });

  console.log(`\n=== Enqueuing ${prospects.length} enrichment jobs ===`);
  let enqueued = 0;
  for (const p of prospects) {
    await enrichmentQueue.add(
      "reenrich-form",
      { type: "auto-score", prospectId: p.id, force: true },
      { jobId: `reenrich-form-${p.id}` }, // dedup across runs
    );
    enqueued++;
    if (enqueued % 100 === 0) console.log(`  ${enqueued}/${prospects.length} queued…`);
  }

  console.log(`\n✅ Enqueued ${enqueued} jobs. The enrichment worker (cron /2 min) will process them.`);
  console.log("Monitor progress: docker logs bl-app --tail 50 -f | grep enrichment");

  await enrichmentQueue.close();
  await redisConnection.quit();
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
