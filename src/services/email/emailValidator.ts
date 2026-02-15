// ─────────────────────────────────────────────────────────────
// Advanced Email Validation Service
// ─────────────────────────────────────────────────────────────

import { Resolver } from "dns/promises";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("email-validator");

export type EmailValidationStatus =
  | "verified"   // Email is valid and deliverable
  | "invalid"    // Email is definitely invalid (syntax, no MX)
  | "risky"      // Suspicious but not confirmed invalid (catch-all, free provider)
  | "disposable" // Temporary email service
  | "role"       // Role-based email (info@, contact@, etc.)
  | "unverified"; // Not yet validated

export interface EmailValidationResult {
  status: EmailValidationStatus;
  email: string;
  reason?: string;
  mxRecords?: string[];
  isDisposable: boolean;
  isRole: boolean;
  isFreeProvider: boolean;
  hasMxRecords: boolean;
  smtpValid?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Disposable Email Domains (Top 100 temporary email services)
// ─────────────────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  // Top disposable email services
  "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamail.net",
  "mailinator.com", "temp-mail.org", "tempmail.com", "tempmailaddress.com",
  "throwaway.email", "trashmail.com", "yopmail.com", "fakeinbox.com",
  "getnada.com", "maildrop.cc", "mintemail.com", "sharklasers.com",
  "grr.la", "guerrillamailblock.com", "pokemail.net", "spam4.me",
  "mvrht.net", "bccto.me", "bugmenot.com", "getairmail.com",
  "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com",
  "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com",
  "superrito.com", "teleworm.us", "33mail.com", "anonbox.net",
  "emailondeck.com", "filzmail.com", "emailsensei.com", "etranquil.com",
  "incognitomail.org", "mailcatch.com", "mailmetrash.com", "mailnesia.com",
  "mailsac.com", "mailtemp.info", "mytrashmail.com", "noclickemail.com",
  "nomail.xl.cx", "pookmail.com", "smoug.net", "sogetthis.com",
  "spambox.us", "spamfree24.org", "spamgourmet.com", "spamhole.com",
  "spamstack.net", "spamthisplease.com", "suremail.info", "tempinbox.com",
  "tempmails.net", "throwawayemailaddress.com", "trashymail.com", "vpn.st",
  "wegwerfmail.de", "wegwerpmailadres.nl", "wh4f.org", "whatpaas.com",
  "banana-mail.com", "banit.club", "beefmilk.com", "binkmail.com",
  "bobmail.info", "bofthew.com", "bootybay.de", "brennendesreich.de",
  "bunsenhoneydew.com", "card.zp.ua", "casualdx.com", "cek.pm",
  "centermail.com", "centermail.net", "choicemail1.com", "clrmail.com",
  "cmail.net", "cmail.org", "coldemail.info", "cool.fr.nf",
  "correo.blogos.net", "cosmorph.com", "courriel.fr.nf", "cubiclink.com",
  "curryworld.de", "cust.in", "dacoolest.com", "dandikmail.com",
  "dawin.com", "dcemail.com", "deadaddress.com", "deadspam.com",
  "delikkt.de", "despam.it", "despammed.com", "devnullmail.com",
  "dfgh.net", "digitalsanctuary.com", "discardmail.com", "discardmail.de",
  "disposableaddress.com", "disposableemailaddresses.com", "disposableinbox.com",
]);

// ─────────────────────────────────────────────────────────────
// Role-Based Email Prefixes
// ─────────────────────────────────────────────────────────────

const ROLE_PREFIXES = new Set([
  "abuse", "admin", "administrator", "all", "billing", "contact", "help",
  "info", "mail", "marketing", "noreply", "no-reply", "postmaster", "root",
  "sales", "security", "spam", "support", "webmaster", "hostmaster",
  "mailer-daemon", "newsletter", "accounts", "service", "services",
  "team", "office", "hello", "press", "media", "news", "jobs",
  "careers", "hr", "humanresources", "legal", "finance", "accounting",
  "enquiry", "enquiries", "inquiry", "inquiries", "feedback", "complaints",
]);

// ─────────────────────────────────────────────────────────────
// Free Email Providers
// ─────────────────────────────────────────────────────────────

const FREE_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "aol.com", "icloud.com", "mail.com", "protonmail.com", "gmx.com",
  "zoho.com", "yandex.com", "mail.ru", "inbox.com", "fastmail.com",
  "yahoo.fr", "yahoo.co.uk", "hotmail.fr", "hotmail.co.uk", "live.fr",
  "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr",
  "gmx.de", "gmx.fr", "web.de", "t-online.de", "freenet.de",
]);

