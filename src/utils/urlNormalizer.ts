/**
 * URL normalization and domain extraction utilities.
 *
 * All functions are pure and throw on invalid input.
 */

/** Query params that should always be stripped (tracking / analytics). */
const UTM_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "ref",
]);

/**
 * Normalize a raw URL for deduplication and storage.
 *
 * Steps:
 *  1. Trim whitespace
 *  2. Force https scheme
 *  3. Lowercase hostname
 *  4. Remove "www." prefix
 *  5. Strip UTM and common tracking query params
 *  6. Remove fragment / hash
 *  7. Remove trailing slash (except root "/")
 */
export function normalizeUrl(rawUrl: string): string {
  let input = rawUrl.trim();

  // Add scheme if missing
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  // Force https
  input = input.replace(/^http:\/\//i, "https://");

  const url = new URL(input);

  // Lowercase host and remove www.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  // Strip tracking params
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (UTM_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  url.search = params.toString();

  // Remove hash
  url.hash = "";

  // Reconstruct and remove trailing slash (but keep root)
  let normalized = url.toString();
  if (normalized.endsWith("/") && url.pathname !== "/") {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Extract the clean hostname from a raw URL (no "www." prefix).
 *
 * @example
 * extractDomain("https://www.example.com/path") // "example.com"
 */
export function extractDomain(rawUrl: string): string {
  let input = rawUrl.trim();

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  const url = new URL(input);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}
