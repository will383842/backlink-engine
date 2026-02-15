// ─────────────────────────────────────────────────────────────
// Country detection service (TLD-based heuristic)
// ─────────────────────────────────────────────────────────────

/**
 * Detect country from domain TLD.
 *
 * Uses ISO 3166-1 alpha-2 codes (2 letters).
 *
 * Examples:
 * - example.fr → FR
 * - example.de → DE
 * - example.co.uk → GB
 */
export function detectCountryFromDomain(domain: string): string {
  // TLD to ISO 3166-1 alpha-2 mapping (ENHANCED)
  const tldToCountry: Record<string, string> = {
    // European countries
    fr: "FR",
    de: "DE",
    uk: "GB",
    es: "ES",
    pt: "PT",
    it: "IT",
    nl: "NL",
    be: "BE",
    ch: "CH",
    at: "AT",
    pl: "PL",
    se: "SE",
    no: "NO",
    fi: "FI",
    dk: "DK",
    ie: "IE",
    gr: "GR",
    cz: "CZ",
    ro: "RO",
    hu: "HU",
    bg: "BG",
    sk: "SK",
    hr: "HR",
    si: "SI",
    lt: "LT",
    lv: "LV",
    ee: "EE",
    ua: "UA",
    by: "BY",
    rs: "RS",
    mk: "MK",
    al: "AL",
    ba: "BA",
    me: "ME",
    xk: "XK",

    // Americas
    us: "US",
    ca: "CA",
    mx: "MX",
    br: "BR",
    ar: "AR",
    cl: "CL",
    co: "CO",
    pe: "PE",
    ve: "VE",
    uy: "UY",
    py: "PY",
    bo: "BO",
    ec: "EC",
    gt: "GT",
    cu: "CU",
    hn: "HN",
    sv: "SV",
    ni: "NI",
    cr: "CR",
    pa: "PA",
    do: "DO",
    pr: "PR",

    // Asia-Pacific
    cn: "CN",
    jp: "JP",
    kr: "KR",
    in: "IN",
    au: "AU",
    nz: "NZ",
    sg: "SG",
    hk: "HK",
    tw: "TW",
    th: "TH",
    my: "MY",
    ph: "PH",
    id: "ID",
    vn: "VN",
    kh: "KH",
    la: "LA",
    mm: "MM",
    bn: "BN",
    np: "NP",
    bd: "BD",
    lk: "LK",
    pk: "PK",
    af: "AF",
    mn: "MN",

    // Middle East & Africa
    ae: "AE",
    sa: "SA",
    il: "IL",
    tr: "TR",
    eg: "EG",
    za: "ZA",
    ng: "NG",
    ke: "KE",
    ma: "MA",
    tn: "TN",
    dz: "DZ",
    ly: "LY",
    sd: "SD",
    et: "ET",
    ug: "UG",
    tz: "TZ",
    gh: "GH",
    ci: "CI",
    sn: "SN",
    cm: "CM",
    ao: "AO",
    mz: "MZ",
    zw: "ZW",
    bw: "BW",
    na: "NA",
    mw: "MW",
    zm: "ZM",

    // Generic TLDs - will be handled specially below
  };

  const parts = domain.split(".");

  // Try last part (TLD)
  const tld = parts[parts.length - 1];
  if (tld && tldToCountry[tld]) {
    return tldToCountry[tld];
  }

  // Try second-level domain for .co.uk, .com.au, .com.br, etc.
  if (parts.length >= 3) {
    const secondLevel = parts[parts.length - 2];
    const topLevel = parts[parts.length - 1];

    // .co.uk → GB, .com.au → AU, etc.
    if ((secondLevel === "co" || secondLevel === "com") && tldToCountry[topLevel]) {
      return tldToCountry[topLevel];
    }
  }

  // Check for country keywords in domain name (ENHANCED)
  const domainLower = domain.toLowerCase();
  const countryKeywords: Record<string, string> = {
    // French variations
    france: "FR",
    french: "FR",
    francais: "FR",

    // German variations
    deutschland: "DE",
    germany: "DE",
    german: "DE",
    deutsch: "DE",

    // Spanish variations
    spain: "ES",
    spanish: "ES",
    espana: "ES",
    espanol: "ES",

    // Portuguese variations
    portugal: "PT",
    portuguese: "PT",
    brasil: "BR",
    brazil: "BR",

    // Italian variations
    italia: "IT",
    italy: "IT",
    italian: "IT",

    // Other European
    nederland: "NL",
    netherlands: "NL",
    belgium: "BE",
    belgique: "BE",
    schweiz: "CH",
    suisse: "CH",
    svizzera: "CH",
    switzerland: "CH",
    austria: "AT",
    osterreich: "AT",
    polska: "PL",
    poland: "PL",
    sverige: "SE",
    sweden: "SE",
    norge: "NO",
    norway: "NO",
    suomi: "FI",
    finland: "FI",
    danmark: "DK",
    denmark: "DK",
    ireland: "IE",
    greece: "GR",
    czech: "CZ",
    romania: "RO",
    hungary: "HU",
    bulgaria: "BG",
    slovakia: "SK",
    croatia: "HR",
    slovenia: "SI",
    lithuania: "LT",
    latvia: "LV",
    estonia: "EE",

    // Russian/Eastern Europe
    russia: "RU",
    russian: "RU",
    ukraine: "UA",

    // Americas
    canada: "CA",
    mexico: "MX",
    argentina: "AR",
    chile: "CL",
    colombia: "CO",
    peru: "PE",
    venezuela: "VE",

    // Asia
    china: "CN",
    chinese: "CN",
    japan: "JP",
    japanese: "JP",
    korea: "KR",
    korean: "KR",
    india: "IN",
    indian: "IN",
    australia: "AU",
    aussie: "AU",
    singapore: "SG",
    thailand: "TH",
    vietnam: "VN",
    philippines: "PH",
    indonesia: "ID",
    malaysia: "MY",

    // Middle East
    emirates: "AE",
    dubai: "AE",
    saudi: "SA",
    israel: "IL",
    turkey: "TR",
    egypt: "EG",

    // Africa
    africa: "ZA",
    southafrica: "ZA",
    nigeria: "NG",
    kenya: "KE",
  };

  for (const [keyword, country] of Object.entries(countryKeywords)) {
    if (domainLower.includes(keyword)) {
      return country;
    }
  }

  // For generic TLDs (.com, .org, .net, etc.), analyze domain name for hints
  if (["com", "org", "net", "io", "co", "info", "biz", "app", "dev"].includes(tld || "")) {
    // Check for language-specific characters
    if (/[àâäæçéèêëïîôùûüÿœ]/.test(domainLower)) return "FR"; // French accents
    if (/[äöüß]/.test(domainLower)) return "DE"; // German umlauts
    if (/[áéíóúñ]/.test(domainLower)) return "ES"; // Spanish accents
    if (/[àãâáéêíóõôúç]/.test(domainLower)) return "PT"; // Portuguese accents
    if (/[àèéìòù]/.test(domainLower)) return "IT"; // Italian accents
    if (/[а-яё]/.test(domainLower)) return "RU"; // Cyrillic
    if (/[一-龯]/.test(domainLower)) return "CN"; // Chinese characters
    if (/[\u0600-\u06FF]/.test(domainLower)) return "SA"; // Arabic

    // Default for .com, .org, .net → US
    return "US";
  }

  // Ultimate fallback: US
  return "US";
}
