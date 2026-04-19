// ---------------------------------------------------------------------------
// Crawl Sources API routes
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";
import { crawlingQueue } from "../../jobs/queue.js";

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface ListQuery {
  page?: string;
  limit?: string;
  type?: string;
  isActive?: string;
}

interface CreateBody {
  name: string;
  type: "blog_directory" | "search_engine" | "competitor_backlinks" | "write_for_us";
  baseUrl?: string;
  config?: Record<string, unknown>;
}

interface UpdateBody {
  name?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

interface ListResultsQuery {
  page?: string;
  limit?: string;
  status?: string;
  sourceId?: string;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default async function crawlingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // GET /api/crawl-sources
  app.get<{ Querystring: ListQuery }>("/", async (request, reply) => {
    const { page, limit, type, isActive } = request.query;
    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (type) where["type"] = type;
    if (isActive !== undefined) where["isActive"] = isActive === "true";

    const [items, total] = await Promise.all([
      prisma.crawlSource.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { results: true } } },
      }),
      prisma.crawlSource.count({ where }),
    ]);

    return reply.send({
      data: items,
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  });

  // POST /api/crawl-sources
  app.post<{ Body: CreateBody }>("/", async (request, reply) => {
    const { name, type, baseUrl, config } = request.body;

    if (type === "search_engine" && process.env["CRAWLING_SEARCH_ENGINE_ENABLED"] !== "true") {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "search_engine sources are disabled (risk of IP ban). Use blog_directory, competitor_backlinks, or write_for_us instead. Set CRAWLING_SEARCH_ENGINE_ENABLED=true to override.",
      });
    }

    const source = await prisma.crawlSource.create({
      data: { name, type, baseUrl, config: (config ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue },
    });

    return reply.status(201).send({ data: source });
  });

  // PUT /api/crawl-sources/:id
  app.put<{ Params: { id: string }; Body: UpdateBody }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    const { name, baseUrl, config, isActive } = request.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData["name"] = name;
    if (baseUrl !== undefined) updateData["baseUrl"] = baseUrl;
    if (config !== undefined) updateData["config"] = config;
    if (isActive !== undefined) updateData["isActive"] = isActive;

    const source = await prisma.crawlSource.update({
      where: { id },
      data: updateData,
    });

    return reply.send({ data: source });
  });

  // DELETE /api/crawl-sources/:id
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    await prisma.crawlSource.delete({ where: { id } });
    return reply.status(204).send();
  });

  // POST /api/crawl-sources/:id/trigger - Manually trigger crawl
  app.post<{ Params: { id: string } }>("/:id/trigger", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    // Verify source exists
    await prisma.crawlSource.findUniqueOrThrow({ where: { id } });

    await crawlingQueue.add("manual-crawl", {
      type: "crawl-source",
      sourceId: id,
    });

    return reply.status(202).send({ message: "Crawl job enqueued", sourceId: id });
  });

  // GET /api/crawl-sources/results - List crawl results
  app.get<{ Querystring: ListResultsQuery }>("/results", async (request, reply) => {
    const { page, limit, status, sourceId } = request.query;
    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (status) where["status"] = status;
    if (sourceId) where["crawlSourceId"] = parseInt(sourceId, 10);

    const [items, total] = await Promise.all([
      prisma.crawlResult.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { crawlSource: { select: { name: true, type: true } } },
      }),
      prisma.crawlResult.count({ where }),
    ]);

    return reply.send({
      data: items,
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  });
}
