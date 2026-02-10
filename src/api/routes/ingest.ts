import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateApiKey } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface IngestProspectItem {
  url: string;
  email?: string;
  name?: string;
  contactFormUrl?: string;
  language?: string;
  country?: string;
  mozDa?: number;
  spamScore?: number;
  notes?: string;
}

interface IngestBody {
  prospects: IngestProspectItem[];
}

interface IngestResultDetail {
  url: string;
  status: "created" | "duplicate" | "error";
  prospectId?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function ingestRoutes(app: FastifyInstance): Promise<void> {

  // ───── POST / ─── Receive prospects from external scraper ─
  app.post<{ Body: IngestBody }>(
    "/",
    {
      preHandler: [authenticateApiKey],
      config: {
        rateLimit: { max: 20, timeWindow: "1 minute" },
      },
      schema: {
        body: {
          type: "object",
          required: ["prospects"],
          properties: {
            prospects: {
              type: "array",
              items: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  contactFormUrl: { type: "string" },
                  language: { type: "string" },
                  country: { type: "string" },
                  mozDa: { type: "integer" },
                  spamScore: { type: "integer" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              total: { type: "integer" },
              created: { type: "integer" },
              duplicates: { type: "integer" },
              errors: { type: "integer" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    status: { type: "string" },
                    prospectId: { type: "integer" },
                    error: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { prospects } = request.body;

      const result = {
        total: prospects.length,
        created: 0,
        duplicates: 0,
        errors: 0,
        details: [] as IngestResultDetail[],
      };

      for (const item of prospects) {
        try {
          // TODO: replace with ingestService.ingestSingle(item) which handles
          //   - URL normalization & domain extraction
          //   - suppression list check
          //   - dedup against existing prospects
          //   - safety check (Google Safe Browsing)
          //   - enrichment pipeline trigger (Moz DA, spam score, language detection)

          const domain = new URL(item.url).hostname.replace(/^www\./, "");

          // Dedup check
          const existing = await prisma.prospect.findUnique({ where: { domain } });
          if (existing) {
            result.duplicates++;
            result.details.push({
              url: item.url,
              status: "duplicate",
              prospectId: existing.id,
            });
            continue;
          }

          // Suppression list check
          if (item.email) {
            const suppressed = await prisma.suppressionEntry.findUnique({
              where: { emailNormalized: item.email.toLowerCase().trim() },
            });
            if (suppressed) {
              result.duplicates++;
              result.details.push({
                url: item.url,
                status: "duplicate",
                error: "Email is on suppression list",
              });
              continue;
            }
          }

          const prospect = await prisma.prospect.create({
            data: {
              domain,
              source: "scraper",
              language: item.language ?? null,
              country: item.country ?? null,
              mozDa: item.mozDa ?? null,
              spamScore: item.spamScore ?? 0,
              contactFormUrl: item.contactFormUrl ?? null,
              sourceUrls: {
                create: {
                  url: item.url,
                  urlNormalized: item.url.toLowerCase(),
                  discoveredVia: "scraper",
                  notes: item.notes ?? null,
                },
              },
              ...(item.email
                ? {
                    contacts: {
                      create: {
                        email: item.email,
                        emailNormalized: item.email.toLowerCase().trim(),
                        name: item.name ?? null,
                        discoveredVia: "scraper",
                      },
                    },
                  }
                : {}),
              events: {
                create: {
                  eventType: "prospect_created",
                  eventSource: "scraper_ingest",
                  data: { url: item.url, scraperBatch: true },
                },
              },
            },
          });

          result.created++;
          result.details.push({
            url: item.url,
            status: "created",
            prospectId: prospect.id,
          });
        } catch (err) {
          result.errors++;
          result.details.push({
            url: item.url,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
          request.log.error({ err, url: item.url }, "Failed to ingest prospect");
        }
      }

      return reply.send(result);
    },
  );

  // ───── GET /stats ─── Ingestion statistics ───────────────
  app.get(
    "/stats",
    {
      preHandler: [authenticateApiKey],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              today: {
                type: "object",
                properties: {
                  received: { type: "integer" },
                  created: { type: "integer" },
                  duplicates: { type: "integer" },
                },
              },
              thisWeek: {
                type: "object",
                properties: {
                  received: { type: "integer" },
                  created: { type: "integer" },
                },
              },
              thisMonth: {
                type: "object",
                properties: {
                  received: { type: "integer" },
                  created: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Count events of type prospect_created from scraper_ingest
      const scraperFilter = {
        eventType: "prospect_created",
        eventSource: "scraper_ingest",
      };

      const [todayCreated, weekCreated, monthCreated, todayTotal, weekTotal, monthTotal] =
        await Promise.all([
          prisma.event.count({
            where: { ...scraperFilter, createdAt: { gte: startOfDay } },
          }),
          prisma.event.count({
            where: { ...scraperFilter, createdAt: { gte: startOfWeek } },
          }),
          prisma.event.count({
            where: { ...scraperFilter, createdAt: { gte: startOfMonth } },
          }),
          // Total prospects created (any source) as a proxy for "received"
          prisma.prospect.count({
            where: { createdAt: { gte: startOfDay } },
          }),
          prisma.prospect.count({
            where: { createdAt: { gte: startOfWeek } },
          }),
          prisma.prospect.count({
            where: { createdAt: { gte: startOfMonth } },
          }),
        ]);

      // TODO: track duplicate attempts in a dedicated counter or log table
      // for now we approximate duplicates = received - created
      return reply.send({
        today: {
          received: todayTotal,
          created: todayCreated,
          duplicates: todayTotal - todayCreated,
        },
        thisWeek: {
          received: weekTotal,
          created: weekCreated,
        },
        thisMonth: {
          received: monthTotal,
          created: monthCreated,
        },
      });
    },
  );
}
