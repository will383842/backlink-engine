// ---------------------------------------------------------------------------
// Sequence Advancer - Advance enrollments through follow-up email sequences
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import { sendViaSMTP } from "./smtpSender.js";
import { getNextSendingDomain } from "./domainRotator.js";
import { getBestTemplate } from "../messaging/templateRenderer.js";
import { createChildLogger } from "../../utils/logger.js";
import { getLlmClient } from "../../llm/index.js";
import { shouldSendImmediately } from "./outreachMode.js";

const log = createChildLogger("sequence-advancer");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SequenceStep {
  stepNumber: number;
  delayDays: number;
  templateId?: number;
  mailwizzCampaignUid?: string;
  subject?: string;
}

interface SequenceConfig {
  steps: SequenceStep[];
  maxSendsPerDay?: number;
  jitterMinutes?: number;
}

interface AdvanceResult {
  advanced: number;
  completed: number;
  stopped: number;
  skipped: number;
  quotaExhausted: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SENDS_PER_DAY = 150;
const DEFAULT_JITTER_MINUTES = 5;
const BATCH_SIZE = 200;
const REDIS_SEND_COUNTER_PREFIX = "sequence:sends:";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Advance all eligible enrollments through their email sequences.
 *
 * Finds enrollments where status=active AND nextSendAt <= now,
 * then advances each to the next step or marks as completed.
 */
export async function advanceEligibleEnrollments(): Promise<AdvanceResult> {
  const result: AdvanceResult = {
    advanced: 0,
    completed: 0,
    stopped: 0,
    skipped: 0,
    quotaExhausted: false,
  };

  const now = new Date();

  // Fetch eligible enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "active",
      nextSendAt: { lte: now },
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
    log.debug("No enrollments ready for advancement.");
    return result;
  }

  log.info({ count: enrollments.length }, "Found enrollments ready for advancement.");

  for (const enrollment of enrollments) {
    try {
      // Check daily send quota
      const quotaOk = await checkDailyQuota(enrollment.campaign.sequenceConfig as unknown as SequenceConfig);
      if (!quotaOk) {
        result.quotaExhausted = true;
        log.warn("Daily send quota exhausted, stopping advancement.");

        // Report remaining enrollments to tomorrow (next day 08:00 UTC)
        const tomorrow8am = new Date();
        tomorrow8am.setUTCDate(tomorrow8am.getUTCDate() + 1);
        tomorrow8am.setUTCHours(8, 0, 0, 0);

        const remainingIds = enrollments
          .slice(enrollments.indexOf(enrollment))
          .map((e) => e.id);

        if (remainingIds.length > 0) {
          await prisma.enrollment.updateMany({
            where: { id: { in: remainingIds }, status: "active" },
            data: { nextSendAt: tomorrow8am },
          });
          log.info({ count: remainingIds.length, nextSendAt: tomorrow8am.toISOString() }, "Deferred remaining enrollments to tomorrow.");
        }

        // Log prominently (Telegram alert can be added when bot is configured)
        log.error(
          { quota: DEFAULT_MAX_SENDS_PER_DAY, deferred: remainingIds.length },
          "⚠️ DAILY QUOTA EXHAUSTED — remaining emails deferred to tomorrow 08:00 UTC.",
        );

        break;
      }

      // Check if there's a pending draft for this enrollment — don't advance until it's approved/rejected
      const pendingDraft = await prisma.sentEmail.findFirst({
        where: { enrollmentId: enrollment.id, status: "draft" },
      });
      if (pendingDraft) {
        log.debug({ enrollmentId: enrollment.id, draftId: pendingDraft.id }, "Pending draft exists, skipping advancement.");
        result.skipped++;
        continue;
      }

      // Check stop conditions
      const shouldStop = await checkStopConditions(enrollment);
      if (shouldStop) {
        result.stopped++;
        continue;
      }

      // Parse sequence config
      const config = parseSequenceConfig(enrollment.campaign.sequenceConfig);
      if (!config || config.steps.length === 0) {
        log.warn(
          { enrollmentId: enrollment.id, campaignId: enrollment.campaignId },
          "Campaign has no valid sequence config, skipping.",
        );
        result.skipped++;
        continue;
      }

      const nextStepIndex = enrollment.currentStep + 1;

      if (nextStepIndex < config.steps.length) {
        // Advance to next step
        await advanceToNextStep(enrollment, config, nextStepIndex);
        await incrementDailyQuota();
        result.advanced++;

        // Add jitter delay between sends
        const jitterMs = getJitterMs(config.jitterMinutes ?? DEFAULT_JITTER_MINUTES);
        if (jitterMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, jitterMs));
        }
      } else {
        // No more steps — mark as completed
        await markCompleted(enrollment);
        result.completed++;
      }
    } catch (err) {
      log.error(
        { err, enrollmentId: enrollment.id },
        "Failed to advance enrollment, skipping.",
      );
      result.skipped++;
    }
  }

  log.info(result, "Sequence advancement cycle complete.");
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
      templateId: s.templateId as number | undefined,
      mailwizzCampaignUid: s.mailwizzCampaignUid as string | undefined,
      subject: s.subject as string | undefined,
    })),
    maxSendsPerDay: (obj.maxSendsPerDay as number) ?? DEFAULT_MAX_SENDS_PER_DAY,
    jitterMinutes: (obj.jitterMinutes as number) ?? DEFAULT_JITTER_MINUTES,
  };
}

