// ---------------------------------------------------------------------------
// Suppression Manager - Manage email suppression list (do-not-contact)
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("suppression");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an email address is in the suppression list.
 *
 * @param email - Email address to check (will be normalized to lowercase)
 * @returns true if the email is suppressed and should NOT be contacted
 */
export async function isInSuppressionList(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  const entry = await prisma.suppressionEntry.findUnique({
    where: { emailNormalized: normalized },
    select: { id: true },
  });

  const isSuppressed = entry !== null;

  if (isSuppressed) {
    log.debug({ email: normalized }, "Email found in suppression list");
  }

  return isSuppressed;
}

/**
 * Add an email address to the suppression list.
 *
 * If the email already exists in the suppression list, this is a no-op.
 *
 * @param email - Email address to suppress
 * @param reason - Why the email was suppressed (e.g. "hard_bounce", "unsubscribed", "spam_complaint")
 * @param source - Where the suppression originated (e.g. "mailwizz_webhook", "imap_monitor", "manual")
 */
export async function addToSuppressionList(
  email: string,
  reason: string,
  source: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();

  try {
    await prisma.suppressionEntry.upsert({
      where: { emailNormalized: normalized },
      create: {
        emailNormalized: normalized,
        reason,
        source,
      },
      update: {
        // If already exists, update the reason/source only if more severe
        // (e.g. upgrading from "soft_bounce" to "hard_bounce")
        reason,
        source,
      },
    });

    log.info(
      { email: normalized, reason, source },
      "Email added to suppression list",
    );

    // Also mark any contacts with this email as opted out
    await prisma.contact.updateMany({
      where: { emailNormalized: normalized, optedOut: false },
      data: {
        optedOut: true,
        optedOutAt: new Date(),
      },
    });

    // Stop any active enrollments for this email
    const contacts = await prisma.contact.findMany({
      where: { emailNormalized: normalized },
      select: { id: true },
    });

    if (contacts.length > 0) {
      const contactIds = contacts.map((c) => c.id);

      const updated = await prisma.enrollment.updateMany({
        where: {
          contactId: { in: contactIds },
          status: "active",
        },
        data: {
          status: "stopped",
          stoppedReason: `suppressed:${reason}`,
          completedAt: new Date(),
        },
      });

      if (updated.count > 0) {
        log.info(
          { email: normalized, stoppedEnrollments: updated.count },
          "Stopped active enrollments for suppressed email",
        );
      }
    }
  } catch (err) {
    log.error({ err, email: normalized }, "Failed to add email to suppression list");
    throw err;
  }
}

/**
 * Remove an entry from the suppression list by its ID.
 *
 * Use with caution: this re-enables contacting the email address.
 * Typically only used for manual corrections.
 *
 * @param id - Suppression entry ID to remove
 */
export async function removeFromSuppressionList(id: number): Promise<void> {
  const entry = await prisma.suppressionEntry.findUnique({
    where: { id },
    select: { id: true, emailNormalized: true },
  });

  if (!entry) {
    log.warn({ id }, "Suppression entry not found");
    return;
  }

  await prisma.suppressionEntry.delete({
    where: { id },
  });

  log.info(
    { id, email: entry.emailNormalized },
    "Email removed from suppression list",
  );
}

/**
 * Batch check multiple emails against the suppression list.
 * More efficient than calling isInSuppressionList() for each email.
 *
 * @param emails - Array of email addresses to check
 * @returns Set of suppressed email addresses (normalized)
 */
export async function batchCheckSuppression(
  emails: string[],
): Promise<Set<string>> {
  const normalized = emails.map((e) => e.trim().toLowerCase());

  const entries = await prisma.suppressionEntry.findMany({
    where: { emailNormalized: { in: normalized } },
    select: { emailNormalized: true },
  });

  const suppressedSet = new Set(entries.map((e) => e.emailNormalized));

  log.debug(
    { checked: emails.length, suppressed: suppressedSet.size },
    "Batch suppression check complete",
  );

  return suppressedSet;
}
