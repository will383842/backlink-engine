import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface BacklinkParams {
  id: string;
}

interface ListBacklinksQuery {
  isLive?: string;
  linkType?: string;
  prospectId?: string;
  isVerified?: string;
  page?: string;
  limit?: string;
}

interface CreateBacklinkBody {
  prospectId: number;
  sourceUrlId?: number;
  pageUrl: string;
  targetUrl: string;
  anchorText?: string;
  linkType?: string;
  isLive?: boolean;
  hasWidget?: boolean;
  hasBadge?: boolean;
}

interface UpdateBacklinkBody {
  pageUrl?: string;
  targetUrl?: string;
  anchorText?: string;
  linkType?: string;
  isLive?: boolean;
  isVerified?: boolean;
  hasWidget?: boolean;
  hasBadge?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function backlinksRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List backlinks with filters ─────────────
  app.get<{ Querystring: ListBacklinksQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            isLive: { type: "string" },
            linkType: { type: "string" },
            prospectId: { type: "string" },
            isVerified: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { isLive, linkType, prospectId, isVerified, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (isLive !== undefined) where["isLive"] = isLive === "true";
      if (linkType) where["linkType"] = linkType;
      if (prospectId) where["prospectId"] = parseInt(prospectId, 10);
      if (isVerified !== undefined) where["isVerified"] = isVerified === "true";

      const [backlinks, total] = await Promise.all([
        prisma.backlink.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            prospect: { select: { id: true, domain: true, status: true, tier: true } },
            sourceUrl: { select: { id: true, url: true, title: true } },
          },
        }),
        prisma.backlink.count({ where }),
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

  // ───── POST / ─── Manually add a backlink ────────────────
  app.post<{ Body: CreateBacklinkBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["prospectId", "pageUrl", "targetUrl"],
          properties: {
            prospectId: { type: "integer" },
            sourceUrlId: { type: "integer" },
            pageUrl: { type: "string" },
            targetUrl: { type: "string" },
            anchorText: { type: "string" },
            linkType: { type: "string", enum: ["dofollow", "nofollow", "ugc", "sponsored"] },
            isLive: { type: "boolean" },
            hasWidget: { type: "boolean" },
            hasBadge: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      // Validate prospect exists
      const prospect = await prisma.prospect.findUnique({ where: { id: body.prospectId } });
      if (!prospect) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Prospect ${body.prospectId} not found`,
        });
      }

      // Validate sourceUrl if provided
      if (body.sourceUrlId) {
        const sourceUrl = await prisma.sourceUrl.findUnique({ where: { id: body.sourceUrlId } });
        if (!sourceUrl || sourceUrl.prospectId !== body.prospectId) {
          return reply.status(400).send({
            statusCode: 400,
            error: "Bad Request",
            message: "Source URL not found or does not belong to the specified prospect",
          });
        }
      }

      const backlink = await prisma.backlink.create({
        data: {
          prospectId: body.prospectId,
          sourceUrlId: body.sourceUrlId ?? null,
          pageUrl: body.pageUrl,
          targetUrl: body.targetUrl,
          anchorText: body.anchorText ?? null,
          linkType: (body.linkType ?? "dofollow") as any,
          isLive: body.isLive ?? true,
          hasWidget: body.hasWidget ?? false,
          hasBadge: body.hasBadge ?? false,
          firstDetectedAt: new Date(),
        },
      });

      // Update prospect status to WON if it was in OUTREACH or NEGOTIATION
      if (["OUTREACH", "NEGOTIATION", "NEW"].includes(prospect.status)) {
        await prisma.prospect.update({
          where: { id: body.prospectId },
          data: { status: "WON" },
        });
      }

      // Log event
      await prisma.event.create({
        data: {
          prospectId: body.prospectId,
          eventType: "backlink_added",
          eventSource: "api",
          userId: request.user.id,
          data: {
            backlinkId: backlink.id,
            pageUrl: body.pageUrl,
            targetUrl: body.targetUrl,
            linkType: backlink.linkType,
          },
        },
      });

      return reply.status(201).send({ data: backlink });
    },
  );

  // ───── PUT /:id ─── Update a backlink ────────────────────
  app.put<{ Params: BacklinkParams; Body: UpdateBacklinkBody }>(
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
            pageUrl: { type: "string" },
            targetUrl: { type: "string" },
            anchorText: { type: "string" },
            linkType: { type: "string", enum: ["dofollow", "nofollow", "ugc", "sponsored"] },
            isLive: { type: "boolean" },
            isVerified: { type: "boolean" },
            hasWidget: { type: "boolean" },
            hasBadge: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.backlink.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Backlink ${id} not found`,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.pageUrl !== undefined) updateData["pageUrl"] = body.pageUrl;
      if (body.targetUrl !== undefined) updateData["targetUrl"] = body.targetUrl;
      if (body.anchorText !== undefined) updateData["anchorText"] = body.anchorText;
      if (body.linkType !== undefined) updateData["linkType"] = body.linkType;
      if (body.hasWidget !== undefined) updateData["hasWidget"] = body.hasWidget;
      if (body.hasBadge !== undefined) updateData["hasBadge"] = body.hasBadge;
      if (body.isVerified !== undefined) {
        updateData["isVerified"] = body.isVerified;
        if (body.isVerified) updateData["lastVerifiedAt"] = new Date();
      }
      if (body.isLive !== undefined) {
        updateData["isLive"] = body.isLive;
        // Track when a backlink is lost
        if (!body.isLive && existing.isLive) {
          updateData["lostAt"] = new Date();
        }
      }

      const backlink = await prisma.backlink.update({
        where: { id },
        data: updateData,
      });

      // Log lost backlink event
      if (body.isLive === false && existing.isLive) {
        await prisma.event.create({
          data: {
            prospectId: existing.prospectId,
            eventType: "backlink_lost",
            eventSource: "api",
            userId: request.user.id,
            data: { backlinkId: id, pageUrl: existing.pageUrl },
          },
        });
      }

      return reply.send({ data: backlink });
    },
  );

  // ───── POST /verify-all ─── Trigger manual verification ──
  app.post(
    "/verify-all",
    {
      config: {
        rateLimit: { max: 2, timeWindow: "10 minutes" },
      },
    },
    async (request, reply) => {
      // TODO: call verificationService.verifyAllLiveBacklinks() which:
      //   - fetches all isLive=true backlinks
      //   - enqueues BullMQ jobs for each (to avoid timeout)
      //   - each job: HTTP HEAD/GET on pageUrl, check for targetUrl in HTML
      //   - updates isVerified, lastVerifiedAt, isLive accordingly

      const liveCount = await prisma.backlink.count({ where: { isLive: true } });

      request.log.info(
        { liveCount },
        "Manual backlink verification triggered",
      );

      // Placeholder: in production, this enqueues BullMQ jobs
      // and returns immediately with a job batch ID
      return reply.status(202).send({
        message: "Verification jobs enqueued",
        data: {
          totalToVerify: liveCount,
          // TODO: return batchId from BullMQ for progress tracking
          estimatedDurationSeconds: liveCount * 2,
        },
      });
    },
  );

  // ───── DELETE /:id ─── Delete a backlink ───────────────
  app.delete<{ Params: BacklinkParams }>(
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

      const existing = await prisma.backlink.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Backlink ${id} not found`,
        });
      }

      await prisma.$transaction([
        // Delete related events
        prisma.event.deleteMany({
          where: { prospectId: existing.prospectId, data: { path: ["backlinkId"], equals: id } },
        }),
        prisma.backlink.delete({ where: { id } }),
      ]);

      return reply.status(204).send();
    },
  );
}
