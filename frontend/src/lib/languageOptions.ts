/**
 * All 9 supported languages for campaign and template dropdowns.
 * Translation keys are in campaigns.* namespace.
 */
export const LANGUAGE_OPTIONS = [
  { value: "fr", labelKey: "campaigns.french" },
  { value: "en", labelKey: "campaigns.english" },
  { value: "es", labelKey: "campaigns.spanish" },
  { value: "de", labelKey: "campaigns.german" },
  { value: "pt", labelKey: "campaigns.portuguese" },
  { value: "ru", labelKey: "campaigns.russian" },
  { value: "ar", labelKey: "campaigns.arabic" },
  { value: "zh", labelKey: "campaigns.chinese" },
  { value: "hi", labelKey: "campaigns.hindi" },
] as const;
