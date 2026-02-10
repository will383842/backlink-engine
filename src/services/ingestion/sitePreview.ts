// ---------------------------------------------------------------------------
// Site Preview - Fetches contact/about pages and extracts emails
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("site-preview");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SitePreview {
  contactPageHtml?: string;
  aboutPageHtml?: string;
  foundEmails: string[];
  contactPageUrl?: string;
  aboutPageUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common contact page paths to try */
const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactez-nous",
  "/kontakt",
  "/contacto",
  "/contato",
];

/** Common about page paths to try */
const ABOUT_PATHS = [
  "/about",
  "/about-us",
  "/a-propos",
  "/qui-sommes-nous",
  "/uber-uns",
  "/sobre-nosotros",
  "/sobre-nos",
];

/** Regex to match email addresses in page text */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Timeout per fetch request (ms) */
const FETCH_TIMEOUT_MS = 5_000;

/** Max HTML body size to process (500KB) */
const MAX_BODY_SIZE = 512_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the contact and about pages of a domain, extract text content
 * and discover email addresses via regex.
 *
 * Uses native fetch() + cheerio (no Puppeteer).
 * Each page fetch has a 5-second timeout.
 */
export async function fetchSitePreview(domain: string): Promise<SitePreview> {
  const baseUrl = `https://${domain}`;
  const allEmails = new Set<string>();

  log.info({ domain }, "Fetching site preview");

  // Fetch contact page
  const contactResult = await tryFetchPaths(baseUrl, CONTACT_PATHS);
  if (contactResult) {
    extractEmails(contactResult.text, allEmails);
    log.debug({ domain, path: contactResult.path }, "Contact page found");
  }

  // Fetch about page
  const aboutResult = await tryFetchPaths(baseUrl, ABOUT_PATHS);
  if (aboutResult) {
    extractEmails(aboutResult.text, allEmails);
    log.debug({ domain, path: aboutResult.path }, "About page found");
  }

  // Also try homepage for emails
  const homepageText = await fetchPageText(baseUrl);
  if (homepageText) {
    extractEmails(homepageText, allEmails);
  }

  // Filter out common false-positive emails
  const validEmails = [...allEmails].filter(isLikelyRealEmail);

  log.info(
    { domain, emailCount: validEmails.length },
    "Site preview complete",
  );

  return {
    contactPageHtml: contactResult?.html,
    aboutPageHtml: aboutResult?.html,
    foundEmails: validEmails,
    contactPageUrl: contactResult ? `${baseUrl}${contactResult.path}` : undefined,
    aboutPageUrl: aboutResult ? `${baseUrl}${aboutResult.path}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PageResult {
  html: string;
  text: string;
  path: string;
}

/**
 * Try multiple paths for a page type and return the first successful one.
 */
async function tryFetchPaths(
  baseUrl: string,
  paths: string[],
): Promise<PageResult | null> {
  for (const path of paths) {
    try {
      const url = `${baseUrl}${path}`;
      const html = await fetchPageHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        // Remove script, style, and nav elements for cleaner text
        $("script, style, nav, header, footer, noscript").remove();
        const text = $("body").text().replace(/\s+/g, " ").trim();

        // Only return if the page has meaningful content (not a 404 page)
        if (text.length > 50) {
          return { html, text, path };
        }
      }
    } catch {
      // Try next path
      continue;
    }
  }
  return null;
}

/**
 * Fetch a page's HTML content with timeout.
 */
async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BacklinkEngine/1.0; +https://sosexpat.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    // Check content type
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return null;
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        break;
      }
    }

    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c, { stream: true })).join("");
  } catch {
    return null;
  }
}

/**
 * Fetch page and extract text content only.
 */
async function fetchPageText(url: string): Promise<string | null> {
  const html = await fetchPageHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Extract email addresses from text and add them to the set.
 */
function extractEmails(text: string, target: Set<string>): void {
  const matches = text.match(EMAIL_REGEX);
  if (matches) {
    for (const email of matches) {
      target.add(email.toLowerCase());
    }
  }
}

/**
 * Filter out common false-positive email patterns
 * (e.g. example@example.com, image file names).
 */
function isLikelyRealEmail(email: string): boolean {
  const lower = email.toLowerCase();

  // Common placeholder emails
  const blacklist = [
    "example@",
    "test@",
    "admin@example",
    "noreply@",
    "no-reply@",
    "mailer-daemon@",
    "postmaster@",
    "hostmaster@",
    "webmaster@",
  ];

  if (blacklist.some((b) => lower.startsWith(b))) {
    return false;
  }

  // Image/asset file extensions that look like emails
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) {
    return false;
  }

  return true;
}
