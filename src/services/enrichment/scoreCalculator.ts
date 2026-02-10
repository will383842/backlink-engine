// ---------------------------------------------------------------------------
// Score Calculator - Composite prospect quality score (0-100)
// ---------------------------------------------------------------------------

import type { Tier } from "../../config/constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreInput {
  openPagerank?: number | null;
  mozDa?: number | null;
  linkNeighborhoodScore?: number | null;
  tier: Tier | number;
  relevanceScore?: number | null;
  hasSocialPresence?: boolean;
}

// ---------------------------------------------------------------------------
// Score weights (must sum to ~100 for a perfect prospect)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  /** Max 40 points from Open PageRank (scale 0-10 -> 0-40) */
  pageRank: 40,
  /** Max 20 points from link neighborhood cleanliness */
  neighborhood: 20,
  /** Max 15 points from content relevance */
  relevance: 15,
  /** Max 10 points from tier (T1=10, T2=5, T3=2, T4=0) */
  tier: 10,
  /** Max 10 points from Moz DA (scale 0-100 -> 0-10) */
  da: 10,
  /** Max 5 points for social presence */
  social: 5,
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate a composite quality score for a prospect (0-100).
 *
 * Components:
 * - Open PageRank (0-10 scale): up to 40 points
 * - Moz DA (0-100 scale): up to 10 points
 * - Link neighborhood cleanliness (0-100 scale): up to 20 points
 * - Content relevance (0-100 scale): up to 15 points
 * - Tier bonus: T1=10, T2=5, T3=2, T4=0
 * - Social presence: 5 points if present
 *
 * @returns Composite score capped at 100
 */
export function calculateScore(prospect: ScoreInput): number {
  let score = 0;

  // 1. Open PageRank contribution (scale: 0-10)
  if (prospect.openPagerank != null) {
    const prNormalized = Math.max(0, Math.min(10, Number(prospect.openPagerank)));
    score += (prNormalized / 10) * WEIGHTS.pageRank;
  }

  // 2. Moz DA contribution (scale: 0-100)
  if (prospect.mozDa != null) {
    const daNormalized = Math.max(0, Math.min(100, prospect.mozDa));
    score += (daNormalized / 100) * WEIGHTS.da;
  }

  // 3. Link neighborhood score (scale: 0-100, higher = cleaner)
  if (prospect.linkNeighborhoodScore != null) {
    const nNormalized = Math.max(0, Math.min(100, prospect.linkNeighborhoodScore));
    score += (nNormalized / 100) * WEIGHTS.neighborhood;
  }

  // 4. Content relevance score (scale: 0-100)
  if (prospect.relevanceScore != null) {
    const rNormalized = Math.max(0, Math.min(100, prospect.relevanceScore));
    score += (rNormalized / 100) * WEIGHTS.relevance;
  }

  // 5. Tier bonus
  switch (prospect.tier) {
    case 1:
      score += 10;
      break;
    case 2:
      score += 5;
      break;
    case 3:
      score += 2;
      break;
    case 4:
    default:
      // No tier bonus
      break;
  }

  // 6. Social presence placeholder
  if (prospect.hasSocialPresence) {
    score += WEIGHTS.social;
  }

  return Math.min(100, Math.round(score));
}
