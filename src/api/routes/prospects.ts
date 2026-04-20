import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";
import { ingestProspect, ingestBulk } from "../../services/ingestion/ingestService.js";
import { renderTemplateForProspect, getSenderInfo } from "../../services/messaging/templateRenderer.js";
import { notifyProspectWon } from "../../services/notifications/telegramService.js";

// Helper: Normalize URL (add https:// if missing)
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

// ─────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────

interface ListProspectsQuery {
  status?: string;
  country?: string;
  language?: string;
  category?: string;
  sourceContactType?: string; // Filter by MC original type (presse, ecole, youtubeur...)
  tier?: string;
  score?: string;
  source?: string;
  search?: string; // search by domain
  tagId?: string; // filter by tag ID
  page?: string;
  limit?: string;
}

interface ProspectParams {
  id: string;
}

interface CreateProspectBody {
  url: string;
  email?: string;
  name?: string; // DEPRECATED: Use firstName + lastName instead
  firstName?: string;
  lastName?: string;
  contactFormUrl?: string;
  phone?: string;
  phoneCountryCode?: string;
  notes?: string;
  language?: string;
  country?: string;
  category?: string;
}

interface UpdateProspectBody {
  language?: string;
  country?: string;
  category?: string;
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

  // ───── GET /recontact-suggestions ─── Suggest prospects to recontact
  app.get("/recontact-suggestions", async (request, reply) => {
    // Find prospects that haven't been contacted recently or are in LOST status
    const suggestions = await prisma.prospect.findMany({
      where: {
        OR: [
          {
            status: { in: ["LOST", "LINK_LOST"] },
            lastContactedAt: {
              lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
            },
          },
          {
            status: "FOLLOWUP_DUE",
            nextFollowupAt: {
              lt: new Date(), // Overdue followups
            },
          },
        ],
      },
      orderBy: { lastContactedAt: "asc" },
      take: 50,
      include: {
        contacts: { select: { id: true, email: true, name: true } },
        _count: { select: { events: true } },
      },
    });

    return reply.send({ data: suggestions });
  });

  // ───── GET / ─── List prospects with filters ─────────────
  app.get<{
    Querystring: ListProspectsQuery & {
      sortBy?: string;
      sortDir?: string;
      contactable?: string;
    };
  }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            country: { type: "string" },
            language: { type: "string" },
            category: { type: "string" },
            tier: { type: "string" },
            score: { type: "string" },
            source: { type: "string" },
            search: { type: "string" },
            sourceContactType: { type: "string" },
            tagId: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
            sortBy: {
              type: "string",
              enum: ["createdAt", "score", "domain", "lastContactedAt"],
              default: "createdAt",
            },
            sortDir: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
            contactable: {
              type: "string",
              enum: ["true", "false", "all"],
              default: "all",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        status,
        country,
        language,
        category,
        sourceContactType,
        tier,
        score,
        source,
        search,
        tagId,
        page,
        limit,
        sortBy,
        sortDir,
        contactable,
      } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (status) where["status"] = status;
      if (country) where["country"] = country;
      if (language) where["language"] = language;
      if (category) where["category"] = category;
      if (tier) where["tier"] = parseInt(tier, 10);
      if (score) where["score"] = { gte: parseInt(score, 10) };
      if (source) where["source"] = source;
      if (search) where["domain"] = { contains: search, mode: "insensitive" };
      if (sourceContactType) {
        where["contacts"] = { some: { sourceContactType } };
      }
      if (tagId) {
        where["tags"] = {
          some: {
            tagId: parseInt(tagId, 10),
          },
        };
      }

      // Contactability filter — aligned with /prospects/stats-by-type and
      // /dashboard/outreach-overview so the count shown in the stats bar
      // equals the number of rows returned by the list.
      //
      // Contactable = has a non-invalid, non-opted-out email OR has a contact form.
      if (contactable === "true") {
        where["OR"] = [
          {
            contacts: {
              some: {
                emailStatus: { not: "invalid" },
                optedOut: false,
              },
            },
          },
          { contactFormUrl: { not: null } },
        ];
      } else if (contactable === "false") {
        // Unreachable: neither a valid email nor a contact form.
        where["AND"] = [
          {
            contacts: {
              none: {
                emailStatus: { not: "invalid" },
                optedOut: false,
              },
            },
          },
          { contactFormUrl: null },
        ];
      }

