// ---------------------------------------------------------------------------
// Press & Journalist Contacts — Targeted Audit
//
// Scope: only prospects whose `category = 'media'` OR whose
// `sourceContactType` matches a press/journalist keyword. Mirrors every
// category of the full audit but restricted to this sub-population.
//
// Read-only. Writes to tmp/audit-press/.
// ---------------------------------------------------------------------------

import { PrismaClient, Prisma } from "@prisma/client";
import { franc } from "franc";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const OUT_DIR = path.resolve(process.cwd(), "tmp/audit-press");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Scope: what counts as a "press/journalist" prospect?
// ---------------------------------------------------------------------------

const PRESS_TYPE_KEYWORDS = [
  "presse", "journaliste", "journalist", "media", "médias", "medias",
  "press", "news", "redaction", "rédaction", "reporter", "newspaper",
  "magazine", "radio", "tv", "television", "télévision", "pigiste",
];

function buildPressFilter(): Prisma.ProspectWhereInput {
  return {
    OR: [
      { category: "media" },
      ...PRESS_TYPE_KEYWORDS.map((kw) => ({
        sourceContactType: { contains: kw, mode: "insensitive" as const },
      })),
    ],
  };
}

function buildPressContactFilter(): Prisma.ContactWhereInput {
  return {
    OR: [
      { prospect: { category: "media" } },
      {
        prospect: {
          sourceContactType: { in: PRESS_TYPE_KEYWORDS, mode: "insensitive" as const },
        },
      } as Prisma.ContactWhereInput,
      ...PRESS_TYPE_KEYWORDS.map((kw) => ({
        sourceContactType: { contains: kw, mode: "insensitive" as const },
      })),
    ],
  };
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

const ISO_639_3_TO_1: Record<string, string> = {
  fra: "fr", eng: "en", deu: "de", spa: "es", por: "pt",
  rus: "ru", arb: "ar", cmn: "zh", hin: "hi", nld: "nl",
  ita: "it", pol: "pl", tur: "tr", jpn: "ja", kor: "ko",
  swe: "sv", dan: "da", nob: "no", nno: "no", fin: "fi",
  ces: "cs", ron: "ro", tha: "th", vie: "vi", ind: "id",
  msa: "ms", ukr: "uk", ell: "el", heb: "he", swa: "sw",
  hun: "hu", bul: "bg", hrv: "hr", slk: "sk", slv: "sl",
  lit: "lt", lav: "lv", est: "et", srp: "sr", cat: "ca",
};

const TLD_LANG: Record<string, string> = {
  fr: "fr", de: "de", es: "es", pt: "pt", it: "it", nl: "nl", be: "fr",
  ch: "de", at: "de", pl: "pl", se: "sv", no: "no", fi: "fi", dk: "da",
  ie: "en", gr: "el", cz: "cs", ro: "ro", hu: "hu", bg: "bg", sk: "sk",
  hr: "hr", si: "sl", lt: "lt", lv: "lv", ee: "et", ru: "ru", ua: "uk",
  by: "ru", us: "en", ca: "en", mx: "es", br: "pt", ar: "es", cl: "es",
  co: "es", pe: "es", ve: "es", cn: "zh", hk: "zh", tw: "zh", jp: "ja",
  kr: "ko", in: "hi", au: "en", nz: "en", sg: "en", th: "th", my: "ms",
  ph: "tl", id: "id", vn: "vi", ae: "ar", sa: "ar", il: "he", tr: "tr",
  eg: "ar", za: "en", ng: "en", ke: "sw",
};

const COUNTRY_TO_LANG: Record<string, string> = {
  FR: "fr", BE: "fr", CH: "de", LU: "fr", MC: "fr",
  DE: "de", AT: "de", LI: "de",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
  IT: "it", VA: "it", SM: "it",
  NL: "nl", RU: "ru", BY: "ru", UA: "uk",
  CN: "zh", HK: "zh", TW: "zh", MO: "zh",
  JP: "ja", KR: "ko", IN: "hi",
  SA: "ar", AE: "ar", EG: "ar", MA: "ar", DZ: "ar", TN: "ar",
  QA: "ar", KW: "ar", OM: "ar", BH: "ar", JO: "ar", LB: "ar",
  TH: "th", VN: "vi", ID: "id", MY: "ms", PH: "tl",
  IL: "he", TR: "tr", GR: "el",
  SE: "sv", NO: "no", DK: "da", FI: "fi",
  PL: "pl", CZ: "cs", SK: "sk", HU: "hu", RO: "ro", BG: "bg",
  HR: "hr", SI: "sl", LT: "lt", LV: "lv", EE: "et",
  US: "en", GB: "en", IE: "en", AU: "en", NZ: "en", CA: "en",
  ZA: "en", NG: "en", KE: "sw",
};

const FREE_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "aol.com",
  "icloud.com", "mail.com", "protonmail.com", "gmx.com", "zoho.com",
  "yandex.com", "mail.ru", "inbox.com", "fastmail.com", "yahoo.fr",
  "yahoo.co.uk", "hotmail.fr", "hotmail.co.uk", "live.fr", "orange.fr",
  "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr", "gmx.de", "gmx.fr",
  "web.de", "t-online.de", "freenet.de", "qq.com", "163.com", "126.com",
  "naver.com", "hanmail.net",
]);

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "temp-mail.org",
  "tempmail.com", "throwaway.email", "trashmail.com", "yopmail.com",
  "fakeinbox.com", "getnada.com", "maildrop.cc", "sharklasers.com",
  "grr.la", "pokemail.net", "mvrht.net", "spam4.me", "mailcatch.com",
  "mailnesia.com", "mailsac.com", "discardmail.com", "emailondeck.com",
]);

