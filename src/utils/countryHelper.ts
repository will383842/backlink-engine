// ─────────────────────────────────────────────────────────────
// Country Helper - Convert ISO codes to full names
// ─────────────────────────────────────────────────────────────

import { countries, getCountryByCode } from "../data/countries.js";

/**
 * Get country name in specified language
 * @param isoCode - ISO 3166-1 alpha-2 code (e.g., "FR", "DE")
 * @param lang - Language ("fr" or "en")
 */
export function getCountryName(isoCode: string, lang: "fr" | "en" = "fr"): string {
  if (!isoCode) return "";

  const country = getCountryByCode(isoCode);
  if (!country) return isoCode; // Fallback to ISO if not found

  return lang === "fr" ? country.nameFr : country.nameEn;
}

/**
 * Get all countries as options for select dropdown
 */
export function getCountryOptions(lang: "fr" | "en" = "fr") {
  return countries.map((country) => ({
    value: country.code,
    label: lang === "fr" ? country.nameFr : country.nameEn,
    flag: country.flag,
  }));
}

/**
 * Enrich prospects with country names (for API responses)
 */
export function enrichProspectWithCountryName(prospect: any, lang: "fr" | "en" = "fr") {
  return {
    ...prospect,
    countryName: prospect.country ? getCountryName(prospect.country, lang) : null,
  };
}
