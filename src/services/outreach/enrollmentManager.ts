// ---------------------------------------------------------------------------
// Enrollment Manager — enroll a prospect and send via SMTP direct
// ---------------------------------------------------------------------------
// Sending path: Postfix/PMTA on the VPS, using the per-domain rotation
// (domainRotator) with ISP throttling. MailWizz is NOT used. A/B testing,
// sequences, pixel tracking, reply classification and warmup are all handled
// locally.
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import type { SupportedLanguage } from "../../config/constants.js";
import { DA_THRESHOLDS, SCORE_THRESHOLDS } from "../../config/constants.js";
import type { AbVariant } from "../../llm/types.js";
import { createChildLogger } from "../../utils/logger.js";
import { isInSuppressionList } from "../suppression/suppressionManager.js";
import { getLlmClient } from "../../llm/index.js";
import { shouldSendImmediately } from "./outreachMode.js";
import { sendViaSMTP } from "./smtpSender.js";
import { getNextSendingDomain } from "./domainRotator.js";

const log = createChildLogger("enrollment");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProspectForEnrollment {
  id: number;
  domain: string;
  language: string | null;
  country: string | null;
  tier: number;
  score: number;
  mozDa: number | null;
  status: string;
}

interface ContactForEnrollment {
  id: number;
  email: string;
  emailNormalized: string;
  name: string | null;
}

