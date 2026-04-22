/**
 * Press email quality audit — 2026-04-22
 *
 * Validates each PressContact's email to reduce bounce rate before a
 * campaign kick-off.  A bounce rate >10% on cold outreach will hurt
 * the reputation of the 5 warmup domains (presse@* mailboxes), so this
 * audit runs BEFORE the worker ever calls sendPressEmail.
 *
 * Checks performed (all safe — no SMTP RCPT TO probing):
 *   1. Format — RFC-ish strict regex
 *   2. Role accounts — heuristic (postmaster@, abuse@, no-reply@…)
 *   3. MX lookup — dns.resolveMx().  Empty MX = undeliverable.
 *   4. Duplicate email — should be unique already, but double-check.
 *   5. Language coherence — contact.lang must be one of the 10 supported
 *   6. TLDs frequently blocked (temporary disposable domains)
 *
 * Output buckets:
 *   - VALID     : safe to send
 *   - RISKY     : format OK + MX OK but role account or suspicious
 *   - INVALID   : format bad OR no MX records → must skip
 *   - SKIPPED   : lang outside supported set
 */
import dns from "node:dns/promises";
import type { PressContact, PressLang } from "@prisma/client";

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;

const ROLE_LOCAL_PARTS = new Set([
  "postmaster", "abuse", "noreply", "no-reply", "donotreply", "mailer-daemon",
  "webmaster", "hostmaster", "root", "admin", "administrator", "spam", "reject",
  "unsubscribe", "bounce", "bounces", "notifications",
]);

const DISPOSABLE_TLDS = new Set(["tempmail", "mailinator", "guerrillamail", "trashmail"]);

const SUPPORTED_LANGS: ReadonlyArray<PressLang> = [
  "fr", "en", "es", "de", "pt", "ru", "zh", "hi", "ar", "et",
];

export type AuditVerdict = "VALID" | "RISKY" | "INVALID" | "SKIPPED";

export interface AuditResult {
  contactId: string;
  email: string;
  mediaName: string;
  lang: string;
  verdict: AuditVerdict;
  reasons: string[];
}

export interface AuditSummary {
  total: number;
  byVerdict: Record<AuditVerdict, number>;
  byLang: Record<string, Record<AuditVerdict, number>>;
  topReasons: Array<{ reason: string; count: number }>;
  duplicateEmails: string[];
  results: AuditResult[];
}

// ---------------------------------------------------------------------------
// Per-domain MX cache — huge speed-up when many contacts share a domain.
// TTL: in-process, lost on restart.
// ---------------------------------------------------------------------------

const mxCache = new Map<string, { hasMx: boolean; checkedAt: number }>();

async function hasMxRecord(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.checkedAt < 10 * 60 * 1000) {
    return cached.hasMx;
  }
  try {
    const records = await dns.resolveMx(domain);
    const hasMx = records.length > 0 && records.some((r) => r.exchange.length > 0);
    mxCache.set(domain, { hasMx, checkedAt: Date.now() });
    return hasMx;
  } catch {
    // NXDOMAIN or other DNS error → no MX → undeliverable
    mxCache.set(domain, { hasMx: false, checkedAt: Date.now() });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Single-contact audit
// ---------------------------------------------------------------------------

async function auditOne(contact: Pick<PressContact, "id" | "email" | "mediaName" | "lang">, seenEmails: Set<string>): Promise<AuditResult> {
  const reasons: string[] = [];
  let verdict: AuditVerdict = "VALID";

  const email = (contact.email ?? "").trim().toLowerCase();

  // 1. Format
  if (!email || !EMAIL_RE.test(email)) {
    reasons.push("format_invalid");
    verdict = "INVALID";
  }

  // 2. Duplicates
  if (email && seenEmails.has(email)) {
    reasons.push("duplicate_in_batch");
    if (verdict !== "INVALID") verdict = "RISKY";
  } else if (email) {
    seenEmails.add(email);
  }

  // 3. Language coherence
  if (!SUPPORTED_LANGS.includes(contact.lang as PressLang)) {
    reasons.push(`unsupported_lang_${contact.lang}`);
    verdict = "SKIPPED";
  }

  // 4. Role account heuristic (only if format OK)
  if (verdict !== "INVALID") {
    const [localPart, domain] = email.split("@");
    if (localPart && ROLE_LOCAL_PARTS.has(localPart.toLowerCase())) {
      reasons.push(`role_account_${localPart}`);
      if (verdict === "VALID") verdict = "RISKY";
    }

    // 5. Disposable TLD guess (cheap heuristic)
    if (domain && DISPOSABLE_TLDS.has(domain.split(".")[0]!.toLowerCase())) {
      reasons.push("disposable_domain");
      verdict = "INVALID";
    }

    // 6. MX lookup (async, the expensive one — cached per domain)
    if (verdict !== "INVALID" && verdict !== "SKIPPED" && domain) {
      const hasMx = await hasMxRecord(domain);
      if (!hasMx) {
        reasons.push("no_mx_records");
        verdict = "INVALID";
      }
    }
  }

  return {
    contactId: contact.id,
    email,
    mediaName: contact.mediaName,
    lang: contact.lang,
    verdict,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Batch audit with concurrency limit (avoid hammering DNS)
// ---------------------------------------------------------------------------

export async function auditPressContacts(
  contacts: Array<Pick<PressContact, "id" | "email" | "mediaName" | "lang">>,
  concurrency = 20,
): Promise<AuditSummary> {
  const seenEmails = new Set<string>();
  const results: AuditResult[] = [];

  // Simple worker-pool pattern
  let cursor = 0;
  async function worker() {
    while (cursor < contacts.length) {
      const idx = cursor++;
      const contact = contacts[idx]!;
      const result = await auditOne(contact, seenEmails);
      results.push(result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, contacts.length) }, worker));

  // Aggregate
  const byVerdict: Record<AuditVerdict, number> = {
    VALID: 0, RISKY: 0, INVALID: 0, SKIPPED: 0,
  };
  const byLang: Record<string, Record<AuditVerdict, number>> = {};
  const reasonCounts = new Map<string, number>();
  const emailFirstSeenId = new Map<string, string>();
  const duplicateEmails = new Set<string>();

  for (const r of results) {
    byVerdict[r.verdict]++;
    if (!byLang[r.lang]) {
      byLang[r.lang] = { VALID: 0, RISKY: 0, INVALID: 0, SKIPPED: 0 };
    }
    byLang[r.lang]![r.verdict]++;
    for (const reason of r.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    if (r.email) {
      if (emailFirstSeenId.has(r.email)) {
        duplicateEmails.add(r.email);
      } else {
        emailFirstSeenId.set(r.email, r.contactId);
      }
    }
  }

  const topReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return {
    total: contacts.length,
    byVerdict,
    byLang,
    topReasons,
    duplicateEmails: Array.from(duplicateEmails),
    results,
  };
}
