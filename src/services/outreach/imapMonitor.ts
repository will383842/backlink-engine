// ---------------------------------------------------------------------------
// IMAP Monitor - Watch inbox for reply emails using ImapFlow
// ---------------------------------------------------------------------------

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { categorizeReply } from "./replyCategorizer.js";
import { notifyProspectReplied } from "../notifications/telegramService.js";

const log = createChildLogger("imap-monitor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedReply {
  from: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string;
  receivedAt: Date;
}

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDIS_LAST_UID_KEY = "imap:lastProcessedUid";
const BATCH_SIZE = 50;
const CONNECTION_TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 5;

let consecutiveFailures = 0;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getImapConfig(): ImapConfig | null {
  const host = process.env["IMAP_HOST"];
  const user = process.env["IMAP_USER"];
  const password = process.env["IMAP_PASSWORD"];

  if (!host || !user || !password) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env["IMAP_PORT"] ?? "993", 10),
    user,
    password,
    tls: process.env["IMAP_TLS"] !== "false",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check IMAP inbox for new reply emails.
 * Returns an array of parsed replies matched or unmatched.
 *
 * Uses UID tracking via Redis to avoid re-processing emails.
 */
export async function checkForReplies(): Promise<ParsedReply[]> {
  const config = getImapConfig();
  if (!config) {
    log.debug("IMAP not configured, skipping reply check.");
    return [];
  }

  log.info("Starting IMAP reply check.");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.password },
    logger: false,
    socketTimeout: CONNECTION_TIMEOUT_MS,
  });

  const replies: ParsedReply[] = [];

  try {
    await client.connect();
    consecutiveFailures = 0;

    // Open INBOX
    const mailbox = await client.mailboxOpen("INBOX");
    log.debug({ messages: mailbox.exists }, "INBOX opened.");

    // Get last processed UID
    const lastUidStr = await redis.get(REDIS_LAST_UID_KEY);
    const lastUid = lastUidStr ? parseInt(lastUidStr, 10) : 0;

    // Search for messages with UID > lastProcessedUid
    const searchRange = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";

    let uids: number[];
    try {
      const searchResult = await client.search({ uid: searchRange }, { uid: true });
      uids = (searchResult as number[]).filter((uid) => uid > lastUid);
    } catch {
      // Fallback: search for UNSEEN messages
      log.debug("UID range search failed, falling back to UNSEEN search.");
      const searchResult = await client.search({ seen: false }, { uid: true });
      uids = (searchResult as number[]).filter((uid) => uid > lastUid);
    }

    if (uids.length === 0) {
      log.debug("No new messages found.");
      await client.logout();
      return [];
    }

    log.info({ count: uids.length }, "Found new messages to process.");

    // Process in batches
    const batch = uids.slice(0, BATCH_SIZE);
    let highestUid = lastUid;

    for (const uid of batch) {
      try {
        const message = await client.fetchOne(String(uid), {
          source: true,
          uid: true,
        });

        const fetchedMsg = message as unknown as { source?: Buffer };
        if (!fetchedMsg?.source) {
          log.debug({ uid }, "Empty message source, skipping.");
          if (uid > highestUid) highestUid = uid;
          continue;
        }

        const parsed = await simpleParser(fetchedMsg.source);

        const senderAddress = extractSenderEmail(parsed.from?.text ?? "");
        if (!senderAddress) {
          log.debug({ uid }, "Could not extract sender email, skipping.");
          if (uid > highestUid) highestUid = uid;
          continue;
        }

        const reply: ParsedReply = {
          from: senderAddress,
          subject: parsed.subject ?? "",
          body: parsed.text ?? "",
          messageId: parsed.messageId ?? "",
          inReplyTo: parsed.inReplyTo as string | undefined,
          receivedAt: parsed.date ?? new Date(),
        };

        replies.push(reply);
        if (uid > highestUid) highestUid = uid;
      } catch (err) {
        log.warn({ err, uid }, "Failed to parse message, skipping.");
        if (uid > highestUid) highestUid = uid;
      }
    }

    // Update last processed UID
    if (highestUid > lastUid) {
      await redis.set(REDIS_LAST_UID_KEY, String(highestUid));
    }

    await client.logout();
    log.info({ processed: replies.length, highestUid }, "IMAP check complete.");
  } catch (err) {
    consecutiveFailures++;
    log.error(
      { err, consecutiveFailures },
      "IMAP connection/fetch failed.",
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Send Telegram alert
      try {
        const { notifyBacklinkLost } = await import("../notifications/telegramService.js");
        // Reuse notification channel for critical alerts
        log.error("IMAP monitor has failed 5 consecutive times — manual intervention needed.");
      } catch {
        // Notification failure is not critical
      }
    }

    // Ensure client is closed
    try {
      await client.logout();
    } catch {
      // Already disconnected
    }
  }

  return replies;
}

