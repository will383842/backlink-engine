// ---------------------------------------------------------------------------
// Contacts Audit — Live re-check
//
// For prospects flagged by contacts-full-audit.ts (L3/C3/L1), this script
// refetches the site HTML (homepage + optionally /about) and produces:
//   - re-detected language (html[lang] / og:locale / franc on first 5000 chars)
//   - re-detected charset / title / meta
// Then writes a CSV with the suggested correction.
//
// Read-only w.r.t. the DB (we only WRITE to tmp/audit-contacts/).
//
// Config via env:
//   AUDIT_LIMIT=500             max prospects to re-fetch (default 2000)
//   AUDIT_CONCURRENCY=20        parallel fetches (default 20)
//   AUDIT_ONLY=L3,C3,L1         restrict to a subset of buckets
//
// The script reads the CSVs produced by contacts-full-audit.ts, so run that
// first.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { franc } from "franc";
import { load } from "cheerio";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const OUT_DIR = path.resolve(process.cwd(), "tmp/audit-contacts");
const LIMIT = Number(process.env.AUDIT_LIMIT ?? 2000);
const CONCURRENCY = Number(process.env.AUDIT_CONCURRENCY ?? 20);
const ONLY = (process.env.AUDIT_ONLY ?? "L3,C3,L1").split(",").map((s) => s.trim());
const FETCH_TIMEOUT_MS = 10000;

