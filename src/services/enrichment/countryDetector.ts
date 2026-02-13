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
export function detectCountryFromDomain(domain: string): string | null {
  // TLD to ISO 3166-1 alpha-2 mapping
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
    
    // Middle East & Africa
    ae: "AE",
    sa: "SA",
    il: "IL",
    tr: "TR",
    eg: "EG",
    za: "ZA",
    ng: "NG",
    ke: "KE",
    
    // Generic TLDs (default to US)
    com: "US",
    org: "US",
    net: "US",
    io: "US",
    co: "US",
  };

  const parts = domain.split(".");
  
  // Try last part (TLD)
  const tld = parts[parts.length - 1];
  if (tld && tldToCountry[tld]) {
    return tldToCountry[tld];
  }

  // Try second-level domain for .co.uk, .com.au, etc.
  if (parts.length >= 3) {
    const secondLevel = parts[parts.length - 2];
    if (secondLevel === "co" || secondLevel === "com") {
      const ccTLD = parts[parts.length - 1];
      if (ccTLD && tldToCountry[ccTLD]) {
        return tldToCountry[ccTLD];
      }
    }
  }

  return null;
}
