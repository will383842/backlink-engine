// ---------------------------------------------------------------------------
// Contact Type Mappings API — CRUD for the sourceContactType → category table
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import type { ProspectCategory } from "@prisma/client";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";
import {
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
} from "../../services/prospects/contactTypeMapper.js";

const PROSPECT_CATEGORIES: ProspectCategory[] = [
  "blogger",
  "association",
  "partner",
  "influencer",
  "media",
  "agency",
  "corporate",
  "ecommerce",
  "podcast",
  "forum",
  "directory",
  "education",
  "other",
];

interface CreateBody {
  typeKey: string;
  category: ProspectCategory;
  label?: string | null;
}

interface UpdateBody {
  typeKey?: string;
  category?: ProspectCategory;
  label?: string | null;
}

export default async function contactTypeMappingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  app.get("/", async (_request, reply) => {
    const items = await listMappings();
    return reply.send({ data: items, categories: PROSPECT_CATEGORIES });
  });

  app.post<{ Body: CreateBody }>("/", async (request, reply) => {
    const { typeKey, category, label } = request.body;

    if (!typeKey || !category) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "typeKey and category are required",
      });
    }
    if (!PROSPECT_CATEGORIES.includes(category)) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: `Invalid category. Valid: ${PROSPECT_CATEGORIES.join(", ")}`,
      });
    }

    try {
      const row = await createMapping({ typeKey, category, label: label ?? null });
      return reply.status(201).send({ data: row });
    } catch (err) {
      const e = err as { code?: string; message?: string; statusCode?: number };
      if (e.code === "P2002") {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "A mapping with that typeKey already exists",
        });
      }
      if (e.statusCode === 400) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: e.message ?? "Invalid input",
        });
      }
      throw err;
    }
  });

  app.put<{ Params: { id: string }; Body: UpdateBody }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    const { typeKey, category, label } = request.body;

    if (category !== undefined && !PROSPECT_CATEGORIES.includes(category)) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: `Invalid category. Valid: ${PROSPECT_CATEGORIES.join(", ")}`,
      });
    }

    try {
      const row = await updateMapping(id, { typeKey, category, label });
      return reply.send({ data: row });
    } catch (err) {
      const e = err as { code?: string; message?: string; statusCode?: number };
      if (e.code === "P2002") {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Another mapping already uses that typeKey",
        });
      }
      if (e.statusCode === 400) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: e.message ?? "Invalid input",
        });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    try {
      await deleteMapping(id);
      return reply.status(204).send();
    } catch (err) {
      const e = err as { message?: string; statusCode?: number };
      if (e.statusCode === 400) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: e.message ?? "Cannot delete",
        });
      }
      throw err;
    }
  });
}
