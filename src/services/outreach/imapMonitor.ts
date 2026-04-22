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

  // Bounce detection — RFC 3464 DSNs arrive in the same inbox now that we
  // send via SMTP direct (no MailWizz webhooks). We detect them heuristically:
  //   • sender is MAILER-DAEMON / postmaster@* / bounces@*
  //   • OR subject matches typical DSN phrasings (undelivered, returned,
  //     delivery status notification, delivery failure)
  const fromLc = reply.from.toLowerCase().trim();
  const subjectLc = (reply.subject ?? "").toLowerCase();
  const isBounceSender =
    fromLc.startsWith("mailer-daemon@") ||
    fromLc.startsWith("postmaster@") ||
    fromLc.startsWith("bounces@") ||
    fromLc.startsWith("noreply-dsn@");
  const isBounceSubject =
    subjectLc.includes("undelivered") ||
    subjectLc.includes("returned mail") ||
    subjectLc.includes("delivery status notification") ||
    subjectLc.includes("delivery failure") ||
    subjectLc.includes("mail delivery failed") ||
    subjectLc.includes("non remis") ||
    subjectLc.includes("non distribué") ||
    subjectLc.includes("non distribue");

  if (isBounceSender || isBounceSubject) {
    await processBounce(reply);
    return;
  }

  const normalizedEmail = reply.from.toLowerCase().trim();

  // Press-outreach matching — look up PressContact by sender email BEFORE
  // the main Contact lookup.  Press campaigns are isolated from netlinking
  // outreach, so we process them here and return early.
  try {
    const pressContact = await prisma.pressContact.findUnique({
      where: { email: normalizedEmail },
    });
    if (pressContact) {
      await processPressReply(pressContact.id, reply);
      return;
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Press-reply lookup failed (non-blocking)");
  }

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
// Bounce processing (RFC 3464 DSN messages arriving in the replies inbox)
// ---------------------------------------------------------------------------

/**
 * Extract the failed recipient address from a DSN body. Tries common
 * patterns: "Final-Recipient: rfc822; addr@domain", "Original-Recipient:",
 * or plain "<addr@domain>" inclusion. Falls back to any email found in the
 * body that matches a contact we have in DB.
 */
function extractBouncedAddress(body: string): string | null {
  // Final-Recipient / Original-Recipient DSN headers
  const dsnMatch = body.match(/(?:Final|Original)-Recipient:\s*(?:rfc822|RFC822)?;?\s*([^\s<>\r\n]+@[^\s<>\r\n]+)/i);
  if (dsnMatch?.[1]) return dsnMatch[1].toLowerCase().trim();

  // Generic "<addr@domain>" in body (common in DSN)
  const addrMatch = body.match(/<([^\s<>]+@[^\s<>]+)>/);
  if (addrMatch?.[1]) return addrMatch[1].toLowerCase().trim();

  return null;
}

/**
 * Classify bounce hardness: hard (550 / 5.x.x / "no such user") vs soft
 * (421 / 4.x.x / "temporary" / "mailbox full" / "rate limited"). Hard bounces
 * mark the contact invalid immediately; soft bounces increment a counter and
 * opt-out after 3 occurrences.
 */
function isHardBounce(body: string): boolean {
  const b = body.toLowerCase();
  if (/5\.\d\.\d/.test(body) || /\b550\b|\b551\b|\b553\b|\b554\b/.test(body)) return true;
  if (b.includes("no such user") || b.includes("user unknown") || b.includes("does not exist") || b.includes("recipient address rejected")) {
    return true;
  }
  // Soft: explicit temporary / 4.x.x
  if (/4\.\d\.\d/.test(body) || /\b421\b|\b450\b|\b452\b/.test(body)) return false;
  if (b.includes("temporary") || b.includes("mailbox full") || b.includes("rate limit")) return false;
  // Default: treat as hard so prospect is quickly excluded
  return true;
}

async function processBounce(reply: ParsedReply): Promise<void> {
  const bouncedAddr = extractBouncedAddress(reply.body);
  if (!bouncedAddr) {
    log.debug({ from: reply.from, subject: reply.subject }, "Bounce detected but recipient could not be extracted.");
    return;
  }

  // Press-outreach bounce path — handle first, exit early if matched.
  // PressContact table is separate from Contact; press bounces need to
  // flip the PressContact to BOUNCED, update the matching sent_emails
  // row (status=bounced + bouncedAt), and cancel any pending follow-ups.
  try {
    const pressContact = await prisma.pressContact.findUnique({
      where: { email: bouncedAddr },
    });
    if (pressContact) {
      const hardP = isHardBounce(reply.body);
      await prisma.pressContact.update({
        where: { id: pressContact.id },
        data: {
          status: "BOUNCED",
          bounceCount: { increment: 1 },
          notes: `[AUTO IMAP bounce ${hardP ? "hard" : "soft"}] ${reply.subject}`,
        },
      });
      // Flag the most recent sent_email row for this contact
      await prisma.sentEmail.updateMany({
        where: { pressContactId: pressContact.id },
        data: {
          status: "bounced",
          bouncedAt: new Date(),
          bounceType: hardP ? "hard" : "soft",
        },
      });
      // Cancel pending follow-ups
      try {
        const { pressOutreachQueue } = await import("../../jobs/queue.js");
        const delayed = await pressOutreachQueue.getJobs(["delayed"]);
        for (const job of delayed) {
          if (job.data?.contactId === pressContact.id) {
            await job.remove();
          }
        }
      } catch (err) {
        log.warn({ err: (err as Error).message }, "Failed to cancel press follow-ups after bounce");
      }
      log.info({ bouncedAddr, pressContactId: pressContact.id, hard: hardP }, "Press bounce processed");
      return;
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, bouncedAddr }, "Press bounce lookup failed (non-blocking)");
  }

  const contact = await prisma.contact.findUnique({
    where: { emailNormalized: bouncedAddr },
    include: {
      enrollments: { where: { status: "active" } },
    },
  });

  if (!contact) {
    log.debug({ bouncedAddr }, "Bounce received for unknown contact.");
    return;
  }

  const hard = isHardBounce(reply.body);
  const eventType = hard ? "hard_bounce" : "soft_bounce";

  await prisma.$transaction(async (tx) => {
    // Log bounce event (attached to first active enrollment if any)
    await tx.event.create({
      data: {
        prospectId: contact.prospectId,
        contactId: contact.id,
        enrollmentId: contact.enrollments[0]?.id ?? null,
        eventType,
        eventSource: "imap_bounce",
        data: {
          from: reply.from,
          subject: reply.subject,
          bouncedAddr,
          bodyPreview: reply.body.slice(0, 600),
          receivedAt: reply.receivedAt.toISOString(),
        },
      },
    });

    if (hard) {
      // Hard bounce → mark email invalid + stop enrollments
      await tx.contact.update({
        where: { id: contact.id },
        data: {
          emailStatus: "invalid",
          optedOut: true,
          optedOutAt: new Date(),
        },
      });
      if (contact.enrollments.length > 0) {
        await tx.enrollment.updateMany({
          where: { contactId: contact.id, status: "active" },
          data: { status: "stopped", stoppedReason: "hard_bounce", completedAt: new Date() },
        });
      }
    } else {
      // Soft bounce → increment counter, opt-out after 3
      const updated = await tx.contact.update({
        where: { id: contact.id },
        data: { softBounceCount: { increment: 1 } },
      });
      if (updated.softBounceCount >= 3) {
        await tx.contact.update({
          where: { id: contact.id },
          data: {
            emailStatus: "invalid",
            optedOut: true,
            optedOutAt: new Date(),
          },
        });
        if (contact.enrollments.length > 0) {
          await tx.enrollment.updateMany({
            where: { contactId: contact.id, status: "active" },
            data: { status: "stopped", stoppedReason: "soft_bounce_3x", completedAt: new Date() },
          });
        }
      }
    }
  });

  log.info(
    { bouncedAddr, type: eventType, prospectId: contact.prospectId },
    "Bounce processed.",
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

// ---------------------------------------------------------------------------
// Press-outreach reply path — 2026-04-22
// PressContact is a parallel table to the main Contact/Prospect one, used
// for the brand-entity press campaign.  When a journalist replies, we want
// the same RESPONDED state machine + follow-up cancellation + Telegram
// notification that the press router's /api/press/reply-received endpoint
// provides.  Rather than duplicate logic, we call straight into Prisma +
// the pressOutreachQueue here, mirroring the route's behavior.
// ---------------------------------------------------------------------------

async function processPressReply(pressContactId: string, reply: ParsedReply): Promise<void> {
  const contact = await prisma.pressContact.findUnique({ where: { id: pressContactId } });
  if (!contact) return;

  // Move to RESPONDED
  await prisma.pressContact.update({
    where: { id: contact.id },
    data: {
      respondedAt: new Date(),
      status: "RESPONDED",
      notes: `[AUTO IMAP] Reply: ${reply.subject}\n---\n${reply.body.slice(0, 2000)}`,
    },
  });

  // Cancel pending follow-ups in BullMQ
  try {
    const { pressOutreachQueue } = await import("../../jobs/queue.js");
    const delayed = await pressOutreachQueue.getJobs(["delayed"]);
    for (const job of delayed) {
      if (job.data?.contactId === contact.id) {
        await job.remove();
      }
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Could not cancel press follow-ups");
  }

  // Telegram notif
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "telegram_notifications" } });
    const cfg = setting?.value as
      | { enabled?: boolean; botToken?: string; chatId?: string; pressChatId?: string }
      | undefined;
    if (cfg?.enabled && cfg.botToken) {
      const chatId = cfg.pressChatId ?? cfg.chatId ?? process.env.TELEGRAM_PRESS_CHAT_ID ?? "7560535072";
      const { sendTelegramMessage } = await import("../notifications/telegramService.js");
      const message = [
        `📰 <b>Nouvelle réponse presse</b> — ${contact.mediaName}`,
        `Langue : ${contact.lang.toUpperCase()} · Angle : ${contact.angle}`,
        `De : ${reply.from}`,
        `Sujet : ${reply.subject}`,
      ].join("\n");
      await sendTelegramMessage(cfg.botToken, chatId, message, "HTML");
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Press Telegram notif failed");
  }

  log.info({ pressContactId, from: reply.from }, "Press reply processed");
}