// ─────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────

/**
 * Validate email syntax (RFC 5322 simplified)
 */
export function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email is from a disposable provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Check if email is role-based (info@, contact@, etc.)
 */
export function isRoleEmail(email: string): boolean {
  const localPart = email.split("@")[0]?.toLowerCase();
  return localPart ? ROLE_PREFIXES.has(localPart) : false;
}

/**
 * Check if email is from a free provider
 */
export function isFreeProviderEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? FREE_PROVIDERS.has(domain) : false;
}

/**
 * Verify MX records for domain
 */
export async function verifyMxRecords(domain: string): Promise<string[]> {
  try {
    const resolver = new Resolver();
    const mxRecords = await resolver.resolveMx(domain);
    return mxRecords.map((mx) => mx.exchange);
  } catch (err) {
    return [];
  }
}

/**
 * Validate email deliverability (MX check only, no SMTP verification)
 *
 * SMTP verification is disabled to avoid:
 * - Being flagged as spam/abuse
 * - Triggering rate limits
 * - Exposing our IP to blacklists
 *
 * For production: Use a third-party service like ZeroBounce, NeverBounce, or MailboxValidator
 */
export async function validateEmailDeliverability(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;

  const mxRecords = await verifyMxRecords(domain);
  return mxRecords.length > 0;
}

/**
 * Comprehensive email validation
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const emailLower = email.toLowerCase().trim();

  // 1. Syntax validation
  if (!isValidEmailSyntax(emailLower)) {
    return {
      status: "invalid",
      email: emailLower,
      reason: "Invalid email syntax",
      isDisposable: false,
      isRole: false,
      isFreeProvider: false,
      hasMxRecords: false,
    };
  }

  // 2. Check disposable
  const disposable = isDisposableEmail(emailLower);
  if (disposable) {
    return {
      status: "disposable",
      email: emailLower,
      reason: "Temporary/disposable email service",
      isDisposable: true,
      isRole: false,
      isFreeProvider: false,
      hasMxRecords: false,
    };
  }

  // 3. Check role-based
  const role = isRoleEmail(emailLower);
  if (role) {
    return {
      status: "role",
      email: emailLower,
      reason: "Role-based email address",
      isDisposable: false,
      isRole: true,
      isFreeProvider: false,
      hasMxRecords: false,
    };
  }

  // 4. Check MX records
  const domain = emailLower.split("@")[1]!;
  const mxRecords = await verifyMxRecords(domain);
  const hasMx = mxRecords.length > 0;

  if (!hasMx) {
    return {
      status: "invalid",
      email: emailLower,
      reason: "No MX records found for domain",
      mxRecords: [],
      isDisposable: false,
      isRole: false,
      isFreeProvider: isFreeProviderEmail(emailLower),
      hasMxRecords: false,
    };
  }

  // 5. Check free provider (considered risky for B2B outreach)
  const freeProvider = isFreeProviderEmail(emailLower);
  if (freeProvider) {
    return {
      status: "risky",
      email: emailLower,
      reason: "Free email provider (not B2B)",
      mxRecords,
      isDisposable: false,
      isRole: false,
      isFreeProvider: true,
      hasMxRecords: true,
    };
  }

  // 6. All checks passed
  return {
    status: "verified",
    email: emailLower,
    mxRecords,
    isDisposable: false,
    isRole: false,
    isFreeProvider: false,
    hasMxRecords: true,
  };
}

/**
 * Batch validate multiple emails
 */
export async function validateEmailsBatch(
  emails: string[]
): Promise<Map<string, EmailValidationResult>> {
  const results = new Map<string, EmailValidationResult>();

  // Process in parallel but limit concurrency to avoid rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((email) => validateEmail(email)));

    batchResults.forEach((result) => {
      results.set(result.email, result);
    });
  }

  return results;
}

/**
 * Get recommended action based on validation status
 */
export function getRecommendedAction(status: EmailValidationStatus): string {
  switch (status) {
    case "verified":
      return "OK to contact";
    case "invalid":
      return "Do not contact - invalid email";
    case "disposable":
      return "Block - temporary email";
    case "role":
      return "Low priority - role-based email";
    case "risky":
      return "Caution - free provider or catch-all";
    case "unverified":
      return "Validation needed";
    default:
      return "Unknown";
  }
}