async function advanceToNextStep(
  enrollment: {
    id: number;
    prospectId: number;
    contactId: number;
    campaignId: number;
    mailwizzSubscriberUid: string | null;
    mailwizzListUid: string | null;
  },
  config: SequenceConfig,
  nextStepIndex: number,
): Promise<void> {
  const step = config.steps[nextStepIndex]!;
  const now = new Date();

  // Calculate next follow-up date
  const nextNextStepIndex = nextStepIndex + 1;
  let nextSendAt: Date | null = null;
  if (nextNextStepIndex < config.steps.length) {
    const nextStep = config.steps[nextNextStepIndex]!;
    nextSendAt = new Date(now.getTime() + nextStep.delayDays * 86_400_000);
  }

  // Load prospect + contact + sender settings for AI email generation
  const prospect = await prisma.prospect.findUnique({ where: { id: enrollment.prospectId } });
  const contact = await prisma.contact.findUnique({ where: { id: enrollment.contactId } });

  if (!prospect || !contact) {
    log.warn({ enrollmentId: enrollment.id }, "Prospect or contact not found, skipping step.");
    return;
  }

  // Get previous email subject + A/B variant for follow-up context
  const previousEmail = await prisma.sentEmail.findFirst({
    where: { enrollmentId: enrollment.id },
    orderBy: { stepNumber: "desc" },
    select: { subject: true, abVariant: true },
  });

  // Carry the same A/B variant through all follow-ups in the sequence
  const abVariant = previousEmail?.abVariant as ("A" | "B" | null) ?? null;

  // Load sender settings
  let senderSettings = { yourWebsite: "https://life-expat.com", yourCompany: "Life Expat", fromEmail: "", fromName: "", replyTo: "" };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
    if (row) Object.assign(senderSettings, row.value);
  } catch { /* use defaults */ }

  // Generate unique follow-up email via AI, grounded on the same MessageTemplate DB
  // (9 langs × 8 cats) + scraped prospect content used by the initial email. This
  // ensures every follow-up preserves facts, URLs and CTAs factually.
  const prospectExt = prospect as unknown as Record<string, unknown>;
  const targetLanguage = prospect.language ?? "en";
  const targetCategory = (prospectExt.category as string | null | undefined) ?? null;
  const referenceTemplateRow = await getBestTemplate(targetLanguage, targetCategory);
  const referenceTemplate = referenceTemplateRow
    ? { subject: referenceTemplateRow.subject as string, body: referenceTemplateRow.body as string }
    : undefined;

  const llm = getLlmClient();
  const generatedEmail = await llm.generateOutreachEmail({
    domain: prospect.domain,
    language: targetLanguage,
    country: prospect.country ?? undefined,
    themes: prospect.thematicCategories as string[] | undefined,
    opportunityType: prospect.opportunityType ?? undefined,
    contactName: contact.firstName ?? contact.name ?? undefined,
    contactType: (contact as unknown as Record<string, unknown>).sourceContactType as string ?? prospect.sourceContactType ?? undefined,
    stepNumber: nextStepIndex,
    previousSubject: previousEmail?.subject,
    yourWebsite: senderSettings.yourWebsite,
    yourCompany: senderSettings.yourCompany,
    variant: abVariant ?? undefined,
    referenceTemplate,
    prospectContent: {
      homepageTitle: (prospectExt.homepageTitle as string | null | undefined) ?? undefined,
      homepageMeta: (prospectExt.homepageMeta as string | null | undefined) ?? undefined,
      latestArticleTitles: (prospectExt.latestArticleTitles as string[] | null | undefined) ?? undefined,
      aboutSnippet: (prospectExt.aboutSnippet as string | null | undefined) ?? undefined,
    },
  });

  // Check outreach mode: auto vs review
  const sendNow = await shouldSendImmediately();

  let messageId: string | undefined;
  let emailSent = false;
  let emailStatus: string;

  let sendingDomain: { domain: string; fromEmail: string; fromName: string; replyTo: string } | null = null;

  if (sendNow) {
    // ── AUTO MODE: Send follow-up immediately via SMTP direct ──
    try {
      sendingDomain = await getNextSendingDomain();
      const fromEmail = senderSettings.fromEmail || sendingDomain.fromEmail;
      const fromName = senderSettings.fromName || sendingDomain.fromName;
      const replyTo = senderSettings.replyTo || sendingDomain.replyTo;

      const result = await sendViaSMTP({
        toEmail: contact.email,
        toName: contact.firstName ?? contact.name ?? undefined,
        fromEmail,
        fromName,
        replyTo,
        subject: generatedEmail.subject,
        bodyText: generatedEmail.body,
      });

      if (result.success) {
        messageId = result.messageId;
        emailSent = true;
        log.info(
          { enrollmentId: enrollment.id, step: nextStepIndex, domain: sendingDomain.domain, messageId },
          "Follow-up SENT via SMTP direct.",
        );
      } else {
        log.error(
          { enrollmentId: enrollment.id, step: nextStepIndex, error: result.error, domain: sendingDomain.domain },
          "SMTP follow-up failed.",
        );
      }
    } catch (err) {
      log.error({ err, enrollmentId: enrollment.id, step: nextStepIndex }, "Fatal error during SMTP follow-up.");
    }
    emailStatus = emailSent ? "sent" : "failed";
  } else {
    // ── REVIEW MODE: Create draft follow-up ──
    emailStatus = "draft";
    log.info({ enrollmentId: enrollment.id, step: nextStepIndex }, "REVIEW MODE — follow-up created as draft.");
  }

  // Update enrollment in DB + store email
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: nextStepIndex,
        lastSentAt: sendNow ? now : undefined,
        nextSendAt, // Always set — sequence advancer re-checks mode before sending
      },
    });

    await tx.sentEmail.create({
      data: {
        enrollmentId: enrollment.id,
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        campaignId: enrollment.campaignId,
        stepNumber: nextStepIndex,
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        language: prospect.language ?? "en",
        generatedBy: "ai",
        promptContext: {
          domain: prospect.domain,
          themes: prospect.thematicCategories,
          stepNumber: nextStepIndex,
          previousSubject: previousEmail?.subject,
          abVariant: abVariant ?? null,
        },
        mailwizzMessageId: messageId ?? null,
        status: emailStatus,
        sentAt: sendNow ? now : null as unknown as Date,
        abVariant: abVariant ?? null,
      },
    });

    if (sendNow) {
      await tx.prospect.update({
        where: { id: enrollment.prospectId },
        data: { lastContactedAt: now },
      });
    }

    await tx.event.create({
      data: {
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        enrollmentId: enrollment.id,
        eventType: sendNow ? "SEQUENCE_STEP_SENT" : "DRAFT_CREATED",
        eventSource: "sequence-advancer",
        data: {
          step: nextStepIndex,
          delayDays: step.delayDays,
          messageId: messageId ?? null,
          emailSubject: generatedEmail.subject,
          nextSendAt: nextSendAt?.toISOString() ?? null,
          outreachMode: sendNow ? "auto" : "review",
        },
      },
    });
  });

  log.debug(
    { enrollmentId: enrollment.id, step: nextStepIndex, messageId },
    "Enrollment advanced and follow-up sent.",
  );
}

