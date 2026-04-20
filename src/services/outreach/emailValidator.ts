// ---------------------------------------------------------------------------
// Post-generation validator for outreach emails.
//
// Runs after the LLM returns a subject+body. Hard-rejects outputs that violate
// the template-grounded contract (missing URLs, invented numbers, wrong
// language, forbidden vocabulary, length). The caller retries up to 2× with
// corrective feedback, then falls back to the reference template verbatim.
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("email-validator");

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface GeneratedEmailShape {
  subject: string;
  body: string;
}

export interface ReferenceTemplate {
  subject: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Forbidden vocabulary (spam triggers + SEO jargon)
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bSEO\b/i, label: "SEO" },
  { pattern: /\bbacklink/i, label: "backlink" },
  { pattern: /\blink juice/i, label: "link juice" },
  { pattern: /\bPageRank\b/i, label: "PageRank" },
  { pattern: /\bdomain authority/i, label: "domain authority" },
  { pattern: /\bFREE\b/, label: "FREE (all-caps)" },
  { pattern: /\bURGENT\b/, label: "URGENT (all-caps)" },
  { pattern: /!{2,}/, label: "multiple exclamation marks" },
];

// ---------------------------------------------------------------------------
// Language script/stopword heuristics (no LLM call — fast & cheap)
// ---------------------------------------------------------------------------

const SCRIPT_TESTS: Record<string, RegExp> = {
  ar: /[\u0600-\u06FF]/, // Arabic
  zh: /[\u4E00-\u9FFF]/, // Han
  hi: /[\u0900-\u097F]/, // Devanagari
  ru: /[\u0400-\u04FF]/, // Cyrillic
};

const LATIN_STOPWORDS: Record<string, string[]> = {
  // At least 2 of these must appear for a body to be accepted as that language
  fr: ["le", "la", "les", "et", "des", "une", "vous", "avec", "pour", "nous", "dans", "votre"],
  en: ["the", "and", "you", "your", "for", "with", "our", "this", "that", "from", "have"],
  de: ["der", "die", "das", "und", "Sie", "für", "mit", "auf", "ein", "eine", "wir", "Ihre"],
  es: ["el", "la", "los", "las", "y", "de", "con", "para", "su", "una", "que"],
  pt: ["o", "a", "os", "as", "e", "de", "para", "com", "que", "uma", "seu", "sua"],
};

function countStopwordMatches(body: string, words: string[]): number {
  let count = 0;
  const tokens = body.toLowerCase().split(/\s+/);
  const tokenSet = new Set(tokens.map((t) => t.replace(/[^\p{L}]+/gu, "")));
  for (const w of words) {
    if (tokenSet.has(w.toLowerCase())) count++;
  }
  return count;
}

function detectLanguageHeuristic(body: string): string | null {
  for (const [lang, rx] of Object.entries(SCRIPT_TESTS)) {
    if (rx.test(body)) return lang;
  }
  // Latin fallback: language with highest stopword hit count
  let best: { lang: string; hits: number } | null = null;
  for (const [lang, words] of Object.entries(LATIN_STOPWORDS)) {
    const hits = countStopwordMatches(body, words);
    if (!best || hits > best.hits) best = { lang, hits };
  }
  if (best && best.hits >= 2) return best.lang;
  return null;
}

// ---------------------------------------------------------------------------
// URL extraction (plain text + markdown)
// ---------------------------------------------------------------------------

const URL_RX = /\b(?:https?:\/\/)?(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,}(?:\/[^\s)>\]]*)?/gi;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_RX) ?? [];
  return matches
    .map((u) => u.toLowerCase().replace(/[.,;:!?)\]>]+$/g, "")) // strip trailing punctuation
    .filter((u) => u.includes("."));
}

// ---------------------------------------------------------------------------
// Word count (approximate, language-agnostic)
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  // Split on whitespace; for CJK/AR this under-counts, but we use a wider
  // range for non-Latin to avoid false rejects.
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Key number preservation (template → output)
// ---------------------------------------------------------------------------

const SIGNATURE_NUMBERS = ["197", "82", "49", "19", "5"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateGeneratedEmail(
  generated: GeneratedEmailShape,
  referenceTemplate: ReferenceTemplate | undefined,
  requestedLanguage: string,
): ValidationResult {
  const issues: string[] = [];

  // 1. Subject length
  if (generated.subject.length > 90) {
    issues.push(`subject too long (${generated.subject.length} chars, max 90)`);
  }
  if (generated.subject.length < 10) {
    issues.push(`subject too short (${generated.subject.length} chars, min 10)`);
  }

  // 2. Body word count — wider range for non-Latin scripts that pack more per word
  const words = wordCount(generated.body);
  const nonLatin = /[\u0400-\u09FF\u4E00-\u9FFF\u0600-\u06FF]/.test(generated.body);
  const minWords = nonLatin ? 50 : 100;
  const maxWords = nonLatin ? 500 : 400;
  if (words < minWords || words > maxWords) {
    issues.push(`body word count ${words} outside [${minWords}, ${maxWords}]`);
  }

  // 3. Language detected matches requested
  const detected = detectLanguageHeuristic(generated.body);
  if (detected && detected !== requestedLanguage) {
    issues.push(`detected language "${detected}" ≠ requested "${requestedLanguage}"`);
  }

  // 4. URL preservation from reference template
  if (referenceTemplate) {
    const refUrls = new Set(extractUrls(referenceTemplate.body));
    const outUrls = new Set(extractUrls(generated.body));
    const missing: string[] = [];
    for (const u of refUrls) {
      // match when the output contains a URL with the same path (ignore protocol)
      const path = u.replace(/^https?:\/\//, "");
      const found = [...outUrls].some((o) => o.includes(path) || path.includes(o));
      if (!found) missing.push(u);
    }
    if (missing.length > 0) {
      issues.push(`missing reference URLs: ${missing.join(", ")}`);
    }

    // 5. Signature number preservation (at least 3 of 5 key numbers)
    const refHas = SIGNATURE_NUMBERS.filter((n) => referenceTemplate.body.includes(n));
    const outHas = SIGNATURE_NUMBERS.filter((n) => generated.body.includes(n));
    const refCount = refHas.length;
    const outCount = outHas.length;
    const expected = Math.max(0, refCount - 1); // allow 1 number to be paraphrased
    if (refCount >= 3 && outCount < expected) {
      issues.push(
        `signature numbers preservation weak: output has ${outCount}/${refCount} of template numbers`,
      );
    }
  }

  // 6. Forbidden vocabulary
  const fullText = `${generated.subject}\n${generated.body}`;
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push(`forbidden vocabulary: "${label}"`);
    }
  }

  // 7. No unsubstituted variables like {siteName}
  if (/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(fullText)) {
    issues.push("unsubstituted variable placeholder remains in output");
  }

  const valid = issues.length === 0;
  if (!valid) {
    log.debug({ issues }, "email validation failed");
  }
  return { valid, issues };
}
