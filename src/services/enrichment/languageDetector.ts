import { franc } from "franc";
import { load } from "cheerio";
import { proxyFetch } from "../../config/proxy.js";

// ─────────────────────────────────────────────────────────────
// Language detection service (using franc + HTML lang attribute)
// ─────────────────────────────────────────────────────────────

// All languages are supported — no restriction. Detection returns any ISO 639-1 code.
// Fallback: "en" when detection fails.

// ISO 639-3 to ISO 639-1 mapping (franc uses ISO 639-3)
const ISO_639_3_TO_1: Record<string, string> = {
  fra: "fr", eng: "en", deu: "de", spa: "es", por: "pt",
  rus: "ru", arb: "ar", cmn: "zh", hin: "hi", nld: "nl",
  ita: "it", pol: "pl", tur: "tr", jpn: "ja", kor: "ko",
  swe: "sv", dan: "da", nob: "no", nno: "no", fin: "fi",
  ces: "cs", ron: "ro", tha: "th", vie: "vi", ind: "id",
  msa: "ms", ukr: "uk", ell: "el", heb: "he", swa: "sw",
  hun: "hu", bul: "bg", hrv: "hr", slk: "sk", slv: "sl",
  lit: "lt", lav: "lv", est: "et", srp: "sr", cat: "ca",
  tgl: "tl", afr: "af", kat: "ka", hye: "hy", ben: "bn",
  tam: "ta", tel: "te", mal: "ml", kan: "kn", urd: "ur",
  fas: "fa", mya: "my", khm: "km", lao: "lo", amh: "am",
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

    const response = await proxyFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Strategy 1: Check HTML lang attribute
    const htmlLang = $("html").attr("lang");
    if (htmlLang) {
      const langCode = htmlLang.toLowerCase().split("-")[0]; // "en-US" → "en"
      if (langCode && langCode.length >= 2 && langCode.length <= 3) {
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

    if (langCode) {
      return langCode;
    }

    // franc returned an unknown code — fallback to null (will default to "en")
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
    se: "sv", // Sweden
    no: "no", // Norway
    fi: "fi", // Finland
    dk: "da", // Denmark
    ie: "en", // Ireland
    gr: "el", // Greece
    cz: "cs", // Czech Republic
    ro: "ro", // Romania
    hu: "hu", // Hungary
    bg: "bg", // Bulgaria
    sk: "sk", // Slovakia
    hr: "hr", // Croatia
    si: "sl", // Slovenia
    lt: "lt", // Lithuania
    lv: "lv", // Latvia
    ee: "et", // Estonia

    // Russian & Eastern Europe
    ru: "ru",
    ua: "uk", // Ukraine
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
    jp: "ja", // Japan
    kr: "ko", // Korea
    in: "hi", // India
    au: "en",
    nz: "en",
    sg: "en",
    th: "th", // Thailand
    my: "ms", // Malaysia
    ph: "tl", // Philippines (Tagalog)
    id: "id", // Indonesia
    vn: "vi", // Vietnam

    // Middle East & Africa
    ae: "ar",
    sa: "ar",
    il: "he", // Israel
    tr: "tr", // Turkey
    eg: "ar",
    za: "en",
    ng: "en",
    ke: "sw", // Kenya (Swahili)

    // Generic TLDs - default to English
    com: "en",
    org: "en",
    net: "en",
    io: "en",
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
