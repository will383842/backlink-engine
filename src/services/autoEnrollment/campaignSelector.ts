// ---------------------------------------------------------------------------
// Campaign Selector - Find the best campaign for auto-enrollment
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import type { Campaign, Prospect } from "@prisma/client";

const log = createChildLogger("campaign-selector");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignWithScore {
  campaign: Campaign;
  matchScore: number;
}

// ---------------------------------------------------------------------------
// Campaign Selection Logic
// ---------------------------------------------------------------------------

/**
 * Find the best campaign for a prospect based on:
 * - Language match (required)
 * - Category filter (if campaign has categoryFilter)
 * - Country match (bonus points)
 * - Campaign is active
 * - Campaign has available slots
 */
export async function findBestCampaign(
  prospectId: number
): Promise<Campaign | null> {
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) {
    log.warn({ prospectId }, "Prospect not found.");
    return null;
  }

  // Find all active campaigns for this language
  const campaigns = await prisma.campaign.findMany({
    where: {
      isActive: true,
      language: prospect.language ?? "en", // Default to English if no language
    },
  });

  if (campaigns.length === 0) {
    log.debug(
      { prospectId, language: prospect.language },
      "No active campaigns found for language."
    );
    return null;
  }

  // Score each campaign based on match criteria
  const scored: CampaignWithScore[] = campaigns
    .map((campaign) => {
      let score = 100; // Base score

      // Filter by category if campaign has categoryFilter
      if (campaign.categoryFilter) {
        const allowedCategories = (campaign.categoryFilter as string[]) ?? [];
        if (allowedCategories.length > 0 && !allowedCategories.includes(prospect.category)) {
          return null; // Skip this campaign
        }
      }

      // Bonus: Country match
      if (campaign.countryFilter && prospect.country) {
        const allowedCountries = (campaign.countryFilter as string[]) ?? [];
        if (allowedCountries.length > 0) {
          if (allowedCountries.includes(prospect.country)) {
            score += 50; // Country match bonus
          } else {
            return null; // Skip if country filter doesn't match
          }
        }
      }

      // Bonus: Min tier match
      if (campaign.minTier && prospect.tier > campaign.minTier) {
        return null; // Skip if prospect tier is too low
      }

      // Bonus: More recent campaign (prefer newer campaigns)
      const daysOld = Math.floor(
        (Date.now() - campaign.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      score -= daysOld; // Slight penalty for older campaigns

      // Penalty: Already has many enrollments (load balancing)
      score -= campaign.totalEnrolled * 0.1;

      return { campaign, matchScore: score };
    })
    .filter((x): x is CampaignWithScore => x !== null);

  if (scored.length === 0) {
    log.debug(
      { prospectId, language: prospect.language },
      "No eligible campaigns after filtering."
    );
    return null;
  }

  // Sort by score (highest first)
  scored.sort((a, b) => b.matchScore - a.matchScore);

  const best = scored[0]!;

  log.info(
    {
      prospectId,
      campaignId: best.campaign.id,
      campaignName: best.campaign.name,
      matchScore: best.matchScore,
    },
    "Selected best campaign for auto-enrollment."
  );

  return best.campaign;
}

/**
 * Check if prospect is already enrolled in any active campaign.
 */
export async function isAlreadyEnrolled(prospectId: number): Promise<boolean> {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      prospectId,
      status: { in: ["active", "completed"] },
    },
  });

  return !!enrollment;
}
