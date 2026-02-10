import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────

interface ListProspectsQuery {
  status?: string;
  country?: string;
  language?: string;
  tier?: string;
  score?: string;
  source?: string;
  search?: string; // search by domain
  page?: string;
  limit?: string;
}

interface ProspectParams {
  id: string;
}

interface CreateProspectBody {
  url: string;
  email?: string;
  name?: string;
  contactFormUrl?: string;
  notes?: string;
}

interface UpdateProspectBody {
  language?: string;
  country?: string;
  tier?: number;
  score?: number;
  status?: string;
  contactFormUrl?: string;
  hasRealTraffic?: boolean;
  isPbn?: boolean;
  nextFollowupAt?: string;
}

interface BulkImportBody {
  csv: string;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function prospectsRoutes(app: FastifyInstance): Promise<void> {
  // All prospect routes require user authentication
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List prospects with filters ─────────────
  app.get<{ Querystring: ListProspectsQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            country: { type: "string" },
            language: { type: "string" },
            tier: { type: "string" },
            score: { type: "string" },
            source: { type: "string" },
            search: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { status, country, language, tier, score, source, search, page, limit } =
        request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (status) where["status"] = status;
      if (country) where["country"] = country;
      if (language) where["language"] = language;
      if (tier) where["tier"] = parseInt(tier, 10);
      if (score) where["score"] = { gte: parseInt(score, 10) };
      if (source) where["source"] = source;
      if (search) where["domain"] = { contains: search, mode: "insensitive" };

      const [prospects, total] = await Promise.all([
        prisma.prospect.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            contacts: { select: { id: true, email: true, name: true, emailStatus: true } },
            _count: { select: { backlinks: true, events: true, enrollments: true } },
          },
        }),
        prisma.prospect.count({ where }),
      ]);

      return reply.send({
        data: prospects,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── GET /:id ─── Full prospect detail ─────────────────
  app.get<{ Params: ProspectParams }>(
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

      const prospect = await prisma.prospect.findUnique({
        where: { id },
        include: {
          contacts: true,
          sourceUrls: true,
          backlinks: { orderBy: { createdAt: "desc" }, take: 20 },
          events: { orderBy: { createdAt: "desc" }, take: 30 },
          enrollments: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      });

      if (!prospect) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      return reply.send({ data: prospect });
    },
  );

  // ───── POST / ─── Quick add a prospect ───────────────────
  app.post<{ Body: CreateProspectBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            contactFormUrl: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { url, email, name, contactFormUrl, notes } = request.body;

      // TODO: call ingestService.ingestSingle() which handles
      //   - URL normalization & domain extraction
      //   - dedup check
      //   - enrichment pipeline trigger
      //   - event creation

      // For now, do a simplified inline version:
      const domain = new URL(url).hostname.replace(/^www\./, "");

      // Check for duplicate
      const existing = await prisma.prospect.findUnique({ where: { domain } });
      if (existing) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: `Prospect already exists for domain: ${domain}`,
          data: { id: existing.id, domain: existing.domain },
        });
      }

      const prospect = await prisma.prospect.create({
        data: {
          domain,
          source: "manual",
          contactFormUrl: contactFormUrl ?? null,
          sourceUrls: {
            create: {
              url,
              urlNormalized: url.toLowerCase(),
              notes: notes ?? null,
              discoveredVia: "manual",
            },
          },
          ...(email
            ? {
                contacts: {
                  create: {
                    email,
                    emailNormalized: email.toLowerCase().trim(),
                    name: name ?? null,
                    discoveredVia: "manual",
                  },
                },
              }
            : {}),
          events: {
            create: {
              eventType: "prospect_created",
              eventSource: "api",
              userId: request.user.id,
              data: { url, email, notes },
            },
          },
        },
        include: { contacts: true, sourceUrls: true },
      });

      return reply.status(201).send({ data: prospect });
    },
  );

  // ───── PUT /:id ─── Update prospect fields ───────────────
  app.put<{ Params: ProspectParams; Body: UpdateProspectBody }>(
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
            language: { type: "string" },
            country: { type: "string" },
            tier: { type: "integer" },
            score: { type: "integer" },
            status: { type: "string" },
            contactFormUrl: { type: "string" },
            hasRealTraffic: { type: "boolean" },
            isPbn: { type: "boolean" },
            nextFollowupAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.language !== undefined) updateData["language"] = body.language;
      if (body.country !== undefined) updateData["country"] = body.country;
      if (body.tier !== undefined) updateData["tier"] = body.tier;
      if (body.score !== undefined) updateData["score"] = body.score;
      if (body.status !== undefined) updateData["status"] = body.status;
      if (body.contactFormUrl !== undefined) updateData["contactFormUrl"] = body.contactFormUrl;
      if (body.hasRealTraffic !== undefined) updateData["hasRealTraffic"] = body.hasRealTraffic;
      if (body.isPbn !== undefined) updateData["isPbn"] = body.isPbn;
      if (body.nextFollowupAt !== undefined)
        updateData["nextFollowupAt"] = new Date(body.nextFollowupAt);

      const prospect = await prisma.prospect.update({
        where: { id },
        data: updateData,
      });

      // Log status changes as events
      if (body.status && body.status !== existing.status) {
        await prisma.event.create({
          data: {
            prospectId: id,
            eventType: "status_changed",
            eventSource: "api",
            userId: request.user.id,
            data: { from: existing.status, to: body.status },
          },
        });
      }

      return reply.send({ data: prospect });
    },
  );

  // ───── GET /:id/timeline ─── Events for prospect ─────────
  app.get<{ Params: ProspectParams; Querystring: { page?: string; limit?: string } }>(
    "/:id/timeline",
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
      const take = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(request.query.page ?? "1", 10) || 1) - 1) * take;

      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where: { prospectId: id },
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            contact: { select: { id: true, email: true, name: true } },
            enrollment: { select: { id: true, campaignId: true, status: true } },
          },
        }),
        prisma.event.count({ where: { prospectId: id } }),
      ]);

      return reply.send({
        data: events,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── GET /:id/backlinks ─── Backlinks for prospect ─────
  app.get<{ Params: ProspectParams }>(
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

      const backlinks = await prisma.backlink.findMany({
        where: { prospectId: id },
        orderBy: { createdAt: "desc" },
        include: {
          sourceUrl: { select: { id: true, url: true, title: true } },
        },
      });

      return reply.send({ data: backlinks });
    },
  );

  // ───── POST /bulk ─── CSV import ─────────────────────────
  app.post<{ Body: BulkImportBody }>(
    "/bulk",
    {
      schema: {
        body: {
          type: "object",
          required: ["csv"],
          properties: {
            csv: { type: "string", description: "Raw CSV content" },
          },
        },
      },
    },
    async (request, reply) => {
      const { csv } = request.body;

      // TODO: call csvParser service to parse CSV into prospect rows
      // TODO: call ingestService.ingestBatch() for each parsed row

      // Simple inline CSV parsing for the skeleton
      const lines = csv.trim().split("\n");
      const header = lines[0];
      if (!header) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "CSV is empty or has no header row",
        });
      }

      const columns = header.split(",").map((c) => c.trim().toLowerCase());
      const urlIndex = columns.indexOf("url");
      if (urlIndex === -1) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "CSV must contain a 'url' column",
        });
      }

      const results = {
        total: lines.length - 1,
        created: 0,
        duplicates: 0,
        errors: 0,
        details: [] as Array<{ line: number; url: string; status: string; error?: string }>,
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(",").map((c) => c.trim());
        const url = cols[urlIndex];

        if (!url) {
          results.errors++;
          results.details.push({ line: i + 1, url: "", status: "error", error: "Missing URL" });
          continue;
        }

        try {
          const domain = new URL(url).hostname.replace(/^www\./, "");
          const existing = await prisma.prospect.findUnique({ where: { domain } });

          if (existing) {
            results.duplicates++;
            results.details.push({ line: i + 1, url, status: "duplicate" });
            continue;
          }

          await prisma.prospect.create({
            data: {
              domain,
              source: "csv_import",
              sourceUrls: {
                create: {
                  url,
                  urlNormalized: url.toLowerCase(),
                  discoveredVia: "csv_import",
                },
              },
              events: {
                create: {
                  eventType: "prospect_created",
                  eventSource: "csv_import",
                  userId: request.user.id,
                },
              },
            },
          });

          results.created++;
          results.details.push({ line: i + 1, url, status: "created" });
        } catch (err) {
          results.errors++;
          results.details.push({
            line: i + 1,
            url,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return reply.status(201).send({ data: results });
    },
  );

  // ───── DELETE /:id ─── Delete a prospect ────────────────
  app.delete<{ Params: ProspectParams }>(
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

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      // Delete prospect and all related records in a transaction
      await prisma.$transaction([
        prisma.event.deleteMany({ where: { prospectId: id } }),
        prisma.enrollment.deleteMany({ where: { prospectId: id } }),
        prisma.backlink.deleteMany({ where: { prospectId: id } }),
        prisma.contact.deleteMany({ where: { prospectId: id } }),
        prisma.sourceUrl.deleteMany({ where: { prospectId: id } }),
        prisma.prospect.delete({ where: { id } }),
      ]);

      return reply.status(204).send();
    },
  );
}
