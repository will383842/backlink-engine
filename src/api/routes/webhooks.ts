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
// SOS Expat webhook event types
// ─────────────────────────────────────────────────────────────

interface SosExpatUserRegisteredBody {
  email: string;
  userId?: string;
  userType?: string; // "client" | "blogger" | "provider" | "influencer" | "chatter" | etc.
  firstName?: string;
  lastName?: string;
  phone?: string;
  registeredAt?: string;
  metadata?: Record<string, unknown>;
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
                data: { emailStatus: "invalid" as any },
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

  // ───── POST /sos-expat/user-registered ─── SOS Expat user registration webhook ──────
  // Called when ANYONE registers on SOS Expat (client, blogger, provider, influencer, chatter, etc.).
  // Stops all active prospecting campaigns for this email - we don't prospect our own ecosystem!
  app.post<{ Body: SosExpatUserRegisteredBody }>(
    "/sos-expat/user-registered",
    {
      preHandler: [authenticateWebhook],
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
            userId: { type: "string" },
            userType: { type: "string", enum: ["client", "blogger", "provider", "influencer", "chatter", "group_admin", "other"] },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
            registeredAt: { type: "string" },
            metadata: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SosExpatUserRegisteredBody }>, reply: FastifyReply) => {
      const { email, userId, userType, firstName, lastName, phone, registeredAt, metadata } = request.body;
      const emailNormalized = email.toLowerCase().trim();

      request.log.info(
        { email: emailNormalized, userId, userType },
        "SOS Expat user registration webhook received",
      );

      try {
        // Find contact by email
        const contact = await prisma.contact.findUnique({
          where: { emailNormalized },
          include: {
            prospect: { select: { id: true, domain: true, status: true } },
          },
        });

        if (!contact) {
          request.log.info(
            { email: emailNormalized, userType },
            "No contact found for registered SOS Expat user (prospect never contacted)",
          );

          // Still add to suppression list to prevent future prospecting
          await prisma.suppressionEntry.upsert({
            where: { emailNormalized },
            create: {
              emailNormalized,
              reason: "sos_expat_user",
              source: "sos_expat_webhook",
            },
            update: {
              reason: "sos_expat_user",
              source: "sos_expat_webhook",
            },
          });

          return reply.status(200).send({
            status: "ok",
            message: "Email added to suppression list",
            actionsPerformed: {
              suppressionAdded: true,
              enrollmentsStopped: 0,
              prospectUpdated: false,
            },
          });
        }

        // Stop all active enrollments for this contact
        const activeEnrollments = await prisma.enrollment.findMany({
          where: {
            contactId: contact.id,
            status: "active",
          },
        });

        if (activeEnrollments.length > 0) {
          await prisma.enrollment.updateMany({
            where: {
              contactId: contact.id,
              status: "active",
            },
            data: {
              status: "stopped",
              stoppedReason: "sos_expat_user_registered",
              completedAt: new Date(),
            },
          });

          request.log.info(
            { contactId: contact.id, count: activeEnrollments.length, userType },
            "Stopped active enrollments for SOS Expat user",
          );
        }

        // Update contact - mark as opted out and store client info
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            optedOut: true,
            optedOutAt: new Date(),
            firstName: firstName || contact.firstName,
            lastName: lastName || contact.lastName,
          },
        });

        // Update prospect status to DO_NOT_CONTACT (part of SOS Expat ecosystem)
        await prisma.prospect.update({
          where: { id: contact.prospectId },
          data: {
            status: "DO_NOT_CONTACT",
          },
        });

        // Add to suppression list
        await prisma.suppressionEntry.upsert({
          where: { emailNormalized },
          create: {
            emailNormalized,
            reason: "sos_expat_user",
            source: "sos_expat_webhook",
          },
          update: {
            reason: "sos_expat_user",
            source: "sos_expat_webhook",
          },
        });

        // Create event log
        await prisma.event.create({
          data: {
            prospectId: contact.prospectId,
            contactId: contact.id,
            eventType: "sos_expat_user_registered",
            eventSource: "sos_expat_webhook",
            data: {
              userId,
              userType,
              email: emailNormalized,
              firstName,
              lastName,
              phone,
              registeredAt,
              enrollmentsStopped: activeEnrollments.length,
              ...metadata,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        request.log.info(
          {
            prospectId: contact.prospectId,
            contactId: contact.id,
            userType,
            enrollmentsStopped: activeEnrollments.length,
          },
          "SOS Expat user registration processed successfully",
        );

        return reply.status(200).send({
          status: "ok",
          message: `SOS Expat user registration processed successfully (${userType || 'unknown type'})`,
          actionsPerformed: {
            suppressionAdded: true,
            enrollmentsStopped: activeEnrollments.length,
            prospectUpdated: true,
            prospectStatus: "DO_NOT_CONTACT",
            userType,
          },
        });
      } catch (err) {
        request.log.error(
          { err, email: emailNormalized },
          "Error processing SOS Expat client registration webhook",
        );

        // Return 500 so SOS Expat can retry
        return reply.status(500).send({
          status: "error",
          message: "Failed to process client registration",
          error: err instanceof Error ? err.message : "Unknown error",
        });
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
