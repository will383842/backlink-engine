// ---------------------------------------------------------------------------
// MailWizz Webhook Handler - Process inbound webhook events from MailWizz
// ---------------------------------------------------------------------------

import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { addToSuppressionList } from "../suppression/suppressionManager.js";

const log = createChildLogger("mailwizz-webhook");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MailWizzEvent {
  /** Event type from MailWizz */
  type:
    | "subscribe"
    | "unsubscribe"
    | "campaign_sent"
    | "campaign_open"
    | "campaign_click"
    | "campaign_bounce"
    | "campaign_complaint"
    | "campaign_delivery";
  /** Subscriber UID */
  subscriber_uid?: string;
  /** Subscriber email */
  email?: string;
  /** List UID */
  list_uid?: string;
  /** Campaign UID */
  campaign_uid?: string;
  /** Custom fields that may contain our campaign reference */
  custom_fields?: Record<string, string>;
  /** Bounce type: hard | soft */
  bounce_type?: string;
  /** Raw event data */
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle an incoming MailWizz webhook event.
 *
 * Supported event types:
 * - `campaign_sent` / `campaign_delivery` - Update enrollment step
 * - `campaign_bounce` - Mark email invalid, add to suppression (hard bounce)
 * - `unsubscribe` - Add to suppression, set DO_NOT_CONTACT
 * - `campaign_complaint` - Same as unsubscribe
 * - `subscribe` / `campaign_open` / `campaign_click` - Log only
 */
export async function handleMailWizzWebhook(
  event: MailWizzEvent,
): Promise<void> {
  log.info({ type: event.type, email: event.email }, "Processing webhook event");

  // Find enrollment by campaign reference from custom fields
  const campaignRef = event.custom_fields?.["CAMPAIGN_REF"];
  const enrollment = campaignRef
    ? await findEnrollmentByCampaignRef(campaignRef)
    : null;

  // Also try to find by subscriber UID
  const enrollmentByUid = enrollment
    ? null
    : event.subscriber_uid
      ? await findEnrollmentBySubscriberUid(event.subscriber_uid)
      : null;

  const activeEnrollment = enrollment ?? enrollmentByUid;

  // Log the event regardless
  if (activeEnrollment) {
    await logWebhookEvent(activeEnrollment.prospectId, activeEnrollment.id, event);
  } else {
    log.warn(
      { type: event.type, campaignRef, subscriberUid: event.subscriber_uid },
      "Could not match webhook event to enrollment",
    );
  }

  // Handle by event type
  switch (event.type) {
    case "campaign_sent":
    case "campaign_delivery":
      await handleSent(activeEnrollment);
      break;

    case "campaign_bounce":
      await handleBounce(activeEnrollment, event);
      break;

    case "unsubscribe":
      await handleUnsubscribe(activeEnrollment, event);
      break;

    case "campaign_complaint":
      await handleComplaint(activeEnrollment, event);
      break;

    case "campaign_open":
    case "campaign_click":
      // Log only (already logged above)
      log.debug(
        { type: event.type, enrollmentId: activeEnrollment?.id },
        "Engagement event logged",
      );
      break;

    case "subscribe":
      // Subscription confirmation, no action needed
      break;

    default:
      log.warn({ type: event.type }, "Unhandled MailWizz webhook event type");
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle sent/delivery event: advance enrollment step.
 */
async function handleSent(
  enrollment: EnrollmentRecord | null,
): Promise<void> {
  if (!enrollment) return;

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      currentStep: { increment: 1 },
      lastSentAt: new Date(),
    },
  });

  log.info(
    { enrollmentId: enrollment.id, prospectId: enrollment.prospectId },
    "Enrollment step advanced (email sent)",
  );
}

/**
 * Handle bounce event: mark email invalid, add to suppression if hard bounce.
 */
