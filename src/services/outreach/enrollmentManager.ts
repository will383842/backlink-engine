// ---------------------------------------------------------------------------
// Enrollment Manager - Enroll a prospect into a MailWizz outreach campaign
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import {
  mailwizzConfig,
  getListUid,
} from "../../config/mailwizz.js";
import type { SupportedLanguage } from "../../config/constants.js";
import { DA_THRESHOLDS, SCORE_THRESHOLDS } from "../../config/constants.js";
import type { AbVariant } from "../../llm/types.js";
import { createChildLogger } from "../../utils/logger.js";
import { MailWizzClient } from "./mailwizzClient.js";
import { isInSuppressionList } from "../suppression/suppressionManager.js";
import { getLlmClient } from "../../llm/index.js";
import { getMailwizzConfig } from "../mailwizz/config.js";
import { shouldSendImmediately } from "./outreachMode.js";

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

  // 0. Check MailWizz kill switch
  const mwConfig = await getMailwizzConfig();

  if (!mwConfig.enabled) {
    log.warn({ prospectId, campaignId }, "MailWizz disabled, enrollment skipped");
    await logEvent(prospectId, null, null, "ENROLLMENT_BLOCKED", {
      reason: "mailwizz_disabled",
    });
    return;
  }

  if (mwConfig.dryRun) {
    log.info(
      { prospectId, campaignId },
      "DRY RUN MODE - Simulating enrollment without sending to MailWizz"
    );
    await logEvent(prospectId, null, null, "ENROLLMENT_DRY_RUN", {
      campaignId,
      prospectId,
    });
    return;
  }

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

  // 3. Check if already in MailWizz
  const listUid = await resolveListUid(campaign, prospect);

  const mailwizz = new MailWizzClient(mailwizzConfig.apiUrl, mailwizzConfig.apiKey);
  const existing = await mailwizz.searchSubscriber(listUid, contact.email);

  if (existing) {
    log.warn(
      { prospectId, email: contact.email },
      "Subscriber already exists in MailWizz",
    );
    await logEvent(prospectId, contact.id, null, "ENROLLMENT_BLOCKED", {
      reason: "already_in_mailwizz",
    });
    return;
  }

  // 4. Check for existing enrollment for this contact + campaign
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

  let subscriberUid: string | undefined;
  let messageId: string | undefined;
  let emailEngineCampaignId: number | undefined;
  let emailStatus: string;

  if (sendNow) {
    // ── AUTO MODE: Create MailWizz subscriber + send email immediately ──
    const mwResult = await mailwizz.createSubscriber(listUid, {
      email: contact.email,
      fname: contact.name ?? undefined,
      BLOG_NAME: prospect.domain,
      BLOG_URL: `https://${prospect.domain}`,
      COUNTRY: prospect.country ?? "",
      LANGUAGE: prospect.language ?? campaign.language,
      PERSONALIZED_LINE: generatedEmail.body.slice(0, 200),
      PROSPECT_ID: String(prospectId),
      CAMPAIGN_REF: campaignRef,
      TAGS: tags.join(","),
    });
    subscriberUid = mwResult.subscriberUid;

    // Send via email-engine (primary) or MailWizz transactional (fallback)
    const { getEmailEngineClient } = await import("./emailEngineClient.js");
    const emailEngine = getEmailEngineClient();

    if (emailEngine.isConfigured()) {
      try {
        const result = await emailEngine.sendEmail({
          toEmail: contact.email,
          toName: contact.name ?? undefined,
          subject: generatedEmail.subject,
          body: generatedEmail.body,
          language: prospect.language ?? campaign.language,
          tags: tags,
          metadata: {
            prospect_id: String(prospectId),
            campaign_ref: campaignRef,
            domain: prospect.domain,
          },
        });

        if (result.success) {
          emailEngineCampaignId = result.campaignId;
          log.info({ prospectId, toEmail: contact.email, campaignId: result.campaignId }, "Initial email SENT via email-engine.");
        } else {
          log.warn({ prospectId, error: result.error }, "Email-engine send failed, trying MailWizz fallback.");
        }
      } catch (err) {
        log.warn({ err, prospectId }, "Email-engine unavailable, trying MailWizz fallback.");
      }
    }

    if (!emailEngineCampaignId) {
      try {
        const result = await mailwizz.sendTransactionalEmail({
          toEmail: contact.email,
          toName: contact.name ?? undefined,
          subject: generatedEmail.subject,
          body: generatedEmail.body,
          fromEmail: senderSettings.fromEmail || undefined,
          fromName: senderSettings.fromName || undefined,
          replyTo: senderSettings.replyTo || undefined,
        });
        messageId = result.messageId;
        log.info({ prospectId, toEmail: contact.email, messageId }, "Initial email SENT via MailWizz fallback.");
      } catch (err) {
        log.error({ err, prospectId }, "Both email-engine and MailWizz failed. Email not sent.");
      }
    }

    emailStatus = (emailEngineCampaignId || messageId) ? "sent" : "failed";
  } else {
    // ── REVIEW MODE: Generate draft, do NOT send ──
    emailStatus = "draft";
    log.info({ prospectId, campaignId }, "REVIEW MODE — email created as draft, awaiting approval.");
  }

  // 10. Create enrollment + sentEmail + update prospect + log event in a transaction
  const enrollment = await prisma.$transaction(async (tx) => {
    const firstFollowupDate = sendNow ? calculateFirstFollowupDate(campaign) : null;

    const newEnrollment = await tx.enrollment.create({
      data: {
        contactId: contact.id,
        campaignId: campaign.id,
        prospectId: prospect.id,
        mailwizzSubscriberUid: subscriberUid ?? null,
        mailwizzListUid: listUid,
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
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        language: prospect.language ?? campaign.language,
        generatedBy: "ai",
        promptContext: {
          domain: prospect.domain,
          contactName: contact.name ?? null,
          abVariant: abVariant ?? null,
        } as unknown as import("@prisma/client").Prisma.InputJsonValue,
        mailwizzMessageId: messageId ?? null,
        mailwizzCampaignUid: emailEngineCampaignId ? String(emailEngineCampaignId) : null,
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
          subscriberUid: subscriberUid ?? null,
          listUid,
          messageId: messageId ?? null,
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
// List UID resolution: campaign override → DB settings → env vars
// ---------------------------------------------------------------------------

async function resolveListUid(
  campaign: CampaignForEnrollment,
  prospect: ProspectForEnrollment,
): Promise<string> {
  // 1. Campaign-level override
  if (campaign.mailwizzListUid) return campaign.mailwizzListUid;

  // 2. Try DB settings
  const lang = (prospect.language ?? campaign.language) as SupportedLanguage;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "mailwizz" } });
    if (row) {
      const mw = row.value as Record<string, unknown>;
      const listUids = mw.listUids as Record<string, string> | undefined;
      if (listUids?.[lang]) return listUids[lang];
    }
  } catch {
    // fall through to env vars
  }

  // 3. Env vars (via config)
  return getListUid(lang);
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
