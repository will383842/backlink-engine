import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface TemplateParams {
  id: string;
}

interface ListTemplatesQuery {
  language?: string;
  purpose?: string;
  isActive?: string;
  page?: string;
  limit?: string;
}

interface CreateTemplateBody {
  name: string;
  language: string;
  purpose: string;
  subject: string;
  body: string;
  formalityLevel?: string;
  culturalNotes?: string;
}

interface UpdateTemplateBody {
  name?: string;
  language?: string;
  purpose?: string;
  subject?: string;
  body?: string;
  formalityLevel?: string;
  culturalNotes?: string;
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function templatesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List templates with filters ─────────────
  app.get<{ Querystring: ListTemplatesQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            language: { type: "string" },
            purpose: { type: "string" },
            isActive: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { language, purpose, isActive, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (language) where["language"] = language;
      if (purpose) where["purpose"] = purpose;
      if (isActive !== undefined) where["isActive"] = isActive === "true";

      const [templates, total] = await Promise.all([
        prisma.outreachTemplate.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.outreachTemplate.count({ where }),
      ]);

      return reply.send({
        data: templates,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST / ─── Create a template ──────────────────────
  app.post<{ Body: CreateTemplateBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "language", "purpose", "subject", "body"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            language: { type: "string", minLength: 2, maxLength: 5 },
            purpose: {
              type: "string",
              enum: ["initial_outreach", "follow_up_1", "follow_up_2", "follow_up_3", "breakup", "thank_you", "negotiation"],
            },
            subject: { type: "string", minLength: 1, maxLength: 500 },
            body: { type: "string", minLength: 1 },
            formalityLevel: {
              type: "string",
              enum: ["informal", "neutral", "formal", "very_formal"],
            },
            culturalNotes: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const template = await prisma.outreachTemplate.create({
        data: {
          name: body.name,
          language: body.language,
          purpose: body.purpose,
          subject: body.subject,
          body: body.body,
          formalityLevel: body.formalityLevel ?? "formal",
          culturalNotes: body.culturalNotes ?? null,
        },
      });

      return reply.status(201).send({ data: template });
    },
  );

  // ───── PUT /:id ─── Update a template ────────────────────
  app.put<{ Params: TemplateParams; Body: UpdateTemplateBody }>(
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
            language: { type: "string" },
            purpose: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            formalityLevel: { type: "string" },
            culturalNotes: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.outreachTemplate.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Template ${id} not found`,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData["name"] = body.name;
      if (body.language !== undefined) updateData["language"] = body.language;
      if (body.purpose !== undefined) updateData["purpose"] = body.purpose;
      if (body.subject !== undefined) updateData["subject"] = body.subject;
      if (body.body !== undefined) updateData["body"] = body.body;
      if (body.formalityLevel !== undefined) updateData["formalityLevel"] = body.formalityLevel;
      if (body.culturalNotes !== undefined) updateData["culturalNotes"] = body.culturalNotes;
      if (body.isActive !== undefined) updateData["isActive"] = body.isActive;

      const template = await prisma.outreachTemplate.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: template });
    },
  );

  // ───── DELETE /:id ─── Delete a template ───────────────
  app.delete<{ Params: TemplateParams }>(
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

      const existing = await prisma.outreachTemplate.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Template ${id} not found`,
        });
      }

      await prisma.outreachTemplate.delete({ where: { id } });

      return reply.status(204).send();
    },
  );
}
