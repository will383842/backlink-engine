// ---------------------------------------------------------------------------
// Language Detector - Detect language from domain TLD
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TLD to language mapping
// ---------------------------------------------------------------------------

const TLD_LANGUAGE_MAP: Record<string, string> = {
  // French
  ".fr": "fr",
  ".be": "fr",    // Belgium (primarily French for our use-case)
  ".lu": "fr",    // Luxembourg
  ".mc": "fr",    // Monaco
  ".sn": "fr",    // Senegal
  ".ci": "fr",    // Ivory Coast
  ".mg": "fr",    // Madagascar
  ".tn": "fr",    // Tunisia
  ".dz": "fr",    // Algeria
  ".ma": "fr",    // Morocco
  ".cm": "fr",    // Cameroon
  ".cd": "fr",    // DRC

  // English
  ".co.uk": "en",
  ".uk": "en",
  ".us": "en",
  ".ca": "en",
  ".au": "en",
  ".nz": "en",
  ".ie": "en",
  ".za": "en",    // South Africa
  ".ng": "en",    // Nigeria
  ".gh": "en",    // Ghana
  ".ke": "en",    // Kenya
  ".in": "en",    // India (English default for our purposes)
  ".sg": "en",    // Singapore
  ".ph": "en",    // Philippines

  // German
  ".de": "de",
  ".at": "de",    // Austria
  ".ch": "de",    // Switzerland (German default)
  ".li": "de",    // Liechtenstein

  // Spanish
  ".es": "es",
  ".mx": "es",
  ".ar": "es",    // Argentina
  ".cl": "es",    // Chile
  ".co": "es",    // Colombia
  ".pe": "es",    // Peru
  ".ve": "es",    // Venezuela
  ".ec": "es",    // Ecuador
  ".uy": "es",    // Uruguay
  ".py": "es",    // Paraguay
  ".bo": "es",    // Bolivia
  ".cr": "es",    // Costa Rica
  ".gt": "es",    // Guatemala
  ".hn": "es",    // Honduras
  ".sv": "es",    // El Salvador
  ".ni": "es",    // Nicaragua
  ".pa": "es",    // Panama
  ".do": "es",    // Dominican Republic
  ".cu": "es",    // Cuba

  // Portuguese
  ".pt": "pt",
  ".com.br": "pt",
  ".br": "pt",
  ".ao": "pt",    // Angola
  ".mz": "pt",    // Mozambique

  // Russian
  ".ru": "ru",
  ".su": "ru",
  ".by": "ru",    // Belarus
  ".kz": "ru",    // Kazakhstan

  // Arabic
  ".sa": "ar",    // Saudi Arabia
  ".ae": "ar",    // UAE
  ".eg": "ar",    // Egypt
  ".qa": "ar",    // Qatar
  ".kw": "ar",    // Kuwait
  ".bh": "ar",    // Bahrain
  ".om": "ar",    // Oman
  ".jo": "ar",    // Jordan
  ".lb": "ar",    // Lebanon
  ".iq": "ar",    // Iraq

  // Chinese
  ".cn": "zh",
  ".tw": "zh",
  ".hk": "zh",

  // Hindi
  // Note: .in is mapped to "en" above since most Indian websites targeting
  // international audiences use English. Hindi detection should use content analysis.

  // Japanese
  ".jp": "ja",

  // Italian
  ".it": "it",

  // Dutch
  ".nl": "nl",

  // Polish
  ".pl": "pl",

  // Swedish
  ".se": "sv",

  // Norwegian
  ".no": "no",

  // Danish
  ".dk": "da",

  // Finnish
  ".fi": "fi",

  // Czech
  ".cz": "cs",

  // Romanian
  ".ro": "ro",

  // Turkish
  ".tr": "tr",

  // Korean
  ".kr": "ko",

  // Thai
  ".th": "th",

  // Vietnamese
  ".vn": "vi",
};

/** Generic TLDs where language cannot be inferred */
const GENERIC_TLDS = new Set([
  ".com",
  ".org",
  ".net",
  ".info",
  ".biz",
  ".io",
  ".co",
  ".app",
  ".dev",
  ".me",
  ".xyz",
  ".online",
  ".site",
  ".tech",
  ".store",
  ".blog",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the language of a domain based on its TLD.
 *
 * If `existingLang` is provided and non-empty, it is returned as-is.
 * Otherwise, the TLD is matched against a known mapping.
 * Generic TLDs (.com, .org, .net, etc.) return "unknown".
 *
 * @param domain - Clean domain (e.g. "example.fr")
 * @param existingLang - Previously known language, if any
 * @returns ISO 639-1 language code or "unknown"
 */
export function detectLanguage(domain: string, existingLang?: string): string {
  if (existingLang && existingLang.trim().length > 0) {
    return existingLang.trim().toLowerCase();
  }

  const lower = domain.toLowerCase();

  // Try compound TLDs first (e.g. .co.uk, .com.br) - longest match wins
  for (const [tld, lang] of Object.entries(TLD_LANGUAGE_MAP)) {
    if (tld.includes(".") && tld.startsWith(".")) {
      // Compound TLD: check if domain ends with it
      if (lower.endsWith(tld)) {
        return lang;
      }
    }
  }

  // Extract the last TLD segment
  const lastDot = lower.lastIndexOf(".");
  if (lastDot === -1) {
    return "unknown";
  }

  const tld = lower.slice(lastDot);

  // Skip generic TLDs
  if (GENERIC_TLDS.has(tld)) {
    return "unknown";
  }

  // Look up in map
  const lang = TLD_LANGUAGE_MAP[tld];
  return lang ?? "unknown";
}
