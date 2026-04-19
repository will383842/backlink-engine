// ---------------------------------------------------------------------------
// One-shot migration — recalc Prospect.category from sourceContactType
// ---------------------------------------------------------------------------
//
// Usage:
//   Dry-run (default): npx tsx scripts/migrate-recalc-prospect-category.ts
//   Apply changes:     npx tsx scripts/migrate-recalc-prospect-category.ts --apply
//
// For every prospect that has a sourceContactType (directly or via a linked
// contact), look up the canonical category via the ContactTypeMapping table
// and update Prospect.category if it differs.
//
// Prints a recap at the end:
//   - X prospects untouched (already matched)
//   - Y prospects recalculated
//   - Z prospects stuck in `other` because no mapping exists (listed) — these
//     rows tell you which synonyms to add to the admin table before re-running.
// ---------------------------------------------------------------------------

import { PrismaClient, type ProspectCategory } from "@prisma/client";
import { inferCategory } from "../src/services/prospects/contactTypeMapper.js";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

interface Row {
  id: number;
  domain: string;
  sourceContactType: string | null;
  category: ProspectCategory;
}

async function loadCandidates(): Promise<Row[]> {
  // Prospects carrying sourceContactType directly
  const direct = await prisma.prospect.findMany({
    where: { sourceContactType: { not: null } },
    select: { id: true, domain: true, sourceContactType: true, category: true },
  });

  // Prospects whose first contact carries the sourceContactType (canonical storage)
  const viaContact = await prisma.$queryRaw<Row[]>`
    SELECT p.id, p.domain, c."sourceContactType" AS "sourceContactType", p.category
    FROM "prospects" p
    JOIN LATERAL (
      SELECT c."sourceContactType"
      FROM "contacts" c
      WHERE c."prospectId" = p.id AND c."sourceContactType" IS NOT NULL
      ORDER BY c."createdAt" ASC
      LIMIT 1
    ) c ON TRUE
    WHERE p."sourceContactType" IS NULL
  `;

  const byId = new Map<number, Row>();
  for (const r of direct) byId.set(r.id, r);
  for (const r of viaContact) if (!byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()];
}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("Loading prospects with sourceContactType…");

  const rows = await loadCandidates();
  console.log(`Found ${rows.length} prospects to examine.\n`);

  let unchanged = 0;
  let recalculated = 0;
  const unmapped = new Map<string, number>(); // typeKey → count

  for (const row of rows) {
    const inferred = await inferCategory(row.sourceContactType);

    if (inferred === row.category) {
      unchanged++;
      continue;
    }

    if (inferred === "other" && row.category !== "other") {
      // No mapping found — count and skip, don't downgrade real categories to other
      const key = (row.sourceContactType ?? "").trim();
      unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
      continue;
    }

    console.log(
      `  #${row.id} (${row.domain}) type="${row.sourceContactType}" : ${row.category} → ${inferred}`,
    );
    recalculated++;

    if (APPLY) {
      await prisma.prospect.update({
        where: { id: row.id },
        data: { category: inferred },
      });
    }
  }

  console.log("\n—— Recap ——");
  console.log(`Untouched (already correct): ${unchanged}`);
  console.log(`${APPLY ? "Updated" : "Would update"}: ${recalculated}`);

  if (unmapped.size > 0) {
    console.log(`\nUnmapped sourceContactType values (${unmapped.size} distinct):`);
    const sorted = [...unmapped.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted) {
      console.log(`  ${String(count).padStart(5)}× "${key}"`);
    }
    console.log(
      "\nAdd these to contact_type_mappings (via the admin UI or the seed script)\nthen re-run this migration.",
    );
  }

  if (!APPLY) {
    console.log("\n(dry-run — re-run with --apply to persist changes)");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
