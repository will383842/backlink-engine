import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import { categorizeReply } from "../../services/outreach/replyCategorizer.js";

const log = createChildLogger("reply-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface ImapCheckJobData {
  type: "imap-check";
}

type ReplyJobData = ImapCheckJobData;

// ---------------------------------------------------------------------------
// IMAP monitor placeholder
// ---------------------------------------------------------------------------

/**
 * Minimal IMAP monitor interface.
 * The actual implementation will live in a dedicated service module
 * (e.g. services/imapMonitor.ts). This placeholder defines the contract
 * and performs a basic IMAP check using env-configured credentials.
 */
const imapMonitor = {
  /**
   * Check the configured IMAP inbox for new replies to outreach emails.
   * Returns an array of parsed reply objects.
   */
  async checkForReplies(): Promise<ImapReply[]> {
    const host = process.env.IMAP_HOST ?? "";
    const port = parseInt(process.env.IMAP_PORT ?? "993", 10);
    const user = process.env.IMAP_USER ?? "";
    const password = process.env.IMAP_PASSWORD ?? "";

    if (!host || !user || !password) {
      log.warn("IMAP credentials not configured, skipping reply check.");
      return [];
    }

    // TODO: Replace with a real IMAP client (e.g. imapflow).
    // For now, log and return empty so the worker skeleton is functional.
    log.info({ host, port, user }, "IMAP check triggered (implementation pending).");
    return [];
  },
};

interface ImapReply {
  /** The email address of the sender */
  from: string;
  /** The subject line */
  subject: string;
  /** The plain-text body */
  body: string;
  /** The raw Message-ID header */
  messageId: string;
  /** The In-Reply-To header (links to original outreach email) */
  inReplyTo?: string;
  /** When the email was received */
  receivedAt: Date;
}

// ---------------------------------------------------------------------------
// Reply processing
// ---------------------------------------------------------------------------

/**
 * Match an incoming reply to an enrollment via email address lookup,
 * then store the reply and create an event.
 */
async function processReply(reply: ImapReply): Promise<void> {
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
    log.info({ from: reply.from }, "Reply from unknown contact, ignoring.");
    return;
  }

  const enrollment = contact.enrollments[0];

  // Create an event recording the reply
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

  // Categorize the reply using LLM
  if (enrollment) {
    try {
      await categorizeReply(contact.prospectId, enrollment.id, reply.body);
    } catch (err) {
      log.error(
        { err, prospectId: contact.prospectId, enrollmentId: enrollment.id },
        "Failed to categorize reply via LLM, falling back to manual stop."
      );
    }

    // Only stop enrollment if campaign is configured to stop on reply
    const campaign = enrollment.campaign;
    if (campaign && campaign.stopOnReply) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "stopped",
          stoppedReason: "reply_received",
          completedAt: new Date(),
        },
      });
    }
  }

  log.info(
    {
      prospectId: contact.prospectId,
      contactId: contact.id,
      from: reply.from,
    },
    "Reply processed and recorded."
  );
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processReplyJob(job: Job<ReplyJobData>): Promise<void> {
  const { type } = job.data;

  if (type !== "imap-check") {
    log.warn({ type, jobId: job.id }, "Unknown reply job type, skipping.");
    return;
  }

  log.info({ jobId: job.id }, "Starting IMAP reply check.");

  const replies = await imapMonitor.checkForReplies();

  if (replies.length === 0) {
    log.debug("No new replies found.");
    await job.updateProgress(100);
    return;
  }

  log.info({ count: replies.length }, "Found new replies.");

  for (let i = 0; i < replies.length; i++) {
    await processReply(replies[i]!);
    await job.updateProgress(Math.round(((i + 1) / replies.length) * 100));
  }

  log.info({ processed: replies.length }, "IMAP reply check complete.");
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<ReplyJobData> | null = null;

/**
 * Start the reply BullMQ worker.
 * Processes 'imap-check' jobs that poll the IMAP inbox for incoming replies.
 */
export function startReplyWorker(): Worker<ReplyJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<ReplyJobData>(
    QUEUE_NAMES.REPLY,
    processReplyJob,
    {
      connection,
      concurrency: 1, // only one IMAP check at a time
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Reply job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, err: err.message },
      "Reply job failed."
    );
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Reply worker error.");
  });

  log.info("Reply worker started.");
  return worker;
}
