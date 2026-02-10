// ---------------------------------------------------------------------------
// Reply categories (re-exported from config/constants)
// ---------------------------------------------------------------------------

import { REPLY_CATEGORIES, type ReplyCategory } from "../config/constants.js";

export { REPLY_CATEGORIES };
export type { ReplyCategory };

// ---------------------------------------------------------------------------
// Categorisation result returned by Claude
// ---------------------------------------------------------------------------

export interface CategoryResult {
  /** One of the 10 recognised reply categories */
  category: ReplyCategory;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Short plain-text summary of the reply content */
  summary: string;
  /** Recommended next action (e.g. "send_pricing", "mark_lost", "escalate") */
  suggestedAction: string;
  /** Whether a human operator should review before acting */
  requiresHuman: boolean;
}

// ---------------------------------------------------------------------------
// Personalisation input
// ---------------------------------------------------------------------------

export interface PersonalizationInput {
  /** ISO 639-1 language code (e.g. "fr", "en", "de") */
  language: string;
  /** Target blog/site domain (e.g. "example.com") */
  domain: string;
  /** Human-readable blog name, if available */
  blogName?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "FR", "DE") */
  country?: string;
}

// ---------------------------------------------------------------------------
// Language detection result
// ---------------------------------------------------------------------------

export interface LanguageDetectionResult {
  /** ISO 639-1 two-letter language code */
  language: string;
}
