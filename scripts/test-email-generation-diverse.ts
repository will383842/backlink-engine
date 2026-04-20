// Test email generation with diversity: multiple categories, multiple languages,
// and also trigger homepage scraping on-the-fly for one prospect to see the
// impact of having real site content available to the LLM.
import { PrismaClient } from "@prisma/client";
import { getLlmClient } from "../src/llm/index.js";
import { getBestTemplate, getSenderInfo } from "../src/services/messaging/templateRenderer.js";
import { validateGeneratedEmail } from "../src/services/outreach/emailValidator.js";
import { scrapeHomepageContent } from "../src/services/enrichment/homepageScraper.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Stats by category + language ===\n");
  const stats = await prisma.$queryRaw<Array<{ category: string; language: string; count: bigint }>>`
    SELECT category::text, language, COUNT(*)::bigint as count
    FROM prospects WHERE language IS NOT NULL
    GROUP BY category, language ORDER BY count DESC LIMIT 20
  `;
  for (const s of stats) console.log(`  ${s.category ?? "null"} × ${s.language} = ${Number(s.count)}`);

  console.log("\n=== Picking 1 prospect per category (seed homepage scrape if needed) ===\n");

  const CATEGORIES_TO_TEST = ["blogger", "media", "influencer", "partner", "corporate"];
  const picked: Array<{
    id: number; domain: string; language: string; category: string | null;
    sourceContactType: string | null; country: string | null;
    thematicCategories: unknown; opportunityType: unknown;
    homepageTitle: string | null; homepageMeta: string | null;
    latestArticleTitles: unknown; aboutSnippet: string | null;
  }> = [];

  for (const cat of CATEGORIES_TO_TEST) {
    const p = await prisma.prospect.findFirst({
      where: { category: cat as any, language: { not: null } },
      select: {
        id: true, domain: true, language: true, category: true, sourceContactType: true,
        country: true, thematicCategories: true, opportunityType: true,
        homepageTitle: true, homepageMeta: true, latestArticleTitles: true, aboutSnippet: true,
      },
      orderBy: { id: "asc" },
    });
    if (p) picked.push(p as any);
  }

  if (picked.length === 0) {
    console.log("No prospects found in any tested category.");
    process.exit(0);
  }

  console.log(`Picked ${picked.length}:`);
  for (const p of picked) {
    console.log(`  #${p.id} ${p.domain} (lang=${p.language}, cat=${p.category}, scraped=${!!p.homepageTitle})`);
  }

  // For the first prospect, do a live homepage scrape so we can see the
  // grounded-with-scrape output side by side.
  if (picked.length > 0 && !picked[0].homepageTitle) {
    console.log(`\n=== Live-scraping homepage for ${picked[0].domain} to see impact ===`);
    try {
      const content = await scrapeHomepageContent(picked[0].domain);
      console.log(`  Title: ${content.homepageTitle ?? "(empty)"}`);
      console.log(`  Meta: ${content.homepageMeta?.slice(0, 100) ?? "(empty)"}...`);
      console.log(`  Articles (${content.latestArticleTitles?.length ?? 0}): ${content.latestArticleTitles?.slice(0, 3).join(" | ") ?? "(none)"}`);
      console.log(`  About: ${content.aboutSnippet?.slice(0, 100) ?? "(empty)"}...`);
      picked[0].homepageTitle = content.homepageTitle;
      picked[0].homepageMeta = content.homepageMeta;
      picked[0].latestArticleTitles = content.latestArticleTitles;
      picked[0].aboutSnippet = content.aboutSnippet;
    } catch (e) {
      console.log(`  Scrape failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n=== Generating emails ===\n");

  const senderInfo = await getSenderInfo();
  const llm = getLlmClient();

  for (const p of picked) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`PROSPECT #${p.id}: ${p.domain}`);
    console.log(`  language=${p.language}, category=${p.category}, sct=${p.sourceContactType}`);
    console.log(`  SCRAPE: title="${p.homepageTitle?.slice(0, 80) ?? "(none)"}" articles=${JSON.stringify(p.latestArticleTitles)?.slice(0, 120) ?? "(none)"}`);
    console.log(`${"=".repeat(80)}`);

    const referenceTemplateRow = await getBestTemplate(p.language, p.category);
    const referenceTemplate = referenceTemplateRow
      ? { subject: referenceTemplateRow.subject as string, body: referenceTemplateRow.body as string }
      : undefined;

    console.log(`\n[Reference template] id=${referenceTemplateRow?.id}, cat=${referenceTemplateRow?.category}, lang=${referenceTemplateRow?.language}`);

    const t0 = Date.now();
    const generated = await llm.generateOutreachEmail({
      domain: p.domain,
      language: p.language,
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

    const validation = validateGeneratedEmail(generated, referenceTemplate, p.language);

    console.log(`\n[Generated in ${elapsed}ms]`);
    console.log(`SUBJECT: ${generated.subject}`);
    console.log(`\nBODY:\n${generated.body}`);
    console.log(`\n[Validation] valid=${validation.valid}${validation.issues.length ? `, issues: ${validation.issues.join(" | ")}` : ""}`);
  }

  console.log(`\n${"=".repeat(80)}\nDONE\n`);
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
