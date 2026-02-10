// ---------------------------------------------------------------------------
// Domain Safety Checker - Verify domain reputation using multiple signals
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("domain-checker");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafetyResult {
  /** Overall safety verdict */
  isSafe: boolean;
  /** Google Safe Browsing result */
  safeBrowsing: "safe" | "malware" | "phishing" | "unwanted" | "error" | "unchecked";
  /** Whether the domain is listed in Spamhaus DNSBL */
  spamhaus: boolean;
  /** Domain name heuristic flags */
  domainFlags: Record<string, boolean>;
  /** Human-readable safety summary */
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Domain name heuristic patterns */
const DOMAIN_HEURISTICS: { name: string; regex: RegExp }[] = [
  { name: "gambling", regex: /casino|poker|slots?|bet(?:ting)?|gambl/i },
  { name: "pharma", regex: /pharma|pills?|viagra|cialis|medicine|rx-/i },
  { name: "adult", regex: /porn|xxx|adult|nsfw|sex(?:cam|toy|chat)|escort/i },
  { name: "payday", regex: /payday|cash-?advance|instant-?loan|quick-?loan/i },
  { name: "crypto_spam", regex: /crypto-?profit|bitcoin-?profit|free-?bitcoin|moon-?coin/i },
  { name: "seo_spam", regex: /cheap-?seo|buy-?links?|link-?farm|pbn-?|backlink-?cheap/i },
  { name: "suspicious_tld", regex: /\.(xyz|top|win|loan|click|gdn|racing|review|accountant|science|date|faith|party|download|stream|bid|trade)$/i },
  { name: "excessive_hyphens", regex: /-.*-.*-.*-/i },
  { name: "too_long", regex: /^.{60,}$/i },
  { name: "random_chars", regex: /[a-z]{20,}/i },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check the safety of a domain using multiple signals:
 *
 * 1. **Google Safe Browsing API** - Checks if the site is flagged as malware,
 *    phishing, or unwanted software.
 * 2. **Spamhaus DNSBL** - Checks if the domain is on the Spamhaus blocklist
 *    via DNS lookup.
 * 3. **Domain name heuristics** - Regex patterns to flag suspicious domain names.
 *
 * @param domain - Clean domain (e.g. "example.com")
 */
export async function checkDomainSafety(domain: string): Promise<SafetyResult> {
  log.info({ domain }, "Checking domain safety");

  // Run all checks in parallel
  const [safeBrowsingResult, spamhausResult, heuristicFlags] =
    await Promise.all([
      checkGoogleSafeBrowsing(domain),
      checkSpamhaus(domain),
      checkDomainHeuristics(domain),
    ]);

  // Determine overall safety
  const hasDomainFlags = Object.values(heuristicFlags).some((v) => v);
  const isSafe =
    safeBrowsingResult === "safe" &&
    !spamhausResult &&
    !hasDomainFlags;

  // Build summary
  const issues: string[] = [];
  if (safeBrowsingResult !== "safe" && safeBrowsingResult !== "unchecked") {
    issues.push(`Safe Browsing: ${safeBrowsingResult}`);
  }
  if (spamhausResult) {
    issues.push("Listed in Spamhaus DNSBL");
  }
  const flaggedHeuristics = Object.entries(heuristicFlags)
    .filter(([_, v]) => v)
    .map(([k]) => k);
  if (flaggedHeuristics.length > 0) {
    issues.push(`Domain flags: ${flaggedHeuristics.join(", ")}`);
  }

  const summary = isSafe
    ? "Domain appears safe"
    : `Domain flagged: ${issues.join("; ")}`;

  const result: SafetyResult = {
    isSafe,
    safeBrowsing: safeBrowsingResult,
    spamhaus: spamhausResult,
    domainFlags: heuristicFlags,
    summary,
  };

  log.info(
    { domain, isSafe, safeBrowsing: safeBrowsingResult, spamhaus: spamhausResult },
    "Domain safety check complete",
  );

  return result;
}

// ---------------------------------------------------------------------------
// Google Safe Browsing check
// ---------------------------------------------------------------------------

async function checkGoogleSafeBrowsing(
  domain: string,
): Promise<SafetyResult["safeBrowsing"]> {
  const apiKey = process.env["GOOGLE_SAFE_BROWSING_API_KEY"];
  if (!apiKey) {
    log.debug("Google Safe Browsing API key not configured, skipping");
    return "unchecked";
  }

  try {
    const url = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "backlink-engine",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [
            { url: `https://${domain}/` },
            { url: `http://${domain}/` },
          ],
        },
      }),
    });

    if (!response.ok) {
      log.warn(
        { status: response.status, domain },
        "Google Safe Browsing API returned error",
      );
      return "error";
    }

    const data = (await response.json()) as {
      matches?: Array<{ threatType: string }>;
    };

    if (!data.matches || data.matches.length === 0) {
      return "safe";
    }

    // Map threat type to our categories
    const threatType = data.matches[0]?.threatType ?? "";
    if (threatType.includes("MALWARE")) return "malware";
    if (threatType.includes("SOCIAL_ENGINEERING")) return "phishing";
    return "unwanted";
  } catch (err) {
    log.error({ err, domain }, "Google Safe Browsing check failed");
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Spamhaus DNSBL check
// ---------------------------------------------------------------------------

async function checkSpamhaus(domain: string): Promise<boolean> {
  try {
    // Spamhaus DBL (Domain Block List) check via DNS
    // Query: <domain>.dbl.spamhaus.org
    // If it resolves, the domain is listed
    const dblQuery = `${domain}.dbl.spamhaus.org`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      // Use DNS-over-HTTPS (DoH) to check DNSBL listing
      const response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(dblQuery)}&type=A`,
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        Status: number;
        Answer?: Array<{ data: string }>;
      };

      // Status 0 = NOERROR, meaning the domain resolved (is listed)
      // A response of 127.0.1.x indicates listing in Spamhaus DBL
      if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
        const ip = data.Answer[0]?.data ?? "";
        if (ip.startsWith("127.0.1.")) {
          log.warn({ domain, ip }, "Domain listed in Spamhaus DBL");
          return true;
        }
      }

      return false;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch (err) {
    log.error({ err, domain }, "Spamhaus check failed");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Domain name heuristics
// ---------------------------------------------------------------------------

async function checkDomainHeuristics(
  domain: string,
): Promise<Record<string, boolean>> {
  const flags: Record<string, boolean> = {};

  for (const { name, regex } of DOMAIN_HEURISTICS) {
    flags[name] = regex.test(domain);
  }

  return flags;
}
