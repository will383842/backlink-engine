import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { authenticateWebhook } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// MailWizz webhook event types
// ─────────────────────────────────────────────────────────────

interface MailWizzWebhookBody {
  event: string;
  subscriber_uid?: string;
  list_uid?: string;
  campaign_uid?: string;
  email?: string;
  reason?: string;
  timestamp?: string;
  // MailWizz can send additional fields depending on event type
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function webhooksRoutes(app: FastifyInstance): Promise<void> {

  // ───── POST /mailwizz ─── MailWizz webhook receiver ──────
  // Authenticated via shared secret (x-webhook-secret header).
  app.post<{ Body: MailWizzWebhookBody }>(
    "/mailwizz",
    {
      preHandler: [authenticateWebhook],
      config: {
        rateLimit: { max: 200, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["event"],
          properties: {
            event: { type: "string" },
            subscriber_uid: { type: "string" },
            list_uid: { type: "string" },
            campaign_uid: { type: "string" },
            email: { type: "string" },
            reason: { type: "string" },
            timestamp: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    async (request: FastifyRequest<{ Body: MailWizzWebhookBody }>, reply: FastifyReply) => {
      const body = request.body;
      const { event, subscriber_uid, list_uid, campaign_uid, email } = body;

      request.log.info(
        { event, subscriber_uid, list_uid, campaign_uid },
        "MailWizz webhook received",
      );

      // TODO: call webhookHandler service which handles full logic
      // For now, inline the basic event processing:

      try {
        switch (event) {
          // ─── Email opened ─────────────────────────────
          case "open": {
            const enrollment = await findEnrollmentByMailwizz(subscriber_uid, list_uid);
            if (enrollment) {
              await prisma.event.create({
                data: {
                  prospectId: enrollment.prospectId,
                  contactId: enrollment.contactId,
                  enrollmentId: enrollment.id,
                  eventType: "email_opened",
                  eventSource: "mailwizz_webhook",
                  data: body as unknown as Prisma.InputJsonValue,
                },
              });
            }
            break;
          }

          // ─── Link clicked ─────────────────────────────
          case "click": {
            const enrollment = await findEnrollmentByMailwizz(subscriber_uid, list_uid);
            if (enrollment) {
              await prisma.event.create({
                data: {
                  prospectId: enrollment.prospectId,
                  contactId: enrollment.contactId,
                  enrollmentId: enrollment.id,
                  eventType: "link_clicked",
                  eventSource: "mailwizz_webhook",
                  data: body as unknown as Prisma.InputJsonValue,
                },
              });
            }
            break;
          }

          // ─── Email bounced ────────────────────────────
          case "bounce": {
            const enrollment = await findEnrollmentByMailwizz(subscriber_uid, list_uid);
            if (enrollment) {
              await prisma.event.create({
                data: {
                  prospectId: enrollment.prospectId,
                  contactId: enrollment.contactId,
                  enrollmentId: enrollment.id,
                  eventType: "email_bounced",
                  eventSource: "mailwizz_webhook",
                  data: body as unknown as Prisma.InputJsonValue,
                },
              });

              // Stop enrollment if campaign has stopOnBounce
              const campaign = await prisma.campaign.findUnique({
                where: { id: enrollment.campaignId },
              });
              if (campaign?.stopOnBounce) {
                await prisma.enrollment.update({
                  where: { id: enrollment.id },
                  data: { status: "stopped", stoppedReason: "bounce" },
                });
              }

              // Update contact email status
              await prisma.contact.update({
                where: { id: enrollment.contactId },
                data: { emailStatus: "bounced" },
              });
            }
            break;
          }

          // ─── Unsubscribe ──────────────────────────────
          case "unsubscribe": {
            const enrollment = await findEnrollmentByMailwizz(subscriber_uid, list_uid);
            if (enrollment) {
              await prisma.event.create({
                data: {
                  prospectId: enrollment.prospectId,
                  contactId: enrollment.contactId,
                  enrollmentId: enrollment.id,
                  eventType: "unsubscribed",
                  eventSource: "mailwizz_webhook",
                  data: body as unknown as Prisma.InputJsonValue,
                },
              });

              // Stop enrollment
              const campaign = await prisma.campaign.findUnique({
                where: { id: enrollment.campaignId },
              });
              if (campaign?.stopOnUnsub) {
                await prisma.enrollment.update({
                  where: { id: enrollment.id },
                  data: { status: "stopped", stoppedReason: "unsubscribe" },
                });
              }

              // Opt out contact
              await prisma.contact.update({
                where: { id: enrollment.contactId },
                data: { optedOut: true, optedOutAt: new Date() },
              });

              // Add to suppression list
              const contact = await prisma.contact.findUnique({
                where: { id: enrollment.contactId },
              });
              if (contact) {
                await prisma.suppressionEntry.upsert({
                  where: { emailNormalized: contact.emailNormalized },
                  create: {
                    emailNormalized: contact.emailNormalized,
                    reason: "unsubscribe",
                    source: "mailwizz_webhook",
                  },
                  update: {},
                });
              }
            }
            break;
          }

          // ─── Complaint / spam report ──────────────────
          case "complaint": {
            if (email) {
              const emailNormalized = email.toLowerCase().trim();

              // Add to suppression list immediately
              await prisma.suppressionEntry.upsert({
                where: { emailNormalized },
                create: {
                  emailNormalized,
                  reason: "complaint",
                  source: "mailwizz_webhook",
                },
                update: {},
              });

              // Stop all active enrollments for this contact
              const contact = await prisma.contact.findUnique({
                where: { emailNormalized },
              });
              if (contact) {
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: { optedOut: true, optedOutAt: new Date() },
                });
                await prisma.enrollment.updateMany({
                  where: { contactId: contact.id, status: "active" },
                  data: { status: "stopped", stoppedReason: "complaint" },
                });

                await prisma.event.create({
                  data: {
                    prospectId: contact.prospectId,
                    contactId: contact.id,
                    eventType: "spam_complaint",
                    eventSource: "mailwizz_webhook",
                    data: body as unknown as Prisma.InputJsonValue,
                  },
                });
              }
            }
            break;
          }

          // ─── Delivery confirmation ────────────────────
          case "delivery":
          case "sent": {
            const enrollment = await findEnrollmentByMailwizz(subscriber_uid, list_uid);
            if (enrollment) {
              await prisma.event.create({
                data: {
                  prospectId: enrollment.prospectId,
                  contactId: enrollment.contactId,
                  enrollmentId: enrollment.id,
                  eventType: "email_sent",
                  eventSource: "mailwizz_webhook",
                  data: body as unknown as Prisma.InputJsonValue,
                },
              });

              // Update enrollment last sent timestamp
              await prisma.enrollment.update({
                where: { id: enrollment.id },
                data: { lastSentAt: new Date() },
              });

              // Update prospect last contacted
              await prisma.prospect.update({
                where: { id: enrollment.prospectId },
                data: { lastContactedAt: new Date() },
              });
            }
            break;
          }

          default:
            request.log.warn({ event }, "Unknown MailWizz webhook event type");
        }

        return reply.status(200).send({ status: "ok", event });
      } catch (err) {
        request.log.error({ err, event, subscriber_uid }, "Error processing MailWizz webhook");
        // Return 200 to prevent MailWizz from retrying (we log the error)
        return reply.status(200).send({ status: "error", event });
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Find an enrollment by MailWizz subscriber_uid and list_uid.
 * Returns null if not found.
 */
async function findEnrollmentByMailwizz(
  subscriberUid: string | undefined,
  listUid: string | undefined,
) {
  if (!subscriberUid) return null;

  const where: Record<string, unknown> = {
    mailwizzSubscriberUid: subscriberUid,
  };
  if (listUid) {
    where["mailwizzListUid"] = listUid;
  }

  return prisma.enrollment.findFirst({
    where,
    include: {
      contact: { select: { id: true, email: true, emailNormalized: true } },
    },
  });
}
