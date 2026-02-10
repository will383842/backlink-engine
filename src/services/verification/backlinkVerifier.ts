// ---------------------------------------------------------------------------
// Backlink Verifier - Verify that backlinks exist and check their attributes
// ---------------------------------------------------------------------------

import * as cheerio from "cheerio";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("backlink-verifier");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationResult {
  /** Whether the target link was found on the page */
  found: boolean;
  /** Link rel attribute analysis */
  linkType: "dofollow" | "nofollow" | "sponsored" | "ugc" | "mixed";
  /** Whether the link appears to be hidden (CSS tricks) */
  isHidden: boolean;
  /** The anchor text of the link, if found */
  anchorText?: string;
  /** HTTP status code of the page fetch */
  httpStatus: number;
  /** Error message if verification failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fetch timeout (ms) */
const FETCH_TIMEOUT_MS = 10_000;

/** Max body size (2MB) */
const MAX_BODY_SIZE = 2_097_152;

/** Patterns that indicate a hidden link */
const HIDDEN_CSS_PATTERNS = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /font-size\s*:\s*0/i,
  /opacity\s*:\s*0(?:[^.]|$)/i,
  /height\s*:\s*0/i,
  /width\s*:\s*0/i,
  /position\s*:\s*absolute.*?(?:left|top)\s*:\s*-\d{4,}/i,
  /text-indent\s*:\s*-\d{4,}/i,
  /overflow\s*:\s*hidden.*?(?:height|width)\s*:\s*0/i,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a single backlink by fetching the source page and checking
 * if it contains a link to the target URL.
 *
 * Checks:
 * - Link presence on the page
 * - rel attribute (dofollow/nofollow/sponsored/ugc)
 * - Hidden link detection (CSS tricks)
 *
 * @param backlink - Backlink record with pageUrl and targetUrl
 */
export async function verifyBacklink(backlink: {
  id: number;
  pageUrl: string;
  targetUrl: string;
  prospectId: number;
}): Promise<VerificationResult> {
  log.info(
    { backlinkId: backlink.id, pageUrl: backlink.pageUrl },
    "Verifying backlink",
  );

  try {
    // Fetch the source page
    const { html, status } = await fetchPage(backlink.pageUrl);

    if (!html) {
      const result: VerificationResult = {
        found: false,
        linkType: "dofollow",
        isHidden: false,
        httpStatus: status,
        error: `Failed to fetch page (HTTP ${status})`,
      };

      await updateBacklinkRecord(backlink.id, backlink.prospectId, result);
      return result;
    }

    // Parse HTML and find matching links
    const $ = cheerio.load(html);
    const targetDomain = extractDomain(backlink.targetUrl);
    const targetPath = extractPath(backlink.targetUrl);

    let found = false;
    let linkType: VerificationResult["linkType"] = "dofollow";
    let isHidden = false;
    let anchorText: string | undefined;

    // Search for links matching the target URL
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") ?? "";

      // Check if this link points to our target
      if (!isMatchingLink(href, targetDomain, targetPath)) {
        return; // continue
      }

      found = true;

      // Extract anchor text
      anchorText = $(el).text().trim() || undefined;

      // Check rel attribute
      const rel = ($(el).attr("rel") ?? "").toLowerCase();
      if (rel.includes("sponsored")) {
        linkType = "sponsored";
      } else if (rel.includes("ugc")) {
        linkType = "ugc";
      } else if (rel.includes("nofollow")) {
        linkType = "nofollow";
      } else {
        linkType = "dofollow";
      }

      // Check if link is hidden
      const style = $(el).attr("style") ?? "";
      const parentStyle = $(el).parent().attr("style") ?? "";
      const combinedStyle = `${style} ${parentStyle}`;

      isHidden = HIDDEN_CSS_PATTERNS.some((pattern) =>
        pattern.test(combinedStyle),
      );

      // Also check for zero-size containers
      const parentClasses = $(el).parents().toArray();
      for (const parent of parentClasses) {
        const pStyle = $(parent).attr("style") ?? "";
        if (HIDDEN_CSS_PATTERNS.some((p) => p.test(pStyle))) {
          isHidden = true;
          break;
        }
      }

      return false; // break - found the link
    });

    // Also check meta robots for nofollow at page level
    const metaRobots = $('meta[name="robots"]').attr("content") ?? "";
    if (metaRobots.includes("nofollow") && found && linkType === "dofollow") {
      linkType = "nofollow"; // Page-level nofollow overrides
    }

    const result: VerificationResult = {
      found,
      linkType,
      isHidden,
      anchorText,
      httpStatus: status,
    };

    // Update the backlink record
    await updateBacklinkRecord(backlink.id, backlink.prospectId, result);

    log.info(
      {
        backlinkId: backlink.id,
        found,
        linkType,
        isHidden,
      },
      "Backlink verification complete",
    );

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ err, backlinkId: backlink.id }, "Backlink verification failed");

    const result: VerificationResult = {
      found: false,
      linkType: "dofollow",
      isHidden: false,
      httpStatus: 0,
      error: errorMessage,
    };

    await updateBacklinkRecord(backlink.id, backlink.prospectId, result);
    return result;
  }
}

