import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface ContactParams {
  id: string;
}

interface ListContactsQuery {
  prospectId?: string;
  emailStatus?: string;
  optedOut?: string;
  page?: string;
  limit?: string;
}

interface CreateContactBody {
  prospectId: number;
  email: string;
  name?: string;
  role?: string;
  discoveredVia?: string;
}

interface UpdateContactBody {
  name?: string;
  role?: string;
  emailStatus?: string;
  optedOut?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List contacts with filters ──────────────
  app.get<{ Querystring: ListContactsQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            prospectId: { type: "string" },
            emailStatus: { type: "string" },
            optedOut: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { prospectId, emailStatus, optedOut, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (prospectId) where["prospectId"] = parseInt(prospectId, 10);
      if (emailStatus) where["emailStatus"] = emailStatus;
      if (optedOut !== undefined) where["optedOut"] = optedOut === "true";

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            prospect: { select: { id: true, domain: true, status: true } },
          },
        }),
        prisma.contact.count({ where }),
      ]);

      return reply.send({
        data: contacts,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST / ─── Create a contact ───────────────────────
  app.post<{ Body: CreateContactBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["prospectId", "email"],
          properties: {
            prospectId: { type: "integer" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            role: { type: "string" },
            discoveredVia: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { prospectId, email, name, role, discoveredVia } = request.body;

      // Verify prospect exists
      const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
      if (!prospect) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${prospectId} not found`,
        });
      }

      // Check suppression list
      const emailNormalized = email.toLowerCase().trim();
      const suppressed = await prisma.suppressionEntry.findUnique({
        where: { emailNormalized },
      });
      if (suppressed) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Email is on the suppression list",
          data: { reason: suppressed.reason },
        });
      }

      // Check for duplicate email
      const existing = await prisma.contact.findUnique({ where: { emailNormalized } });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Contact already exists with email: ${email}`,
          data: { id: existing.id, prospectId: existing.prospectId },
        });
      }

      const contact = await prisma.contact.create({
        data: {
          prospectId,
          email,
          emailNormalized,
          name: name ?? null,
          role: role ?? "unknown",
          discoveredVia: discoveredVia ?? "manual",
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          prospectId,
          contactId: contact.id,
          eventType: "contact_added",
          eventSource: "api",
          userId: request.user.id,
          data: { email, role },
        },
      });

      return reply.status(201).send({ data: contact });
    },
  );

  // ───── PUT /:id ─── Update a contact ─────────────────────
  app.put<{ Params: ContactParams; Body: UpdateContactBody }>(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            emailStatus: { type: "string" },
            optedOut: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.contact.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Contact ${id} not found`,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData["name"] = body.name;
      if (body.role !== undefined) updateData["role"] = body.role;
      if (body.emailStatus !== undefined) updateData["emailStatus"] = body.emailStatus;
      if (body.optedOut !== undefined) {
        updateData["optedOut"] = body.optedOut;
        if (body.optedOut && !existing.optedOut) {
          updateData["optedOutAt"] = new Date();
        }
      }

      const contact = await prisma.contact.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: contact });
    },
  );

  // ───── DELETE /:id ─── Delete a contact ──────────────────
  app.delete<{ Params: ContactParams }>(
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

      const existing = await prisma.contact.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Contact ${id} not found`,
        });
      }

      // Check for active enrollments before deleting
      const activeEnrollments = await prisma.enrollment.count({
        where: { contactId: id, status: "active" },
      });
      if (activeEnrollments > 0) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Contact ${id} has ${activeEnrollments} active enrollment(s). Stop them first.`,
        });
      }

      await prisma.contact.delete({ where: { id } });

      return reply.status(204).send();
    },
  );
}
