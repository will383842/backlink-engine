// Test email generation on 5 prospects that now have homepage content
// scraped, covering multiple categories when possible. Demonstrates the
// quality uplift from the scrape backfill.
import { PrismaClient } from "@prisma/client";
import { getLlmClient } from "../src/llm/index.js";
import { getBestTemplate, getSenderInfo } from "../src/services/messaging/templateRenderer.js";
import { validateGeneratedEmail } from "../src/services/outreach/emailValidator.js";

const prisma = new PrismaClient();

async function main() {
  const enriched = await prisma.prospect.findMany({
    where: {
      homepageTitle: { not: null },
      language: { not: null },
      status: "READY_TO_CONTACT",
    },
    select: {
      id: true, domain: true, language: true, category: true, sourceContactType: true, country: true,
      thematicCategories: true, opportunityType: true,
      homepageTitle: true, homepageMeta: true, latestArticleTitles: true, aboutSnippet: true,
    },
    orderBy: { id: "asc" },
    take: 30,
  });

  console.log(`=== Picking prospects with scraped homepage (found ${enriched.length}) ===\n`);

  // Pick diversity: one per category if possible
  const seen = new Set<string>();
  const picked: typeof enriched = [];
  for (const p of enriched) {
    const key = `${p.category}|${p.language}`;
    if (!seen.has(key) && picked.length < 5) {
      seen.add(key);
      picked.push(p);
    }
  }
  // fill
  for (const p of enriched) {
    if (picked.length >= 5) break;
    if (!picked.find((x) => x.id === p.id)) picked.push(p);
  }

  console.log(`Testing on ${picked.length}:`);
  for (const p of picked) {
    console.log(`  #${p.id} ${p.domain} (${p.language}/${p.category}) — title="${p.homepageTitle?.slice(0, 60)}..."`);
  }

  console.log("\n=== Generating emails ===\n");

  const senderInfo = await getSenderInfo();
  const llm = getLlmClient();

  for (const p of picked) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`PROSPECT #${p.id}: ${p.domain}`);
    console.log(`  lang=${p.language}, cat=${p.category}, sct=${p.sourceContactType}`);
    console.log(`  homepageTitle: ${p.homepageTitle}`);
    console.log(`  latestArticles (${(p.latestArticleTitles as string[] | null)?.length ?? 0}):`);
    for (const t of (p.latestArticleTitles as string[] | null ?? []).slice(0, 3)) {
      console.log(`    • ${t.slice(0, 100)}`);
    }
    console.log(`  aboutSnippet: ${p.aboutSnippet?.slice(0, 150) ?? "(none)"}`);
    console.log(`${"=".repeat(80)}`);

    const referenceTemplateRow = await getBestTemplate(p.language!, p.category);
    const referenceTemplate = referenceTemplateRow
      ? { subject: referenceTemplateRow.subject as string, body: referenceTemplateRow.body as string }
      : undefined;

    const t0 = Date.now();
    const generated = await llm.generateOutreachEmail({
      domain: p.domain,
      language: p.language!,
      country: p.country ?? undefined,
      themes: (p.thematicCategories as string[] | null) ?? undefined,
      opportunityType: (p.opportunityType as string | null) ?? undefined,
      contactType: p.sourceContactType ?? undefined,
      stepNumber: 0,
      yourWebsite: senderInfo.yourWebsite,
      yourCompany: senderInfo.yourCompany,
      referenceTemplate,
      prospectContent: {
        homepageTitle: p.homepageTitle ?? undefined,
        homepageMeta: p.homepageMeta ?? undefined,
        latestArticleTitles: (p.latestArticleTitles as string[] | null) ?? undefined,
        aboutSnippet: p.aboutSnippet ?? undefined,
      },
    });
    const elapsed = Date.now() - t0;

    const validation = validateGeneratedEmail(generated, referenceTemplate, p.language!);

    console.log(`\n[Generated in ${elapsed}ms — validation: ${validation.valid ? "✓" : "✗ " + validation.issues.join("|")}]`);
    console.log(`SUBJECT: ${generated.subject}\n`);
    console.log(generated.body);
  }

  console.log(`\n${"=".repeat(80)}\nDONE\n`);
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
