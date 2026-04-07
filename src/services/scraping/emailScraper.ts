// ─────────────────────────────────────────────────────────────
// Email Scraper - Find emails on a webpage
// ─────────────────────────────────────────────────────────────

import { load } from "cheerio";
import { createChildLogger } from "../../utils/logger.js";
import { validateEmail } from "../email/emailValidator.js";
import { proxyFetch } from "../../config/proxy.js";

const log = createChildLogger("email-scraper");

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const COMMON_PATTERNS = [
  // Email obfuscation patterns
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,     // name [at] domain.com
  /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/gi,  // name @ domain . com
  /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,     // name (at) domain.com
];

// Emails génériques à ignorer
const IGNORE_EMAILS = new Set([
  "example@example.com",
  "test@test.com",
  "admin@localhost",
  "noreply@noreply.com",
  "no-reply@example.com",
]);

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

export interface ScrapedEmail {
  email: string;
  source: "html" | "text" | "mailto" | "obfuscated";
  confidence: "high" | "medium" | "low";
}

// ─────────────────────────────────────────────────────────────
// Multi-page discovery — find contact/about/legal pages
// ─────────────────────────────────────────────────────────────

const CONTACT_PAGE_PATTERNS = [
  // English
  /\/contact/i, /\/about/i, /\/team/i, /\/reach/i, /\/get-in-touch/i,
  /\/write-for-us/i, /\/guest-post/i, /\/collaborate/i, /\/hire/i,
  /\/advertise/i, /\/sponsor/i, /\/partnership/i, /\/work-with/i,
  // French
  /\/contact/i, /\/a-propos/i, /\/equipe/i, /\/nous-contacter/i,
  /\/mentions-legales/i, /\/qui-sommes-nous/i, /\/partenariat/i,
  // German
  /\/kontakt/i, /\/ueber-uns/i, /\/impressum/i, /\/team/i,
  // Spanish
  /\/contacto/i, /\/sobre/i, /\/nosotros/i, /\/aviso-legal/i,
  // Italian
  /\/contatti/i, /\/chi-siamo/i,
  // Dutch
  /\/contact/i, /\/over-ons/i,
  // Portuguese
  /\/contato/i, /\/sobre/i,
  // Generic
  /\/legal/i, /\/privacy/i, /\/imprint/i, /\/disclosure/i,
  /\/editorial/i, /\/contributors/i, /\/authors/i, /\/staff/i,
];

/**
 * Discover contact/about/legal page URLs from a homepage.
 * Returns unique URLs worth scraping for emails.
 */
async function discoverContactPages(homepageUrl: string, html: string): Promise<string[]> {
  const $ = load(html);
  const baseUrl = new URL(homepageUrl);
  const pages = new Set<string>();

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Resolve relative URLs
    let fullUrl: string;
    try {
      fullUrl = new URL(href, homepageUrl).toString();
    } catch {
      return;
    }

    // Only same domain
    try {
      if (new URL(fullUrl).hostname !== baseUrl.hostname) return;
    } catch {
      return;
    }

    // Check if it matches a contact page pattern
    const isContactPage = CONTACT_PAGE_PATTERNS.some((p) => p.test(fullUrl));
    if (isContactPage) {
      pages.add(fullUrl.split("#")[0]!.split("?")[0]!); // Strip fragment and query
    }
  });

  // Also try common paths directly (even if not linked)
  const commonPaths = [
    "/contact", "/contact-us", "/about", "/about-us", "/team",
    "/impressum", "/imprint", "/mentions-legales", "/legal",
    "/a-propos", "/kontakt", "/contacto", "/contatti",
    "/write-for-us", "/guest-post", "/advertise", "/collaborate",
  ];

  for (const path of commonPaths) {
    pages.add(`${baseUrl.origin}${path}`);
  }

  return Array.from(pages).slice(0, 15); // Max 15 pages to scrape
}

/**
 * Scrape emails from a webpage
 */
