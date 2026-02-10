import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface AssetParams {
  id: string;
}

interface ListAssetsQuery {
  assetType?: string;
  isPublished?: string;
  page?: string;
  limit?: string;
}

interface CreateAssetBody {
  title: string;
  slug: string;
  assetType: string;
  url: string;
  description?: string;
  availableLanguages?: string[];
  isPublished?: boolean;
}

interface UpdateAssetBody {
  title?: string;
  slug?: string;
  assetType?: string;
  url?: string;
  description?: string;
  availableLanguages?: string[];
  isPublished?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function assetsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List linkable assets ────────────────────
  app.get<{ Querystring: ListAssetsQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            assetType: { type: "string" },
            isPublished: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { assetType, isPublished, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (assetType) where["assetType"] = assetType;
      if (isPublished !== undefined) where["isPublished"] = isPublished === "true";

      const [assets, total] = await Promise.all([
        prisma.linkableAsset.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.linkableAsset.count({ where }),
      ]);

      return reply.send({
        data: assets,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST / ─── Create a linkable asset ────────────────
  app.post<{ Body: CreateAssetBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["title", "slug", "assetType", "url"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 300 },
            slug: { type: "string", minLength: 1, maxLength: 200 },
            assetType: {
              type: "string",
              enum: ["guide", "tool", "infographic", "study", "directory", "widget", "badge", "other"],
            },
            url: { type: "string", format: "uri" },
            description: { type: "string" },
            availableLanguages: { type: "array", items: { type: "string" } },
            isPublished: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      // Check for duplicate slug
      const existingSlug = await prisma.linkableAsset.findUnique({
        where: { slug: body.slug },
      });
      if (existingSlug) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Asset with slug "${body.slug}" already exists`,
        });
      }

      const asset = await prisma.linkableAsset.create({
        data: {
          title: body.title,
          slug: body.slug,
          assetType: body.assetType,
          url: body.url,
          description: body.description ?? null,
          availableLanguages: body.availableLanguages ?? ["fr", "en"],
          isPublished: body.isPublished ?? false,
          publishedAt: body.isPublished ? new Date() : null,
        },
      });

      return reply.status(201).send({ data: asset });
    },
  );

  // ───── PUT /:id ─── Update an asset ──────────────────────
  app.put<{ Params: AssetParams; Body: UpdateAssetBody }>(
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
            title: { type: "string" },
            slug: { type: "string" },
            assetType: { type: "string" },
            url: { type: "string" },
            description: { type: "string" },
            availableLanguages: { type: "array", items: { type: "string" } },
            isPublished: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.linkableAsset.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Asset ${id} not found`,
        });
      }

      // Check slug uniqueness if being changed
      if (body.slug && body.slug !== existing.slug) {
        const slugTaken = await prisma.linkableAsset.findUnique({
          where: { slug: body.slug },
        });
        if (slugTaken) {
          return reply.status(409).send({
            statusCode: 409,
            error: "Conflict",
            message: `Asset with slug "${body.slug}" already exists`,
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData["title"] = body.title;
      if (body.slug !== undefined) updateData["slug"] = body.slug;
      if (body.assetType !== undefined) updateData["assetType"] = body.assetType;
      if (body.url !== undefined) updateData["url"] = body.url;
      if (body.description !== undefined) updateData["description"] = body.description;
      if (body.availableLanguages !== undefined)
        updateData["availableLanguages"] = body.availableLanguages;
      if (body.isPublished !== undefined) {
        updateData["isPublished"] = body.isPublished;
        if (body.isPublished && !existing.isPublished) {
          updateData["publishedAt"] = new Date();
        }
      }

      const asset = await prisma.linkableAsset.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: asset });
    },
  );

  // ───── GET /:id/backlinks ─── Backlinks pointing to this asset
  app.get<{ Params: AssetParams; Querystring: { page?: string; limit?: string } }>(
    "/:id/backlinks",
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

      const asset = await prisma.linkableAsset.findUnique({ where: { id } });
      if (!asset) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Asset ${id} not found`,
        });
      }

      const take = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(request.query.page ?? "1", 10) || 1) - 1) * take;

      // Find backlinks whose targetUrl matches the asset URL
      const [backlinks, total] = await Promise.all([
        prisma.backlink.findMany({
          where: { targetUrl: asset.url },
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            prospect: { select: { id: true, domain: true, tier: true, status: true } },
          },
        }),
        prisma.backlink.count({ where: { targetUrl: asset.url } }),
      ]);

      return reply.send({
        data: backlinks,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── DELETE /:id ─── Delete a linkable asset ─────────
  app.delete<{ Params: AssetParams }>(
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

      const existing = await prisma.linkableAsset.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Asset ${id} not found`,
        });
      }

      await prisma.linkableAsset.delete({ where: { id } });

      return reply.status(204).send();
    },
  );
}
