// ─────────────────────────────────────────────────────────────
// Homepage content scraper — feeds LLM personalization for Flux B
//
// Extracts: <title>, <meta name="description">, recent article titles
// from homepage + About snippet from /about or /a-propos.
// Stores per-prospect so the email generator can reference the real site
// content (headline, audience, recent topic) instead of generic claims.
// ─────────────────────────────────────────────────────────────

import { load } from "cheerio";
import { createChildLogger } from "../../utils/logger.js";
import { proxyFetch } from "../../config/proxy.js";

const log = createChildLogger("homepage-scraper");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ABOUT_PAGE_SLUGS = [
  "/about",
  "/about-us",
  "/a-propos",
  "/a-propos/",
  "/qui-sommes-nous",
  "/sobre",
  "/sobre-nosotros",
  "/ueber-uns",
  "/kontakt", // DE often has about info on kontakt
  "/chi-siamo",
];

export interface HomepageContent {
  homepageTitle: string | null;
  homepageMeta: string | null;
  latestArticleTitles: string[] | null;
  aboutSnippet: string | null;
}

// Cap response body size so a malicious or broken site can't OOM us with a
// multi-GB HTML stream. 2 MB is more than enough for head + first articles.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

async function fetchHtml(url: string, timeoutMs = 10_000): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await proxyFetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
    });
    if (!response.ok) return null;

    // Stream + size cap to prevent OOM on pathological sites.
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      log.debug({ url, contentLength }, "Response too large, skipping");
      return null;
    }
    const buf = await response.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return null;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch (err) {
    log.debug({ url, err: err instanceof Error ? err.message : err }, "fetchHtml failed");
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function truncate(s: string, max: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1) + "…";
}

function extractArticleTitles($: ReturnType<typeof load>): string[] {
  // Try most common patterns in order of reliability
  const candidates: string[] = [];

  // WordPress / common blog patterns
  $("article h2, article h3, .post-title, .entry-title, h2.title, .article-title").each(
    (_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text.length >= 8 && text.length <= 200) candidates.push(text);
    },
  );

  // Fallback to any h2 in main/content areas if nothing matched
  if (candidates.length === 0) {
    $("main h2, #content h2, .content h2").each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text.length >= 8 && text.length <= 200) candidates.push(text);
    });
  }

  // Dedupe + cap at 5
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(c);
      if (uniq.length >= 5) break;
    }
  }
  return uniq;
}

function extractAboutSnippet($: ReturnType<typeof load>): string | null {
  // Take first 2 non-empty paragraphs from main content
  const paragraphs: string[] = [];
  $("main p, article p, .about p, #about p, .content p").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text.length >= 40 && paragraphs.length < 2) paragraphs.push(text);
  });
  if (paragraphs.length === 0) {
    // Fallback: any long-ish paragraph
    $("p").each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (text.length >= 80 && paragraphs.length < 2) paragraphs.push(text);
    });
  }
  if (paragraphs.length === 0) return null;
  return truncate(paragraphs.join(" "), 500);
}

async function tryAboutPage(baseUrl: string): Promise<string | null> {
  const base = baseUrl.replace(/\/$/, "");
  // Shorter timeout per about-page probe: each miss shouldn't delay us 10s.
  for (const slug of ABOUT_PAGE_SLUGS) {
    const url = base + slug;
    const html = await fetchHtml(url, 5_000);
    if (!html) continue;
    try {
      const $ = load(html);
      const snippet = extractAboutSnippet($);
      if (snippet && snippet.length >= 80) {
        log.debug({ url, len: snippet.length }, "About page found");
        return snippet;
      }
    } catch {
      // malformed HTML — skip silently
    }
  }
  return null;
}

export async function scrapeHomepageContent(domain: string): Promise<HomepageContent> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  log.debug({ url }, "Scraping homepage content");

  const result: HomepageContent = {
    homepageTitle: null,
    homepageMeta: null,
    latestArticleTitles: null,
    aboutSnippet: null,
  };

  const html = await fetchHtml(url);
  if (html) {
    // Wrap parsing in try so malformed HTML doesn't crash the worker.
    try {
      const $ = load(html);

      const title = $("head > title").first().text().trim();
      if (title) result.homepageTitle = truncate(title, 300);

      const meta =
        $('head > meta[name="description"]').attr("content")?.trim() ||
        $('head > meta[property="og:description"]').attr("content")?.trim() ||
        null;
      if (meta) result.homepageMeta = truncate(meta, 500);

      const articles = extractArticleTitles($);
      if (articles.length > 0) result.latestArticleTitles = articles;

      const aboutFromHome = extractAboutSnippet($);
      if (aboutFromHome && aboutFromHome.length >= 80) result.aboutSnippet = aboutFromHome;
    } catch (err) {
      log.debug({ url, err: err instanceof Error ? err.message : err }, "Homepage HTML parse failed");
    }
  }

  // If About snippet not found on homepage, try dedicated /about pages
  if (!result.aboutSnippet) {
    try {
      const aboutFromPage = await tryAboutPage(url);
      if (aboutFromPage) result.aboutSnippet = aboutFromPage;
    } catch (err) {
      log.debug({ url, err: err instanceof Error ? err.message : err }, "About probe failed");
    }
  }

  log.info(
    {
      domain,
      hasTitle: !!result.homepageTitle,
      hasMeta: !!result.homepageMeta,
      articleCount: result.latestArticleTitles?.length ?? 0,
      hasAbout: !!result.aboutSnippet,
    },
    "Homepage scraping complete",
  );

  return result;
}
