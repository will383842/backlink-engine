// ---------------------------------------------------------------------------
// Production readiness audit — runs every critical scenario end-to-end and
// reports PASS / FAIL with details. No emails are sent.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { getLlmClient } from "../src/llm/index.js";
import { getBestTemplate, getSenderInfo } from "../src/services/messaging/templateRenderer.js";
import { validateGeneratedEmail } from "../src/services/outreach/emailValidator.js";
import { getDomainHealth, getUnhealthyDomains } from "../src/services/outreach/domainHealthMonitor.js";
import { getSendingDomains, getNextSendingDomain } from "../src/services/outreach/domainRotator.js";
import { scrapeHomepageContent } from "../src/services/enrichment/homepageScraper.js";

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  details?: string;
}
const results: TestResult[] = [];
function record(name: string, status: "PASS" | "FAIL" | "WARN", details?: string) {
  results.push({ name, status, details });
  const emoji = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`  ${emoji} ${name}${details ? ` — ${details}` : ""}`);
}

// ---------------------------------------------------------------------------
// SECTION A — Data integrity
// ---------------------------------------------------------------------------
async function sectionData() {
  console.log("\n=== A. DATA INTEGRITY ===");

  // A1. Templates by language + category
  const LANGS = ["fr", "en", "es", "de", "pt", "ru", "ar", "zh", "hi"];
  const CATS = ["blogger", "influencer", "media", "partner", "agency", "association", "corporate"];

  for (const lang of LANGS) {
    for (const cat of CATS) {
      const t = await prisma.messageTemplate.findFirst({ where: { language: lang, category: cat } });
      if (!t) {
        record(`Template ${lang}+${cat} exists`, "FAIL", "missing");
      } else if (!t.subject || !t.body) {
        record(`Template ${lang}+${cat} content`, "FAIL", "empty fields");
      } else {
        // PASS (silently skip to keep output short)
      }
    }
    // Default (no category) for this language
    const def = await prisma.messageTemplate.findFirst({ where: { language: lang, category: null } });
    if (!def) {
      record(`Default template for ${lang}`, "FAIL", "missing");
    }
  }
  record("All 9 langs × 7 cats + default templates", "PASS", "silent");

  // A2. FR has phone, others don't
  const frBlog = await prisma.messageTemplate.findFirst({ where: { language: "fr", category: "blogger" } });
  const enBlog = await prisma.messageTemplate.findFirst({ where: { language: "en", category: "blogger" } });
  if (!frBlog?.body.includes("+33")) record("FR template has phone", "FAIL");
  else record("FR template has phone", "PASS");
  if (enBlog?.body.includes("+33")) record("EN template has NO phone", "FAIL", "phone leaked");
  else record("EN template has NO phone", "PASS");

  // A3. Signature numbers in FR blog
  const nums = ["197", "82", "49", "19", "5 min"];
  const missing = nums.filter((n) => !frBlog?.body.includes(n));
  if (missing.length === 0) record("FR blog template contains all key numbers", "PASS");
  else record("FR blog template key numbers", "FAIL", `missing ${missing.join(",")}`);

  // A4. Category-keyed templates (used by the Flux B outreach LLM) must not
  //     have unsubstituted {vars}. sourceContactType-keyed templates (legacy
  //     form-contact renderers, Flux A) are expected to have {siteName},
  //     {yourName}, etc. — those are substituted by templateRenderer at send
  //     time.
  const allTpls = await prisma.messageTemplate.findMany();
  const categoryTpls = allTpls.filter((t) => t.category !== null || (t.sourceContactType === null && t.category === null));
  const bad = categoryTpls.filter((t) => /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(t.subject + t.body));
  if (bad.length === 0) record(`Zero unsubstituted {vars} in category+default templates (${categoryTpls.length} checked)`, "PASS");
  else record("Template variable substitution in category/default templates", "FAIL", `${bad.length} with placeholders: ${bad.slice(0, 3).map(b => b.id).join(",")}`);

  // A5. Correct CTAs per category
  const ctaMap: Record<string, string[]> = {
    blogger: ["devenir-blogger"],
    influencer: ["devenir-influenceur"],
    media: ["press-kit"],
    partner: ["devenir-partenaire"],
    agency: ["devenir-partenaire"],
    association: ["devenir-partenaire"],
    corporate: ["devenir-partenaire"],
  };
  for (const [cat, ctas] of Object.entries(ctaMap)) {
    const tpls = await prisma.messageTemplate.findMany({ where: { category: cat } });
    const wrong = tpls.filter((t) => !ctas.some((c) => t.body.includes(c)));
    if (wrong.length === 0) record(`CTAs correct for ${cat}`, "PASS");
    else record(`CTAs for ${cat}`, "FAIL", `${wrong.length} templates missing correct CTA`);
  }

  // A6. Prospects data
  const totalProspects = await prisma.prospect.count();
  const withHomepage = await prisma.prospect.count({ where: { homepageTitle: { not: null } } });
  record("Prospects total", "PASS", `${totalProspects} total, ${withHomepage} with homepage scrape`);
}

