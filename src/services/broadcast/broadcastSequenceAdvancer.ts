/**
 * Broadcast Sequence Advancer
 * Advances broadcast enrollments through multi-step email sequences.
 * Called every 10 minutes by the broadcast worker.
 */

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { getVariations, pickAndPersonalize } from "./variationCache.js";
import { sendViaSMTP } from "../outreach/smtpSender.js";
import { getNextSendingDomain } from "../outreach/domainRotator.js";
import { getBroadcastRemainingToday } from "./warmupScheduler.js";
import { generateUnsubscribeUrl } from "../../api/routes/unsubscribe.js";

const log = createChildLogger("broadcast-sequence-advancer");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SequenceStep {
  stepNumber: number;
  delayDays: number;
  sourceEmail?: { subject: string; body: string };
}

interface SequenceConfig {
  steps: SequenceStep[];
}

interface AdvanceResult {
  advanced: number;
  completed: number;
  stopped: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Advance all eligible broadcast enrollments through their sequences.
 *
 * Finds enrollments where status=active AND nextSendAt <= now AND campaign
 * is a broadcast type, then advances each to the next step or marks as completed.
 */
export async function advanceBroadcastEnrollments(): Promise<AdvanceResult> {
  const result: AdvanceResult = { advanced: 0, completed: 0, stopped: 0, skipped: 0 };
  const now = new Date();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "active",
      nextSendAt: { lte: now },
      campaign: {
        campaignType: "broadcast",
        isActive: true,
      },
    },
    include: {
      campaign: true,
      prospect: true,
      contact: true,
    },
    orderBy: { nextSendAt: "asc" },
    take: BATCH_SIZE,
  });

  if (enrollments.length === 0) {
    log.debug("No broadcast enrollments ready for advancement.");
    return result;
  }

  log.info({ count: enrollments.length }, "Found broadcast enrollments ready for advancement.");

  for (const enrollment of enrollments) {
    try {
      // Parse sequence config
      const seqConfig = parseSequenceConfig(enrollment.campaign.sequenceConfig);
      if (!seqConfig || seqConfig.steps.length === 0) {
        log.warn({ enrollmentId: enrollment.id, campaignId: enrollment.campaignId }, "No valid sequence config, skipping.");
        result.skipped++;
        continue;
      }

      const nextStepIndex = enrollment.currentStep + 1;

      // Sequence complete?
      if (nextStepIndex >= seqConfig.steps.length) {
        await markCompleted(enrollment);
        result.completed++;
        continue;
      }

      // Check stop conditions
      const stopReason = await checkStopConditions(enrollment);
      if (stopReason) {
        await stopEnrollment(enrollment, stopReason);
        result.stopped++;
        continue;
      }

      // Check daily warmup quota
      const remaining = await getBroadcastRemainingToday(enrollment.campaignId);
      if (remaining <= 0) {
        log.debug({ campaignId: enrollment.campaignId }, "Daily warmup quota exhausted — stopping batch for this campaign.");
        break;
      }

      // Resolve source email for this step (step override or campaign default)
      const stepDef = seqConfig.steps[nextStepIndex]!;
      const sourceEmail = stepDef.sourceEmail ?? (enrollment.campaign.sourceEmail as { subject: string; body: string } | null);
      if (!sourceEmail?.subject || !sourceEmail?.body) {
        log.warn({ enrollmentId: enrollment.id, step: nextStepIndex }, "No source email for step, skipping.");
        result.skipped++;
        continue;
      }

      // Get contact info
      const contact = enrollment.contact;
      const prospect = enrollment.prospect;
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null;
      const language = prospect.language || enrollment.campaign.language || "en";
      const contactType = contact.sourceContactType || "other";
      const brief = enrollment.campaign.brief || "";

      // Generate / cache variations
      const variations = await getVariations(
        enrollment.campaignId, language, contactType, sourceEmail, brief, nextStepIndex,
      );

      // Pick and personalize
      const personalized = pickAndPersonalize(variations, contactName, prospect.domain);

      // Add unsubscribe footer
      const unsubLink = generateUnsubscribeUrl(contact.email);
      const bodyWithUnsub = personalized.body + `\n\n---\nUnsubscribe: ${unsubLink}`;

      // Send via SMTP
      const sendingDomain = await getNextSendingDomain();
      const smtpResult = await sendViaSMTP({
        toEmail: contact.email,
        toName: contactName || undefined,
        fromEmail: sendingDomain.fromEmail,
        fromName: sendingDomain.fromName,
        replyTo: sendingDomain.replyTo,
        subject: personalized.subject,
        bodyText: bodyWithUnsub,
      });

      if (!smtpResult.success) {
        log.warn({ enrollmentId: enrollment.id, step: nextStepIndex }, "SMTP send failed, skipping.");
        result.skipped++;
        continue;
      }

      // Calculate next send date
      const nextNextStepIndex = nextStepIndex + 1;
      let nextSendAt: Date | null = null;
      if (nextNextStepIndex < seqConfig.steps.length) {
        const nextStep = seqConfig.steps[nextNextStepIndex]!;
        nextSendAt = new Date(now.getTime() + nextStep.delayDays * 86_400_000);
      }

      // Persist: SentEmail + enrollment update + campaign counter + event
      await prisma.$transaction(async (tx) => {
        await tx.sentEmail.create({
          data: {
            enrollmentId: enrollment.id,
            prospectId: enrollment.prospectId,
            contactId: enrollment.contactId,
            campaignId: enrollment.campaignId,
            stepNumber: nextStepIndex,
            subject: personalized.subject,
            body: bodyWithUnsub,
            language,
            generatedBy: "ai",
            mailwizzMessageId: smtpResult.messageId ?? null,
            status: "sent",
            sentAt: now,
          },
        });

        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextStepIndex,
            lastSentAt: now,
            nextSendAt,
          },
        });

        await tx.campaign.update({
          where: { id: enrollment.campaignId },
          data: { totalSent: { increment: 1 } },
        });

        await tx.event.create({
          data: {
            prospectId: enrollment.prospectId,
            contactId: enrollment.contactId,
            enrollmentId: enrollment.id,
            eventType: "BROADCAST_STEP_SENT",
            eventSource: "broadcast-sequence-advancer",
            data: {
              step: nextStepIndex,
              delayDays: stepDef.delayDays,
              messageId: smtpResult.messageId ?? null,
              subject: personalized.subject,
              nextSendAt: nextSendAt?.toISOString() ?? null,
            },
          },
        });
      });

      result.advanced++;
      log.debug({ enrollmentId: enrollment.id, step: nextStepIndex }, "Broadcast enrollment advanced.");

      // Jitter 10-30s between sends
      const jitter = 10_000 + Math.floor(Math.random() * 20_000);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    } catch (err) {
      log.error({ err, enrollmentId: enrollment.id }, "Failed to advance broadcast enrollment.");
      result.skipped++;
    }
  }

  log.info(result, "Broadcast sequence advancement cycle complete.");
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseSequenceConfig(raw: unknown): SequenceConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const steps = obj.steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return {
    steps: steps.map((s: Record<string, unknown>, i: number) => ({
      stepNumber: (s.stepNumber as number) ?? i,
      delayDays: (s.delayDays as number) ?? 2,
      sourceEmail: s.sourceEmail as { subject: string; body: string } | undefined,
    })),
  };
}

