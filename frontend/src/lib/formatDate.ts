// Locale-aware date formatting helpers built on date-fns. Pulls the active
// i18n language from the LanguageContext so formats match the user's UI.

import { format, formatDistanceToNow, type Locale } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { enUS } from "date-fns/locale/en-US";
import { useContext, useMemo } from "react";
import { LanguageContext, type Lang } from "@/i18n/LanguageContext";

const LOCALES: Record<Lang, Locale> = {
  fr,
  en: enUS,
};

function getLocale(lang: Lang): Locale {
  return LOCALES[lang] ?? enUS;
}

export interface DateFormatters {
  /** Formats a date with the given date-fns token string. */
  formatDate: (date: Date | string | number, pattern: string) => string;
  /** Relative "2 hours ago" style formatting. */
  formatRelative: (date: Date | string | number) => string;
  /** Current date-fns locale object (useful for ad-hoc format calls). */
  locale: Locale;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * React hook that returns memoised locale-aware date formatters.
 * Prefer this inside components so formatting follows the user's UI language.
 */
export function useDateFormat(): DateFormatters {
  const { lang } = useContext(LanguageContext);
  return useMemo(() => {
    const locale = getLocale(lang);
    return {
      formatDate: (date, pattern) => format(toDate(date), pattern, { locale }),
      formatRelative: (date) =>
        formatDistanceToNow(toDate(date), { addSuffix: true, locale }),
      locale,
    };
  }, [lang]);
}

/**
 * Non-hook variant for modules that don't have a React context (e.g. services
 * or event handlers that receive the Lang explicitly).
 */
export function formatDateWithLang(
  date: Date | string | number,
  pattern: string,
  lang: Lang,
): string {
  return format(toDate(date), pattern, { locale: getLocale(lang) });
}