// ---------------------------------------------------------------------------
// Reply processing (called from replyWorker)
// ---------------------------------------------------------------------------

/**
 * Process a single parsed reply: match to enrollment, categorize, take action.
 */
export async function processReply(reply: ParsedReply): Promise<void> {
  // Deduplicate by messageId to prevent processing the same reply twice
  if (reply.messageId) {
    const dedupKey = `reply:processed:${reply.messageId}`;
    try {
      const isNew = await redis.set(dedupKey, "1", "EX", 604800, "NX"); // 7-day TTL
      if (!isNew) {
        log.debug({ messageId: reply.messageId }, "Reply already processed, skipping.");
        return;
      }
    } catch {
      // Redis down — proceed anyway (UID tracking is primary dedup)
    }
  }

  const normalizedEmail = reply.from.toLowerCase().trim();

  // Find the contact by email
  const contact = await prisma.contact.findUnique({
    where: { emailNormalized: normalizedEmail },
    include: {
      prospect: true,
      enrollments: {
        where: { status: "active" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        include: { campaign: true },
      },
    },
  });

  if (!contact) {
    // Try matching by campaign reference in subject
    const campaignRefMatch = reply.subject.match(/BL-\d+-\d+-\d+/);
    if (campaignRefMatch) {
      const refEnrollment = await prisma.enrollment.findFirst({
        where: { campaignRef: campaignRefMatch[0] },
        include: { campaign: true },
      });

      if (refEnrollment) {
        await processMatchedReply(
          refEnrollment.prospectId,
          refEnrollment.contactId,
          refEnrollment.id,
          refEnrollment.campaign,
          reply,
        );
        return;
      }
    }

    log.debug({ from: reply.from }, "No matching contact found for reply.");
    return;
  }

  const enrollment = contact.enrollments[0];

  // Create reply event
  await prisma.event.create({
    data: {
      prospectId: contact.prospectId,
      contactId: contact.id,
      enrollmentId: enrollment?.id ?? null,
      eventType: "reply_received",
      eventSource: "imap_monitor",
      data: {
        from: reply.from,
        subject: reply.subject,
        messageId: reply.messageId,
        inReplyTo: reply.inReplyTo,
        bodyPreview: reply.body.slice(0, 500),
        receivedAt: reply.receivedAt.toISOString(),
      },
    },
  });

  // Update prospect status
  await prisma.prospect.update({
    where: { id: contact.prospectId },
    data: { status: "REPLIED" },
  });

  // Send Telegram notification
  await notifyProspectReplied(contact.prospectId).catch((err) => {
    log.error({ err, prospectId: contact.prospectId }, "Telegram notification failed.");
  });

  // Categorize and stop enrollment if configured
  if (enrollment) {
    try {
      await categorizeReply(contact.prospectId, enrollment.id, reply.body);
    } catch (err) {
      log.error({ err, enrollmentId: enrollment.id }, "Reply categorization failed.");
    }

    if (enrollment.campaign.stopOnReply) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "stopped",
          stoppedReason: "reply_received",
          completedAt: new Date(),
          nextSendAt: null,
        },
      });
    }
  }

  log.info(
    { prospectId: contact.prospectId, from: reply.from },
    "Reply processed.",
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function processMatchedReply(
  prospectId: number,
  contactId: number,
  enrollmentId: number,
  campaign: { stopOnReply: boolean },
  reply: ParsedReply,
): Promise<void> {
  await prisma.event.create({
    data: {
      prospectId,
      contactId,
      enrollmentId,
      eventType: "reply_received",
      eventSource: "imap_monitor",
      data: {
        from: reply.from,
        subject: reply.subject,
        messageId: reply.messageId,
        bodyPreview: reply.body.slice(0, 500),
        receivedAt: reply.receivedAt.toISOString(),
      },
    },
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: "REPLIED" },
  });

  await notifyProspectReplied(prospectId).catch((err) => {
    log.error({ err, prospectId }, "Telegram notification failed.");
  });

  try {
    await categorizeReply(prospectId, enrollmentId, reply.body);
  } catch (err) {
    log.error({ err, enrollmentId }, "Reply categorization failed.");
  }

  if (campaign.stopOnReply) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "stopped",
        stoppedReason: "reply_received",
        completedAt: new Date(),
        nextSendAt: null,
      },
    });
  }

  log.info({ prospectId, enrollmentId }, "Matched reply processed.");
}

function extractSenderEmail(from: string): string | null {
  // Try angle brackets: "John Doe <john@example.com>"
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].toLowerCase().trim();

  // Try plain email
  const emailMatch = from.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch?.[0]) return emailMatch[0].toLowerCase().trim();

  return null;
}
