// ---------------------------------------------------------------------------
// Google Search Client - Prospect discovery via direct scraping + SerpAPI fallback
// ---------------------------------------------------------------------------
//
// Primary: Direct Google scraping (free, unlimited)
// Fallback: SerpAPI (paid, if SERPAPI_KEY is set)
//
// Anti-ban: Conservative rate limiting (10s/domain, 6/min global, 5-15s
// delay between queries, 403/429 → 1h block). Uses proxyFetch for
// optional proxy rotation. Chrome User-Agent. No mention of sos-expat.com.
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";
import { createChildLogger } from "../../utils/logger.js";
import { extractDomain } from "../../utils/urlNormalizer.js";
import { waitForRateLimit, blockDomain } from "./rateLimiter.js";
import { proxyFetch } from "../../config/proxy.js";
import type { CrawlHit } from "./blogCrawler.js";

const log = createChildLogger("search-client");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Direct Google Scraping (free, primary method)
// ---------------------------------------------------------------------------

/**
 * Scrape Google search results directly.
 * Returns parsed organic results (links, titles, snippets).
 */
async function scrapeGoogleDirect(
  query: string,
  lang: string = "en",
  num: number = 20,
): Promise<CrawlHit[]> {
  // Rate limit: be very conservative with Google
  const allowed = await waitForRateLimit("google");
  if (!allowed) {
    log.debug({ query }, "Google rate limited or blocked, skipping.");
    return [];
  }

  // Extra delay between Google queries (5-15 seconds)
  const extraDelay = 5000 + Math.random() * 10000;
  await new Promise((r) => setTimeout(r, extraDelay));

  const params = new URLSearchParams({
    q: query,
    num: String(num),
    hl: lang,
  });

  try {
    const response = await proxyFetch(
      `https://www.google.com/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": `${lang},en;q=0.9`,
          "Accept-Encoding": "gzip, deflate",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (response.status === 429 || response.status === 403) {
      await blockDomain("google");
      log.warn({ query, status: response.status }, "Google blocked us. Pausing for 1 hour.");
      return [];
    }

    if (!response.ok) {
      log.warn({ query, status: response.status }, "Google search failed.");
      return [];
    }

    const html = await response.text();

    // Detect CAPTCHA page
    if (html.includes("captcha") || html.includes("unusual traffic") || html.includes("sorry/index")) {
      await blockDomain("google");
      log.warn({ query }, "Google CAPTCHA detected. Pausing for 1 hour.");
      return [];
    }

    return parseGoogleResults(html);
  } catch (err) {
    log.error({ err, query }, "Google scrape failed.");
    return [];
  }
}

/**
 * Parse Google search results HTML to extract organic results.
 */
function parseGoogleResults(html: string): CrawlHit[] {
  const $ = cheerio.load(html);
  const hits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  // Google organic results are in <div class="g"> containers
  // Multiple selector strategies for robustness
  const selectors = [
    "div.g",           // Standard organic results
    "div.tF2Cxc",      // Alternative container
    "div[data-hveid]",  // Data attribute based
  ];

  for (const selector of selectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);

      // Extract link
      const linkEl = $el.find("a[href]").first();
      const href = linkEl.attr("href") ?? "";

      // Skip Google internal links, ads, and non-HTTP
      if (
        !href.startsWith("http") ||
        href.includes("google.com") ||
        href.includes("youtube.com") ||
        href.includes("webcache.googleusercontent") ||
        href.includes("translate.google")
      ) {
        return;
      }

      const domain = extractDomain(href);
      if (!domain || seenDomains.has(domain)) return;

      // Extract title
      const title = $el.find("h3").first().text().trim() || null;

      // Extract snippet (multiple possible selectors)
      const snippet =
        $el.find(".VwiC3b").first().text().trim() ||
        $el.find("span.aCOpRe").first().text().trim() ||
        $el.find("[data-sncf]").first().text().trim() ||
        $el.find(".IsZvec").first().text().trim() ||
        null;

      seenDomains.add(domain);
      hits.push({
        url: href,
        domain,
        title,
        metaDescription: snippet,
      });
    });

    // If we found results with this selector, stop trying others
    if (hits.length > 0) break;
  }

  // Fallback: extract all external links if selectors didn't work
  if (hits.length === 0) {
    $("a[href^='http']").each((_i, el) => {
      const href = $(el).attr("href") ?? "";
      if (
        href.includes("google.com") ||
        href.includes("youtube.com") ||
        href.includes("webcache") ||
        href.includes("translate.google")
      ) {
        return;
      }

      const domain = extractDomain(href);
      if (!domain || seenDomains.has(domain)) return;

      seenDomains.add(domain);
      hits.push({
        url: href,
        domain,
        title: $(el).text().trim() || null,
        metaDescription: null,
      });
    });
  }

  return hits;
}

// ---------------------------------------------------------------------------
// SerpAPI (paid fallback)
// ---------------------------------------------------------------------------

interface SerpApiResult {
  organic_results?: Array<{
    link: string;
    title: string;
    snippet?: string;
    domain?: string;
  }>;
}

async function searchViaSerpApi(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<CrawlHit[]> {
  await waitForRateLimit("serpapi");

  const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: "google",
    num: String(Math.min(maxResults, 100)),
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { signal: AbortSignal.timeout(30_000) },
  );

  if (!response.ok) {
    log.warn({ query, status: response.status }, "SerpAPI request failed.");
    return [];
  }

  const data = (await response.json()) as SerpApiResult;
  if (!data.organic_results) return [];

  return data.organic_results.map((r) => ({
    url: r.link,
    domain: extractDomain(r.link) ?? "",
    title: r.title || null,
    metaDescription: r.snippet || null,
  })).filter((h) => h.domain);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for prospects matching given queries.
 *
 * Primary: Direct Google scraping (free, no API key needed)
 * Fallback: SerpAPI if SERPAPI_KEY is configured
 *
 * @param queries - Array of search queries
 * @param maxResultsPerQuery - Max results per query (default: 20)
 */
export async function searchForProspects(
  queries: string[],
  maxResultsPerQuery: number = 20,
): Promise<CrawlHit[]> {
  const serpApiKey = process.env["SERPAPI_KEY"];
  const useSerpApi = !!serpApiKey;

  const allHits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  log.info(
    { totalQueries: queries.length, method: useSerpApi ? "serpapi" : "google-direct" },
    "Starting prospect search.",
  );

  for (const query of queries) {
    try {
      let queryHits: CrawlHit[];

      if (useSerpApi) {
        // Paid: SerpAPI
        queryHits = await searchViaSerpApi(query, serpApiKey, maxResultsPerQuery);
      } else {
        // Free: Direct Google scraping
        queryHits = await scrapeGoogleDirect(query, "en", maxResultsPerQuery);
      }

      // Deduplicate
      for (const hit of queryHits) {
        if (!seenDomains.has(hit.domain)) {
          seenDomains.add(hit.domain);
          allHits.push(hit);
        }
      }

      log.debug({ query, results: queryHits.length }, "Query complete.");
    } catch (err) {
      log.error({ err, query }, "Query failed.");
    }
  }

  log.info(
    { totalQueries: queries.length, totalHits: allHits.length, method: useSerpApi ? "serpapi" : "google-direct" },
    "Prospect search complete.",
  );

  return allHits;
}

/**
 * Generate search queries covering ALL SOS-Expat niches by country.
 *
 * Niches: expatriés, digital nomads, étudiants internationaux, retraités
 * à l'étranger, investisseurs, voyageurs long séjour, photographes voyage,
 * touristes, travailleurs détachés, PVT/WHV, etc.
 */
export function generateExpatQueries(
  countries: string[],
  language: string = "en",
): string[] {
  const templates: Record<string, string[]> = {
    en: [
      "expat {country} blog",
      "living abroad {country}",
      "moving to {country} guide",
      "digital nomad {country}",
      "retire abroad {country}",
      "international student {country} guide",
      "invest abroad {country}",
      "travel photography {country} blog",
      "working holiday {country}",
      "long term travel {country}",
      "relocate to {country}",
    ],
    fr: [
      "blog expatrié {country}",
      "vivre à l'étranger {country}",
      "s'expatrier {country} guide",
      "digital nomad {country}",
      "retraite à l'étranger {country}",
      "étudiant international {country}",
      "investir à l'étranger {country}",
      "photographe voyage {country}",
      "PVT {country} guide",
      "s'installer {country}",
    ],
    de: [
      "auswandern {country} blog",
      "leben im ausland {country}",
      "expat {country} ratgeber",
      "digitale nomaden {country}",
      "ruhestand im ausland {country}",
      "studieren im ausland {country}",
      "working holiday {country}",
    ],
    es: [
      "expatriado {country} blog",
      "vivir en el extranjero {country}",
      "emigrar a {country} guía",
      "nómada digital {country}",
      "jubilarse en {country}",
      "estudiar en el extranjero {country}",
      "invertir en {country}",
    ],
    pt: [
      "expatriado {country} blog",
      "morar no exterior {country}",
      "viver em {country} guia",
      "nômade digital {country}",
      "aposentadoria no exterior {country}",
      "estudar no exterior {country}",
    ],
    ru: [
      "эмиграция {country} блог",
      "жизнь за рубежом {country}",
      "переезд {country} гид",
      "цифровой кочевник {country}",
      "учёба за рубежом {country}",
    ],
    ar: [
      "المغتربين {country} مدونة",
      "العيش في الخارج {country}",
      "الهجرة إلى {country} دليل",
      "الدراسة في الخارج {country}",
      "الاستثمار في {country}",
    ],
    zh: [
      "移居{country}攻略",
      "海外生活{country}博客",
      "数字游民{country}",
      "留学{country}指南",
      "海外投资{country}",
    ],
    hi: [
      "विदेश में रहना {country} ब्लॉग",
      "प्रवासी {country} गाइड",
      "विदेश में पढ़ाई {country}",
      "डिजिटल नोमैड {country}",
    ],
    nl: [
      "expat {country} blog",
      "wonen in het buitenland {country}",
      "emigreren naar {country} gids",
      "digitale nomade {country}",
      "studeren in het buitenland {country}",
    ],
    it: [
      "espatriato {country} blog",
      "vivere all'estero {country}",
      "trasferirsi {country} guida",
      "nomade digitale {country}",
      "studiare all'estero {country}",
    ],
    pl: [
      "emigracja {country} blog",
      "życie za granicą {country}",
      "przeprowadzka do {country}",
      "cyfrowy nomada {country}",
    ],
    tr: [
      "yurt dışında yaşam {country} blog",
      "göçmenlik {country} rehber",
      "dijital göçebe {country}",
      "{country} yatırım rehberi",
    ],
    ja: [
      "海外移住{country}ブログ",
      "海外生活{country}ガイド",
      "デジタルノマド{country}",
      "留学{country}ガイド",
    ],
    ko: [
      "해외이주 {country} 블로그",
      "해외생활 {country} 가이드",
      "디지털노마드 {country}",
      "유학 {country} 가이드",
    ],
    sv: [
      "expat {country} blogg",
      "bo utomlands {country}",
      "flytta till {country} guide",
    ],
    th: [
      "ย้ายไปอยู่ {country} บล็อก",
      "ชีวิตต่างแดน {country}",
      "ดิจิทัลโนแมด {country}",
    ],
    vi: [
      "định cư {country} blog",
      "cuộc sống nước ngoài {country}",
      "du học {country} hướng dẫn",
    ],
    id: [
      "ekspat {country} blog",
      "hidup di luar negeri {country}",
      "pindah ke {country} panduan",
      "digital nomad {country}",
    ],
  };

  // Fallback: if no template for this language, use English
  const langTemplates = templates[language] ?? templates["en"]!;

  return countries.flatMap((country) =>
    langTemplates.map((t) => t.replace("{country}", country)),
  );
}
