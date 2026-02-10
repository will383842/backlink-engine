// ---------------------------------------------------------------------------
// Neighborhood Pre-Analyzer - Analyze outbound links for spam/quality signals
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("neighborhood");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NeighborhoodPreAnalysis {
  /** Count of outbound links per external domain */
  outboundDomains: Record<string, number>;
  /** Domains matching suspect patterns */
  suspectDomains: string[];
  /** Domains that appear clean */
  cleanDomains: string[];
  /** Suggested neighborhood score (0-100, higher = cleaner) */
  suggestedScore: number;
  /** Total number of outbound links found */
  totalOutbound: number;
  /** Number of unique external domains */
  uniqueDomains: number;
}

// ---------------------------------------------------------------------------
// Suspect patterns (regex)
// ---------------------------------------------------------------------------

const SUSPECT_PATTERNS: { category: string; regex: RegExp }[] = [
  { category: "gambling", regex: /casino|poker|slots?|bet(?:ting)?|gambl/i },
  { category: "pharma", regex: /pharma|pills?|viagra|cialis|medicine|prescription/i },
  { category: "adult", regex: /porn|xxx|adult|nsfw|sex(?:cam|toy|chat)|escort/i },
  { category: "payday", regex: /payday|(?:cash|money)-?advance|instant-?loan|quick-?loan/i },
  { category: "crypto-spam", regex: /crypto-?invest|bitcoin-?profit|free-?bitcoin/i },
  { category: "seo-spam", regex: /cheap-?seo|buy-?links?|link-?farm|pbn/i },
];

/** Fetch timeout per request (ms) */
const FETCH_TIMEOUT_MS = 8_000;

/** Max HTML body size (1MB) */
const MAX_BODY_SIZE = 1_048_576;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-analyze the link neighborhood of a domain by fetching its homepage,
 * extracting all outbound links, and flagging suspect domains.
 *
 * The suggested score is computed as:
 * - Start at 100
 * - Penalize for each suspect domain (-15 each, min 0)
 * - Penalize for very high outbound link count (>100 links = -10, >200 = -20)
 * - Penalize if suspect ratio > 10% of total unique domains (-10)
 *
 * @param domain - Clean domain (e.g. "example.com")
 */
export async function preAnalyzeNeighborhood(
  domain: string,
): Promise<NeighborhoodPreAnalysis> {
  log.info({ domain }, "Starting neighborhood pre-analysis");

  const outboundDomains: Record<string, number> = {};
  const suspectDomains: string[] = [];
  const cleanDomains: string[] = [];

  try {
    // Fetch homepage
    const html = await fetchHomepage(domain);
    if (!html) {
      log.warn({ domain }, "Could not fetch homepage for neighborhood analysis");
      return {
        outboundDomains: {},
        suspectDomains: [],
        cleanDomains: [],
        suggestedScore: 50, // Neutral when we can't check
        totalOutbound: 0,
        uniqueDomains: 0,
      };
    }

    // Parse HTML and extract outbound links
    const $ = cheerio.load(html);
    const links = $('a[href^="http"]');

    links.each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      try {
        const linkUrl = new URL(href);
        const linkDomain = linkUrl.hostname.toLowerCase().replace(/^www\./, "");

        // Skip links pointing to the same domain
        if (linkDomain === domain || linkDomain.endsWith(`.${domain}`)) {
          return;
        }

        // Count per domain
        outboundDomains[linkDomain] = (outboundDomains[linkDomain] ?? 0) + 1;
      } catch {
        // Invalid URL, skip
      }
    });

    // Classify domains
    const uniqueExternalDomains = Object.keys(outboundDomains);

    for (const extDomain of uniqueExternalDomains) {
      const isSuspect = SUSPECT_PATTERNS.some(({ regex }) => regex.test(extDomain));
      if (isSuspect) {
        suspectDomains.push(extDomain);
      } else {
        cleanDomains.push(extDomain);
      }
    }

    // Calculate suggested score
    const suggestedScore = computeScore(
      uniqueExternalDomains.length,
      suspectDomains.length,
      Object.values(outboundDomains).reduce((a, b) => a + b, 0),
    );

    log.info(
      {
        domain,
        totalOutbound: Object.values(outboundDomains).reduce((a, b) => a + b, 0),
        uniqueDomains: uniqueExternalDomains.length,
        suspectCount: suspectDomains.length,
        suggestedScore,
      },
      "Neighborhood pre-analysis complete",
    );

    return {
      outboundDomains,
      suspectDomains,
      cleanDomains,
      suggestedScore,
      totalOutbound: Object.values(outboundDomains).reduce((a, b) => a + b, 0),
      uniqueDomains: uniqueExternalDomains.length,
    };
  } catch (err) {
    log.error({ err, domain }, "Neighborhood pre-analysis failed");
    return {
      outboundDomains: {},
      suspectDomains: [],
      cleanDomains: [],
      suggestedScore: 50,
      totalOutbound: 0,
      uniqueDomains: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the homepage HTML of a domain.
 */
async function fetchHomepage(domain: string): Promise<string | null> {
  const url = `https://${domain}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BacklinkEngine/1.0; +https://sosexpat.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        break;
      }
    }

    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c, { stream: true })).join("");
  } catch {
    // Try HTTP fallback
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(`http://${domain}`, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BacklinkEngine/1.0; +https://sosexpat.com)",
          Accept: "text/html",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) return null;

      const text = await response.text();
      return text.slice(0, MAX_BODY_SIZE);
    } catch {
      return null;
    }
  }
}

/**
 * Compute neighborhood quality score (0-100).
 */
function computeScore(
  uniqueDomains: number,
  suspectCount: number,
  totalOutbound: number,
): number {
  let score = 100;

  // Penalize each suspect domain (-15 each)
  score -= suspectCount * 15;

  // Penalize high outbound link count (link farm signal)
  if (totalOutbound > 200) {
    score -= 20;
  } else if (totalOutbound > 100) {
    score -= 10;
  }

  // Penalize if suspect ratio is high (>10% of unique domains are suspect)
  if (uniqueDomains > 0) {
    const suspectRatio = suspectCount / uniqueDomains;
    if (suspectRatio > 0.1) {
      score -= 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}