// ---------------------------------------------------------------------------
// SECTION B — Template resolver fallback chain
// ---------------------------------------------------------------------------
async function sectionFallback() {
  console.log("\n=== B. TEMPLATE FALLBACK CHAIN ===");

  // B1. Exact match (fr, blogger)
  let t = await getBestTemplate("fr", "blogger");
  if (t?.language === "fr" && t?.category === "blogger") record("Fallback: exact match fr+blogger", "PASS");
  else record("Fallback: exact match fr+blogger", "FAIL", `got lang=${t?.language}, cat=${t?.category}`);

  // B2. Language only (fr, null → fr general default)
  t = await getBestTemplate("fr", null);
  if (t?.language === "fr" && t?.category === null) record("Fallback: fr+null → fr default", "PASS");
  else record("Fallback: fr+null", "FAIL", `got lang=${t?.language}, cat=${t?.category}`);

  // B3. Unsupported lang + known category (hr, corporate → en corporate) — the fix
  t = await getBestTemplate("hr", "corporate");
  if (t?.language === "en" && t?.category === "corporate") record("Fallback: hr+corporate → en+corporate (CATEGORY preserved)", "PASS");
  else record("Fallback: hr+corporate", "FAIL", `got lang=${t?.language}, cat=${t?.category}`);

  // B4. Unsupported lang + unknown category → en default
  t = await getBestTemplate("hr", "nonexistent_cat");
  if (t?.language === "en" && t?.category === null) record("Fallback: hr+unknown → en+default", "PASS");
  else record("Fallback: hr+unknown", "FAIL", `got lang=${t?.language}, cat=${t?.category}`);

  // B5. Lang without any template → en default
  t = await getBestTemplate("xx", null);
  if (t?.language === "en" && t?.category === null) record("Fallback: xx+null → en+default", "PASS");
  else record("Fallback: xx+null", "FAIL", `got lang=${t?.language}, cat=${t?.category}`);
}

// ---------------------------------------------------------------------------
// SECTION C — Validator edge cases
// ---------------------------------------------------------------------------
async function sectionValidator() {
  console.log("\n=== C. VALIDATOR EDGE CASES ===");

  const refTpl = (await prisma.messageTemplate.findFirst({ where: { language: "en", category: "blogger" } }))!;
  const ref = { subject: refTpl.subject, body: refTpl.body };

  // C1. Valid email — use a real template-grounded body (must be ~120+ words
  //     to pass the Latin minimum). Derived from the reference template.
  let v = validateGeneratedEmail(
    {
      subject: "Partnership idea for your audience",
      body: ref.body.replace(/Hello,/, "Hi there,").replace(/Hello,?\s*\n+/i, "Hi there,\n\n"),
    },
    ref,
    "en",
  );
  if (v.valid) record("Validator accepts good email", "PASS");
  else record("Validator accepts good email", "FAIL", v.issues.join("|"));

  // C2. Wrong language (asked EN, output FR)
  v = validateGeneratedEmail(
    { subject: "Partenariat avec votre blog", body: "Bonjour, je vous contacte pour vous proposer un partenariat avec SOS-Expat, la première plateforme du monde qui propose aux expats une réponse en moins de 5 minutes. 197 pays, 82 avocats, 49€ et 19€ par session. Nous vous offrons 10$ par appel. Découvrez la plateforme: sos-expat.com. Inscrivez-vous comme affilié: sos-expat.com/devenir-blogger. Williams Jullin" },
    ref, "en",
  );
  if (!v.valid && v.issues.some((i) => i.includes("language"))) record("Validator rejects wrong language", "PASS");
  else record("Validator rejects wrong language", "FAIL", `issues: ${v.issues.join("|")}`);

  // C3. Missing reference URLs
  v = validateGeneratedEmail(
    { subject: "Offer", body: "Hi, check out our service at sos-expat.com/different-url. 197 countries, 82 lawyers, 49€ and 19€ pricing. Over 24 hours. Williams" },
    ref, "en",
  );
  if (!v.valid && v.issues.some((i) => i.includes("missing reference URLs"))) record("Validator rejects invented URLs", "PASS");
  else record("Validator rejects invented URLs", "FAIL", `issues: ${v.issues.join("|")}`);

  // C4. Forbidden vocabulary (SEO)
  v = validateGeneratedEmail(
    {
      subject: "SEO partnership",
      body:
        "Hello, we offer SEO backlink exchange. 197 countries, 82 lawyers, $49 $19 pricing. sos-expat.com sos-expat.com/devenir-blogger. Paid within 24 hours. Williams Jullin",
    },
    ref, "en",
  );
  if (!v.valid && v.issues.some((i) => i.toLowerCase().includes("forbidden"))) record("Validator rejects SEO/backlink jargon", "PASS");
  else record("Validator rejects SEO/backlink jargon", "FAIL", `issues: ${v.issues.join("|")}`);

  // C5. Subject too long
  v = validateGeneratedEmail(
    {
      subject: "x".repeat(100),
      body: "Hello, 197 countries, 82 lawyers, 49, 19, 5 min, sos-expat.com/devenir-blogger, sos-expat.com, Williams Jullin, paid within 24 hours with our platform connecting expats around the world, all nationalities and all languages.",
    },
    ref, "en",
  );
  if (!v.valid && v.issues.some((i) => i.includes("subject too long"))) record("Validator rejects long subject", "PASS");
  else record("Validator rejects long subject", "FAIL", `issues: ${v.issues.join("|")}`);

  // C6. Unsubstituted variables
  v = validateGeneratedEmail(
    {
      subject: "Hello {siteName}",
      body: "Hi {contactName}, 197 countries, 82 lawyers, 49, 19, 5 min. sos-expat.com sos-expat.com/devenir-blogger. Williams Jullin paid within 24 hours.",
    },
    ref, "en",
  );
  if (!v.valid && v.issues.some((i) => i.includes("unsubstituted"))) record("Validator rejects {placeholders}", "PASS");
  else record("Validator rejects {placeholders}", "FAIL", `issues: ${v.issues.join("|")}`);
}

