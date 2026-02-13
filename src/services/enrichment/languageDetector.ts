import { franc } from "franc";
import cheerio from "cheerio";

// ─────────────────────────────────────────────────────────────
// Language detection service (using franc + HTML lang attribute)
// ─────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = ["fr", "en", "de", "es", "pt", "ru", "ar", "zh", "hi"];

// ISO 639-3 to ISO 639-1 mapping (franc uses ISO 639-3)
const ISO_639_3_TO_1: Record<string, string> = {
  fra: "fr",
  eng: "en",
  deu: "de",
  spa: "es",
  por: "pt",
  rus: "ru",
  arb: "ar",
  cmn: "zh",
  hin: "hi",
};

/**
 * Detect language from URL content.
 *
 * Strategy:
 * 1. Try HTML lang attribute
 * 2. Fallback to franc text analysis
 * 3. Return null if detection fails or unsupported language
 */
export async function detectLanguageFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BacklinkEngine/1.0; +https://example.com/bot)",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Strategy 1: Check HTML lang attribute
    const htmlLang = $("html").attr("lang");
    if (htmlLang) {
      const langCode = htmlLang.toLowerCase().split("-")[0]; // "en-US" → "en"
      if (langCode && SUPPORTED_LANGUAGES.includes(langCode)) {
        return langCode;
      }
    }

    // Strategy 2: Extract text content and use franc
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);

    if (bodyText.length < 50) {
      // Not enough text to detect
      return null;
    }

    const detected = franc(bodyText, { minLength: 3 });

    // franc returns ISO 639-3, convert to ISO 639-1
    const langCode = ISO_639_3_TO_1[detected];

    if (langCode && SUPPORTED_LANGUAGES.includes(langCode)) {
      return langCode;
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Detect language from domain TLD (fallback heuristic).
 *
 * Examples:
 * - example.fr → fr
 * - example.de → de
 * - example.co.uk → en
 */
export function detectLanguageFromDomain(domain: string): string | null {
  const tldMap: Record<string, string> = {
    fr: "fr",
    de: "de",
    es: "es",
    pt: "pt",
    ru: "ru",
    cn: "zh",
    in: "hi",
    uk: "en",
    com: "en",
    org: "en",
    net: "en",
  };

  const parts = domain.split(".");
  const tld = parts[parts.length - 1];

  if (tld && tldMap[tld]) {
    return tldMap[tld];
  }

  return null;
}
