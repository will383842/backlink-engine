import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { isInSuppressionList } from "../suppression/suppressionManager.js";
import { shouldSendImmediately } from "../outreach/outreachMode.js";
import { getEmailEngineClient } from "../outreach/emailEngineClient.js";
import { sendViaSMTP } from "../outreach/smtpSender.js";
import { getNextSendingDomain } from "../outreach/domainRotator.js";
import { canSendToIsp, recordSendToIsp } from "../outreach/ispThrottler.js";
import { generateUnsubscribeUrl } from "../../api/routes/unsubscribe.js";
import { getVariations, pickAndPersonalize } from "./variationCache.js";
import { sendBroadcastAlert } from "../notifications/telegramService.js";

const log = createChildLogger("broadcast-manager");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BroadcastResult {
  status: "sent" | "draft" | "suppressed" | "duplicate" | "error";
  sentEmailId?: number;
  error?: string;
}

interface EligibleContact {
  contactId: number;
  email: string;
  emailNormalized: string;
  firstName: string | null;
  lastName: string | null;
  sourceContactType: string | null;
  language: string | null;
  country: string | null;
  prospectId: number;
  domain: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enroll a single contact into a broadcast campaign.
 */
export async function enrollBroadcastRecipient(
  campaignId: number,
  contact: EligibleContact,
): Promise<BroadcastResult> {
  try {
    // 1. Load campaign
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.campaignType !== "broadcast") {
      return { status: "error", error: "Campaign not found or not broadcast type" };
    }

    const sourceEmail = campaign.sourceEmail as { subject: string; body: string } | null;
    if (!sourceEmail?.subject || !sourceEmail?.body) {
      return { status: "error", error: "Campaign has no source email" };
    }

    // 2. Check suppression
    if (await isInSuppressionList(contact.emailNormalized)) {
      log.debug({ email: contact.emailNormalized }, "Suppressed — skipping.");
      return { status: "suppressed" };
    }

    // 3. Check duplicate enrollment
    const existing = await prisma.enrollment.findFirst({
      where: { contactId: contact.contactId, campaignId },
    });
    if (existing) {
      return { status: "duplicate" };
    }

    // 4. Get or generate variations for this language + contactType combo
    const language = contact.language || campaign.language || "en";
    const contactType = contact.sourceContactType || "other";
    const brief = campaign.brief || "";

    const variations = await getVariations(
      campaignId, language, contactType, sourceEmail, brief,
    );

    // 5. Pick random variation and personalize
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null;
    const emailContent = pickAndPersonalize(variations, contactName, contact.domain);

    // 5b. Get sending domain (round-robin rotation)
    const sendingDomain = await getNextSendingDomain();

    // 5c. Add unsubscribe footer
    const unsubLink = generateUnsubscribeUrl(contact.email);
    const bodyWithUnsub = emailContent.body + `\n\n---\nPour ne plus recevoir nos emails : ${unsubLink}`;

    // 6. Check ISP rate limit
    if (!(await canSendToIsp(contact.email))) {
      log.debug({ email: contact.email }, "ISP rate limit reached — skipping for now.");
      return { status: "error", error: "ISP rate limit" };
    }

    // 7. Check outreach mode (auto vs review)
    const autoSend = await shouldSendImmediately();

    // 8. Try to send
    let mailwizzMessageId: string | null = null;
    let sentAt: Date | null = null;
    let emailStatus: string = "draft";

    if (autoSend) {
      try {
        // Primary: Direct SMTP via Postfix → OpenDKIM → PowerMTA
        const smtpResult = await sendViaSMTP({
          toEmail: contact.email,
          toName: contactName || undefined,
          fromEmail: sendingDomain.fromEmail,
          fromName: sendingDomain.fromName,
          replyTo: sendingDomain.replyTo,
          subject: emailContent.subject,
          bodyText: bodyWithUnsub,
        });

        if (smtpResult.success) {
          emailStatus = "sent";
          sentAt = new Date();
          mailwizzMessageId = smtpResult.messageId ?? null;
          await recordSendToIsp(contact.email);
        }

        // Fallback 1: Email Engine API (if configured)
        if (emailStatus !== "sent") {
          const emailEngine = getEmailEngineClient();
          if (emailEngine.isConfigured()) {
            const result = await emailEngine.sendEmail({
              toEmail: contact.email,
              toName: contactName || undefined,
              subject: emailContent.subject,
              body: bodyWithUnsub,
              language,
              category: contactType,
              tags: [`broadcast`, `campaign:${campaignId}`, `type:${contactType}`, `lang:${language}`],
            });
            if (result.success) {
              emailStatus = "sent";
              sentAt = new Date();
              mailwizzMessageId = result.campaignId ? String(result.campaignId) : null;
              await recordSendToIsp(contact.email);
            }
          }
        }

        // Fallback 2: MailWizz transactional API
        if (emailStatus !== "sent") {
          const { MailWizzClient } = await import("../outreach/mailwizzClient.js");
          const mailwizzConfig = await import("../../config/mailwizz.js");
          const mw = new MailWizzClient(mailwizzConfig.mailwizzConfig.apiUrl, mailwizzConfig.mailwizzConfig.apiKey);
          const result = await mw.sendTransactionalEmail({
            toEmail: contact.email,
            toName: contactName || "",
            fromEmail: sendingDomain.fromEmail,
            fromName: sendingDomain.fromName,
            replyTo: sendingDomain.replyTo,
            subject: emailContent.subject,
            body: textToHtml(bodyWithUnsub),
          });
          if (result.messageId) {
            emailStatus = "sent";
            sentAt = new Date();
            mailwizzMessageId = result.messageId;
            await recordSendToIsp(contact.email);
          }
        }
      } catch (err) {
        log.error({ err, email: contact.email }, "Failed to send broadcast email");
        emailStatus = "failed";
      }
    }

    // 8. Create enrollment + sent email in transaction
    const [enrollment] = await prisma.$transaction([
      prisma.enrollment.create({
        data: {
          contactId: contact.contactId,
          campaignId,
          prospectId: contact.prospectId,
          currentStep: 0,
          status: emailStatus === "sent" ? "completed" : "active",
          enrolledAt: new Date(),
          lastSentAt: sentAt,
        },
      }),
    ]);

    const sentEmail = await prisma.sentEmail.create({
      data: {
        enrollmentId: enrollment.id,
        prospectId: contact.prospectId,
        contactId: contact.contactId,
        campaignId,
        stepNumber: 0,
        subject: emailContent.subject,
        body: bodyWithUnsub,
        language,
        generatedBy: "ai",
        status: emailStatus,
        sentAt,
        mailwizzMessageId,
      },
    });

    // 9. Update campaign counters
    if (emailStatus === "sent") {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalEnrolled: { increment: 1 },
          totalSent: { increment: 1 },
        },
      });
    }

    // 10. Log event
    await prisma.event.create({
      data: {
        prospectId: contact.prospectId,
        contactId: contact.contactId,
        enrollmentId: enrollment.id,
        eventType: emailStatus === "sent" ? "broadcast_sent" : "broadcast_draft",
        eventSource: "broadcast",
        data: { campaignId, subject: emailContent.subject, language, contactType, sendingDomain: sendingDomain.domain } as unknown as Prisma.InputJsonValue,
      },
    });

    log.info(
      { campaignId, email: contact.email, status: emailStatus },
      "Broadcast recipient processed.",
    );

    return { status: emailStatus === "sent" ? "sent" : "draft", sentEmailId: sentEmail.id };
  } catch (err) {
    log.error({ err, campaignId, contactId: contact.contactId }, "Broadcast enrollment error");
    return { status: "error", error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Get eligible contacts for a broadcast campaign.
 */
export async function getEligibleContacts(
  campaignId: number,
  limit: number,
): Promise<EligibleContact[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { targetSourceContactTypes: true },
  });

  if (!campaign) return [];

  const targetTypes = (campaign.targetSourceContactTypes as string[]) ?? [];

  const typeFilter = targetTypes.length > 0
    ? Prisma.sql`AND (c."sourceContactType" = ANY(${targetTypes}) OR p."sourceContactType" = ANY(${targetTypes}))`
    : Prisma.empty;

  const contacts = await prisma.$queryRaw<EligibleContact[]>`
    SELECT
      c.id AS "contactId",
      c.email,
      c."emailNormalized",
      c."firstName",
      c."lastName",
      c."sourceContactType",
      p.language,
      p.country,
      p.id AS "prospectId",
      p.domain
    FROM contacts c
    JOIN prospects p ON c."prospectId" = p.id
    WHERE c."optedOut" = false
      AND c."emailStatus" NOT IN ('invalid')
      ${typeFilter}
      AND c.id NOT IN (
        SELECT "contactId" FROM enrollments WHERE "campaignId" = ${campaignId}
      )
      AND c."emailNormalized" NOT IN (
        SELECT "emailNormalized" FROM suppression_entries
      )
    ORDER BY c."createdAt" ASC
    LIMIT ${limit}
  `;

  return contacts;
}