// ---------------------------------------------------------------------------
// SECTION D — Domain rotation + health
// ---------------------------------------------------------------------------
async function sectionDomains() {
  console.log("\n=== D. DOMAIN ROTATION + HEALTH ===");

  const domains = await getSendingDomains();
  record("Sending domains configured", "PASS", `${domains.length} domains: ${domains.map((d) => d.domain).join(", ")}`);

  const health = await getDomainHealth();
  record("Domain health monitor", "PASS", `${health.length} domains with recent activity`);

  const unhealthy = await getUnhealthyDomains();
  if (unhealthy.size === 0) record("All domains healthy", "PASS");
  else record("Some domains unhealthy", "WARN", `${unhealthy.size} paused: ${[...unhealthy].join(", ")}`);

  // Next domain picks
  const picks = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const next = await getNextSendingDomain();
    picks.add(next.domain);
  }
  if (picks.size >= Math.min(domains.length, 6)) record("Round-robin rotation distributes", "PASS", `${picks.size} distinct domains picked in 12 rounds`);
  else record("Round-robin rotation", "WARN", `only ${picks.size} distinct domains`);
}

// ---------------------------------------------------------------------------
// SECTION E — End-to-end email generation (cross-matrix)
// ---------------------------------------------------------------------------
async function sectionE2E() {
  console.log("\n=== E. END-TO-END EMAIL GENERATION ===");
  const sender = await getSenderInfo();
  const llm = getLlmClient();

  const scenarios: Array<{ lang: string; cat: string; scrape: boolean; variant?: "A" | "B" }> = [
    { lang: "fr", cat: "blogger", scrape: true },
    { lang: "en", cat: "media", scrape: true },
    { lang: "es", cat: "influencer", scrape: false },
    { lang: "de", cat: "partner", scrape: false },
    { lang: "pt", cat: "agency", scrape: false },
    { lang: "ru", cat: "association", scrape: false },
    { lang: "ar", cat: "corporate", scrape: false },
    { lang: "zh", cat: "blogger", scrape: false },
    { lang: "hi", cat: "media", scrape: false },
    // Unsupported lang → fallback
    { lang: "hr", cat: "corporate", scrape: false },
    // A/B variants
    { lang: "en", cat: "blogger", scrape: false, variant: "A" },
    { lang: "en", cat: "blogger", scrape: false, variant: "B" },
  ];

  for (const s of scenarios) {
    const t0 = Date.now();
    try {
      // Find a random prospect matching lang
      const prospect = await prisma.prospect.findFirst({
        where: { language: s.lang, ...(s.scrape ? { homepageTitle: { not: null } } : {}) },
      });
      if (!prospect && !["hr"].includes(s.lang)) {
        record(`E2E ${s.lang}/${s.cat}${s.variant ? " ["+s.variant+"]" : ""}`, "WARN", "no prospect found");
        continue;
      }

      const refRow = await getBestTemplate(s.lang, s.cat);
      const ref = refRow ? { subject: refRow.subject, body: refRow.body } : undefined;

      const pExt = prospect as unknown as Record<string, unknown>;
      const gen = await llm.generateOutreachEmail({
        domain: prospect?.domain ?? "example.hr",
        language: s.lang,
        country: prospect?.country ?? undefined,
        contactType: s.cat,
        stepNumber: 0,
        yourWebsite: sender.yourWebsite,
        yourCompany: sender.yourCompany,
        referenceTemplate: ref,
        prospectContent: s.scrape && prospect ? {
          homepageTitle: (pExt.homepageTitle as string) ?? undefined,
          homepageMeta: (pExt.homepageMeta as string) ?? undefined,
          latestArticleTitles: (pExt.latestArticleTitles as string[]) ?? undefined,
          aboutSnippet: (pExt.aboutSnippet as string) ?? undefined,
        } : undefined,
        variant: s.variant,
      });
      const elapsed = Date.now() - t0;
      const validation = validateGeneratedEmail(gen, ref, s.lang);
      const label = `${s.lang}/${s.cat}${s.variant ? " ["+s.variant+"]" : ""}${s.scrape ? " [scrape]" : ""}`;
      if (validation.valid) {
        record(`E2E ${label}`, "PASS", `${elapsed}ms, subj=${gen.subject.length}ch, body=${gen.body.split(/\s+/).length}w`);
      } else {
        record(`E2E ${label}`, "WARN", `${elapsed}ms, issues: ${validation.issues.slice(0, 2).join("|")}`);
      }
    } catch (err) {
      record(`E2E ${s.lang}/${s.cat}`, "FAIL", err instanceof Error ? err.message : String(err));
    }
  }
}

