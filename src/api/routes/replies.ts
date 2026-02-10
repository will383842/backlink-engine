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
}
