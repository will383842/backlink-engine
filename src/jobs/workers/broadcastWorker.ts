import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { QUEUE_NAMES } from "../queue.js";
import {
  enrollBroadcastRecipient,
  getEligibleContacts,
  checkCampaignHealth,
} from "../../services/broadcast/broadcastManager.js";
import {
  getBroadcastRemainingToday,
  advanceAllWarmups,
} from "../../services/broadcast/warmupScheduler.js";
import { advanceBroadcastEnrollments } from "../../services/broadcast/broadcastSequenceAdvancer.js";

const log = createChildLogger("broadcast-worker");

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

interface ProcessBroadcastData {
  type: "process-broadcast";
}

interface AdvanceWarmupData {
  type: "advance-warmup";
}

interface AdvanceBroadcastSequenceData {
  type: "advance-broadcast-sequence";
}

type BroadcastJobData = ProcessBroadcastData | AdvanceWarmupData | AdvanceBroadcastSequenceData;

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

async function processBroadcastJob(job: Job<BroadcastJobData>): Promise<void> {
  const { type } = job.data;

  if (type === "advance-warmup") {
    log.info("Advancing warmup days for all active broadcast campaigns...");
    await advanceAllWarmups();
    return;
  }

  if (type === "advance-broadcast-sequence") {
    log.info("Advancing broadcast enrollments through sequences...");
    const summary = await advanceBroadcastEnrollments();
    log.info(summary, "Broadcast sequence advancement complete.");
    return;
  }

  if (type === "process-broadcast") {
    await processActiveBroadcasts();
    return;
  }

  log.warn({ type }, "Unknown broadcast job type");
}

/**
 * Process all active broadcast campaigns.
 */
async function processActiveBroadcasts(): Promise<void> {
  const campaigns = await prisma.campaign.findMany({
    where: { campaignType: "broadcast", isActive: true },
    select: { id: true, name: true, sourceEmail: true, language: true, brief: true },
  });

  if (campaigns.length === 0) {
    log.debug("No active broadcast campaigns.");
    return;
  }

  log.info({ count: campaigns.length }, "Processing active broadcast campaigns...");

  for (const campaign of campaigns) {
    try {
      // Health check — auto-pause if bounce/complaint rates too high
      const health = await checkCampaignHealth(campaign.id);
      if (!health.healthy) {
        log.warn({ campaignId: campaign.id, reason: health.reason }, "Campaign auto-paused.");
        continue;
      }

      // Get remaining quota for today
      const remaining = await getBroadcastRemainingToday(campaign.id);
      if (remaining <= 0) {
        log.debug({ campaignId: campaign.id }, "Daily quota reached — skipping.");
        continue;
      }

      // Fetch eligible contacts
      const contacts = await getEligibleContacts(campaign.id, remaining);
      if (contacts.length === 0) {
        // All contacts processed — mark campaign as complete
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { isActive: false },
        });
        log.info({ campaignId: campaign.id, name: campaign.name }, "All contacts processed — campaign completed.");
        continue;
      }

      log.info(
        { campaignId: campaign.id, name: campaign.name, contacts: contacts.length, remaining },
        "Processing broadcast batch...",
      );

      let sent = 0;
      let errors = 0;

      for (const contact of contacts) {
        const result = await enrollBroadcastRecipient(campaign.id, contact);

        if (result.status === "sent" || result.status === "draft") {
          sent++;
        } else if (result.status === "error") {
          errors++;
        }

        // Jitter: 10-30s between sends (conservative for deliverability)
        const jitter = 10_000 + Math.floor(Math.random() * 20_000);
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }

      log.info(
        { campaignId: campaign.id, sent, errors, total: contacts.length },
        "Broadcast batch completed.",
      );

      // ── Process manual recipients ──
      const manualRemaining = remaining - sent;
      if (manualRemaining > 0) {
        const manualRecipients = await prisma.broadcastManualRecipient.findMany({
          where: { campaignId: campaign.id, status: "pending" },
          take: manualRemaining,
          orderBy: { addedAt: "asc" },
        });

        for (const mr of manualRecipients) {
          try {
            const sourceEmail = campaign.sourceEmail as { subject: string; body: string } | null;
            if (!sourceEmail) break;

            const { getVariations, pickAndPersonalize } = await import("../../services/broadcast/variationCache.js");
            const { sendViaSMTP } = await import("../../services/outreach/smtpSender.js");
            const { getNextSendingDomain } = await import("../../services/outreach/domainRotator.js");

            const lang = mr.language || campaign.language || "fr";
            const type = mr.contactType || "other";
            const variations = await getVariations(campaign.id, lang, type, sourceEmail, campaign.brief || "");
            const personalized = pickAndPersonalize(variations, mr.name, mr.email.split("@")[1]);
            const domain = await getNextSendingDomain();

            const result = await sendViaSMTP({
              toEmail: mr.email,
              toName: mr.name || "",
              fromEmail: domain.fromEmail,
              fromName: domain.fromName,
              replyTo: domain.replyTo,
              subject: personalized.subject,
              bodyText: personalized.body,
            });

            await prisma.broadcastManualRecipient.update({
              where: { id: mr.id },
              data: { status: result.success ? "sent" : "failed", sentAt: new Date() },
            });

            if (result.success) {
              sent++;
              await prisma.campaign.update({
                where: { id: campaign.id },
                data: { totalSent: { increment: 1 } },
              });
            }

            const jitter = 10_000 + Math.floor(Math.random() * 20_000);
            await new Promise((resolve) => setTimeout(resolve, jitter));
          } catch (err) {
            log.error({ err, recipientId: mr.id }, "Error sending to manual recipient");
            await prisma.broadcastManualRecipient.update({
              where: { id: mr.id },
              data: { status: "failed" },
            });
          }
        }

        if (manualRecipients.length > 0) {
          log.info({ campaignId: campaign.id, manual: manualRecipients.length }, "Manual recipients processed.");
        }
      }
    } catch (err) {
      log.error({ err, campaignId: campaign.id }, "Error processing broadcast campaign");
    }
  }
}

// ---------------------------------------------------------------------------
// Worker startup
// ---------------------------------------------------------------------------

export function startBroadcastWorker(): void {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  const worker = new Worker(QUEUE_NAMES.BROADCAST, processBroadcastJob, {
    connection,
    concurrency: 1, // Single-threaded to respect rate limits
    limiter: { max: 1, duration: 60_000 }, // Max 1 job per minute
  });

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id, type: job.data.type }, "Broadcast job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, type: job?.data?.type, err }, "Broadcast job failed.");
  });

  log.info("Broadcast worker started.");
}
