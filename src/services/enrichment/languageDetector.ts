import { franc } from "franc";
import { load } from "cheerio";

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
 * Detect language from domain TLD (ENHANCED - always returns a value).
 *
 * Examples:
 * - example.fr → fr
 * - example.de → de
 * - example.co.uk → en
 * - example.com → en (fallback)
 */
export function detectLanguageFromDomain(domain: string): string {
  const tldMap: Record<string, string> = {
    // European languages
    fr: "fr",
    de: "de",
    es: "es",
    pt: "pt",
    it: "it",
    nl: "nl",
    be: "fr", // Belgium (Dutch/French - default French for MailWizz)
    ch: "de", // Switzerland (German/French/Italian - default German)
    at: "de", // Austria (German)
    pl: "pl",
    se: "en", // Sweden (we support Swedish but fallback to English if not in enum)
    no: "en", // Norway
    fi: "en", // Finland
    dk: "en", // Denmark
    ie: "en", // Ireland
    gr: "en", // Greece
    cz: "en", // Czech Republic
    ro: "en", // Romania
    hu: "en", // Hungary
    bg: "en", // Bulgaria
    sk: "en", // Slovakia
    hr: "en", // Croatia
    si: "en", // Slovenia
    lt: "en", // Lithuania
    lv: "en", // Latvia
    ee: "en", // Estonia

    // Russian & Eastern Europe
    ru: "ru",
    ua: "ru", // Ukraine
    by: "ru", // Belarus

    // Americas
    us: "en",
    ca: "en", // Canada
    mx: "es",
    br: "pt",
    ar: "es", // Argentina
    cl: "es", // Chile
    co: "es", // Colombia
    pe: "es", // Peru
    ve: "es", // Venezuela

    // Asia
    cn: "zh",
    hk: "zh",
    tw: "zh",
    jp: "en", // Japan (we don't support Japanese in enum)
    kr: "en", // Korea
    in: "hi", // India
    au: "en",
    nz: "en",
    sg: "en",
    th: "en", // Thailand
    my: "en", // Malaysia
    ph: "en", // Philippines
    id: "en", // Indonesia
    vn: "en", // Vietnam

    // Middle East & Africa
    ae: "ar",
    sa: "ar",
    il: "en", // Israel
    tr: "en", // Turkey
    eg: "ar",
    za: "en",
    ng: "en",
    ke: "en",

    // Generic TLDs - default to English
    com: "en",
    org: "en",
    net: "en",
    io: "en",
    co: "en",
    info: "en",
    biz: "en",
    app: "en",
    dev: "en",
  };

  const parts = domain.split(".");

  // Try last part (TLD)
  const tld = parts[parts.length - 1];
  if (tld && tldMap[tld]) {
    return tldMap[tld];
  }

  // Try second-level for .co.uk, .com.au, etc.
  if (parts.length >= 3) {
    const secondLevel = parts[parts.length - 2];
    if (secondLevel && tldMap[secondLevel]) {
      return tldMap[secondLevel];
    }
  }

  // Check for language keywords in domain name
  const domainLower = domain.toLowerCase();
  const languageKeywords: Record<string, string> = {
    french: "fr",
    francais: "fr",
    france: "fr",
    deutsch: "de",
    german: "de",
    germany: "de",
    spanish: "es",
    espanol: "es",
    spain: "es",
    portuguese: "pt",
    portugal: "pt",
    russian: "ru",
    russia: "ru",
    chinese: "zh",
    china: "zh",
    hindi: "hi",
    india: "hi",
    arabic: "ar",
  };

  for (const [keyword, lang] of Object.entries(languageKeywords)) {
    if (domainLower.includes(keyword)) {
      return lang;
    }
  }

  // Ultimate fallback: English
  return "en";
}
