// ---------------------------------------------------------------------------
// Target Pages API routes
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

const DEFAULT_ANCHOR_DISTRIBUTION = [
  { anchorType: "brand", targetPercentage: 40 },
  { anchorType: "url", targetPercentage: 20 },
  { anchorType: "generic", targetPercentage: 20 },
  { anchorType: "keyword", targetPercentage: 10 },
  { anchorType: "long_tail", targetPercentage: 10 },
  { anchorType: "lsi", targetPercentage: 0 },
];

interface ListQuery {
  page?: string;
  limit?: string;
  pageType?: string;
  country?: string;
  isActive?: string;
}

interface CreateBody {
  url: string;
  slug: string;
  title: string;
  description?: string;
  pageType: string;
  country?: string;
  language?: string;
  priority?: number;
}

interface UpdateBody {
  title?: string;
  description?: string;
  pageType?: string;
  country?: string;
  language?: string;
  priority?: number;
  isActive?: boolean;
}

export default async function targetPagesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // GET /api/target-pages
  app.get<{ Querystring: ListQuery }>("/", async (request, reply) => {
    const { page, limit, pageType, country, isActive } = request.query;
    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (pageType) where["pageType"] = pageType;
    if (country) where["country"] = country;
    if (isActive !== undefined) where["isActive"] = isActive === "true";

    const [items, total] = await Promise.all([
      prisma.targetPage.findMany({
        where,
        skip,
        take,
        orderBy: { priority: "desc" },
        include: { _count: { select: { backlinks: true } } },
      }),
      prisma.targetPage.count({ where }),
    ]);

    return reply.send({
      data: items,
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  });

  // POST /api/target-pages
  app.post<{ Body: CreateBody }>("/", async (request, reply) => {
    const body = request.body;

    // Create target page + default anchor strategies in a transaction
    const targetPage = await prisma.$transaction(async (tx) => {
      const tp = await tx.targetPage.create({
        data: {
          url: body.url,
          slug: body.slug,
          title: body.title,
          description: body.description,
          pageType: body.pageType as never,
          country: body.country,
          language: body.language as never,
          priority: body.priority ?? 5,
        },
      });

      // Create default anchor strategy distribution
      await tx.anchorStrategy.createMany({
        data: DEFAULT_ANCHOR_DISTRIBUTION.map((d) => ({
          targetPageId: tp.id,
          anchorType: d.anchorType,
          targetPercentage: d.targetPercentage,
        })),
      });

      return tp;
    });

    return reply.status(201).send({ data: targetPage });
  });

  // GET /api/target-pages/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const targetPage = await prisma.targetPage.findUnique({
      where: { id },
      include: {
        anchorStrategies: true,
        _count: { select: { backlinks: true } },
      },
    });

    if (!targetPage) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: `Target page ${id} not found` });
    }

    return reply.send({ data: targetPage });
  });

  // PUT /api/target-pages/:id
  app.put<{ Params: { id: string }; Body: UpdateBody }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    const body = request.body;

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData["title"] = body.title;
    if (body.description !== undefined) updateData["description"] = body.description;
    if (body.pageType !== undefined) updateData["pageType"] = body.pageType;
    if (body.country !== undefined) updateData["country"] = body.country;
    if (body.language !== undefined) updateData["language"] = body.language;
    if (body.priority !== undefined) updateData["priority"] = body.priority;
    if (body.isActive !== undefined) updateData["isActive"] = body.isActive;

    const tp = await prisma.targetPage.update({ where: { id }, data: updateData });
    return reply.send({ data: tp });
  });

  // DELETE /api/target-pages/:id
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);
    await prisma.targetPage.delete({ where: { id } });
    return reply.status(204).send();
  });

  // GET /api/target-pages/:id/anchor-distribution
  app.get<{ Params: { id: string } }>("/:id/anchor-distribution", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const [strategies, backlinks] = await Promise.all([
      prisma.anchorStrategy.findMany({ where: { targetPageId: id } }),
      prisma.backlink.findMany({
        where: { targetPageId: id, isLive: true },
        select: { anchorText: true },
      }),
    ]);

    // Classify and count anchor types
    const totalLinks = backlinks.length;
    const counts: Record<string, number> = {};

    for (const bl of backlinks) {
      const type = classifyAnchorText(bl.anchorText ?? "");
      counts[type] = (counts[type] ?? 0) + 1;
    }

    const distribution = strategies.map((s) => ({
      anchorType: s.anchorType,
      targetPercentage: Number(s.targetPercentage),
      currentPercentage: totalLinks > 0 ? Math.round(((counts[s.anchorType] ?? 0) / totalLinks) * 100) : 0,
      count: counts[s.anchorType] ?? 0,
      alert: totalLinks > 0 &&
        Math.round(((counts[s.anchorType] ?? 0) / totalLinks) * 100) > Number(s.targetPercentage) + 15,
    }));

    return reply.send({
      data: { targetPageId: id, totalLinks, distribution },
    });
  });
}

function classifyAnchorText(text: string): string {
  const lower = text.toLowerCase().trim();

  if (!lower) return "generic";

  // Brand detection
  if (lower.includes("sos expat") || lower.includes("sos-expat") || lower.includes("life-expat")) {
    return "brand";
  }

  // URL detection
  if (lower.startsWith("http") || lower.includes(".com") || lower.includes(".org")) {
    return "url";
  }

  // Generic anchors
  const genericPatterns = [
    "click here", "here", "visit", "read more", "learn more", "see more",
    "en savoir plus", "cliquez ici", "ici", "lire la suite",
    "mehr erfahren", "hier klicken",
  ];
  if (genericPatterns.some((p) => lower === p || lower.startsWith(p))) {
    return "generic";
  }

  // Word count heuristic
  const words = lower.split(/\s+/).length;
  if (words <= 2) return "keyword";
  return "long_tail";
}
