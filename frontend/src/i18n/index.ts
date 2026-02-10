import { useContext, useCallback } from "react";
import { LanguageContext, type Lang } from "./LanguageContext";
import { fr, type TranslationKeys } from "./translations/fr";
import { en } from "./translations/en";

export { LanguageProvider } from "./LanguageContext";
export type { Lang } from "./LanguageContext";

const translations: Record<Lang, TranslationKeys> = { fr, en };

/**
 * Resolve a dot-notated key against a nested translation object.
 * Returns the key itself if not found (fallback).
 */
function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return path;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : path;
}

/**
 * Simple template interpolation: replaces {{key}} with values from params.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export function useTranslation() {
  const { lang, setLang } = useContext(LanguageContext);
  const dict = translations[lang];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const raw = resolve(dict as unknown as Record<string, unknown>, key);
      return interpolate(raw, params);
    },
    [dict],
  );

  return { t, lang, setLang };
}