export async function scrapeEmailsFromUrl(url: string): Promise<ScrapedEmail[]> {
  try {
    log.debug({ url }, "Starting email scraping");

    // 1. Fetch HTML with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await proxyFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.warn({ url, status: response.status }, "Failed to fetch URL");
      return [];
    }

    const html = await response.text();
    const $ = load(html);

    // 2. Extract emails from different sources
    const emails: ScrapedEmail[] = [];

    // Method 1: mailto: links (highest confidence)
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const email = href.replace("mailto:", "").split("?")[0].trim();
        if (isValidEmail(email)) {
          emails.push({ email, source: "mailto", confidence: "high" });
        }
      }
    });

    // Method 2: Plain text emails in HTML
    const bodyText = $("body").text();
    const textEmails = bodyText.match(EMAIL_REGEX) || [];
    for (const email of textEmails) {
      if (isValidEmail(email)) {
        emails.push({ email, source: "text", confidence: "medium" });
      }
    }

    // Method 3: Emails in HTML source (hidden in comments, etc.)
    const htmlEmails = html.match(EMAIL_REGEX) || [];
    for (const email of htmlEmails) {
      if (isValidEmail(email) && !emails.some(e => e.email === email)) {
        emails.push({ email, source: "html", confidence: "medium" });
      }
    }

    // Method 4: Obfuscated emails (name [at] domain.com)
    for (const pattern of COMMON_PATTERNS) {
      const matches = bodyText.matchAll(pattern);
      for (const match of matches) {
        const email = `${match[1]}@${match[2]}`.toLowerCase();
        if (isValidEmail(email) && !emails.some(e => e.email === email)) {
          emails.push({ email, source: "obfuscated", confidence: "low" });
        }
      }
    }

    // 3. Deduplicate and normalize
    const uniqueEmails = deduplicateEmails(emails);

    log.info({ url, count: uniqueEmails.length }, `Found ${uniqueEmails.length} emails`);

    return uniqueEmails;
  } catch (err: any) {
    if (err.name === "AbortError") {
      log.warn({ url }, "Request timeout");
    } else {
      log.error({ err, url }, "Failed to scrape emails");
    }
    return [];
  }
}

/**
 * DEEP scrape: Scrape emails from homepage + contact/about/legal pages.
 * Discovers sub-pages automatically and scrapes all of them.
 *
 * Typically finds 3-5x more emails than single-page scraping.
 */
export async function scrapeEmailsDeep(baseUrl: string): Promise<ScrapedEmail[]> {
  const allEmails: ScrapedEmail[] = [];
  const seenEmails = new Set<string>();
  const scrapedUrls = new Set<string>();

  log.info({ baseUrl }, "Starting deep email scrape (multi-page).");

  // 1. Scrape the homepage first
  const homepageEmails = await scrapeEmailsFromUrl(baseUrl);
  for (const e of homepageEmails) {
    if (!seenEmails.has(e.email.toLowerCase())) {
      seenEmails.add(e.email.toLowerCase());
      allEmails.push(e);
    }
  }
  scrapedUrls.add(baseUrl);

  // 2. Discover contact/about/legal pages from homepage HTML
  let homepageHtml = "";
  try {
    const res = await proxyFetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      homepageHtml = await res.text();
    }
  } catch {
    // Already scraped above, continue with what we have
  }

  if (!homepageHtml) {
    return allEmails;
  }

  const contactPages = await discoverContactPages(baseUrl, homepageHtml);

  log.debug({ baseUrl, contactPages: contactPages.length }, "Discovered contact pages.");

  // 3. Scrape each discovered page (with delays to be respectful)
  for (const pageUrl of contactPages) {
    if (scrapedUrls.has(pageUrl)) continue;
    scrapedUrls.add(pageUrl);

    // Small delay between page fetches (1-2s)
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    try {
      const pageEmails = await scrapeEmailsFromUrl(pageUrl);
      for (const e of pageEmails) {
        if (!seenEmails.has(e.email.toLowerCase())) {
          seenEmails.add(e.email.toLowerCase());
          allEmails.push(e);
        }
      }
    } catch (err) {
      log.debug({ err, pageUrl }, "Failed to scrape sub-page (non-critical).");
    }
  }

  log.info(
    { baseUrl, totalPages: scrapedUrls.size, totalEmails: allEmails.length },
    `Deep scrape complete: ${scrapedUrls.size} pages → ${allEmails.length} emails.`,
  );

  return allEmails;
}

