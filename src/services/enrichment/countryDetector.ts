// ---------------------------------------------------------------------------
// Country Detector - Detect country from domain TLD (ISO 3166-1 alpha-2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ccTLD to ISO 3166-1 alpha-2 mapping
// ---------------------------------------------------------------------------

const CCTLD_COUNTRY_MAP: Record<string, string> = {
  // Europe
  ".fr": "FR",
  ".de": "DE",
  ".es": "ES",
  ".it": "IT",
  ".pt": "PT",
  ".nl": "NL",
  ".be": "BE",
  ".lu": "LU",
  ".ch": "CH",
  ".at": "AT",
  ".li": "LI",
  ".mc": "MC",
  ".co.uk": "GB",
  ".uk": "GB",
  ".ie": "IE",
  ".se": "SE",
  ".no": "NO",
  ".dk": "DK",
  ".fi": "FI",
  ".pl": "PL",
  ".cz": "CZ",
  ".sk": "SK",
  ".hu": "HU",
  ".ro": "RO",
  ".bg": "BG",
  ".hr": "HR",
  ".si": "SI",
  ".rs": "RS",
  ".ba": "BA",
  ".me": "ME",   // Note: .me is also used as generic TLD
  ".mk": "MK",
  ".al": "AL",
  ".gr": "GR",
  ".cy": "CY",
  ".mt": "MT",
  ".ee": "EE",
  ".lv": "LV",
  ".lt": "LT",
  ".ua": "UA",
  ".by": "BY",
  ".md": "MD",

  // Americas
  ".us": "US",
  ".ca": "CA",
  ".mx": "MX",
  ".com.br": "BR",
  ".br": "BR",
  ".ar": "AR",
  ".cl": "CL",
  ".co": "CO",
  ".pe": "PE",
  ".ve": "VE",
  ".ec": "EC",
  ".uy": "UY",
  ".py": "PY",
  ".bo": "BO",
  ".cr": "CR",
  ".gt": "GT",
  ".hn": "HN",
  ".sv": "SV",
  ".ni": "NI",
  ".pa": "PA",
  ".do": "DO",
  ".cu": "CU",
  ".pr": "PR",
  ".jm": "JM",
  ".tt": "TT",

  // Asia
  ".ru": "RU",
  ".su": "RU",
  ".cn": "CN",
  ".jp": "JP",
  ".kr": "KR",
  ".in": "IN",
  ".pk": "PK",
  ".bd": "BD",
  ".lk": "LK",
  ".th": "TH",
  ".vn": "VN",
  ".id": "ID",
  ".my": "MY",
  ".sg": "SG",
  ".ph": "PH",
  ".tw": "TW",
  ".hk": "HK",
  ".mm": "MM",
  ".kh": "KH",
  ".la": "LA",
  ".np": "NP",
  ".kz": "KZ",
  ".uz": "UZ",
  ".tm": "TM",
  ".kg": "KG",
  ".tj": "TJ",
  ".az": "AZ",
  ".ge": "GE",
  ".am": "AM",
  ".mn": "MN",

  // Middle East
  ".tr": "TR",
  ".sa": "SA",
  ".ae": "AE",
  ".eg": "EG",
  ".qa": "QA",
  ".kw": "KW",
  ".bh": "BH",
  ".om": "OM",
  ".jo": "JO",
  ".lb": "LB",
  ".iq": "IQ",
  ".ir": "IR",
  ".il": "IL",
  ".ps": "PS",
  ".ye": "YE",
  ".sy": "SY",

  // Africa
  ".za": "ZA",
  ".ng": "NG",
  ".gh": "GH",
  ".ke": "KE",
  ".tz": "TZ",
  ".ug": "UG",
  ".et": "ET",
  ".sn": "SN",
  ".ci": "CI",
  ".cm": "CM",
  ".cd": "CD",
  ".mg": "MG",
  ".tn": "TN",
  ".dz": "DZ",
  ".ma": "MA",
  ".ly": "LY",
  ".ao": "AO",
  ".mz": "MZ",
  ".zw": "ZW",
  ".bw": "BW",
  ".na": "NA",
  ".rw": "RW",
  ".mu": "MU",

  // Oceania
  ".au": "AU",
  ".nz": "NZ",
  ".fj": "FJ",
};

/** Generic TLDs where country cannot be inferred */
const GENERIC_TLDS = new Set([
  ".com",
  ".org",
  ".net",
  ".info",
  ".biz",
  ".io",
  ".app",
  ".dev",
  ".xyz",
  ".online",
  ".site",
  ".tech",
  ".store",
  ".blog",
  ".co",  // .co is technically Colombia but widely used as generic
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the country of a domain based on its ccTLD.
 *
 * If `existingCountry` is provided and non-empty, it is returned as-is.
 * Otherwise, the TLD is matched against a known ccTLD-to-country mapping.
 * Generic TLDs (.com, .org, .net, etc.) return an empty string.
 *
 * @param domain - Clean domain (e.g. "example.fr")
 * @param existingCountry - Previously known country code, if any
 * @returns ISO 3166-1 alpha-2 country code or empty string
 */
export function detectCountry(domain: string, existingCountry?: string): string {
  if (existingCountry && existingCountry.trim().length > 0) {
    return existingCountry.trim().toUpperCase();
  }

  const lower = domain.toLowerCase();

  // Try compound ccTLDs first (e.g. .co.uk, .com.br) - longest match wins
  for (const [tld, country] of Object.entries(CCTLD_COUNTRY_MAP)) {
    if (tld.includes(".") && tld.startsWith(".") && tld.split(".").length > 2) {
      if (lower.endsWith(tld)) {
        return country;
      }
    }
  }

  // Extract the last TLD segment
  const lastDot = lower.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }

  const tld = lower.slice(lastDot);

  // Skip generic TLDs
  if (GENERIC_TLDS.has(tld)) {
    return "";
  }

  const country = CCTLD_COUNTRY_MAP[tld];
  return country ?? "";
}
