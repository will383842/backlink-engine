import type { SupportedLanguage } from "./constants.js";

/**
 * MailWizz list UID mapping: one list per language.
 */
export type MailwizzListMap = Record<SupportedLanguage, string>;

export interface MailwizzConfig {
  /** Base URL of the MailWizz API (e.g. https://mail.example.com/api) */
  apiUrl: string;
  /** MailWizz API key */
  apiKey: string;
  /** Per-language list UIDs */
  lists: MailwizzListMap;
}

/**
 * MailWizz configuration read from environment variables.
 *
 * Expected env vars:
 *   MAILWIZZ_API_URL   - base API URL
 *   MAILWIZZ_API_KEY   - API authentication key
 *   MAILWIZZ_LIST_FR   - list UID for French
 *   MAILWIZZ_LIST_EN   - list UID for English
 *   ... (one per language)
 */
export const mailwizzConfig: MailwizzConfig = {
  apiUrl: process.env.MAILWIZZ_API_URL ?? "",
  apiKey: process.env.MAILWIZZ_API_KEY ?? "",
  lists: {
    fr: process.env.MAILWIZZ_LIST_FR ?? "",
    en: process.env.MAILWIZZ_LIST_EN ?? "",
    de: process.env.MAILWIZZ_LIST_DE ?? "",
    es: process.env.MAILWIZZ_LIST_ES ?? "",
    pt: process.env.MAILWIZZ_LIST_PT ?? "",
    ru: process.env.MAILWIZZ_LIST_RU ?? "",
    ar: process.env.MAILWIZZ_LIST_AR ?? "",
    zh: process.env.MAILWIZZ_LIST_ZH ?? "",
    hi: process.env.MAILWIZZ_LIST_HI ?? "",
  },
};

/**
 * Returns true if the minimum required MailWizz config is present.
 */
export function isMailwizzConfigured(): boolean {
  return mailwizzConfig.apiUrl.length > 0 && mailwizzConfig.apiKey.length > 0;
}

/**
 * Get the list UID for a given language.
 * Throws if the list UID is not configured.
 */
export function getListUid(language: SupportedLanguage): string {
  const uid = mailwizzConfig.lists[language];
  if (!uid) {
    throw new Error(
      `MailWizz list UID not configured for language "${language}". ` +
        `Set MAILWIZZ_LIST_${language.toUpperCase()} in your .env file.`
    );
  }
  return uid;
}