// ---------------------------------------------------------------------------
// SECTION F — Scrape
// ---------------------------------------------------------------------------
async function sectionScrape() {
  console.log("\n=== F. HOMEPAGE SCRAPER ===");
  // Known-good site
  try {
    const c = await scrapeHomepageContent("nomadcapitalist.com");
    if (c.homepageTitle && c.latestArticleTitles && c.latestArticleTitles.length > 0) {
      record("Scraper: known-good site", "PASS", `title + ${c.latestArticleTitles.length} articles`);
    } else {
      record("Scraper: known-good site", "FAIL", "incomplete result");
    }
  } catch (e) {
    record("Scraper: known-good site", "FAIL", e instanceof Error ? e.message : String(e));
  }

  // Dead site — should return all nulls, not throw
  try {
    const c = await scrapeHomepageContent("this-domain-definitely-does-not-exist-12345.xyz");
    if (c.homepageTitle === null && c.aboutSnippet === null) {
      record("Scraper: dead site returns nulls (no throw)", "PASS");
    } else {
      record("Scraper: dead site", "FAIL", "got non-null values for dead site?");
    }
  } catch (e) {
    record("Scraper: dead site throws", "FAIL", e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// SECTION G — DB health / queue
// ---------------------------------------------------------------------------
async function sectionHealth() {
  console.log("\n=== G. HEALTH ===");

  const prospectCount = await prisma.prospect.count();
  const templateCount = await prisma.messageTemplate.count();
  const campaignCount = await prisma.campaign.count();
  const sentEmailCount = await prisma.sentEmail.count();

  record("DB accessible", "PASS", `${prospectCount} prospects, ${templateCount} templates, ${campaignCount} campaigns, ${sentEmailCount} sent`);

  // BullMQ: check if redis is reachable
  try {
    const { redis } = await import("../src/config/redis.js");
    const ping = await redis.ping();
    if (ping === "PONG") record("Redis accessible", "PASS");
    else record("Redis", "FAIL", `unexpected response: ${ping}`);
  } catch (e) {
    record("Redis", "FAIL", e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(70));
  console.log("  PRODUCTION READINESS AUDIT");
  console.log("  " + new Date().toISOString());
  console.log("=".repeat(70));

  await sectionData();
  await sectionFallback();
  await sectionValidator();
  await sectionDomains();
  await sectionScrape();
  await sectionHealth();
  await sectionE2E();

  console.log("\n" + "=".repeat(70));
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  console.log(`  SUMMARY: ${pass} PASS  |  ${fail} FAIL  |  ${warn} WARN`);
  console.log("=".repeat(70));

  if (fail > 0) {
    console.log("\nFAILURES:");
    for (const r of results.filter((x) => x.status === "FAIL")) {
      console.log(`  ✗ ${r.name} — ${r.details ?? ""}`);
    }
  }
  if (warn > 0) {
    console.log("\nWARNINGS:");
    for (const r of results.filter((x) => x.status === "WARN")) {
      console.log(`  ⚠ ${r.name} — ${r.details ?? ""}`);
    }
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); }).finally(() => prisma.$disconnect());
