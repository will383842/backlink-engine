// ---------------------------------------------------------------------------
// IMAP Monitor - Watch inbox for reply emails and match to enrollments
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { categorizeReply } from "./replyCategorizer.js";

const log = createChildLogger("imap-monitor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: Date;
  messageId?: string;
  inReplyTo?: string;
}

// ---------------------------------------------------------------------------
// Configuration from env
// ---------------------------------------------------------------------------

function getImapConfig(): ImapConfig {
  const host = process.env["IMAP_HOST"];
  const port = process.env["IMAP_PORT"];
  const user = process.env["IMAP_USER"];
  const password = process.env["IMAP_PASSWORD"];

  if (!host || !user || !password) {
    throw new Error(
      "IMAP configuration incomplete. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD env vars.",
    );
  }

  return {
    host,
    port: port ? parseInt(port, 10) : 993,
    user,
    password,
    tls: process.env["IMAP_TLS"] !== "false",
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/** How often to check for new emails (ms) */
const CHECK_INTERVAL_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the IMAP monitor loop.
 * Checks for new replies at a regular interval.
 */
export function startImapMonitor(): void {
  if (monitorInterval) {
    log.warn("IMAP monitor already running");
    return;
  }

  log.info("Starting IMAP monitor");

  // Run immediately on start
  checkForReplies().catch((err) => {
    log.error({ err }, "Initial IMAP check failed");
  });

  // Schedule periodic checks
  monitorInterval = setInterval(() => {
    checkForReplies().catch((err) => {
      log.error({ err }, "IMAP check failed");
    });
  }, CHECK_INTERVAL_MS);

  log.info({ intervalMs: CHECK_INTERVAL_MS }, "IMAP monitor started");
}

/**
 * Stop the IMAP monitor loop.
 */
export function stopImapMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log.info("IMAP monitor stopped");
  }
}

/**
 * Check for new reply emails and process them.
 *
 * Flow:
 * 1. Connect to IMAP server
 * 2. Scan inbox for unprocessed emails (since last check)
 * 3. For each email, try to match to an enrollment by sender email or subject
 * 4. If matched, extract reply text and run through replyCategorizer
 * 5. Mark email as processed
 */
export async function checkForReplies(): Promise<void> {
  log.info("Checking for new replies");

  // TODO: Replace with actual IMAP library (e.g. imapflow or imap-simple)
  // The skeleton below shows the intended flow.
  //
  // Example using imapflow:
  //
  // import { ImapFlow } from "imapflow";
  // const config = getImapConfig();
  // const client = new ImapFlow({
  //   host: config.host,
  //   port: config.port,
  //   secure: config.tls,
  //   auth: { user: config.user, pass: config.password },
  // });

  try {
    const config = getImapConfig();
    log.debug({ host: config.host }, "IMAP config loaded");

    // Step 1: Connect to IMAP
    // TODO: await client.connect();

    // Step 2: Open inbox
    // TODO: await client.mailboxOpen("INBOX");

    // Step 3: Search for unseen/recent messages
    // TODO: const messages = await client.search({ seen: false });

    // Step 4: Fetch and process each message
    const messages: ParsedEmail[] = []; // TODO: Replace with actual fetch

    for (const email of messages) {
      await processReplyEmail(email);
    }

    // Step 5: Disconnect
    // TODO: await client.logout();

    log.info({ processed: messages.length }, "IMAP check complete");
  } catch (err) {
    log.error({ err }, "Failed to check IMAP for replies");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal processing
// ---------------------------------------------------------------------------

/**
 * Process a single reply email: match to enrollment and categorize.
 */
async function processReplyEmail(email: ParsedEmail): Promise<void> {
  const senderEmail = extractEmailAddress(email.from);

  if (!senderEmail) {
    log.debug({ from: email.from }, "Could not extract sender email, skipping");
    return;
  }

  log.debug({ from: senderEmail, subject: email.subject }, "Processing reply email");

  // Try to find matching enrollment by sender email
  const enrollment = await findEnrollmentByEmail(senderEmail);

  if (!enrollment) {
    // Try matching by subject line (look for campaign reference pattern)
    const campaignRefMatch = email.subject.match(/BL-\d+-\d+-\d+/);
    if (campaignRefMatch) {
      const refEnrollment = await prisma.enrollment.findFirst({
        where: { campaignRef: campaignRefMatch[0] },
        select: {
          id: true,
          prospectId: true,
          contactId: true,
        },
      });

      if (refEnrollment) {
        await processMatchedReply(
          refEnrollment.prospectId,
          refEnrollment.id,
          email.text,
        );
        return;
      }
    }

    log.debug(
      { from: senderEmail },
      "No matching enrollment found for reply email",
    );
    return;
  }

  await processMatchedReply(enrollment.prospectId, enrollment.id, email.text);
}

/**
 * Process a matched reply: categorize and take action.
 */
async function processMatchedReply(
  prospectId: number,
  enrollmentId: number,
  replyText: string,
): Promise<void> {
  // Update prospect status to REPLIED
  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "REPLIED" },
  });

  // Log the reply event
  await prisma.event.create({
    data: {
      prospectId,
      enrollmentId,
      eventType: "REPLY_RECEIVED",
      eventSource: "imap_monitor",
      data: {
        replyPreview: replyText.slice(0, 500),
      },
    },
  });

  // Categorize the reply
  await categorizeReply(prospectId, enrollmentId, replyText);

  log.info({ prospectId, enrollmentId }, "Reply processed and categorized");
}

/**
 * Find an active enrollment by the contact's email address.
 */
async function findEnrollmentByEmail(
  email: string,
): Promise<{ id: number; prospectId: number; contactId: number } | null> {
  const emailNormalized = email.toLowerCase().trim();

  // Find the contact
  const contact = await prisma.contact.findUnique({
    where: { emailNormalized },
    select: { id: true },
  });

  if (!contact) return null;

  // Find active enrollment for this contact
  return prisma.enrollment.findFirst({
    where: {
      contactId: contact.id,
      status: "active",
    },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      prospectId: true,
      contactId: true,
    },
  });
}

/**
 * Extract a clean email address from a "From" header
 * (e.g. "John Doe <john@example.com>" -> "john@example.com")
 */
function extractEmailAddress(from: string): string | null {
  // Try to extract from angle brackets
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].toLowerCase().trim();
  }

  // If no brackets, check if the whole string is an email
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch?.[0]) {
    return emailMatch[0].toLowerCase().trim();
  }

  return null;
}