/**
 * Verify all backlinks that are marked as live.
 * Typically called by a scheduled job.
 */
export async function verifyAllBacklinks(): Promise<void> {
  log.info("Starting bulk backlink verification");

  const backlinks = await prisma.backlink.findMany({
    where: { isLive: true },
    select: {
      id: true,
      pageUrl: true,
      targetUrl: true,
      prospectId: true,
    },
  });

  log.info({ count: backlinks.length }, "Backlinks to verify");

  let verified = 0;
  let lost = 0;
  let errors = 0;

  for (const backlink of backlinks) {
    try {
      const result = await verifyBacklink(backlink);
      verified++;
      if (!result.found) {
        lost++;
      }
    } catch {
      errors++;
    }

    // Rate-limit: wait 2 seconds between verifications to be polite
    await sleep(2_000);
  }

  log.info(
    { total: backlinks.length, verified, lost, errors },
    "Bulk backlink verification complete",
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a page's HTML content.
 */
async function fetchPage(
  url: string,
): Promise<{ html: string | null; status: number }> {
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
      return { html: null, status: response.status };
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) return { html: null, status: response.status };

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
    const html = chunks.map((c) => decoder.decode(c, { stream: true })).join("");
    return { html, status: response.status };
  } catch {
    return { html: null, status: 0 };
  }
}

/**
 * Check if a link href matches the target URL/domain.
 */
function isMatchingLink(
  href: string,
  targetDomain: string,
  targetPath: string,
): boolean {
  try {
    // Handle relative URLs by skipping them
    if (!href.startsWith("http")) {
      return false;
    }

    const linkUrl = new URL(href);
    const linkDomain = linkUrl.hostname.toLowerCase().replace(/^www\./, "");

    // Domain must match
    if (linkDomain !== targetDomain) {
      return false;
    }

    // If we have a specific path to match, check it
    if (targetPath && targetPath !== "/") {
      const linkPath = linkUrl.pathname.replace(/\/+$/, "");
      const normalizedTarget = targetPath.replace(/\/+$/, "");
      return linkPath === normalizedTarget || linkPath.startsWith(normalizedTarget);
    }

    // Domain match is sufficient if no specific path
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from a URL.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract path from a URL.
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.pathname;
  } catch {
    return "/";
  }
}

/**
 * Update the backlink record in the database based on verification results.
 */
async function updateBacklinkRecord(
  backlinkId: number,
  prospectId: number,
  result: VerificationResult,
): Promise<void> {
  const now = new Date();

  await prisma.backlink.update({
    where: { id: backlinkId },
    data: {
      isVerified: result.found,
      isLive: result.found,
      linkType: result.linkType,
      anchorText: result.anchorText ?? undefined,
      lastVerifiedAt: now,
      lostAt: !result.found ? now : null,
    },
  });

  // Log verification event
  await prisma.event.create({
    data: {
      prospectId,
      eventType: result.found ? "BACKLINK_VERIFIED" : "BACKLINK_NOT_FOUND",
      eventSource: "backlink_verifier",
      data: {
        backlinkId,
        found: result.found,
        linkType: result.linkType,
        isHidden: result.isHidden,
        httpStatus: result.httpStatus,
        error: result.error,
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
