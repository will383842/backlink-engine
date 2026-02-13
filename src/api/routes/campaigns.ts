import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Request types
// ─────────────────────────────────────────────────────────────

interface CampaignParams {
  id: string;
}

interface ListCampaignsQuery {
  isActive?: string;
  language?: string;
  page?: string;
  limit?: string;
}

interface CreateCampaignBody {
  name: string;
  language: string;
  targetTier?: number;
  targetCountry?: string;
  targetCategory?: string;
  mailwizzListUid?: string;
  sequenceConfig: Record<string, unknown>;
  stopOnReply?: boolean;
  stopOnUnsub?: boolean;
  stopOnBounce?: boolean;
}

interface UpdateCampaignBody {
  name?: string;
  language?: string;
  targetTier?: number;
  targetCountry?: string;
  targetCategory?: string;
  mailwizzListUid?: string;
  sequenceConfig?: Record<string, unknown>;
  stopOnReply?: boolean;
  stopOnUnsub?: boolean;
  stopOnBounce?: boolean;
  isActive?: boolean;
}

interface EnrollProspectBody {
  prospectId: number;
  contactId: number;
}

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function campaignsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List campaigns ──────────────────────────
  app.get<{ Querystring: ListCampaignsQuery }>(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            isActive: { type: "string" },
            language: { type: "string" },
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "50" },
          },
        },
      },
    },
    async (request, reply) => {
      const { isActive, language, page, limit } = request.query;

      const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
      const skip = ((parseInt(page ?? "1", 10) || 1) - 1) * take;

      const where: Record<string, unknown> = {};
      if (isActive !== undefined) where["isActive"] = isActive === "true";
      if (language) where["language"] = language;

      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            _count: { select: { enrollments: true } },
          },
        }),
        prisma.campaign.count({ where }),
      ]);

      return reply.send({
        data: campaigns,
        pagination: {
          total,
          page: Math.floor(skip / take) + 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      });
    },
  );

  // ───── POST / ─── Create a campaign ──────────────────────
  app.post<{ Body: CreateCampaignBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "language"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            language: { type: "string", minLength: 2, maxLength: 5 },
            targetTier: { type: "integer", minimum: 1, maximum: 5 },
            targetCountry: { type: "string" },
            targetCategory: { type: "string", enum: ["blogger", "association", "partner", "influencer", "media", "agency", "corporate", "ecommerce", "other"] },
            mailwizzListUid: { type: "string" },
            sequenceConfig: { type: "object" },
            stopOnReply: { type: "boolean" },
            stopOnUnsub: { type: "boolean" },
            stopOnBounce: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const campaign = await prisma.campaign.create({
        data: {
          name: body.name,
          language: body.language,
          targetTier: body.targetTier ?? null,
          targetCountry: body.targetCountry ?? null,
          targetCategory: body.targetCategory ?? null,
          mailwizzListUid: body.mailwizzListUid ?? null,
          sequenceConfig: (body.sequenceConfig ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
          stopOnReply: body.stopOnReply ?? true,
          stopOnUnsub: body.stopOnUnsub ?? true,
          stopOnBounce: body.stopOnBounce ?? true,
        },
      });

      return reply.status(201).send({ data: campaign });
    },
  );

  // ───── PUT /:id ─── Update a campaign ────────────────────
  app.put<{ Params: CampaignParams; Body: UpdateCampaignBody }>(
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
            targetTier: { type: "integer" },
            targetCountry: { type: "string" },
            targetCategory: { type: "string" },
            mailwizzListUid: { type: "string" },
            sequenceConfig: { type: "object" },
            stopOnReply: { type: "boolean" },
            stopOnUnsub: { type: "boolean" },
            stopOnBounce: { type: "boolean" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const body = request.body;

      const existing = await prisma.campaign.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Campaign ${id} not found`,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData["name"] = body.name;
      if (body.language !== undefined) updateData["language"] = body.language;
      if (body.targetTier !== undefined) updateData["targetTier"] = body.targetTier;
      if (body.targetCountry !== undefined) updateData["targetCountry"] = body.targetCountry;
      if (body.targetCategory !== undefined) updateData["targetCategory"] = body.targetCategory;
      if (body.mailwizzListUid !== undefined) updateData["mailwizzListUid"] = body.mailwizzListUid;
      if (body.sequenceConfig !== undefined) updateData["sequenceConfig"] = body.sequenceConfig;
      if (body.stopOnReply !== undefined) updateData["stopOnReply"] = body.stopOnReply;
      if (body.stopOnUnsub !== undefined) updateData["stopOnUnsub"] = body.stopOnUnsub;
      if (body.stopOnBounce !== undefined) updateData["stopOnBounce"] = body.stopOnBounce;
      if (body.isActive !== undefined) updateData["isActive"] = body.isActive;

      const campaign = await prisma.campaign.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: campaign });
    },
  );

  // ───── POST /:id/enroll ─── Enroll a prospect in campaign
  app.post<{ Params: CampaignParams; Body: EnrollProspectBody }>(
    "/:id/enroll",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["prospectId", "contactId"],
          properties: {
            prospectId: { type: "integer" },
            contactId: { type: "integer" },
          },
        },
      },
    },
    async (request, reply) => {
      const campaignId = parseIdParam(request.params.id);
      const { prospectId, contactId } = request.body;

      // Validate campaign exists and is active
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Campaign ${campaignId} not found`,
        });
      }
      if (!campaign.isActive) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Campaign is not active",
        });
      }

      // Validate contact exists and belongs to prospect
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Contact ${contactId} not found`,
        });
      }
      if (contact.prospectId !== prospectId) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Contact does not belong to the specified prospect",
        });
      }

      // Check if contact is opted out
      if (contact.optedOut) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Contact has opted out",
        });
      }

      // Check for duplicate enrollment
      const existingEnrollment = await prisma.enrollment.findUnique({
        where: { contactId_campaignId: { contactId, campaignId } },
      });
      if (existingEnrollment) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "Contact is already enrolled in this campaign",
          data: { enrollmentId: existingEnrollment.id, status: existingEnrollment.status },
        });
      }

      // TODO: call outreachService.enrollProspect() which handles:
      //   - MailWizz subscriber creation
      //   - sequence scheduling
      //   - first email send scheduling

      const enrollment = await prisma.enrollment.create({
        data: {
          contactId,
          campaignId,
          prospectId,
          status: "active",
          currentStep: 0,
        },
      });

      // Update campaign stats
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { totalEnrolled: { increment: 1 } },
      });

      // Update prospect status if it was NEW
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: "OUTREACH",
          firstContactedAt: new Date(),
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          prospectId,
          contactId,
          enrollmentId: enrollment.id,
          eventType: "enrolled_in_campaign",
          eventSource: "api",
          userId: request.user.id,
          data: { campaignId, campaignName: campaign.name },
        },
      });

      return reply.status(201).send({ data: enrollment });
    },
  );

  // ───── GET /:id/stats ─── Campaign statistics ────────────
  app.get<{ Params: CampaignParams }>(
    "/:id/stats",
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

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Campaign ${id} not found`,
        });
      }

      const [
        totalEnrolled,
        active,
        paused,
        completed,
        stopped,
        replied,
        bounced,
      ] = await Promise.all([
        prisma.enrollment.count({ where: { campaignId: id } }),
        prisma.enrollment.count({ where: { campaignId: id, status: "active" } }),
        prisma.enrollment.count({ where: { campaignId: id, status: "paused" } }),
        prisma.enrollment.count({ where: { campaignId: id, status: "completed" } }),
        prisma.enrollment.count({ where: { campaignId: id, status: "stopped" } }),
        prisma.event.count({
          where: {
            enrollment: { campaignId: id },
            eventType: "reply_received",
          },
        }),
        prisma.event.count({
          where: {
            enrollment: { campaignId: id },
            eventType: "email_bounced",
          },
        }),
      ]);

      const replyRate = totalEnrolled > 0 ? (replied / totalEnrolled) * 100 : 0;

      return reply.send({
        data: {
          campaignId: id,
          campaignName: campaign.name,
          totalEnrolled,
          enrollmentsByStatus: { active, paused, completed, stopped },
          replied,
          bounced,
          replyRate: Math.round(replyRate * 100) / 100,
          totalWon: campaign.totalWon,
        },
      });
    },
  );

  // ───── DELETE /:id ─── Delete a campaign ───────────────
  app.delete<{ Params: CampaignParams }>(
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

      const existing = await prisma.campaign.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Campaign ${id} not found`,
        });
      }

      // Delete campaign and cascade to related enrollments/events
      await prisma.$transaction(async (tx) => {
        // Delete events linked to enrollments of this campaign
        await tx.event.deleteMany({
          where: { enrollment: { campaignId: id } },
        });
        // Delete enrollments
        await tx.enrollment.deleteMany({ where: { campaignId: id } });
        // Delete campaign
        await tx.campaign.delete({ where: { id } });
      });

      return reply.status(204).send();
    },
  );

  // ───── POST /:id/enroll-preview ─── Preview eligible prospects
  app.post<{ Params: CampaignParams; Body: { filters?: Record<string, unknown> } }>(
    "/:id/enroll-preview",
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
            filters: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const campaignId = parseIdParam(request.params.id);
      const { filters } = request.body;

      // Validate campaign exists
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: `Campaign ${campaignId} not found`,
        });
      }

      // Build where clause for eligible prospects
      const where: Record<string, unknown> = {
        status: { in: ["READY_TO_CONTACT", "CONTACTED_EMAIL", "FOLLOWUP_DUE"] },
      };

      // Apply campaign target filters
      if (campaign.targetTier) {
        where["tier"] = campaign.targetTier;
      }
      if (campaign.targetCountry) {
        where["country"] = campaign.targetCountry;
      }
      if (campaign.targetCategory) {
        where["category"] = campaign.targetCategory;
      }
      if (campaign.language) {
        where["language"] = campaign.language;
      }

      // Apply additional user filters
      if (filters) {
        Object.assign(where, filters);
      }

      // Count eligible prospects with at least one verified contact
      const eligibleProspects = await prisma.prospect.findMany({
        where: {
          ...where,
          contacts: {
            some: {
              emailStatus: "verified",
              optedOut: false,
            },
          },
        },
        select: {
          id: true,
          domain: true,
          tier: true,
          score: true,
          status: true,
          contacts: {
            where: {
              emailStatus: "verified",
              optedOut: false,
            },
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        take: 100, // Limit preview to 100 prospects
      });

      const totalEligible = await prisma.prospect.count({
        where: {
          ...where,
          contacts: {
            some: {
              emailStatus: "verified",
              optedOut: false,
            },
          },
        },
      });

      return reply.send({
        campaignId,
        campaignName: campaign.name,
        totalEligible,
        preview: eligibleProspects,
        filters: {
          targetTier: campaign.targetTier,
          targetCountry: campaign.targetCountry,
          language: campaign.language,
          ...filters,
        },
      });
    },
  );
}