async function markCompleted(enrollment: {
  id: number;
  prospectId: number;
  contactId: number;
  campaignId: number;
}): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "completed",
        completedAt: now,
        nextSendAt: null,
      },
    });

    await tx.event.create({
      data: {
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        enrollmentId: enrollment.id,
        eventType: "SEQUENCE_COMPLETED",
        eventSource: "sequence-advancer",
        data: { completedAt: now.toISOString() },
      },
    });
  });

  log.debug({ enrollmentId: enrollment.id }, "Enrollment sequence completed.");
}

async function checkStopConditions(enrollment: {
  id: number;
  prospectId: number;
  contactId: number;
  campaignId: number;
  lastSentAt: Date | null;
  campaign: { stopOnReply: boolean; stopOnBounce: boolean; stopOnUnsub: boolean };
}): Promise<boolean> {
  const since = enrollment.lastSentAt ?? new Date(0);

  // Check for reply since last send
  if (enrollment.campaign.stopOnReply) {
    const replyEvent = await prisma.event.findFirst({
      where: {
        prospectId: enrollment.prospectId,
        eventType: { in: ["reply_received", "REPLY_RECEIVED"] },
        createdAt: { gt: since },
      },
    });

    if (replyEvent) {
      await stopEnrollment(enrollment, "reply_received");
      return true;
    }
  }

  // Check for bounce since last send
  if (enrollment.campaign.stopOnBounce) {
    const bounceEvent = await prisma.event.findFirst({
      where: {
        enrollmentId: enrollment.id,
        eventType: { in: ["bounce", "hard_bounce", "soft_bounce"] },
        createdAt: { gt: since },
      },
    });

    if (bounceEvent) {
      await stopEnrollment(enrollment, "bounce_received");
      return true;
    }
  }

  // Check for unsubscribe
  if (enrollment.campaign.stopOnUnsub) {
    const unsubEvent = await prisma.event.findFirst({
      where: {
        enrollmentId: enrollment.id,
        eventType: "unsubscribe",
        createdAt: { gt: since },
      },
    });

    if (unsubEvent) {
      await stopEnrollment(enrollment, "unsubscribed");
      return true;
    }
  }

  return false;
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
        eventType: "SEQUENCE_STOPPED",
        eventSource: "sequence-advancer",
        data: { reason },
      },
    });
  });

  log.info({ enrollmentId: enrollment.id, reason }, "Enrollment stopped.");
}