async function checkStopConditions(enrollment: {
  id: number;
  prospectId: number;
  lastSentAt: Date | null;
  campaign: { stopOnReply: boolean; stopOnBounce: boolean; stopOnUnsub: boolean };
}): Promise<string | null> {
  const since = enrollment.lastSentAt ?? new Date(0);

  if (enrollment.campaign.stopOnReply) {
    const reply = await prisma.event.findFirst({
      where: {
        prospectId: enrollment.prospectId,
        eventType: { in: ["reply_received", "REPLY_RECEIVED"] },
        createdAt: { gt: since },
      },
    });
    if (reply) return "reply_received";
  }

  if (enrollment.campaign.stopOnBounce) {
    const bounce = await prisma.event.findFirst({
      where: {
        enrollmentId: enrollment.id,
        eventType: { in: ["bounce", "hard_bounce", "soft_bounce"] },
        createdAt: { gt: since },
      },
    });
    if (bounce) return "bounce_received";
  }

  if (enrollment.campaign.stopOnUnsub) {
    const unsub = await prisma.event.findFirst({
      where: {
        enrollmentId: enrollment.id,
        eventType: "unsubscribe",
        createdAt: { gt: since },
      },
    });
    if (unsub) return "unsubscribed";
  }

  return null;
}

async function stopEnrollment(
  enrollment: { id: number; prospectId: number; contactId: number },
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "stopped",
        stoppedReason: reason,
        completedAt: new Date(),
        nextSendAt: null,
      },
    });

    await tx.event.create({
      data: {
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        enrollmentId: enrollment.id,
        eventType: "BROADCAST_SEQUENCE_STOPPED",
        eventSource: "broadcast-sequence-advancer",
        data: { reason },
      },
    });
  });

  log.info({ enrollmentId: enrollment.id, reason }, "Broadcast enrollment stopped.");
}

async function markCompleted(enrollment: {
  id: number;
  prospectId: number;
  contactId: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        nextSendAt: null,
      },
    });

    await tx.event.create({
      data: {
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        enrollmentId: enrollment.id,
        eventType: "BROADCAST_SEQUENCE_COMPLETED",
        eventSource: "broadcast-sequence-advancer",
        data: { completedAt: new Date().toISOString() },
      },
    });
  });

  log.debug({ enrollmentId: enrollment.id }, "Broadcast enrollment sequence completed.");
}