/**
 * Count total eligible contacts for a broadcast campaign.
 */
export async function countEligibleContacts(campaignId: number): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { targetSourceContactTypes: true },
  });

  if (!campaign) return 0;

  const targetTypes = (campaign.targetSourceContactTypes as string[]) ?? [];

  const typeFilter = targetTypes.length > 0
    ? Prisma.sql`AND (c."sourceContactType" = ANY(${targetTypes}) OR p."sourceContactType" = ANY(${targetTypes}))`
    : Prisma.empty;

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM contacts c
    JOIN prospects p ON c."prospectId" = p.id
    WHERE c."optedOut" = false
      AND c."emailStatus" NOT IN ('invalid')
      ${typeFilter}
      AND c.id NOT IN (
        SELECT "contactId" FROM enrollments WHERE "campaignId" = ${campaignId}
      )
      AND c."emailNormalized" NOT IN (
        SELECT "emailNormalized" FROM suppression_entries
      )
  `;

  return Number(result[0]?.count ?? 0);
}

/**
 * Check campaign health (bounce/complaint rates) and auto-pause if needed.
 */
export async function checkCampaignHealth(campaignId: number): Promise<{ healthy: boolean; reason?: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, totalSent: true, totalBounced: true, totalComplained: true },
  });

  if (!campaign || campaign.totalSent < 10) return { healthy: true };

  const bounceRate = campaign.totalBounced / campaign.totalSent;
  const complaintRate = campaign.totalComplained / campaign.totalSent;

  if (bounceRate > 0.05) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { isActive: false } });
    log.warn({ campaignId, bounceRate }, "Campaign auto-paused: bounce rate > 5%");
    // Real-time Telegram alert
    sendBroadcastAlert(campaign.name, "auto_paused",
      `Bounce rate: ${(bounceRate * 100).toFixed(1)}% (seuil: 5%)\nBounces: ${campaign.totalBounced}/${campaign.totalSent} envoyes`
    ).catch(() => {});
    return { healthy: false, reason: `Bounce rate ${(bounceRate * 100).toFixed(1)}% > 5%` };
  }

  if (complaintRate > 0.001) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { isActive: false } });
    log.warn({ campaignId, complaintRate }, "Campaign auto-paused: complaint rate > 0.1%");
    // Real-time Telegram alert
    sendBroadcastAlert(campaign.name, "auto_paused",
      `Plaintes: ${(complaintRate * 100).toFixed(2)}% (seuil: 0.1%)\nPlaintes: ${campaign.totalComplained}/${campaign.totalSent} envoyes`
    ).catch(() => {});
    return { healthy: false, reason: `Complaint rate ${(complaintRate * 100).toFixed(2)}% > 0.1%` };
  }

  return { healthy: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

async function loadSenderSettings(): Promise<{
  fromEmail: string;
  fromName: string;
  replyTo: string;
}> {
  const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
  const val = (row?.value as Record<string, string>) ?? {};
  return {
    fromEmail: val.fromEmail || process.env.FROM_EMAIL || "contact@life-expat.com",
    fromName: val.fromName || process.env.FROM_NAME || "Life Expat",
    replyTo: val.replyTo || process.env.REPLY_TO || val.fromEmail || "contact@life-expat.com",
  };
}