/**
 * Scrape emails and validate them (ENHANCED: returns HTML + name data)
 */
export async function scrapeAndValidateEmails(url: string): Promise<{
  email: string;
  source: string;
  confidence: string;
  validation: Awaited<ReturnType<typeof validateEmail>>;
  firstName?: string;
  lastName?: string;
  html?: string;  // Return HTML to avoid double fetch
}[]> {
  const scraped = await scrapeEmailsFromUrl(url);

  // Fetch HTML once for name extraction
  let html: string | undefined;
  try {
    const response = await proxyFetch(url);
    if (response.ok) {
      html = await response.text();
    }
  } catch (err) {
    log.debug({ err, url }, "Failed to fetch HTML for name extraction");
  }

  // Validate each email
  const validated = await Promise.all(
    scraped.map(async (item) => {
      // Try to extract name from HTML context (if HTML available)
      let firstName: string | undefined;
      let lastName: string | undefined;

      if (html) {
        try {
          const nameData = extractNameFromEmailContext(item.email, html);
          if (nameData) {
            firstName = nameData.firstName;
            lastName = nameData.lastName;
          }
        } catch (err) {
          log.debug({ err, email: item.email }, "Failed to extract name from context");
        }
      }

      return {
        ...item,
        validation: await validateEmail(item.email),
        firstName,
        lastName,
        html,  // Pass HTML to avoid refetching
      };
    })
  );

  // Filter out invalid emails
  return validated.filter((item) =>
    item.validation.status !== "invalid" &&
    item.validation.status !== "disposable"
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();

  // Ignore common test emails
  if (IGNORE_EMAILS.has(normalized)) return false;

  // Ignore image files mistaken as emails
  if (normalized.match(/\.(jpg|png|gif|svg|webp)$/)) return false;

  // Basic validation
  if (!normalized.includes("@")) return false;
  if (normalized.length < 5) return false;
  if (normalized.length > 254) return false;

  // Simple regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized);
}

function deduplicateEmails(emails: ScrapedEmail[]): ScrapedEmail[] {
  const seen = new Map<string, ScrapedEmail>();

  for (const item of emails) {
    const normalized = item.email.toLowerCase().trim();

    if (!seen.has(normalized)) {
      seen.set(normalized, item);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(normalized)!;
      const confidenceOrder = { high: 3, medium: 2, low: 1 };

      if (confidenceOrder[item.confidence] > confidenceOrder[existing.confidence]) {
        seen.set(normalized, item);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Extract person name from email context (heuristic)
 * ENHANCED: More robust with better error handling
 */
export function extractNameFromEmailContext(email: string, html: string): {
  firstName?: string;
  lastName?: string;
} | null {
  try {
    // Validate inputs
    if (!email || !html || html.length > 10_000_000) {
      return null;  // Skip if HTML too large (>10MB)
    }

    const $ = load(html);

    // Look for name near the email
    const emailElement = $(`a[href="mailto:${email}"]`);
    if (emailElement.length > 0) {
      const text = emailElement.text().trim();

      // If link text is not the email itself, it might be a name
      if (text && text !== email && text.length < 100) {  // Sanity check
        const parts = text.split(/\s+/).filter(p => p.length > 1);
        if (parts.length >= 2 && parts.length <= 4) {  // Reasonable name length
          return {
            firstName: capitalize(parts[0]),
            lastName: capitalize(parts.slice(1).join(" ")),
          };
        }
      }

      // Check nearby text (parent or sibling elements)
      const nearbyText = emailElement.parent().text().trim();
      if (nearbyText && nearbyText.length < 200) {
        const nameParts = nearbyText.split(/\s+/).filter(p => p.length > 2 && p.length < 30);
        if (nameParts.length >= 2 && nameParts.length <= 4) {
          return {
            firstName: capitalize(nameParts[0]),
            lastName: capitalize(nameParts[1]),
          };
        }
      }
    }

    return null;
  } catch (err) {
    log.debug({ err, email }, "Failed to extract name from email context");
    return null;
  }
}

// Helper: Capitalize first letter
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