const ROLE_PREFIXES = new Set([
  "abuse", "admin", "administrator", "all", "billing", "contact", "help",
  "info", "mail", "marketing", "noreply", "no-reply", "postmaster", "root",
  "sales", "security", "spam", "support", "webmaster", "hostmaster",
  "mailer-daemon", "newsletter", "accounts", "service", "services", "team",
  "office", "hello", "press", "media", "news", "jobs", "careers", "hr",
  "legal", "finance", "accounting", "feedback",
]);

const PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "test.org",
  "localhost", "your-domain.com", "your-domain.fr", "domain.com", "email.com",
  "mail.com", "default.com", "tbd.com", "n/a", "na", "none", "null",
  "undefined", "placeholder.com", "dummy.com",
]);

const JUNK_LOCAL_PATTERNS = [
  /^u\d{3,}/i,
  /^\d+x\d+/,
  /(^|[._-])(png|jpg|jpeg|gif|svg|webp|ico|css|js|pdf|woff2?|ttf|otf)(\d|[._-]|$)/i,
  /^x[0-9a-f]{6,}/i,
  /^[0-9a-f]{24,}$/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i,
  /^@?\w*\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i,
  /\\u[0-9a-f]{4}/i,
  /%[0-9a-f]{2}%[0-9a-f]{2}/i,
  /^(icon|logo|banner|bg|background|cover|hero|thumb|thumbnail|sprite|loader|spinner)[0-9._-]/i,
  /^(data|image|file|asset|media|static|cdn|content)[0-9._-]/i,
  /^[\d._-]+$/,
];

const SCRIPT_HINTS: Array<{ re: RegExp; lang: string }> = [
  { re: /[؀-ۿ]/, lang: "ar" },
  { re: /[Ѐ-ӿ]/, lang: "ru" },
  { re: /[一-鿿]/, lang: "zh" },
  { re: /[぀-ゟ゠-ヿ]/, lang: "ja" },
  { re: /[가-힯]/, lang: "ko" },
  { re: /[ऀ-ॿ]/, lang: "hi" },
  { re: /[฀-๿]/, lang: "th" },
  { re: /[Ͱ-Ͽ]/, lang: "el" },
  { re: /[֐-׿]/, lang: "he" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasValidSyntax(email: string): boolean {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email);
}

function localPart(email: string): string {
  return email.split("@")[0] ?? "";
}

function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase();
}

function isJunkLocalPart(email: string): boolean {
  const lp = localPart(email);
  if (lp.length > 64) return true;
  return JUNK_LOCAL_PATTERNS.some((re) => re.test(lp));
}

function tldOf(domain: string): string | null {
  const parts = domain.split(".");
  return parts.length >= 2 ? (parts[parts.length - 1] || null) : null;
}

