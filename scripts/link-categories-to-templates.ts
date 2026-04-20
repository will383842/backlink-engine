// ---------------------------------------------------------------------------
// Set category field on existing blog + influencer templates so the admin
// matrix in /message-templates shows them as ✅ instead of ➕.
//
// Matrix uses category field, prospect resolver uses sourceContactType.
// We set both on the same row — the OR in prospects.ts:1751-1753 matches
// either path.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const blogUpdates = await prisma.messageTemplate.updateMany({
    where: { sourceContactType: "blog", category: null },
    data: { category: "blogger" },
  });
  console.log(`✓ blog → blogger: ${blogUpdates.count} rows`);

  const influencerUpdates = await prisma.messageTemplate.updateMany({
    where: { sourceContactType: "influencer", category: null },
    data: { category: "influencer" },
  });
  console.log(`✓ influencer → influencer: ${influencerUpdates.count} rows`);

  console.log("\n=== Verification (matrix-compatible rows) ===");
  const byCategory = await prisma.messageTemplate.groupBy({
    by: ["category", "language"],
    _count: true,
    orderBy: [{ category: "asc" }, { language: "asc" }],
  });
  const summary: Record<string, number> = {};
  for (const row of byCategory) {
    const key = row.category ?? "null (general)";
    summary[key] = (summary[key] ?? 0) + row._count;
  }
  for (const [cat, count] of Object.entries(summary)) {
    console.log(`  ${cat.padEnd(25)} ${count} rows`);
  }

  process.exit(0);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