async function handleBounce(
  enrollment: EnrollmentRecord | null,
  event: MailWizzEvent,
): Promise<void> {
  const isHardBounce = event.bounce_type === "hard";

  if (enrollment) {
    // Stop the enrollment
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "stopped",
        stoppedReason: `bounce_${event.bounce_type ?? "unknown"}`,
        completedAt: new Date(),
      },
    });

    // Mark contact email as invalid
    if (enrollment.contactId) {
      await prisma.contact.update({
        where: { id: enrollment.contactId },
        data: { emailStatus: "invalid" },
      });
    }

    // Update prospect status
    await prisma.prospect.update({
      where: { id: enrollment.prospectId },
      data: { status: "LOST" },
    });
  }

  // Add to suppression list for hard bounces
  if (isHardBounce && event.email) {
    await addToSuppressionList(
      event.email.toLowerCase(),
      "hard_bounce",
      "mailwizz_webhook",
    );
    log.info(
      { email: event.email, enrollmentId: enrollment?.id },
      "Hard bounce: email added to suppression list",
    );
  }

  log.info(
    { type: event.bounce_type, enrollmentId: enrollment?.id },
    "Bounce handled",
  );
}

/**
 * Handle unsubscribe: add to suppression, mark as DO_NOT_CONTACT.
 */
async function handleUnsubscribe(
  enrollment: EnrollmentRecord | null,
  event: MailWizzEvent,
): Promise<void> {
  if (enrollment) {
    // Stop enrollment
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "stopped",
        stoppedReason: "unsubscribed",
        completedAt: new Date(),
      },
    });

    // Mark contact as opted out
    if (enrollment.contactId) {
      await prisma.contact.update({
        where: { id: enrollment.contactId },
        data: {
          optedOut: true,
          optedOutAt: new Date(),
        },
      });
    }

    // Update prospect to DO_NOT_CONTACT
    await prisma.prospect.update({
      where: { id: enrollment.prospectId },
      data: { status: "DO_NOT_CONTACT" },
    });
  }

  // Add to suppression list
  if (event.email) {
    await addToSuppressionList(
      event.email.toLowerCase(),
      "unsubscribed",
      "mailwizz_webhook",
    );
  }

  log.info(
    { email: event.email, enrollmentId: enrollment?.id },
    "Unsubscribe handled: added to suppression, DO_NOT_CONTACT",
  );
}

/**
 * Handle complaint: same severity as unsubscribe.
 */
async function handleComplaint(
  enrollment: EnrollmentRecord | null,
  event: MailWizzEvent,
): Promise<void> {
  // Complaints are treated the same as unsubscribes
  await handleUnsubscribe(enrollment, event);

  log.warn(
    { email: event.email, enrollmentId: enrollment?.id },
    "Spam complaint received - treated as unsubscribe",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EnrollmentRecord {
  id: number;
  prospectId: number;
  contactId: number;
  campaignId: number;
  campaignRef: string | null;
}

async function findEnrollmentByCampaignRef(
  campaignRef: string,
): Promise<EnrollmentRecord | null> {
  return prisma.enrollment.findFirst({
    where: { campaignRef },
    select: {
      id: true,
      prospectId: true,
      contactId: true,
      campaignId: true,
      campaignRef: true,
    },
  });
}

async function findEnrollmentBySubscriberUid(
  subscriberUid: string,
): Promise<EnrollmentRecord | null> {
  return prisma.enrollment.findFirst({
    where: { mailwizzSubscriberUid: subscriberUid },
    select: {
      id: true,
      prospectId: true,
      contactId: true,
      campaignId: true,
      campaignRef: true,
    },
  });
}

async function logWebhookEvent(
  prospectId: number,
  enrollmentId: number,
  event: MailWizzEvent,
): Promise<void> {
  await prisma.event.create({
    data: {
      prospectId,
      enrollmentId,
      eventType: `MAILWIZZ_${event.type.toUpperCase()}`,
      eventSource: "mailwizz_webhook",
      data: {
        type: event.type,
        email: event.email ?? null,
        subscriberUid: event.subscriber_uid ?? null,
        bounceType: event.bounce_type ?? null,
        campaignRef: event.custom_fields?.["CAMPAIGN_REF"] ?? null,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}