      // Build dynamic orderBy
      const validSortFields = new Set(["createdAt", "score", "domain", "lastContactedAt"]);
      const orderField = validSortFields.has(sortBy ?? "") ? sortBy! : "createdAt";
      const orderDirection: "asc" | "desc" = sortDir === "asc" ? "asc" : "desc";
      const orderBy: Record<string, "asc" | "desc"> = { [orderField]: orderDirection };

      const [prospects, total] = await Promise.all([
        prisma.prospect.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            contacts: { select: { id: true, email: true, name: true, firstName: true, lastName: true, emailStatus: true, sourceContactType: true } },
            tags: { include: { tag: true } },
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
          tags: { include: { tag: true } },
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
            url: { type: "string" }, // Removed strict URI format validation
            email: { type: "string" }, // Removed strict email format validation
            name: { type: "string" },
            contactName: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            contactFormUrl: { type: "string" },
            phone: { type: "string" },
            phoneCountryCode: { type: "string", maxLength: 5 },
            notes: { type: "string" },
            tier: { type: "number", minimum: 1, maximum: 3 },
            language: { type: "string", enum: ["fr", "en", "de", "es", "pt", "ru", "ar", "zh", "hi"] },
            country: { type: "string", minLength: 2, maxLength: 2 },
            category: { type: "string", enum: ["blogger", "association", "partner", "influencer", "media", "agency", "corporate", "ecommerce", "other"] },
            sourceContactType: { type: "string", maxLength: 30 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateProspectBody & {
        contactName?: string;
        sourceContactType?: string;
      };
      const { url, email, contactFormUrl, phone, phoneCountryCode, notes, language, country, category, sourceContactType } = body;
      // Accept either `name` or legacy `contactName` field from UI
      const name = body.name ?? body.contactName;
      const firstName = body.firstName;
      const lastName = body.lastName;

      // Normalize URL before processing
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "URL cannot be empty",
        });
      }

      // Use ingestService for proper pipeline (dedup + enrichment trigger)
      const result = await ingestProspect({
        url: normalizedUrl,
        email,
        name,
        firstName,
        lastName,
        contactFormUrl,
        phone,
        phoneCountryCode,
        notes,
        language,
        country,
        category: category ?? undefined,
        sourceContactType: sourceContactType || undefined,
        source: "manual",
        meta: { userId: request.user.id },
      });