interface CampaignForEnrollment {
  id: number;
  name: string;
  language: string;
  mailwizzListUid: string | null;
  abTestEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enroll a prospect into an outreach campaign.
 *
 * Steps:
 * 1. Load prospect, contact, and campaign data
 * 2. Check suppression list
 * 3. Check if already enrolled in MailWizz
 * 4. Generate personalized opening line via Claude
 * 5. Create subscriber in MailWizz with custom fields + tags
 * 6. Create enrollment record in database
 * 7. Update prospect status to CONTACTED_EMAIL
 * 8. Log event
 */
export async function enrollProspect(
  prospectId: number,
  campaignId: number,
): Promise<void> {
  log.info({ prospectId, campaignId }, "Starting enrollment");

  // 1. Load data
  const prospect = await prisma.prospect.findUniqueOrThrow({
    where: { id: prospectId },
  }) as ProspectForEnrollment;

  const contact = await prisma.contact.findFirst({
    where: { prospectId, optedOut: false, emailStatus: { not: "invalid" } },
    orderBy: { createdAt: "asc" },
  }) as ContactForEnrollment | null;

  if (!contact) {
    throw new Error(`No valid contact found for prospect ${prospectId}`);
  }

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  }) as CampaignForEnrollment;

  // 2. Check suppression list
  const isSuppressed = await isInSuppressionList(contact.emailNormalized);
  if (isSuppressed) {
    log.warn(
      { prospectId, email: contact.emailNormalized },
      "Email is in suppression list, skipping enrollment",
    );
    await logEvent(prospectId, contact.id, null, "ENROLLMENT_BLOCKED", {
      reason: "suppression_list",
    });
    return;
  }

  // 3. Check for existing enrollment for this contact + campaign
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      contactId_campaignId: {
        contactId: contact.id,
        campaignId: campaign.id,
      },
    },
  });

  if (existingEnrollment) {
    log.warn(
      { prospectId, contactId: contact.id, campaignId },
      "Already enrolled in this campaign",
    );
    return;
  }

  // 5. Load sender settings for email generation
  let senderSettings = { yourWebsite: "https://life-expat.com", yourCompany: "Life Expat", fromEmail: "", fromName: "", replyTo: "" };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
    if (row) Object.assign(senderSettings, row.value);
  } catch { /* use defaults */ }

  // 6. Determine A/B variant (random 50/50 split when campaign has A/B testing enabled)
  const abVariant: AbVariant | undefined = campaign.abTestEnabled
    ? (Math.random() < 0.5 ? "A" : "B")
    : undefined;

  if (abVariant) {
    log.info({ prospectId, campaignId, abVariant }, "A/B test: assigned variant");
  }

  // 7. Generate COMPLETE personalized email via AI
  const llm = getLlmClient();
  const generatedEmail = await llm.generateOutreachEmail({
    domain: prospect.domain,
    language: prospect.language ?? campaign.language,
    country: prospect.country ?? undefined,
    themes: (prospect as unknown as Record<string, unknown>).thematicCategories as string[] | undefined,
    opportunityType: (prospect as unknown as Record<string, unknown>).opportunityType as string | undefined,
    contactName: contact.name ?? undefined,
    contactType: ((contact as unknown as Record<string, unknown>).sourceContactType as string | undefined)
      ?? ((prospect as unknown as Record<string, unknown>).sourceContactType as string | undefined),
    stepNumber: 0,
    yourWebsite: senderSettings.yourWebsite,
    yourCompany: senderSettings.yourCompany,
    variant: abVariant,
  });

  // 7. Generate unique campaign reference
  const campaignRef = `BL-${campaignId}-${prospectId}-${Date.now()}`;

  // 8. Build tags for MailWizz
  const tags = buildTags(prospect, campaign);

  // 9. Check outreach mode: auto (send immediately) vs review (create draft)
  const sendNow = await shouldSendImmediately();

  let messageId: string | undefined;
  let sendingDomain: { domain: string; fromEmail: string; fromName: string; replyTo: string } | null = null;
  let emailStatus: string;

  if (sendNow) {
    // ── AUTO MODE: send directly via SMTP (Postfix/PMTA) with domain rotation ──
    //
    // We pick the next sending domain from the rotation pool (round-robin with
    // per-domain warmup caps applied by the rotator). The actual SMTP relay is
    // the local Postfix; PMTA handles throttling + warmup traffic mixing.
    try {
      sendingDomain = await getNextSendingDomain();
      const fromEmail = senderSettings.fromEmail || sendingDomain.fromEmail;
      const fromName = senderSettings.fromName || sendingDomain.fromName;
      const replyTo = senderSettings.replyTo || sendingDomain.replyTo;

      const result = await sendViaSMTP({
        toEmail: contact.email,
        toName: contact.name ?? undefined,
        fromEmail,
        fromName,
        replyTo,
        subject: generatedEmail.subject,
        bodyText: generatedEmail.body,
      });

      if (result.success) {
        messageId = result.messageId;
        log.info(
          { prospectId, toEmail: contact.email, domain: sendingDomain.domain, messageId },
          "Initial email SENT via SMTP direct.",
        );
      } else {
        log.error(
          { prospectId, error: result.error, domain: sendingDomain.domain },
          "SMTP send failed.",
        );
      }
    } catch (err) {
      log.error({ err, prospectId }, "Fatal error during SMTP send attempt.");
    }

    emailStatus = messageId ? "sent" : "failed";
  } else {
    // ── REVIEW MODE: Generate draft, do NOT send ──
    emailStatus = "draft";
    log.info({ prospectId, campaignId }, "REVIEW MODE — email created as draft, awaiting approval.");
  }

  // 10. Create enrollment + sentEmail + update prospect + log event in a transaction
  const enrollment = await prisma.$transaction(async (tx) => {
    // Always calculate follow-up date (even for drafts — needed to unfreeze after approval)
    const firstFollowupDate = calculateFirstFollowupDate(campaign);

    const newEnrollment = await tx.enrollment.create({
      data: {
        contactId: contact.id,
        campaignId: campaign.id,
        prospectId: prospect.id,
        // mailwizzSubscriberUid / mailwizzListUid intentionally null — we send
        // via SMTP direct. Columns kept in schema for historical compat.
        mailwizzSubscriberUid: null,
        mailwizzListUid: null,
        campaignRef,
        currentStep: 0,
        status: "active",
        enrolledAt: new Date(),
        lastSentAt: sendNow ? new Date() : null,
        nextSendAt: firstFollowupDate,
      },
    });

    // Store the full email content for audit (or review)
    await tx.sentEmail.create({
      data: {
        enrollmentId: newEnrollment.id,
        prospectId,
        contactId: contact.id,
        campaignId: campaign.id,
        stepNumber: 0,
        // fromEmail records which sending domain actually carried this message
        // so the Mailbox Monitor can attribute stats per inbox.
        fromEmail: sendingDomain?.fromEmail ?? null,
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        language: prospect.language ?? campaign.language,
        generatedBy: "ai",
        promptContext: {
          domain: prospect.domain,
          contactName: contact.name ?? null,
          abVariant: abVariant ?? null,
          sendingDomain: sendingDomain?.domain ?? null,
        } as unknown as import("@prisma/client").Prisma.InputJsonValue,
        mailwizzMessageId: messageId ?? null,
        mailwizzCampaignUid: null,
        status: emailStatus,
        sentAt: sendNow ? new Date() : null as unknown as Date,
        abVariant: abVariant ?? null,
      },
    });

    // Only update prospect status if actually sent
    if (sendNow) {
      const now = new Date();
      await tx.prospect.update({
        where: { id: prospectId },
        data: {
          status: "CONTACTED_EMAIL",
          firstContactedAt: prospect.status === "NEW" || prospect.status === "READY_TO_CONTACT"
            ? now
            : undefined,
          lastContactedAt: now,
        },
      });
    }

    await tx.campaign.update({
      where: { id: campaignId },
      data: { totalEnrolled: { increment: 1 } },
    });

    await tx.event.create({
      data: {
        prospectId,
        contactId: contact.id,
        enrollmentId: newEnrollment.id,
        eventType: sendNow ? "ENROLLED" : "DRAFT_CREATED",
        eventSource: "enrollment-manager",
        data: {
          campaignId,
          campaignRef,
          messageId: messageId ?? null,
          sendingDomain: sendingDomain?.domain ?? null,
          emailSubject: generatedEmail.subject,
          tags,
          abVariant: abVariant ?? null,
          outreachMode: sendNow ? "auto" : "review",
        } as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    return newEnrollment;
  });

  log.info(
    { prospectId, enrollmentId: enrollment.id, campaignRef, mode: sendNow ? "auto" : "review" },
    sendNow ? "Prospect enrolled and initial email sent." : "Prospect enrolled — draft email awaiting review.",
  );
}

// ---------------------------------------------------------------------------
// First follow-up date calculation from sequenceConfig
// ---------------------------------------------------------------------------

function calculateFirstFollowupDate(campaign: CampaignForEnrollment): Date | null {
  try {
    const config = (campaign as unknown as Record<string, unknown>).sequenceConfig;
    if (!config || typeof config !== "object") return null;

    const obj = config as Record<string, unknown>;
    const steps = obj.steps;
    if (!Array.isArray(steps) || steps.length === 0) return null;

    // First step after initial email (step 0 = initial send)
    // Find step with index 1 (first follow-up)
    const firstFollowup = steps.length > 1 ? steps[1] : steps[0];
    const delayDays = (firstFollowup as Record<string, unknown>).delayDays as number;

    if (typeof delayDays !== "number" || delayDays <= 0) return null;

    return new Date(Date.now() + delayDays * 86_400_000);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tag building
// ---------------------------------------------------------------------------

function buildTags(
  prospect: ProspectForEnrollment,
  campaign: CampaignForEnrollment,
): string[] {
  const tags: string[] = [];

  // Source tag
  tags.push("source:backlink-engine");

  // Tier tag
  tags.push(`tier:T${prospect.tier}`);

  // Language tag
  if (prospect.language) {
    tags.push(`lang:${prospect.language}`);
  }

  // Country tag
  if (prospect.country) {
    tags.push(`country:${prospect.country}`);
  }

  // Score level tag
  if (prospect.score >= SCORE_THRESHOLDS.high) {
    tags.push("score:high");
  } else if (prospect.score >= SCORE_THRESHOLDS.medium) {
    tags.push("score:medium");
  } else {
    tags.push("score:low");
  }

  // DA level tag
  if (prospect.mozDa != null) {
    if (prospect.mozDa >= DA_THRESHOLDS.high) {
      tags.push("da:high");
    } else if (prospect.mozDa >= DA_THRESHOLDS.medium) {
      tags.push("da:medium");
    } else {
      tags.push("da:low");
    }
  }

  // Campaign tag
  tags.push(`campaign:${campaign.name.toLowerCase().replace(/\s+/g, "-")}`);

  return tags;
}

// ---------------------------------------------------------------------------
// Event logging helper
// ---------------------------------------------------------------------------

async function logEvent(
  prospectId: number,
  contactId: number | null,
  enrollmentId: number | null,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  await prisma.event.create({
    data: {
      prospectId,
      contactId,
      enrollmentId,
      eventType,
      eventSource: "enrollment-manager",
      data: data as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}
