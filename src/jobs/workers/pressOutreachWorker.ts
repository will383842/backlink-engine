/**
 * Press Outreach Worker — 2026-04-22 (brand entity Vague 4.3)
 *
 * Sends personalized press pitch emails in 9 languages to journalists,
 * tracking each PressContact through its status machine (PENDING → SENT
 * → RESPONDED → PUBLISHED). Reuses the 5 presse@* inboxes from the
 * Mailflow warmup infrastructure (rotation for deliverability).
 *
 * Job data shape:
 *   { contactId: string, template: "initial" | "follow_up_1" | "follow_up_2" }
 *
 * After an "initial" send, the worker enqueues the two follow-ups as
 * delayed jobs (J+5 and J+10). The reply webhook (/api/press/reply-received)
 * removes pending follow-ups when a journalist replies.
 *
 * Concurrency: set to 3 per worker (9 workers × 3 = 27 parallel sends
 * max), which stays safely under Gmail/Postal rate limits per inbox.
 */
import { Worker, type Job, Queue } from "bullmq";
import { PressContactStatus, PressLang } from "@prisma/client";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES, pressOutreachQueue } from "../queue.js";
import { isWorkerEnabled } from "../../services/automation/automationToggles.js";
import { sendPressEmail, PRESSE_INBOXES } from "../../services/press/sender.js";
import { renderPitchEmail } from "../../services/press/pitchRenderer.js";

