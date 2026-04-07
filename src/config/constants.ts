// ---------------------------------------------------------------------------
// Prospect statuses
// ---------------------------------------------------------------------------

export const PROSPECT_STATUSES = [
  "NEW",
  "ENRICHING",
  "READY_TO_CONTACT",
  "CONTACTED_EMAIL",
  "CONTACTED_MANUAL",
  "FOLLOWUP_DUE",
  "REPLIED",
  "NEGOTIATING",
  "WON",
  "LINK_PENDING",
  "LINK_VERIFIED",
  "LINK_LOST",
  "RE_CONTACTED",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Reply categories
// ---------------------------------------------------------------------------

export const REPLY_CATEGORIES = [
  "INTERESTED",
  "NOT_INTERESTED",
  "ASKING_PRICE",
  "ASKING_QUESTIONS",
  "ALREADY_LINKED",
  "OUT_OF_OFFICE",
  "BOUNCE",
  "UNSUBSCRIBE",
  "SPAM",
  "OTHER",
] as const;

export type ReplyCategory = (typeof REPLY_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Tier system (1 = best, 4 = lowest quality)
// ---------------------------------------------------------------------------

export const TIERS = [1, 2, 3, 4] as const;
export type Tier = (typeof TIERS)[number];

// ---------------------------------------------------------------------------
// Languages with SERP query templates (optimized search queries)
// All other languages are supported via AI email generation with English fallback.
// ---------------------------------------------------------------------------

export const LANGUAGES_WITH_SERP_TEMPLATES = [
  "fr", "en", "de", "es", "pt", "ru", "ar", "zh", "hi",
  "nl", "it", "pl", "tr", "ja", "ko", "sv", "da", "no",
  "fi", "cs", "ro", "th", "vi", "id", "ms", "uk", "el",
  "he", "sw", "hu", "bg", "hr", "sk", "sl", "lt", "lv",
  "et", "sr", "ca", "tl",
] as const;

/** Any ISO 639-1 language code (free string, not restricted) */
export type SupportedLanguage = string;

/** The default fallback language when detection fails */
export const DEFAULT_LANGUAGE = "en";

// ---------------------------------------------------------------------------
// Score & DA thresholds
// ---------------------------------------------------------------------------

export const SCORE_THRESHOLDS = {
  high: 70,
  medium: 40,
  low: 0,
} as const;

export const DA_THRESHOLDS = {
  high: 40,
  medium: 15,
  low: 0,
} as const;

// ---------------------------------------------------------------------------
// Outreach & re-contact limits
// ---------------------------------------------------------------------------

/** Minimum months before a prospect can be re-contacted */
export const RECONTACT_DELAY_MONTHS = 6;

/** Maximum number of re-contact attempts per prospect */
export const MAX_RECONTACTS = 2;

// ---------------------------------------------------------------------------
// AI / LLM thresholds
// ---------------------------------------------------------------------------

/** Minimum confidence score for LLM classification to be accepted */
export const CONFIDENCE_THRESHOLD = 0.85;
