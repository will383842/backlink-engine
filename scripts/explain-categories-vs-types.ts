// Explain the mismatch between Prospect.category (BL taxonomy, 8 values)
// and Contact.sourceContactType (MC taxonomy, dozens of free-text values).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. Counts by Prospect.category ===\n");
  const byCat = await prisma.prospect.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });
  let totalCat = 0;
  for (const row of byCat) {
    console.log(`  ${row.category ?? "null"}: ${row._count._all}`);
    totalCat += row._count._all;
  }
  console.log(`  TOTAL: ${totalCat} prospects\n`);

  console.log("=== 2. Counts by Contact.sourceContactType (contactable only) ===\n");
  const bySct = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
    SELECT "sourceContactType" as type, COUNT(*)::bigint as count
    FROM contacts
    WHERE "sourceContactType" IS NOT NULL
      AND "optedOut" = false
      AND "emailStatus" NOT IN ('invalid')
    GROUP BY "sourceContactType"
    ORDER BY count DESC
    LIMIT 20
  `;
  let totalSct = 0;
  for (const row of bySct) {
    console.log(`  ${row.type}: ${Number(row.count)}`);
    totalSct += Number(row.count);
  }
  console.log(`  TOTAL (contactable): ${totalSct} contacts\n`);

  console.log("=== 3. CROSS-TAB: category × sourceContactType (top 30) ===\n");
  const cross = await prisma.$queryRaw<Array<{ category: string; type: string; count: bigint }>>`
    SELECT p.category::text as category, c."sourceContactType" as type, COUNT(*)::bigint as count
    FROM prospects p
    LEFT JOIN contacts c ON c."prospectId" = p.id
    WHERE c."sourceContactType" IS NOT NULL
      AND c."optedOut" = false
      AND c."emailStatus" NOT IN ('invalid')
    GROUP BY p.category, c."sourceContactType"
    ORDER BY count DESC
    LIMIT 30
  `;
  console.log("  category      | type            | count");
  console.log("  " + "-".repeat(50));
  for (const row of cross) {
    console.log(`  ${(row.category ?? "null").padEnd(13)} | ${(row.type ?? "null").padEnd(15)} | ${Number(row.count)}`);
  }

  console.log("\n=== 4. Why 1943 blogger but only 49 'blog' sourceContactType? ===\n");
  const bloggerBreakdown = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
    SELECT c."sourceContactType" as type, COUNT(*)::bigint as count
    FROM prospects p
    LEFT JOIN contacts c ON c."prospectId" = p.id
    WHERE p.category = 'blogger'
      AND c."sourceContactType" IS NOT NULL
    GROUP BY c."sourceContactType"
    ORDER BY count DESC
  `;
  console.log("  Prospects in category=blogger, by sourceContactType:");
  let bloggerTotal = 0;
  for (const row of bloggerBreakdown) {
    console.log(`    ${row.type.padEnd(25)} ${Number(row.count)}`);
    bloggerTotal += Number(row.count);
  }
  console.log(`  TOTAL category=blogger contacts with sct: ${bloggerTotal}`);

  console.log("\n=== 5. Prospects WITHOUT any contact (category only, no sct) ===\n");
  const noContacts = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT p.category::text as category, COUNT(*)::bigint as count
    FROM prospects p
    WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c."prospectId" = p.id)
    GROUP BY p.category
    ORDER BY count DESC
  `;
  for (const row of noContacts) {
    console.log(`  ${row.category ?? "null"}: ${Number(row.count)} prospects without any contact row`);
  }

  console.log("\n=== 6. Summary — why numbers differ ===");
  console.log(`  → 5295 (prospects) != 4378 (contacts contactables): difference is prospects without email,`);
  console.log(`    prospects with all emails opted-out, or prospects with only 'invalid' emails.`);
  console.log(`  → 1943 'blogger' category: big umbrella — see breakdown above.`);
  console.log(`    Probably groups together: blog, youtubeur, instagrammeur, tiktokeur, presse, etc.`);
  console.log(`  → 49 'blog' sourceContactType: narrow free-text value, only direct personal blogs.`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
