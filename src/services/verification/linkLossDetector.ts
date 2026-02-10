// ---------------------------------------------------------------------------
// Link Loss Detector - Find and flag backlinks that have been removed
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { verifyBacklink } from "./backlinkVerifier.js";

const log = createChildLogger("link-loss-detector");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How old lastVerifiedAt must be to trigger re-verification (in days) */
const STALE_THRESHOLD_DAYS = 7;

/** Delay between verifications to be polite (ms) */
const VERIFY_DELAY_MS = 3_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect backlinks that may have been lost.
 *
 * Finds all backlinks where:
 * - isLive is true
 * - lastVerifiedAt is older than 7 days (or null)
 *
 * For each stale backlink:
 * 1. Re-verify by fetching the page
 * 2. If not found, mark as lost (isLive=false, lostAt=now)
 * 3. Update the prospect status to LINK_LOST
 * 4. Create a LINK_LOST event
 */
export async function detectLinkLoss(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);

  log.info(
    { cutoffDate: cutoffDate.toISOString(), thresholdDays: STALE_THRESHOLD_DAYS },
    "Starting link loss detection",
  );

  // Find stale backlinks that need re-verification
  const staleBacklinks = await prisma.backlink.findMany({
    where: {
      isLive: true,
      OR: [
        { lastVerifiedAt: null },
        { lastVerifiedAt: { lt: cutoffDate } },
      ],
    },
    select: {
      id: true,
      pageUrl: true,
      targetUrl: true,
      prospectId: true,
      lastVerifiedAt: true,
    },
    orderBy: { lastVerifiedAt: "asc" }, // Oldest first
  });

  log.info(
    { count: staleBacklinks.length },
    "Found stale backlinks to re-verify",
  );

  let verified = 0;
  let stillLive = 0;
  let lost = 0;
  let errors = 0;

  for (const backlink of staleBacklinks) {
    try {
      const result = await verifyBacklink(backlink);
      verified++;

      if (result.found) {
        stillLive++;
      } else {
        lost++;
        // The verifyBacklink function already updates isLive and lostAt,
        // but we also need to update the prospect status and create a specific event.
        await handleLinkLoss(backlink.id, backlink.prospectId);
      }
    } catch (err) {
      errors++;
      log.error(
        { err, backlinkId: backlink.id },
        "Error during link loss verification",
      );
    }

    // Rate limiting between verifications
    if (staleBacklinks.indexOf(backlink) < staleBacklinks.length - 1) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  log.info(
    {
      total: staleBacklinks.length,
      verified,
      stillLive,
      lost,
      errors,
    },
    "Link loss detection complete",
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Handle a confirmed link loss: update prospect status and create event.
 */
async function handleLinkLoss(
  backlinkId: number,
  prospectId: number,
): Promise<void> {
  // Check if the prospect has other live backlinks
  const otherLiveBacklinks = await prisma.backlink.count({
    where: {
      prospectId,
      isLive: true,
      id: { not: backlinkId },
    },
  });

  // Only update prospect status if this was the last live backlink
  if (otherLiveBacklinks === 0) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { status: true },
    });

    // Don't override DO_NOT_CONTACT or LOST statuses
    if (
      prospect &&
      prospect.status !== "DO_NOT_CONTACT" &&
      prospect.status !== "LOST"
    ) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "LINK_LOST" },
      });

      log.warn(
        { prospectId, backlinkId },
        "Prospect status updated to LINK_LOST (last backlink lost)",
      );
    }
  }

  // Create specific link loss event
  await prisma.event.create({
    data: {
      prospectId,
      eventType: "LINK_LOST",
      eventSource: "link_loss_detector",
      data: {
        backlinkId,
        hasOtherLiveBacklinks: otherLiveBacklinks > 0,
      },
    },
  });

  log.info(
    { prospectId, backlinkId, otherLiveBacklinks },
    "Link loss recorded",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
