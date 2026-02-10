import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface SuppressionParams {
  id: string;
}

interface ListSuppressionQuery {
  reason?: string;
  source?: string;
  search?: string;
  page?: string;
  limit?: string;
}

interface CreateSuppressionBody {
  email: string;
  reason: string;
  source?: string;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function suppressionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List suppression entries ────────────────
  app.get<{ Querystring: ListSuppressionQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            reason: { type: "string" },
            source: { type: "string" },
            search: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { reason, source, search, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (reason) where["reason"] = reason;
      if (source) where["source"] = source;
      if (search) {
        where["emailNormalized"] = { contains: search.toLowerCase(), mode: "insensitive" };
      }

      const [entries, total] = await Promise.all([
        prisma.suppressionEntry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.suppressionEntry.count({ where }),
      ]);

      return reply.send({
        data: entries,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST / ─── Add to suppression list ────────────────
  app.post<{ Body: CreateSuppressionBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "reason"],
          properties: {
            email: { type: "string", format: "email" },
            reason: {
              type: "string",
              enum: ["bounce", "unsubscribe", "complaint", "manual", "invalid"],
            },
            source: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, reason, source } = request.body;
      const emailNormalized = email.toLowerCase().trim();

      // Check for duplicate
      const existing = await prisma.suppressionEntry.findUnique({
        where: { emailNormalized },
      });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Email ${email} is already on the suppression list`,
          data: existing,
        });
      }

      const entry = await prisma.suppressionEntry.create({
        data: {
          emailNormalized,
          reason,
          source: source ?? "manual",
        },
      });

      // Also opt-out any existing contacts with this email
      const contact = await prisma.contact.findUnique({
        where: { emailNormalized },
      });
      if (contact && !contact.optedOut) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { optedOut: true, optedOutAt: new Date() },
        });

        // Stop active enrollments for this contact
        await prisma.enrollment.updateMany({
          where: { contactId: contact.id, status: "active" },
          data: { status: "stopped", stoppedReason: `suppressed:${reason}` },
        });

        // Log event
        await prisma.event.create({
          data: {
            prospectId: contact.prospectId,
            contactId: contact.id,
            eventType: "contact_suppressed",
            eventSource: "suppression_api",
            userId: request.user.id,
            data: { reason, email },
          },
        });
      }

      return reply.status(201).send({ data: entry });
    },
  );

  // ───── DELETE /:id ─── Remove from suppression list ──────
  app.delete<{ Params: SuppressionParams }>(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);

      const existing = await prisma.suppressionEntry.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Suppression entry ${id} not found`,
        });
      }

      await prisma.suppressionEntry.delete({ where: { id } });

      return reply.status(204).send();
    },
  );
}
