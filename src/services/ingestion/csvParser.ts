// ---------------------------------------------------------------------------
// CSV Parser - Parses CSV text or URL-per-line format into IngestInput[]
// ---------------------------------------------------------------------------

import type { IngestInput } from "./ingestService.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CsvRow {
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Known header aliases mapped to IngestInput field names */
const HEADER_MAP: Record<string, keyof IngestInput> = {
  url: "url",
  site: "url",
  website: "url",
  domain: "url",
  link: "url",
  email: "email",
  mail: "email",
  "e-mail": "email",
  contact: "email",
  name: "name",
  nom: "name",
  blog: "name",
  "blog_name": "name",
  notes: "notes",
  note: "notes",
  comment: "notes",
  commentaire: "notes",
  language: "language",
  lang: "language",
  langue: "language",
  country: "country",
  pays: "country",
  "contact_form": "contactFormUrl",
  "contact_form_url": "contactFormUrl",
  "contact_url": "contactFormUrl",
};

/** Regex to detect a valid URL-like string (starts with http or has a dot) */
const URL_PATTERN = /^(?:https?:\/\/)?[\w.-]+\.\w{2,}/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse CSV text (semicolon or comma separated) or plain URL-per-line format
 * into an array of IngestInput objects suitable for bulk ingestion.
 *
 * Supports:
 * - Header row with column mapping (url;email;name;notes etc.)
 * - Simple URL-per-line (no header)
 * - Auto-detection of separator (semicolon vs comma)
 */
export function parseCsv(text: string): IngestInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [];
  }

  // Detect if first line is a header or just URLs
  const firstLine = lines[0]!;
  const separator = detectSeparator(firstLine);
  const firstFields = firstLine.split(separator).map((f) => f.trim().toLowerCase());

  // Check if any field matches a known header keyword
  const hasHeader = firstFields.some(
    (field) => HEADER_MAP[field] !== undefined,
  );

  if (hasHeader) {
    return parseWithHeader(lines, separator, firstFields);
  }

  // No header detected: treat as URL-per-line
  return parseUrlPerLine(lines);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect CSV separator by counting occurrences in the first line.
 * Prefers semicolon if both are present (common in EU exports).
 */
function detectSeparator(line: string): string {
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;

  // If semicolons are present, prefer them (EU-style CSVs)
  if (semicolons > 0) {
    return ";";
  }
  if (commas > 0) {
    return ",";
  }
  // Fallback: tab
  if (line.includes("\t")) {
    return "\t";
  }
  // Single column, use semicolon as default
  return ";";
}

/**
 * Parse lines with a known header row.
 */
function parseWithHeader(
  lines: string[],
  separator: string,
  headerFields: string[],
): IngestInput[] {
  // Map header positions to IngestInput field names
  const fieldMap: (keyof IngestInput | null)[] = headerFields.map(
    (field) => HEADER_MAP[field] ?? null,
  );

  const results: IngestInput[] = [];

  // Start from line 1 (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const values = line.split(separator).map((v) => v.trim());

    const row: CsvRow = {};
    for (let j = 0; j < fieldMap.length; j++) {
      const fieldName = fieldMap[j];
      if (fieldName && values[j]) {
        row[fieldName] = values[j];
      }
    }

    // URL is required
    if (!row["url"] || !URL_PATTERN.test(row["url"])) {
      continue;
    }

    results.push({
      url: row["url"],
      email: row["email"] || undefined,
      name: row["name"] || undefined,
      language: row["language"] || undefined,
      country: row["country"] || undefined,
      contactFormUrl: row["contactFormUrl"] || undefined,
      notes: row["notes"] || undefined,
      source: "csv_import",
    });
  }

  return results;
}

/**
 * Parse lines where each line is a plain URL.
 */
function parseUrlPerLine(lines: string[]): IngestInput[] {
  const results: IngestInput[] = [];

  for (const line of lines) {
    // Skip comment lines
    if (line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    if (URL_PATTERN.test(line)) {
      results.push({
        url: line,
        source: "csv_import",
      });
    }
  }

  return results;
}