const ISO_639_3_TO_1: Record<string, string> = {
  fra: "fr", eng: "en", deu: "de", spa: "es", por: "pt",
  rus: "ru", arb: "ar", cmn: "zh", hin: "hi", nld: "nl",
  ita: "it", pol: "pl", tur: "tr", jpn: "ja", kor: "ko",
  swe: "sv", dan: "da", nob: "no", nno: "no", fin: "fi",
  ces: "cs", ron: "ro", tha: "th", vie: "vi", ind: "id",
  msa: "ms", ukr: "uk", ell: "el", heb: "he", swa: "sw",
  hun: "hu", bul: "bg", hrv: "hr", slk: "sk", slv: "sl",
  lit: "lt", lav: "lv", est: "et", srp: "sr", cat: "ca",
  tgl: "tl", afr: "af",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(file: string, header: string[], rows: Record<string, unknown>[]) {
  const out = fs.createWriteStream(path.join(OUT_DIR, file));
  out.write("﻿" + header.join(",") + "\n");
  for (const r of rows) {
    out.write(header.map((h) => csvEscape(r[h])).join(",") + "\n");
  }
  out.end();
}

async function readCsvProspectIds(file: string): Promise<number[]> {
  const p = path.join(OUT_DIR, file);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  const lines = text.split(/\r?\n/).slice(1); // skip header
  const ids = new Set<number>();
  for (const line of lines) {
    if (!line) continue;
    // prospect_id is the 1st or 2nd column depending on the bucket
    const parts = line.split(",");
    // try to find a numeric value
    for (const v of parts) {
      const n = Number(v.replace(/^"|"$/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 1e9) { ids.add(n); break; }
    }
  }
  return [...ids];
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SOSExpatAuditBot/1.0; +https://sos-expat.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "*",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("xml")) return null;
    const buf = await res.arrayBuffer();
    // size cap 2 MB
    if (buf.byteLength > 2_000_000) return null;
    // we don't try to honour every charset — browsers default to utf-8
    // and our language detection is resilient to minor decoding issues.
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function detectLanguage(html: string): {
  htmlLang: string | null;
  ogLocale: string | null;
  francLang: string | null;
  title: string;
  description: string;
} {
  const $ = load(html);
  const htmlLang = ($("html").attr("lang") ?? null)?.toLowerCase().split("-")[0] ?? null;
  const ogLocale = ($('meta[property="og:locale"]').attr("content") ?? null)
    ?.toLowerCase()
    .split("_")[0] ?? null;

  const title = ($("title").first().text() ?? "").trim().slice(0, 300);
  const description = ($('meta[name="description"]').attr("content") ?? "")
    .trim()
    .slice(0, 500);

  // Strip boilerplate before language detection
  $("script, style, noscript").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);

  let francLang: string | null = null;
  if (bodyText.length >= 60) {
    const detected = franc(bodyText, { minLength: 3 });
    francLang = ISO_639_3_TO_1[detected] ?? null;
  }

  return { htmlLang, ogLocale, francLang, title, description };
}

function consensusLanguage(d: {
  htmlLang: string | null;
  ogLocale: string | null;
  francLang: string | null;
}): string | null {
  const votes = [d.htmlLang, d.ogLocale, d.francLang].filter(Boolean) as string[];
  if (votes.length === 0) return null;
  // weight: html lang first, og:locale second, franc third — but if franc agrees
  // with either explicit signal, we boost confidence.
  const counts: Record<string, number> = {};
  for (const v of votes) counts[v] = (counts[v] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]![0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bucketMap: Record<string, string> = {
    L3: "L3_language_vs_content_mismatch.csv",
    L1: "L1_language_missing.csv",
    C3: "C3_homepage_never_scraped.csv",
  };

  const seen = new Set<number>();
  for (const bucket of ONLY) {
    const file = bucketMap[bucket];
    if (!file) continue;
    const ids = await readCsvProspectIds(file);
    for (const id of ids) seen.add(id);
  }

  const candidates = [...seen].slice(0, LIMIT);
  console.log(`[live-recheck] buckets=${ONLY.join(",")} candidates=${candidates.length} concurrency=${CONCURRENCY}`);

  if (candidates.length === 0) {
    console.log("Nothing to recheck. Did you run contacts-full-audit.ts first?");
    return;
  }

  const prospects = await prisma.prospect.findMany({
    where: { id: { in: candidates } },
    select: {
      id: true, domain: true, language: true, country: true,
      homepageTitle: true, homepageMeta: true,
    },
  });

  const rows: Record<string, unknown>[] = [];

  let index = 0;
  async function worker() {
    while (index < prospects.length) {
      const i = index++;
      const p = prospects[i]!;
      const url = `https://${p.domain}`;
      const html = await fetchHtml(url);
      if (!html) {
        rows.push({
          prospect_id: p.id, domain: p.domain, declared_language: p.language ?? "",
          fetch: "failed", html_lang: "", og_locale: "", franc_lang: "",
          consensus: "", title: "", description: "",
        });
        continue;
      }
      const d = detectLanguage(html);
      const consensus = consensusLanguage(d);
      const mismatch = consensus && p.language && consensus !== p.language;
      rows.push({
        prospect_id: p.id,
        domain: p.domain,
        declared_language: p.language ?? "",
        fetch: "ok",
        html_lang: d.htmlLang ?? "",
        og_locale: d.ogLocale ?? "",
        franc_lang: d.francLang ?? "",
        consensus: consensus ?? "",
        mismatch: mismatch ? "yes" : "no",
        title: d.title,
        description: d.description,
      });
      if ((i + 1) % 50 === 0) {
        console.log(`  progress: ${i + 1}/${prospects.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, prospects.length) }, worker);
  await Promise.all(workers);

  writeCsv("L3_live_recheck.csv", [
    "prospect_id", "domain", "declared_language", "fetch", "html_lang",
    "og_locale", "franc_lang", "consensus", "mismatch", "title", "description",
  ], rows);

  const stats = {
    total: rows.length,
    fetch_ok: rows.filter((r) => r.fetch === "ok").length,
    fetch_failed: rows.filter((r) => r.fetch === "failed").length,
    confirmed_mismatch: rows.filter((r) => r.mismatch === "yes").length,
    confirmed_ok: rows.filter((r) => r.mismatch === "no" && r.fetch === "ok" && r.consensus).length,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "L3_live_recheck_summary.json"),
    JSON.stringify(stats, null, 2),
  );

  console.log("\n=== LIVE RECHECK SUMMARY ===");
  console.log(stats);
  console.log(`\nCSV: ${path.join(OUT_DIR, "L3_live_recheck.csv")}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
