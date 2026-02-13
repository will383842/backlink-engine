import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface ListRepliesQuery {
  category?: string;
  campaignId?: string;
  page?: string;
  limit?: string;
}

export default async function repliesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List reply events ────────────────────────
  app.get<{ Querystring: ListRepliesQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            category: { type: "string" },
            campaignId: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { category, campaignId, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {
        eventType: { in: ["reply_received", "REPLY_CLASSIFIED"] },
      };

      if (category) {
        where["data"] = { path: ["category"], equals: category };
      }

      if (campaignId) {
        where["enrollment"] = { campaignId: parseInt(campaignId, 10) };
      }

      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            prospect: { select: { id: true, domain: true, status: true } },
            contact: { select: { id: true, email: true, name: true } },
            enrollment: { select: { id: true, campaignId: true, status: true } },
          },
        }),
        prisma.event.count({ where }),
      ]);

      // Map events to Reply-like objects for the frontend
      const data = events.map((ev) => ({
        id: ev.id,
        prospectId: ev.prospectId,
        prospectDomain: ev.prospect?.domain ?? "unknown",
        category: (ev.data as Record<string, unknown>)?.category ?? "OTHER",
        confidence: (ev.data as Record<string, unknown>)?.confidence ?? 0,
        summary: (ev.data as Record<string, unknown>)?.summary ?? "",
        fullText: (ev.data as Record<string, unknown>)?.replyPreview ?? "",
        suggestedAction: (ev.data as Record<string, unknown>)?.suggestedAction ?? null,
        isHandled: (ev.data as Record<string, unknown>)?.isHandled === true,
        receivedAt: ev.createdAt.toISOString(),
        contact: ev.contact,
        enrollment: ev.enrollment,
      }));

      return reply.send({
        data,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST /:id/handle ─── Manually handle a reply ───────
  app.post<{
    Params: { id: string };
    Body: {
      action: "mark_interested" | "mark_not_interested" | "mark_spam" | "recategorize";
      newCategory?: string;
      notes?: string;
    };
  }>(
    "/:id/handle",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["mark_interested", "mark_not_interested", "mark_spam", "recategorize"],
            },
            newCategory: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const eventId = parseInt(request.params.id, 10);
      if (Number.isNaN(eventId)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid event ID",
        });
      }

      const { action, newCategory, notes } = request.body;

      // Find the reply event
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          prospect: true,
          contact: true,
          enrollment: true,
        },
      });

      if (!event) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Reply event ${eventId} not found`,
        });
      }

      // Update the event data with manual action
      const updatedData = {
        ...(event.data as Record<string, unknown>),
        isHandled: true,
        manualAction: action,
        manualNotes: notes ?? null,
        handledAt: new Date().toISOString(),
        handledBy: request.user.id,
      };

      // Apply action-specific updates
      if (action === "mark_interested" && event.prospectId) {
        await prisma.prospect.update({
          where: { id: event.prospectId },
          data: { status: "NEGOTIATING" },
        });

        // Increment campaign totalWon if enrollment exists
        if (event.enrollmentId) {
          const enrollment = await prisma.enrollment.findUnique({
            where: { id: event.enrollmentId },
          });
          if (enrollment) {
            await prisma.campaign.update({
              where: { id: enrollment.campaignId },
              data: { totalWon: { increment: 1 } },
            });
          }
        }
      } else if (action === "mark_not_interested" && event.prospectId) {
        await prisma.prospect.update({
          where: { id: event.prospectId },
          data: { status: "LOST" },
        });
      } else if (action === "mark_spam" && event.contactId) {
        // Add to suppression list
        const contact = await prisma.contact.findUnique({
          where: { id: event.contactId },
        });
        if (contact) {
          await prisma.suppressionEntry.upsert({
            where: { emailNormalized: contact.emailNormalized },
            create: {
              emailNormalized: contact.emailNormalized,
              reason: "spam",
              source: "manual",
            },
            update: {},
          });

          // Mark contact as opted out
          await prisma.contact.update({
            where: { id: event.contactId },
            data: { optedOut: true, optedOutAt: new Date() },
          });
        }
      } else if (action === "recategorize" && newCategory) {
        updatedData["category"] = newCategory;
      }

      // Update the event with manual handling data
      await prisma.event.update({
        where: { id: eventId },
        data: { data: updatedData },
      });

      // Log a new event for the manual action
      if (event.prospectId) {
        await prisma.event.create({
          data: {
            prospectId: event.prospectId,
            contactId: event.contactId ?? undefined,
            enrollmentId: event.enrollmentId ?? undefined,
            eventType: "reply_manually_handled",
            eventSource: "api",
            userId: request.user.id,
            data: { originalEventId: eventId, action, notes, newCategory },
          },
        });
      }

      return reply.send({
        message: "Reply handled successfully",
        eventId,
        action,
        updatedData,
      });
    },
  );
}