      if (result.status === "duplicate") {
        const existing = await prisma.prospect.findUnique({
          where: { id: result.prospectId },
          include: { contacts: true, sourceUrls: true },
        });

        const domain = existing?.domain || "unknown";
        const contactCount = existing?.contacts.length || 0;
        const addedDate = existing?.createdAt
          ? new Date(existing.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : "inconnue";

        return reply.status(409).send({
          statusCode: 409,
          error: "Duplicate",
          message: `Ce domaine existe déjà : ${domain} (ajouté le ${addedDate}, ${contactCount} contact${contactCount > 1 ? 's' : ''})`,
          data: existing,
        });
      }

      if (result.status === "error") {
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: result.error || "Failed to create prospect",
        });
      }

      // Fetch created prospect with relations
      const prospect = await prisma.prospect.findUnique({
        where: { id: result.prospectId },
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
            category: { type: "string" },
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
      if (body.category !== undefined) updateData["category"] = body.category;
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

      // Parse CSV (supports: url,email,name,firstName,lastName,language,country,category,sourceContactType,phone,notes)
      // Separator: comma or semicolon auto-detected from header line
      const lines = csv.trim().split(/\r?\n/);
      const header = lines[0];
      if (!header) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "CSV is empty or has no header row",
        });
      }

      // Auto-detect separator
      const separator = header.includes(";") && !header.includes(",") ? ";" : ",";
      const splitRow = (row: string) => row.split(separator).map((c) => c.trim());

      const columns = splitRow(header).map((c) => c.toLowerCase());
      const urlIndex = columns.indexOf("url");
      if (urlIndex === -1) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "CSV must contain a 'url' column",
        });
      }

      // Optional columns
      const emailIndex = columns.indexOf("email");
      const nameIndex = columns.indexOf("name");
      const firstNameIndex = columns.indexOf("firstname");
      const lastNameIndex = columns.indexOf("lastname");
      const languageIndex = columns.indexOf("language");
      const countryIndex = columns.indexOf("country");
      const categoryIndex = columns.indexOf("category");
      const sourceContactTypeIndex = columns.indexOf("sourcecontacttype");
      const phoneIndex = columns.indexOf("phone");
      const notesIndex = columns.indexOf("notes");

      // Build IngestInput array
      const prospects = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitRow(lines[i]!);
        const url = cols[urlIndex];

        if (!url) continue;

        prospects.push({
          url,
          email: emailIndex >= 0 ? cols[emailIndex] || undefined : undefined,
          name: nameIndex >= 0 ? cols[nameIndex] || undefined : undefined,
          firstName: firstNameIndex >= 0 ? cols[firstNameIndex] || undefined : undefined,
          lastName: lastNameIndex >= 0 ? cols[lastNameIndex] || undefined : undefined,
          language: languageIndex >= 0 ? cols[languageIndex] || undefined : undefined,
          country: countryIndex >= 0 ? cols[countryIndex] || undefined : undefined,
          category: categoryIndex >= 0 ? cols[categoryIndex] || undefined : undefined,
          sourceContactType:
            sourceContactTypeIndex >= 0 ? cols[sourceContactTypeIndex] || undefined : undefined,
          phone: phoneIndex >= 0 ? cols[phoneIndex] || undefined : undefined,
          notes: notesIndex >= 0 ? cols[notesIndex] || undefined : undefined,
          source: "csv_import" as const,
        });
      }

      // Use ingestBulk for proper pipeline (dedup + enrichment)
      const result = await ingestBulk(prospects);

      return reply.status(201).send({ data: result });
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

  // ───── GET /check-dedup ─── Check if domain exists (query string) ─────
  app.get<{ Querystring: { url: string } }>(
    "/check-dedup",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.query;

      try {
        const normalized = normalizeUrl(url);
        if (!normalized) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "URL cannot be empty",
          });
        }

        const domain = new URL(normalized).hostname.replace(/^www\./, "");
        const existing = await prisma.prospect.findUnique({
          where: { domain },
          select: { id: true, domain: true, status: true, createdAt: true },
        });

        if (existing) {
          return reply.send({
            exists: true,
            prospect: existing,
          });
        }

        return reply.send({ exists: false });
      } catch (err) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid URL format",
        });
      }
    },
  );

  // ───── POST /check-dedup ─── Check if domain exists (body) ─────
  app.post<{ Body: { url: string } }>(
    "/check-dedup",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body;

      try {
        const normalized = normalizeUrl(url);
        if (!normalized) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "URL cannot be empty",
          });
        }

        const domain = new URL(normalized).hostname.replace(/^www\./, "");
        const existing = await prisma.prospect.findUnique({
          where: { domain },
          select: { id: true, domain: true, status: true, createdAt: true },
        });

        if (existing) {
          return reply.send({
            exists: true,
            prospect: existing,
          });
        }

        return reply.send({ exists: false });
      } catch (err) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid URL format",
        });
      }
    },
  );

  // ───── GET /site-preview ─── Scrape site for preview (query string) ───
  app.get<{ Querystring: { url: string } }>(
    "/site-preview",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.query;

      try {
        const normalized = normalizeUrl(url);
        if (!normalized) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "URL cannot be empty",
          });
        }

        // Simple fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(normalized, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: `Failed to fetch URL: ${response.status} ${response.statusText}`,
          });
        }

        const html = await response.text();

        // Extract title and meta description (simple regex for speed)
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        );

        const domain = new URL(normalized).hostname.replace(/^www\./, "");

        return reply.send({
          url: normalized,
          domain,
          title: titleMatch?.[1]?.trim() ?? "No title found",
          description: descMatch?.[1]?.trim() ?? "No description found",
        });
      } catch (err) {
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message:
            err instanceof Error
              ? `Failed to preview site: ${err.message}`
              : "Failed to preview site",
        });
      }
    },
  );

  // ───── POST /site-preview ─── Scrape site for preview (body) ───
  app.post<{ Body: { url: string } }>(
    "/site-preview",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body;

      try {
        const normalized = normalizeUrl(url);
        if (!normalized) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "URL cannot be empty",
          });
        }

        // Simple fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(normalized, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: `Failed to fetch URL: ${response.status} ${response.statusText}`,
          });
        }

        const html = await response.text();

        // Extract title and meta description (simple regex for speed)
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        );

        const domain = new URL(normalized).hostname.replace(/^www\./, "");

        return reply.send({
          url: normalized,
          domain,
          title: titleMatch?.[1]?.trim() ?? "No title found",
          description: descMatch?.[1]?.trim() ?? "No description found",
        });
      } catch (err) {
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message:
            err instanceof Error
              ? `Failed to preview site: ${err.message}`
              : "Failed to preview site",
        });
      }
    },
  );

  // ───── POST /bulk-check-dedup ─── Check multiple URLs ───
  app.post<{ Body: { urls: string[] } }>(
    "/bulk-check-dedup",
    {
      schema: {
        body: {
          type: "object",
          required: ["urls"],
          properties: {
            urls: {
              type: "array",
              items: { type: "string", format: "uri" },
              maxItems: 1000,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { urls } = request.body;

      const results: Array<{
        url: string;
        domain: string;
        exists: boolean;
        prospectId?: number;
      }> = [];

      for (const url of urls) {
        try {
          const domain = new URL(url).hostname.replace(/^www\./, "");
          const existing = await prisma.prospect.findUnique({
            where: { domain },
            select: { id: true },
          });

          results.push({
            url,
            domain,
            exists: !!existing,
            prospectId: existing?.id,
          });
        } catch {
          results.push({
            url,
            domain: "invalid",
            exists: false,
          });
        }
      }

      const summary = {
        total: urls.length,
        existing: results.filter((r) => r.exists).length,
        new: results.filter((r) => !r.exists && r.domain !== "invalid").length,
        invalid: results.filter((r) => r.domain === "invalid").length,
      };

      return reply.send({ summary, results });
    },
  );

  // ───── POST /:id/mark-won ─── Mark prospect as won ───────
  app.post<{ Params: ProspectParams; Body: { backlink?: { pageUrl: string; anchorText?: string } } }>(
    "/:id/mark-won",
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
            backlink: {
              type: "object",
              properties: {
                pageUrl: { type: "string", format: "uri" },
                anchorText: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const { backlink } = request.body;

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      // If a backlink URL is provided, the link is claimed to be already
      // posted → set LINK_PENDING so the verification worker picks it up on
      // Sunday and promotes to LINK_VERIFIED if it finds the link live.
      // Without a backlink URL, the deal is agreed but nothing posted yet → WON.
      const nextStatus = backlink?.pageUrl ? "LINK_PENDING" : "WON";

      await prisma.prospect.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      // Send Telegram notification
      await notifyProspectWon(id).catch((err) => {
        request.log.error({ err, prospectId: id }, "Failed to send Telegram notification for prospect won");
      });

      // Optionally create backlink record
      if (backlink?.pageUrl) {
        await prisma.backlink.create({
          data: {
            prospectId: id,
            pageUrl: backlink.pageUrl,
            targetUrl: process.env.DEFAULT_TARGET_URL ?? "https://life-expat.com",
            anchorText: backlink.anchorText ?? null,
            linkType: "dofollow",
            isVerified: false,
            isLive: true,
          },
        });
      }

      // Log event
      await prisma.event.create({
        data: {
          prospectId: id,
          eventType: "marked_won",
          eventSource: "api",
          userId: request.user.id,
          data: { backlink },
        },
      });

      return reply.send({ message: "Prospect marked as won", prospectId: id });
    },
  );

  // ───── POST /:id/recontact ─── Re-contact a prospect ────
  app.post<{ Params: ProspectParams; Body?: { notes?: string } }>(
    "/:id/recontact",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        // Body is optional - can be empty object or contain notes
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const notes = request.body?.notes;

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      // Reset status to RE_CONTACTED
      await prisma.prospect.update({
        where: { id },
        data: {
          status: "RE_CONTACTED",
          lastContactedAt: new Date(),
          nextFollowupAt: null,
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          prospectId: id,
          eventType: "recontact_initiated",
          eventSource: "api",
          userId: request.user.id,
          data: { notes: notes ?? null },
        },
      });

      return reply.send({ message: "Prospect ready for re-contact", prospectId: id });
    },
  );

  // ───── POST /:id/log-manual-contact ─── Log manual contact (form submission) ────
  app.post<{ Params: ProspectParams; Body: { message: string; method?: string; nextFollowupDays?: number } }>(
    "/:id/log-manual-contact",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string", description: "Content of the message sent via contact form" },
            method: { type: "string", description: "Contact method (contact_form, linkedin, etc.)", default: "contact_form" },
            nextFollowupDays: { type: "integer", description: "Days until next followup", default: 7 },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const { message, method = "contact_form", nextFollowupDays = 7 } = request.body;

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      // Update prospect status to CONTACTED_MANUAL
      const nextFollowupAt = new Date();
      nextFollowupAt.setDate(nextFollowupAt.getDate() + nextFollowupDays);

      await prisma.prospect.update({
        where: { id },
        data: {
          status: "CONTACTED_MANUAL",
          lastContactedAt: new Date(),
          nextFollowupAt,
        },
      });

      // Log event with message content
      await prisma.event.create({
        data: {
          prospectId: id,
          eventType: "MANUAL_CONTACT_SENT",
          eventSource: "manual",
          userId: request.user.id,
          data: {
            method,
            message,
            contactedAt: new Date().toISOString(),
            nextFollowupAt: nextFollowupAt.toISOString(),
          },
        },
      });

      return reply.send({
        message: "Manual contact logged successfully",
        prospectId: id,
        nextFollowupAt,
      });
    },
  );

  // ───── DELETE /:id/manual-contact ─── Undo last manual contact (form) ────
  //
  // Removes the most recent MANUAL_CONTACT_SENT event so the prospect is put
  // back in /form-outreach's queue (the queue query excludes prospects having
  // any such event). We also revert prospect.status to READY_TO_CONTACT only
  // when the current status is CONTACTED_MANUAL — we don't clobber a status
  // advanced by another flow (REPLIED, WON, …).
  app.delete<{ Params: ProspectParams }>(
    "/:id/manual-contact",
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

      const prospect = await prisma.prospect.findUnique({ where: { id } });
      if (!prospect) {
        return reply.status(404).send({ error: "Prospect not found" });
      }

      const lastEvent = await prisma.event.findFirst({
        where: { prospectId: id, eventType: "MANUAL_CONTACT_SENT" },
        orderBy: { createdAt: "desc" },
      });

      if (!lastEvent) {
        return reply.status(404).send({
          error: "no_manual_contact",
          message: "This prospect has no manual contact event to undo.",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.event.delete({ where: { id: lastEvent.id } });

        // Revert status only if still CONTACTED_MANUAL — don't clobber a
        // status advanced by another downstream flow.
        if (prospect.status === "CONTACTED_MANUAL") {
          await tx.prospect.update({
            where: { id },
            data: {
              status: "READY_TO_CONTACT",
              nextFollowupAt: null,
              // Keep lastContactedAt: it reflects history even if the
              // current contact is rolled back.
            },
          });
        }

        // Audit trail
        await tx.event.create({
          data: {
            prospectId: id,
            eventType: "MANUAL_CONTACT_UNDONE",
            eventSource: "manual",
            userId: request.user.id,
            data: {
              undoneEventId: lastEvent.id,
              undoneAt: new Date().toISOString(),
              originalData: lastEvent.data as unknown as import("@prisma/client").Prisma.InputJsonValue,
            },
          },
        });
      });

      return reply.send({
        message: "Manual contact undone",
        prospectId: id,
      });
    },
  );

  // ───── GET /:id/contact-history ─── Get all manual contacts for a prospect ────
  app.get<{ Params: ProspectParams }>(
    "/:id/contact-history",
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

      // Get all manual contact events
      const events = await prisma.event.findMany({
        where: {
          prospectId: id,
          eventType: { in: ["MANUAL_CONTACT_SENT", "recontact_initiated", "CONTACTED_EMAIL"] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return reply.send({ data: events });
    },
  );

  // ───── POST /:id/notes ─── Add a CRM note ────────────────
  app.post<{ Params: ProspectParams; Body: { text: string } }>(
    "/:id/notes",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const { text } = request.body;

      const existing = await prisma.prospect.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${id} not found`,
        });
      }

      const event = await prisma.event.create({
        data: {
          prospectId: id,
          eventType: "note_added",
          eventSource: "api",
          userId: request.user.id,
          data: { text, author: String((request.user as Record<string, unknown>).name || request.user.email) } as object,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return reply.status(201).send({ data: event });
    },
  );

  // ───── GET /:id/notes ─── Get all CRM notes for a prospect ────
  app.get<{ Params: ProspectParams }>(
    "/:id/notes",
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

      const notes = await prisma.event.findMany({
        where: {
          prospectId: id,
          eventType: "note_added",
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return reply.send({ data: notes });
    },
  );

  // ───────────────────────────────────────────────────────────
  // GET /:id/generate-message - Generate pre-filled message for contact form
  // ───────────────────────────────────────────────────────────
  app.get<{ Params: ProspectParams }>(
    "/:id/generate-message",
    {
      onRequest: [authenticateUser],
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

      // Fetch prospect with contact form info
      const prospect = await prisma.prospect.findUnique({
        where: { id },
        select: {
          id: true,
          domain: true,
          language: true,
          contactFormUrl: true,
          contactFormFields: true,
          hasCaptcha: true,
        },
      });

      if (!prospect) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Prospect not found",
        });
      }

      if (!prospect.contactFormUrl) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "No contact form detected for this prospect",
        });
      }

      if (!prospect.language) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Prospect has no language set. Run enrichment first.",
        });
      }

      // Get sender info
      const senderInfo = await getSenderInfo();

      // Render template
      const rendered = await renderTemplateForProspect(id, senderInfo);

      if (!rendered) {
        return reply.status(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Failed to render message template",
        });
      }

      return reply.send({
        success: true,
        data: {
          subject: rendered.subject,
          body: rendered.body,
          contactFormUrl: prospect.contactFormUrl,
          formFields: prospect.contactFormFields,
          hasCaptcha: prospect.hasCaptcha,
          language: prospect.language,
          senderInfo,
        },
      });
    },
  );

  // ───── GET /stats-by-type ─── Counts by category, sourceContactType, status, contact method ────
  app.get("/stats-by-type", async (_request, reply) => {
    const [byCategory, bySourceType, byStatus, contactMethod, byLanguage, byCountry] = await Promise.all([
      // By BL category
      prisma.prospect.groupBy({
        by: ["category"],
        _count: { _all: true },
        orderBy: { _count: { category: "desc" } },
      }),
      // By MC source contact type (count emails, not prospects)
      prisma.$queryRaw<{ type: string; count: bigint }[]>`
        SELECT c."sourceContactType" as type, COUNT(*) as count
        FROM contacts c
        WHERE c."sourceContactType" IS NOT NULL
          AND c."sourceContactType" != 'unknown'
          AND c."optedOut" = false
          AND c."emailStatus" NOT IN ('invalid')
        GROUP BY c."sourceContactType"
        ORDER BY count DESC
      `,
      // By status
      prisma.prospect.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { _count: { status: "desc" } },
      }),
      // Contact method breakdown
      prisma.$queryRaw<{ method: string; count: bigint }[]>`
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM contacts c WHERE c."prospectId" = p.id AND c."emailStatus" NOT IN ('invalid') AND c."optedOut" = false)
              AND p."contactFormUrl" IS NOT NULL THEN 'email_and_form'
            WHEN EXISTS (SELECT 1 FROM contacts c WHERE c."prospectId" = p.id AND c."emailStatus" NOT IN ('invalid') AND c."optedOut" = false)
              THEN 'email_only'
            WHEN p."contactFormUrl" IS NOT NULL THEN 'form_only'
            ELSE 'none'
          END as method,
          COUNT(*) as count
        FROM prospects p
        GROUP BY method
        ORDER BY count DESC
      `,
      // Top 10 languages
      prisma.prospect.groupBy({
        by: ["language"],
        _count: { _all: true },
        where: { language: { not: null } },
        orderBy: { _count: { language: "desc" } },
        take: 15,
      }),
      // Top 10 countries
      prisma.prospect.groupBy({
        by: ["country"],
        _count: { _all: true },
        where: { country: { not: null } },
        orderBy: { _count: { country: "desc" } },
        take: 15,
      }),
    ]);

    // Compute aggregated contactability counts from the contactMethod breakdown
    const methodMap = new Map<string, number>();
    for (const e of contactMethod) {
      methodMap.set(e.method, Number(e.count));
    }
    const total = byCategory.reduce((s, e) => s + e._count._all, 0);
    const contactable =
      (methodMap.get("email_only") ?? 0) +
      (methodMap.get("email_and_form") ?? 0) +
      (methodMap.get("form_only") ?? 0);
    const unreachable = methodMap.get("none") ?? 0;

    return reply.send({
      data: {
        total,
        contactable,
        unreachable,
        byCategory: byCategory.map((e) => ({ category: e.category, count: e._count._all })),
        bySourceType: bySourceType.map((e) => ({ type: e.type, count: Number(e.count) })),
        byStatus: byStatus.map((e) => ({ status: e.status, count: e._count._all })),
        byContactMethod: contactMethod.map((e) => ({ method: e.method, count: Number(e.count) })),
        byLanguage: byLanguage.map((e) => ({ language: e.language, count: e._count._all })),
        byCountry: byCountry.map((e) => ({ country: e.country, count: e._count._all })),
      },
    });
  });

  // ───── GET /form-queue ─── Prospects with contact form (pending or contacted) ────
  app.get<{
    Querystring: {
      language?: string;
      category?: string;
      sourceContactType?: string;
      folder?: "pending" | "contacted";
      limit?: string;
    };
  }>(
    "/form-queue",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            language: { type: "string" },
            category: { type: "string" },
            sourceContactType: { type: "string" },
            folder: { type: "string", enum: ["pending", "contacted"], default: "pending" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { language, category, sourceContactType, folder = "pending", limit } = request.query;
      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);

      // Shared base filter
      const baseWhere: Record<string, unknown> = {
        contactFormUrl: { not: null },
      };
      if (sourceContactType) {
        baseWhere["OR"] = [
          { sourceContactType },
          { contacts: { some: { sourceContactType } } },
        ];
      }
      if (language) baseWhere["language"] = language;
      if (category) baseWhere["category"] = category;

      // Pending (default) = prospect not yet contacted via form, eligible statuses.
      // Contacted = prospect with at least one MANUAL_CONTACT_SENT event.
      const where: Record<string, unknown> =
        folder === "contacted"
          ? {
              ...baseWhere,
              events: { some: { eventType: "MANUAL_CONTACT_SENT" } },
            }
          : {
              ...baseWhere,
              status: { in: ["READY_TO_CONTACT", "NEW", "ENRICHING"] },
              NOT: {
                events: {
                  some: { eventType: "MANUAL_CONTACT_SENT" },
                },
              },
            };

      const [prospects, total, alreadyContacted] = await Promise.all([
        prisma.prospect.findMany({
          where,
          select: {
            id: true,
            domain: true,
            category: true,
            language: true,
            country: true,
            contactFormUrl: true,
            contactFormFields: true,
            hasCaptcha: true,
            score: true,
            tier: true,
            status: true,
            thematicCategories: true,
            contacts: {
              select: { email: true, firstName: true, lastName: true, name: true },
              take: 1,
            },
            // For the Contacted folder, surface the most-recent manual contact
            // event so the UI can show when it happened and who clicked.
            events: folder === "contacted"
              ? {
                  where: { eventType: "MANUAL_CONTACT_SENT" },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { createdAt: true, data: true },
                }
              : false,
          },
          orderBy:
            folder === "contacted"
              ? [{ lastContactedAt: "desc" }, { id: "desc" }]
              : [{ score: "desc" }, { tier: "asc" }],
          take,
        }),
        prisma.prospect.count({ where }),
        prisma.event.groupBy({
          by: ["prospectId"],
          where: { eventType: "MANUAL_CONTACT_SENT" },
          _count: true,
        }),
      ]);

      return reply.send({
        data: prospects,
        total,
        alreadyContactedCount: alreadyContacted.length,
        folder,
      });
    },
  );

  // ───── POST /:id/generate-form-message ─── Generate a message for contact form ────
  app.post<{ Params: ProspectParams }>(
    "/:id/generate-form-message",
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
          contacts: { take: 1 },
        },
      });

      if (!prospect) {
        return reply.status(404).send({ error: "Prospect not found" });
      }

      // Check if already contacted via form (dedup)
      const alreadyContacted = await prisma.event.findFirst({
        where: { prospectId: id, eventType: "MANUAL_CONTACT_SENT" },
      });

      if (alreadyContacted) {
        return reply.status(400).send({
          error: "already_contacted",
          message: `This prospect was already contacted on ${(alreadyContacted.data as any)?.contactedAt ?? alreadyContacted.createdAt.toISOString()}`,
          contactedAt: (alreadyContacted.data as any)?.contactedAt ?? alreadyContacted.createdAt.toISOString(),
        });
      }

      // Load sender settings
      let senderSettings = { yourWebsite: "https://life-expat.com", yourCompany: "Life Expat", yourName: "" };
      try {
        const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
        if (row) Object.assign(senderSettings, row.value);
        const outreachRow = await prisma.appSetting.findUnique({ where: { key: "outreach_config" } });
        if (outreachRow) Object.assign(senderSettings, outreachRow.value);
      } catch { /* defaults */ }

      // Lookup a MessageTemplate from the DB — no LLM call.
      // Priority order (highest first):
      //   1. (lang + sourceContactType)        — most specific
      //   2. (lang + category)                  — category fallback
      //   3. (lang, null, null)                 — general per-language
      //   4. (en  + sourceContactType)
      //   5. (en  + category)
      //   6. (en, null, null)
      // Returns 404 if nothing is found so the admin can create one from
      // /message-templates instead of getting a silently-wrong default.
      const lang = prospect.language ?? "en";
      const cat = prospect.category;
      const sct =
        (prospect.contacts[0] as unknown as { sourceContactType?: string | null })
          ?.sourceContactType ??
        prospect.sourceContactType ??
        null;

      const candidates = await prisma.messageTemplate.findMany({
        where: {
          OR: [
            { language: lang, sourceContactType: sct },
            { language: lang, category: cat },
            { language: lang, category: null, sourceContactType: null },
            { language: "en", sourceContactType: sct },
            { language: "en", category: cat },
            { language: "en", category: null, sourceContactType: null },
          ],
        },
      });

      const pickByPriority = (): typeof candidates[number] | null => {
        const byScore = (t: typeof candidates[number]) => {
          let score = 0;
          if (t.language === lang) score += 100;
          if (sct && t.sourceContactType === sct) score += 20;
          if (t.category === cat) score += 10;
          return score;
        };
        return candidates.sort((a, b) => byScore(b) - byScore(a))[0] ?? null;
      };

      const template = pickByPriority();

      if (!template) {
        return reply.status(404).send({
          error: "no_template",
          message: `No MessageTemplate found for language "${lang}" (category "${cat}"). Create one from /message-templates.`,
          language: lang,
          category: cat,
        });
      }

      // Variable substitution — keeps the legacy {siteName}/{yourName}/
      // {yourCompany}/{yourWebsite} placeholders and adds {contactName} for
      // personalised greetings.
      const contactName =
        prospect.contacts[0]?.firstName ??
        prospect.contacts[0]?.name ??
        "";

      const substitute = (text: string): string =>
        text
          .replace(/\{siteName\}/g, prospect.domain)
          .replace(/\{domain\}/g, prospect.domain)
          .replace(/\{contactName\}/g, contactName)
          .replace(/\{yourName\}/g, senderSettings.yourName || "")
          .replace(/\{yourCompany\}/g, senderSettings.yourCompany)
          .replace(/\{yourWebsite\}/g, senderSettings.yourWebsite);

      return reply.send({
        data: {
          subject: substitute(template.subject),
          body: substitute(template.body),
          language: template.language,
          templateId: template.id,
          prospectDomain: prospect.domain,
          contactFormUrl: prospect.contactFormUrl,
          hasCaptcha: prospect.hasCaptcha,
          formFields: prospect.contactFormFields,
        },
      });
    },
  );
}
