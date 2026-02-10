// ---------------------------------------------------------------------------
// Enrollment Manager - Enroll a prospect into a MailWizz outreach campaign
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../config/database.js";
import {
  mailwizzConfig,
  getListUid,
} from "../../config/mailwizz.js";
import type { SupportedLanguage } from "../../config/constants.js";
import { DA_THRESHOLDS, SCORE_THRESHOLDS } from "../../config/constants.js";
import { createChildLogger } from "../../utils/logger.js";
import { MailWizzClient } from "./mailwizzClient.js";
import { isInSuppressionList } from "../suppression/suppressionManager.js";

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

  // 3. Check if already in MailWizz
  const listUid = campaign.mailwizzListUid ?? getListUid(
    (prospect.language ?? campaign.language) as SupportedLanguage,
  );

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

  // 5. Generate personalized line via Claude
  const personalizedLine = await generatePersonalizedLine(
    prospect,
    contact,
    campaign.language,
  );

  // 6. Generate unique campaign reference
  const campaignRef = `BL-${campaignId}-${prospectId}-${Date.now()}`;

  // 7. Build tags for MailWizz
  const tags = buildTags(prospect, campaign);

  // 8. Create subscriber in MailWizz (with tags)
  const { subscriberUid } = await mailwizz.createSubscriber(listUid, {
    email: contact.email,
    fname: contact.name ?? undefined,
    BLOG_NAME: prospect.domain,
    BLOG_URL: `https://${prospect.domain}`,
    COUNTRY: prospect.country ?? "",
    LANGUAGE: prospect.language ?? campaign.language,
    PERSONALIZED_LINE: personalizedLine,
    PROSPECT_ID: String(prospectId),
    CAMPAIGN_REF: campaignRef,
    TAGS: tags.join(","),
  });

  // 9. Create enrollment + update prospect + update campaign + log event in a transaction
  const enrollment = await prisma.$transaction(async (tx) => {
    const newEnrollment = await tx.enrollment.create({
      data: {
        contactId: contact.id,
        campaignId: campaign.id,
        prospectId: prospect.id,
        mailwizzSubscriberUid: subscriberUid,
        mailwizzListUid: listUid,
        campaignRef,
        currentStep: 0,
        status: "active",
        enrolledAt: new Date(),
      },
    });

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

    await tx.campaign.update({
      where: { id: campaignId },
      data: { totalEnrolled: { increment: 1 } },
    });

    await tx.event.create({
      data: {
        prospectId,
        contactId: contact.id,
        enrollmentId: newEnrollment.id,
        eventType: "ENROLLED",
        eventSource: "enrollment-manager",
        data: {
          campaignId,
          campaignRef,
          subscriberUid,
          listUid,
          personalizedLine,
          tags,
        } as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    return newEnrollment;
  });

  log.info(
    { prospectId, enrollmentId: enrollment.id, campaignRef },
    "Prospect enrolled successfully",
  );
}

// ---------------------------------------------------------------------------
// Personalized line generation (Claude)
// ---------------------------------------------------------------------------

async function generatePersonalizedLine(
  prospect: ProspectForEnrollment,
  contact: ContactForEnrollment,
  campaignLanguage: string,
): Promise<string> {
  try {
    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `You are writing a personalized opening line for a backlink outreach email.

Context:
- Blog/site: ${prospect.domain}
- Contact name: ${contact.name ?? "Unknown"}
- Country: ${prospect.country ?? "Unknown"}
- Language: ${campaignLanguage}

Write a single, natural-sounding personalized opening line (1-2 sentences max) in ${campaignLanguage} that:
- References their website naturally
- Feels genuine, not templated
- Does NOT mention backlinks or SEO
- Is appropriate for a first contact

Return ONLY the personalized line, nothing else.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock?.text?.trim() ?? "";
  } catch (err) {
    log.error({ err, prospectId: prospect.id }, "Failed to generate personalized line");
    // Fallback: empty personalized line (template will handle it)
    return "";
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