// ---------------------------------------------------------------------------
// Daily quota management (Redis counter)
// ---------------------------------------------------------------------------

function getDailyQuotaKey(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${REDIS_SEND_COUNTER_PREFIX}${today}`;
}

async function checkDailyQuota(config: SequenceConfig | null): Promise<boolean> {
  const maxSends = config?.maxSendsPerDay ?? DEFAULT_MAX_SENDS_PER_DAY;
  const key = getDailyQuotaKey();
  try {
    const current = parseInt((await redis.get(key)) ?? "0", 10);
    return current < maxSends;
  } catch (err) {
    log.warn({ err }, "Redis unavailable for quota check, allowing send.");
    return true; // Fail open
  }
}

async function incrementDailyQuota(): Promise<void> {
  const key = getDailyQuotaKey();
  try {
    await redis.incr(key);
    await redis.expire(key, 86_400); // 24h TTL
  } catch (err) {
    log.warn({ err }, "Redis unavailable for quota increment.");
  }
}

// ---------------------------------------------------------------------------
// Jitter (random delay between sends)
// ---------------------------------------------------------------------------

function getJitterMs(maxMinutes: number): number {
  // Random delay between 10 seconds and maxMinutes
  const minMs = 10_000;
  const maxMs = maxMinutes * 60_000;
  return Math.floor(Math.random() * (maxMs - minMs) + minMs);
}
