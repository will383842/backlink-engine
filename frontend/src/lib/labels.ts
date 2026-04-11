// Centralised label/colour dictionaries shared across pages.
// For i18n dropdowns with translation keys see lib/languageOptions.ts.

import type { ProspectStatus } from "@/types";

// ---------------------------------------------------------------------------
// Language display names (25 languages) — used in table cells and badges
// ---------------------------------------------------------------------------

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "Francais",
  en: "Anglais",
  es: "Espagnol",
  de: "Allemand",
  pt: "Portugais",
  it: "Italien",
  nl: "Neerlandais",
  ar: "Arabe",
  zh: "Chinois",
  ja: "Japonais",
  ko: "Coreen",
  ru: "Russe",
  pl: "Polonais",
  tr: "Turc",
  vi: "Vietnamien",
  th: "Thai",
  hi: "Hindi",
  sv: "Suedois",
  da: "Danois",
  no: "Norvegien",
  fi: "Finnois",
  el: "Grec",
  cs: "Tcheque",
  ro: "Roumain",
  hu: "Hongrois",
};

export function getLanguageName(code: string | null | undefined): string {
  if (!code) return "—";
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

// ---------------------------------------------------------------------------
// Prospect status — human labels, ordering, colours
// ---------------------------------------------------------------------------

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  ENRICHING: "Enrichissement",
  READY_TO_CONTACT: "Pret",
  CONTACTED_EMAIL: "Contacte",
  CONTACTED_MANUAL: "Contacte (form)",
  FOLLOWUP_DUE: "Relance",
  REPLIED: "A repondu",
  NEGOTIATING: "Negociation",
  WON: "Gagne",
  LINK_PENDING: "Lien en attente",
  LINK_VERIFIED: "Lien verifie",
  LINK_LOST: "Lien perdu",
  RE_CONTACTED: "Recontacte",
  LOST: "Perdu",
  DO_NOT_CONTACT: "Ne pas contacter",
};

export const PROSPECT_STATUS_OPTIONS: ProspectStatus[] = [
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
];

export const PROSPECT_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-surface-100 text-surface-700",
  ENRICHING: "bg-blue-100 text-blue-700",
  READY_TO_CONTACT: "bg-cyan-100 text-cyan-700",
  CONTACTED_EMAIL: "bg-indigo-100 text-indigo-700",
  CONTACTED_MANUAL: "bg-indigo-100 text-indigo-700",
  FOLLOWUP_DUE: "bg-amber-100 text-amber-700",
  REPLIED: "bg-purple-100 text-purple-700",
  NEGOTIATING: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LINK_PENDING: "bg-blue-100 text-blue-700",
  LINK_VERIFIED: "bg-emerald-100 text-emerald-700",
  LINK_LOST: "bg-red-100 text-red-700",
  RE_CONTACTED: "bg-purple-100 text-purple-700",
  LOST: "bg-red-100 text-red-700",
  DO_NOT_CONTACT: "bg-surface-800 text-white",
};

export function getProspectStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return PROSPECT_STATUS_LABELS[status] ?? status;
}

export function getProspectStatusColor(status: string | null | undefined): string {
  if (!status) return "bg-surface-100 text-surface-700";
  return PROSPECT_STATUS_COLORS[status] ?? "bg-surface-100 text-surface-700";
}