function detectLangFromText(text: string): string | null {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  if (snippet.length < 40) return null;
  for (const hint of SCRIPT_HINTS) {
    if (hint.re.test(snippet)) return hint.lang;
  }
  const detected = franc(snippet, { minLength: 3 });
  return ISO_639_3_TO_1[detected] ?? null;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

class CsvWriter {
  private fd: number;
  private header: string[];
  constructor(file: string, header: string[]) {
    this.fd = fs.openSync(path.join(OUT_DIR, file), "w");
    this.header = header;
    fs.writeSync(this.fd, "﻿" + header.join(",") + "\n");
  }
  row(obj: Record<string, unknown>) {
    const line = this.header.map((h) => csvEscape(obj[h])).join(",") + "\n";
    fs.writeSync(this.fd, line);
  }
  close() { fs.closeSync(this.fd); }
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

async function run() {
  const startedAt = Date.now();
  const counters: Record<string, number> = {};
  const inc = (k: string) => (counters[k] = (counters[k] ?? 0) + 1);

  const pressProspectFilter = buildPressFilter();
  const pressContactFilter = buildPressContactFilter();

  const totalPressProspects = await prisma.prospect.count({ where: pressProspectFilter });
  const totalPressContacts = await prisma.contact.count({ where: pressContactFilter });
  console.log(`[press-audit] scope: press/journalist prospects=${totalPressProspects} contacts=${totalPressContacts}`);

  // Breakdown par sourceContactType pour sanity-check du scope
  const typeBreakdown = await prisma.prospect.groupBy({
    by: ["sourceContactType", "category"],
    where: pressProspectFilter,
    _count: true,
    orderBy: { _count: { sourceContactType: "desc" } },
  });
  console.log("\n=== SCOPE BREAKDOWN ===");
  console.table(typeBreakdown.map((r) => ({
    sourceContactType: r.sourceContactType ?? "(null)",
    category: r.category,
    count: r._count,
  })));

  const writers: Record<string, CsvWriter> = {
    E1: new CsvWriter("E1_email_syntax_invalid.csv", [
      "contact_id", "prospect_id", "domain", "email", "email_status",
      "source", "category", "source_contact_type",
    ]),
    E2: new CsvWriter("E2_email_junk_localpart.csv", [
      "contact_id", "prospect_id", "domain", "email", "reason",
      "source", "category", "source_contact_type",
    ]),
    E3: new CsvWriter("E3_email_placeholder_domain.csv", [
      "contact_id", "prospect_id", "domain", "email", "email_domain",
      "source", "category", "source_contact_type",
    ]),
    E4: new CsvWriter("E4_email_role_based.csv", [
      "contact_id", "prospect_id", "domain", "email", "email_status",
      "source", "category", "source_contact_type",
    ]),
    E5: new CsvWriter("E5_email_disposable.csv", [
      "contact_id", "prospect_id", "domain", "email", "email_domain",
      "source", "category", "source_contact_type",
    ]),
    E6: new CsvWriter("E6_email_free_provider.csv", [
      "contact_id", "prospect_id", "domain", "category", "email",
      "email_domain", "source", "source_contact_type",
    ]),
    E7: new CsvWriter("E7_email_domain_mismatch.csv", [
      "contact_id", "prospect_id", "prospect_domain", "email", "email_domain",
      "source", "category", "source_contact_type",
    ]),
    E9: new CsvWriter("E9_prospect_no_contact.csv", [
      "prospect_id", "domain", "category", "status", "source",
      "country", "language", "source_contact_type",
    ]),
    L1: new CsvWriter("L1_language_missing.csv", [
      "prospect_id", "domain", "country", "category", "source", "source_contact_type",
    ]),
    L2: new CsvWriter("L2_language_vs_tld_mismatch.csv", [
      "prospect_id", "domain", "declared_language", "tld_expected", "tld",
      "source", "source_contact_type",
    ]),
    L3: new CsvWriter("L3_language_vs_content_mismatch.csv", [
      "prospect_id", "domain", "declared_language", "detected_language",
      "homepage_title_sample", "homepage_meta_sample", "about_sample",
      "source", "source_contact_type",
    ]),
    L4: new CsvWriter("L4_language_vs_country_mismatch.csv", [
      "prospect_id", "domain", "declared_language", "country", "country_expected_lang",
      "source", "source_contact_type",
    ]),
    C2: new CsvWriter("C2_country_missing.csv", [
      "prospect_id", "domain", "language", "category", "source", "source_contact_type",
    ]),
    C3: new CsvWriter("C3_homepage_never_scraped.csv", [
      "prospect_id", "domain", "status", "created_at", "source", "source_contact_type",
    ]),
  };

  // Duplicates scoped to press population
  const dupes = (await prisma.$queryRawUnsafe<Array<{ emailNormalized: string; count: bigint; ids: string }>>(`
    SELECT c."emailNormalized",
           COUNT(*)::bigint AS count,
           string_agg(c."prospectId"::text, ',' ORDER BY c."id") AS ids
    FROM contacts c
    JOIN prospects p ON p.id = c."prospectId"
    WHERE p.category = 'media'
       OR lower(coalesce(p."sourceContactType", '')) ~ '(presse|journaliste|journalist|media|press|news|redaction|reporter|newspaper|magazine|radio|pigiste)'
       OR lower(coalesce(c."sourceContactType", '')) ~ '(presse|journaliste|journalist|media|press|news|redaction|reporter|newspaper|magazine|radio|pigiste)'
    GROUP BY c."emailNormalized"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10000
  `));
  const E8writer = new CsvWriter("E8_email_duplicate.csv", ["email_normalized", "count", "sample_prospect_ids"]);
  for (const d of dupes) {
    inc("E8");
    E8writer.row({
      email_normalized: d.emailNormalized,
      count: Number(d.count),
      sample_prospect_ids: d.ids.split(",").slice(0, 10).join(";"),
    });
  }
  E8writer.close();

  // ---- Stream contacts ----------------------------------------------------
  const BATCH = 1000;
  let cursor: number | undefined;

  while (true) {
    const contacts = await prisma.contact.findMany({
      where: pressContactFilter,
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true, email: true, emailNormalized: true, emailStatus: true,
        role: true, sourceContactType: true, discoveredVia: true,
        prospect: {
          select: {
            id: true, domain: true, category: true, source: true,
            language: true, country: true, sourceContactType: true,
          },
        },
      },
    });
    if (contacts.length === 0) break;

    for (const c of contacts) {
      const email = (c.email || "").trim();
      const p = c.prospect;
      const commonFields = {
        contact_id: c.id,
        prospect_id: p.id,
        domain: p.domain,
        category: p.category,
        source: p.source,
        source_contact_type: c.sourceContactType ?? p.sourceContactType ?? "",
      };

      if (!email || !hasValidSyntax(email)) {
        inc("E1");
        writers.E1.row({ ...commonFields, email, email_status: c.emailStatus });
        continue;
      }

      const eDomain = emailDomain(email);

      if (isJunkLocalPart(email)) {
        inc("E2");
        writers.E2.row({ ...commonFields, email, reason: localPart(email).slice(0, 80) });
      }

      if (PLACEHOLDER_DOMAINS.has(eDomain)) {
        inc("E3");
        writers.E3.row({ ...commonFields, email, email_domain: eDomain });
      }

      if (ROLE_PREFIXES.has(localPart(email).toLowerCase())) {
        inc("E4");
        writers.E4.row({ ...commonFields, email, email_status: c.emailStatus });
      }

      if (DISPOSABLE_DOMAINS.has(eDomain)) {
        inc("E5");
        writers.E5.row({ ...commonFields, email, email_domain: eDomain });
      }

      // Media: a free provider (gmail/yahoo…) for a journalist is common & legit.
      // We still log it but as "info" — useful to spot unexpected patterns.
      if (FREE_PROVIDERS.has(eDomain)) {
        inc("E6");
        writers.E6.row({ ...commonFields, email, email_domain: eDomain });
      }

      if (
        eDomain &&
        !FREE_PROVIDERS.has(eDomain) &&
        eDomain !== p.domain &&
        !eDomain.endsWith("." + p.domain) &&
        !p.domain.endsWith("." + eDomain)
      ) {
        inc("E7");
        writers.E7.row({
          contact_id: c.id, prospect_id: p.id, prospect_domain: p.domain,
          email, email_domain: eDomain, source: p.source, category: p.category,
          source_contact_type: commonFields.source_contact_type,
        });
      }
    }

    cursor = contacts[contacts.length - 1]!.id;
    if (contacts.length < BATCH) break;
  }

  // ---- Stream prospects ---------------------------------------------------
  const PROSPECT_SELECT = {
    id: true as const,
    domain: true as const,
    source: true as const,
    category: true as const,
    sourceContactType: true as const,
    language: true as const,
    country: true as const,
    status: true as const,
    createdAt: true as const,
    homepageTitle: true as const,
    homepageMeta: true as const,
    aboutSnippet: true as const,
    _count: { select: { contacts: true as const } },
  };

  cursor = undefined;
  while (true) {
    const prospects: Array<
      Awaited<ReturnType<typeof prisma.prospect.findMany<{ select: typeof PROSPECT_SELECT }>>>[number]
    > = await prisma.prospect.findMany({
      where: pressProspectFilter,
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: PROSPECT_SELECT,
    });
    if (prospects.length === 0) break;

    for (const p of prospects) {
      const sct = p.sourceContactType ?? "";

      if (p._count.contacts === 0) {
        inc("E9");
        writers.E9.row({
          prospect_id: p.id, domain: p.domain, category: p.category,
          status: p.status, source: p.source, country: p.country ?? "",
          language: p.language ?? "", source_contact_type: sct,
        });
      }

      if (!p.language) {
        inc("L1");
        writers.L1.row({
          prospect_id: p.id, domain: p.domain, country: p.country ?? "",
          category: p.category, source: p.source, source_contact_type: sct,
        });
      } else {
        const tld = tldOf(p.domain);
        if (tld && TLD_LANG[tld] && TLD_LANG[tld] !== p.language) {
          inc("L2");
          writers.L2.row({
            prospect_id: p.id, domain: p.domain, declared_language: p.language,
            tld_expected: TLD_LANG[tld], tld, source: p.source,
            source_contact_type: sct,
          });
        }

        if (p.country && COUNTRY_TO_LANG[p.country] && COUNTRY_TO_LANG[p.country] !== p.language) {
          inc("L4");
          writers.L4.row({
            prospect_id: p.id, domain: p.domain, declared_language: p.language,
            country: p.country, country_expected_lang: COUNTRY_TO_LANG[p.country],
            source: p.source, source_contact_type: sct,
          });
        }

        const homepageText = [p.homepageTitle, p.homepageMeta, p.aboutSnippet]
          .filter(Boolean)
          .join(" | ");

        if (homepageText.length >= 40) {
          const detected = detectLangFromText(homepageText);
          if (detected && detected !== p.language) {
            inc("L3");
            writers.L3.row({
              prospect_id: p.id, domain: p.domain,
              declared_language: p.language, detected_language: detected,
              homepage_title_sample: (p.homepageTitle ?? "").slice(0, 120),
              homepage_meta_sample: (p.homepageMeta ?? "").slice(0, 120),
              about_sample: (p.aboutSnippet ?? "").slice(0, 120),
              source: p.source, source_contact_type: sct,
            });
          }
        }
      }

      if (!p.country) {
        inc("C2");
        writers.C2.row({
          prospect_id: p.id, domain: p.domain, language: p.language ?? "",
          category: p.category, source: p.source, source_contact_type: sct,
        });
      }

      if (!p.homepageTitle && !p.homepageMeta && !p.aboutSnippet) {
        inc("C3");
        writers.C3.row({
          prospect_id: p.id, domain: p.domain, status: p.status,
          created_at: p.createdAt.toISOString(), source: p.source,
          source_contact_type: sct,
        });
      }
    }

    cursor = prospects[prospects.length - 1]!.id;
    if (prospects.length < BATCH) break;
  }

  for (const w of Object.values(writers)) w.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    scope: {
      description: "Press & journalist contacts (category=media OR sourceContactType matches press/journalist keyword)",
      keywords: PRESS_TYPE_KEYWORDS,
      totalProspects: totalPressProspects,
      totalContacts: totalPressContacts,
      breakdown: typeBreakdown.map((r) => ({
        sourceContactType: r.sourceContactType,
        category: r.category,
        count: r._count,
      })),
    },
    findings: counters,
    legend: {
      E1: "Email syntax invalid",
      E2: "Email junk local-part (image/asset/token artifacts)",
      E3: "Email placeholder domain (example.com, test.com, …)",
      E4: "Role-based email (info@, contact@, press@, …)",
      E5: "Disposable provider",
      E6: "Free provider (gmail/yahoo/…) — normal for journalists but worth reviewing",
      E7: "Email domain mismatch vs prospect domain",
      E8: "Duplicate emailNormalized",
      E9: "Prospect with zero contacts",
      L1: "Prospect language missing",
      L2: "Language vs TLD mismatch",
      L3: "Language vs scraped homepage content mismatch",
      L4: "Language vs country mismatch",
      C2: "Country missing",
      C3: "Homepage never scraped",
    },
    outputDir: OUT_DIR,
  };
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== PRESS AUDIT SUMMARY ===");
  console.log(`Scope prospects : ${totalPressProspects}`);
  console.log(`Scope contacts  : ${totalPressContacts}`);
  console.log("Findings        :");
  for (const [code, n] of Object.entries(counters).sort()) {
    console.log(`  ${code}: ${n}`);
  }
  console.log(`\nCSV exports: ${OUT_DIR}`);
  console.log(`Duration: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