const log = createChildLogger("press-outreach-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

type PressJobTemplate = "initial" | "follow_up_1" | "follow_up_2";

interface PressOutreachJobData {
  contactId: string;
  template: PressJobTemplate;
  /** Optional campaign tag for filtering/reporting */
  campaignTag?: string;
}

// ---------------------------------------------------------------------------
// Delay constants
// ---------------------------------------------------------------------------

const FOLLOW_UP_1_DELAY_MS = 5 * 24 * 60 * 60 * 1000; // J+5
const FOLLOW_UP_2_DELAY_MS = 10 * 24 * 60 * 60 * 1000; // J+10

// ---------------------------------------------------------------------------
// Inbox rotation (stable by contact-id hash → same contact always uses the
// same inbox, so reply threads stay coherent)
// ---------------------------------------------------------------------------

function pickInboxForContact(contactId: string, lang: PressLang): string {
  // Prefer language-specific inbox if configured, otherwise rotate
  const langInbox = PRESSE_INBOXES.byLang[lang];
  if (langInbox) return langInbox;
  const hash = [...contactId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PRESSE_INBOXES.rotation[hash % PRESSE_INBOXES.rotation.length];
}

// ---------------------------------------------------------------------------
// Status transition helper
// ---------------------------------------------------------------------------

function nextStatus(template: PressJobTemplate): PressContactStatus {
  switch (template) {
    case "initial":
      return PressContactStatus.SENT;
    case "follow_up_1":
      return PressContactStatus.FOLLOW_UP_1;
    case "follow_up_2":
      return PressContactStatus.FOLLOW_UP_2;
  }
}

function timestampField(template: PressJobTemplate): "sentAt" | "followUp1At" | "followUp2At" {
  switch (template) {
    case "initial":
      return "sentAt";
    case "follow_up_1":
      return "followUp1At";
    case "follow_up_2":
      return "followUp2At";
  }
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

async function processPressOutreach(job: Job<PressOutreachJobData>) {
  const { contactId, template, campaignTag } = job.data;

  if (!(await isWorkerEnabled("press-outreach"))) {
    log.info({ jobId: job.id }, "Worker disabled via automationToggles, skipping");
    return { skipped: true, reason: "worker_disabled" };
  }

  const contact = await prisma.pressContact.findUnique({ where: { id: contactId } });
  if (!contact) {
    log.warn({ contactId }, "Contact not found, skipping job");
    return { skipped: true, reason: "contact_not_found" };
  }

  // Skip if journalist already responded — BullMQ remove-on-reply is best
  // effort; this is the safety net.
  if (contact.respondedAt || contact.status === PressContactStatus.RESPONDED
      || contact.status === PressContactStatus.PUBLISHED
      || contact.status === PressContactStatus.UNSUBSCRIBED
      || contact.status === PressContactStatus.BOUNCED
      || contact.status === PressContactStatus.SKIPPED) {
    log.info({ contactId, status: contact.status }, "Contact already in terminal state, skipping");
    return { skipped: true, reason: contact.status };
  }

  // Render the email body from the pitch template for this lang + angle +
  // template iteration (initial / follow_up_1 / follow_up_2).
  const { subject, html, text, pdfUrl } = await renderPitchEmail({
    lang: contact.lang,
    angle: contact.angle,
    template,
    firstName: contact.firstName,
    mediaName: contact.mediaName,
    mediaUrl: contact.mediaUrl,
  });

  const fromInbox = pickInboxForContact(contact.id, contact.lang);

  try {
    await sendPressEmail({
      from: fromInbox,
      to: contact.email,
      subject,
      html,
      text,
      attachments: pdfUrl ? [{ filename: `SOS-Expat-press-${contact.lang}.pdf`, url: pdfUrl }] : [],
      // Custom headers for Mailflow reply tracking — the webhook handler
      // extracts `X-Press-Contact-Id` from the reply to close the loop.
      headers: {
        "X-Press-Contact-Id": contact.id,
        "X-Press-Template": template,
        ...(campaignTag ? { "X-Press-Campaign": campaignTag } : {}),
      },
    });
  } catch (err) {
    log.error({ err, contactId, fromInbox }, "sendPressEmail failed");
    // Bubble up so BullMQ applies the 3-attempt retry with exponential backoff
    throw err;
  }

  // Update status + timestamp for this iteration
  await prisma.pressContact.update({
    where: { id: contact.id },
    data: {
      status: nextStatus(template),
      [timestampField(template)]: new Date(),
      fromInbox,
      campaignTag: campaignTag ?? contact.campaignTag,
    },
  });

  // Schedule follow-ups on initial send (delayed jobs). We enqueue BOTH
  // follow-ups up front; the reply webhook cancels them as soon as the
  // journalist responds.
  if (template === "initial") {
    await pressOutreachQueue.add(
      `followup1:${contact.id}`,
      { contactId: contact.id, template: "follow_up_1", campaignTag },
      { delay: FOLLOW_UP_1_DELAY_MS },
    );
    await pressOutreachQueue.add(
      `followup2:${contact.id}`,
      { contactId: contact.id, template: "follow_up_2", campaignTag },
      { delay: FOLLOW_UP_2_DELAY_MS },
    );
    log.info({ contactId }, "Initial sent, follow-ups scheduled at J+5 and J+10");
  }

  return {
    sent: true,
    contactId: contact.id,
    fromInbox,
    template,
  };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function startPressOutreachWorker(): Worker {
  const worker = new Worker<PressOutreachJobData>(
    QUEUE_NAMES.PRESS_OUTREACH,
    processPressOutreach,
    {
      connection: {
        host: redis.options.host ?? "127.0.0.1",
        port: redis.options.port ?? 6379,
        password: redis.options.password,
        db: redis.options.db ?? 0,
      },
      concurrency: 3,
      // Global cap at the worker level: max 5 sends per minute across ALL
      // 5 inboxes combined.  The warmup scheduler (`buildPressSchedule`)
      // already spreads sends across 12h windows per day; this is a safety
      // net in case multiple start calls stack up or a cron bug enqueues
      // too many at once.  5/min = 300/h, still well below any realistic
      // daily cap (250 max in the default schedule).
      limiter: { max: 5, duration: 60_000 },
    },
  );

  worker.on("completed", (job, result) => {
    log.info({ jobId: job.id, result }, "Press outreach job completed");
  });
  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, "Press outreach job failed");
  });

  log.info("Press outreach worker started (concurrency=3)");
  return worker;
}
