// Test the full email generation pipeline on 5 representative prospects.
import { PrismaClient } from "@prisma/client";
import { getLlmClient } from "../src/llm/index.js";
import { getBestTemplate, getSenderInfo } from "../src/services/messaging/templateRenderer.js";
import { validateGeneratedEmail } from "../src/services/outreach/emailValidator.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Finding 5 representative prospects ===\n");

  // Find prospects with homepage scraped + one per category when possible
  const candidates = await prisma.prospect.findMany({
    where: {
      language: { not: null },
      homepageTitle: { not: null },
    },
    select: {
      id: true,
      domain: true,
      language: true,
      category: true,
      sourceContactType: true,
      country: true,
      thematicCategories: true,
      opportunityType: true,
      homepageTitle: true,
      homepageMeta: true,
      latestArticleTitles: true,
      aboutSnippet: true,
    },
    take: 100,
  });

  // Pick one per category (up to 5 distinct) + fill with random if not enough
  const seen = new Set<string>();
  const picked: typeof candidates = [];
  for (const c of candidates) {
    const key = c.category ?? "null";
    if (!seen.has(key) && picked.length < 5) {
      seen.add(key);
      picked.push(c);
    }
  }
  // If < 5, pad with any remaining
  for (const c of candidates) {
    if (picked.length >= 5) break;
    if (!picked.find((p) => p.id === c.id)) picked.push(c);
  }

  if (picked.length === 0) {
    console.log("No prospect with scraped homepageTitle found. Trying without that filter.");
    const fallback = await prisma.prospect.findMany({
      where: { language: { not: null } },
      select: {
        id: true,
        domain: true,
        language: true,
        category: true,
        sourceContactType: true,
        country: true,
        thematicCategories: true,
        opportunityType: true,
        homepageTitle: true,
        homepageMeta: true,
        latestArticleTitles: true,
        aboutSnippet: true,
      },
      take: 5,
    });
    picked.push(...fallback);
  }

  console.log(`Found ${picked.length} prospects to test:\n`);
  for (const p of picked) {
    console.log(`  #${p.id} ${p.domain} (${p.language}, category=${p.category}, sct=${p.sourceContactType}, scraped=${!!p.homepageTitle})`);
  }

  console.log("\n=== Generating emails ===\n");

  const senderInfo = await getSenderInfo();
  const llm = getLlmClient();

  for (const p of picked) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`PROSPECT #${p.id}: ${p.domain}`);
    console.log(`  language=${p.language}, category=${p.category}, sct=${p.sourceContactType}`);
    console.log(`  homepageTitle: ${p.homepageTitle ?? "(none)"}`);
    console.log(`  latestArticles: ${JSON.stringify(p.latestArticleTitles) ?? "(none)"}`);
    console.log(`${"=".repeat(80)}`);

    const referenceTemplateRow = await getBestTemplate(p.language!, p.category);
    const referenceTemplate = referenceTemplateRow
      ? { subject: referenceTemplateRow.subject as string, body: referenceTemplateRow.body as string }
      : undefined;

    console.log(`\n[Reference template] ${referenceTemplate ? `id=${referenceTemplateRow!.id}, subject="${referenceTemplate.subject.slice(0, 60)}..."` : "NONE"}`);

    const t0 = Date.now();
    const generated = await llm.generateOutreachEmail({
      domain: p.domain,
      language: p.language!,
      country: p.country ?? undefined,
      themes: (p.thematicCategories as string[] | null) ?? undefined,
      opportunityType: p.opportunityType ?? undefined,
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

    console.log(`\n[Generated in ${elapsed}ms]`);
    console.log(`SUBJECT: ${generated.subject}`);
    console.log(`\nBODY:\n${generated.body}`);
    console.log(`\n[Validation] valid=${validation.valid}${validation.issues.length ? `, issues: ${validation.issues.join(" | ")}` : ""}`);
  }

  console.log(`\n${"=".repeat(80)}\nDONE\n`);
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
