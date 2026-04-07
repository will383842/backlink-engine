// ---------------------------------------------------------------------------
// SerpAPI Client - Search engine results for prospect discovery
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";
import { extractDomain } from "../../utils/urlNormalizer.js";
import { waitForRateLimit } from "./rateLimiter.js";
import type { CrawlHit } from "./blogCrawler.js";

const log = createChildLogger("serpapi-client");

interface SerpApiResult {
  organic_results?: Array<{
    link: string;
    title: string;
    snippet?: string;
    domain?: string;
  }>;
}

/**
 * Search SerpAPI for prospects matching given queries.
 *
 * @param queries - Array of search queries
 * @param maxResultsPerQuery - Max results per query (default: 50)
 */
export async function searchForProspects(
  queries: string[],
  maxResultsPerQuery: number = 50,
): Promise<CrawlHit[]> {
  const apiKey = process.env["SERPAPI_KEY"];
  if (!apiKey) {
    log.warn("SERPAPI_KEY not set, skipping search.");
    return [];
  }

  const allHits: CrawlHit[] = [];
  const seenDomains = new Set<string>();

  for (const query of queries) {
    try {
      await waitForRateLimit("serpapi");

      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: "google",
        num: String(Math.min(maxResultsPerQuery, 100)),
      });

      const response = await fetch(
        `https://serpapi.com/search.json?${params.toString()}`,
        { signal: AbortSignal.timeout(30_000) },
      );

      if (!response.ok) {
        log.warn({ query, status: response.status }, "SerpAPI request failed.");
        continue;
      }

      const data = (await response.json()) as SerpApiResult;

      if (!data.organic_results) {
        log.debug({ query }, "No organic results.");
        continue;
      }

      for (const result of data.organic_results) {
        const domain = extractDomain(result.link);
        if (!domain || seenDomains.has(domain)) continue;

        seenDomains.add(domain);
        allHits.push({
          url: result.link,
          domain,
          title: result.title || null,
          metaDescription: result.snippet || null,
        });
      }

      log.debug({ query, results: data.organic_results.length }, "SerpAPI query complete.");
    } catch (err) {
      log.error({ err, query }, "SerpAPI query failed.");
    }
  }

  log.info({ totalQueries: queries.length, totalHits: allHits.length }, "SerpAPI search complete.");
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
