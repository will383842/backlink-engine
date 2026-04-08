// ---------------------------------------------------------------------------
// Reply categories (re-exported from config/constants)
// ---------------------------------------------------------------------------

import { REPLY_CATEGORIES, type ReplyCategory } from "../config/constants.js";

export { REPLY_CATEGORIES };
export type { ReplyCategory };

// ---------------------------------------------------------------------------
// Categorisation result returned by the LLM
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

// ---------------------------------------------------------------------------
// Thematic classification result
// ---------------------------------------------------------------------------

export interface ThematicResult {
  /** Relevance to expat niche, 0-10 */
  relevance: number;
  /** Matching themes from the classification prompt */
  themes: string[];
  /** Brief explanation */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Opportunity detection result
// ---------------------------------------------------------------------------

export interface OpportunityResult {
  /** Best opportunity type for this prospect */
  opportunityType: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Brief explanation */
  reasoning: string;
  /** Actionable details */
  notes: string;
}

// ---------------------------------------------------------------------------
// Outreach email generation
// ---------------------------------------------------------------------------

export type AbVariant = "A" | "B";

export interface GenerateEmailInput {
  domain: string;
  language: string;
  country?: string;
  themes?: string[];
  opportunityType?: string;
  contactName?: string;
  /** Original contact type from Mission Control (presse, blog, influenceur, youtubeur, instagrammeur, podcast_radio...) */
  contactType?: string;
  stepNumber: number;
  previousSubject?: string;
  yourWebsite: string;
  yourCompany: string;
  /** A/B test variant. "A" = benefit-focused, "B" = curiosity-focused, undefined = no A/B test */
  variant?: AbVariant;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}
