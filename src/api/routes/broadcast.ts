import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  countEligibleContacts,
  getEligibleContacts,
  enrollBroadcastRecipient,
} from "../../services/broadcast/broadcastManager.js";
import {
  getBroadcastDailyLimit,
  getBroadcastSentToday,
} from "../../services/broadcast/warmupScheduler.js";
import { invalidateCampaignVariations } from "../../services/broadcast/variationCache.js";
import { getCached } from "../../services/cacheService.js";

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default async function broadcastRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── POST / ─── Create broadcast campaign ──────────────────────
  app.post(
    "/",
    async (
      request: FastifyRequest<{
        Body: {
          name: string;
          language?: string;
          brief: string;
          sourceEmail: { subject: string; body: string };
          targetSourceContactTypes: string[];
          warmupSchedule?: number[];
          stopOnBounce?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { name, language, brief, sourceEmail, targetSourceContactTypes, warmupSchedule, stopOnBounce } = request.body;

      if (!name || !sourceEmail?.subject || !sourceEmail?.body) {
        return reply.status(400).send({ error: "name, sourceEmail.subject, and sourceEmail.body are required" });
      }

      if (!targetSourceContactTypes?.length) {
        return reply.status(400).send({ error: "targetSourceContactTypes must have at least one type" });
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          campaignType: "broadcast",
          language: language || "fr",
          brief,
          sourceEmail,
          targetSourceContactTypes,
          warmupSchedule: warmupSchedule || [5, 10, 20, 40, 75, 150, 300, 500],
          stopOnBounce: stopOnBounce ?? true,
          stopOnReply: false,
          stopOnUnsub: true,
          isActive: false, // Must be explicitly started
        },
      });

      return reply.status(201).send({ data: campaign });
    },
  );

  // ───── GET / ─── List broadcast campaigns ───────────────────────
  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: { active?: string } }>,
      reply: FastifyReply,
    ) => {
      const { active } = request.query;

      const where: Record<string, unknown> = { campaignType: "broadcast" };
      if (active === "true") where.isActive = true;
      if (active === "false") where.isActive = false;

      const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ data: campaigns });
    },
  );

  // ───── GET /:id ─── Get broadcast campaign detail ───────────────
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const campaign = await prisma.campaign.findUnique({ where: { id } });

      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const eligible = await countEligibleContacts(id);
      const dailyLimit = await getBroadcastDailyLimit(id);
      const sentToday = await getBroadcastSentToday(id);

      return reply.send({
        data: {
          ...campaign,
          eligibleContacts: eligible,
          dailyLimit,
          sentToday,
          remainingToday: Math.max(0, dailyLimit - sentToday),
        },
      });
    },
  );

  // ───── PUT /:id ─── Update broadcast campaign ──────────────────
  app.put(
    "/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          name?: string;
          brief?: string;
          sourceEmail?: { subject: string; body: string };
          targetSourceContactTypes?: string[];
          warmupSchedule?: number[];
          language?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { name, brief, sourceEmail, targetSourceContactTypes, warmupSchedule, language } = request.body;

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (brief !== undefined) data.brief = brief;
      if (sourceEmail !== undefined) data.sourceEmail = sourceEmail;
      if (targetSourceContactTypes !== undefined) data.targetSourceContactTypes = targetSourceContactTypes;
      if (warmupSchedule !== undefined) data.warmupSchedule = warmupSchedule;
      if (language !== undefined) data.language = language;

      const updated = await prisma.campaign.update({ where: { id }, data });

      // Invalidate variation cache if source email changed
      if (sourceEmail !== undefined) {
        await invalidateCampaignVariations(id);
      }

      return reply.send({ data: updated });
    },
  );

  // ───── DELETE /:id ─── Delete broadcast campaign ───────────────
  app.delete(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      await prisma.$transaction([
        prisma.sentEmail.deleteMany({ where: { campaignId: id } }),
        prisma.enrollment.deleteMany({ where: { campaignId: id } }),
        prisma.campaign.delete({ where: { id } }),
      ]);

      await invalidateCampaignVariations(id);

      return reply.send({ message: "Campaign deleted" });
    },
  );

  // ───── GET /:id/stats ─── Live stats ────────────────────────────
  app.get(
    "/:id/stats",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);

      const data = await getCached(`broadcast:stats:${id}`, 30, async () => {
        const campaign = await prisma.campaign.findUnique({
          where: { id },
          select: {
            totalSent: true, totalDelivered: true, totalOpened: true,
            totalClicked: true, totalBounced: true, totalComplained: true,
            totalEnrolled: true, warmupSchedule: true, currentWarmupDay: true,
          },
        });

        if (!campaign) return null;

        // By language
        const byLanguage = await prisma.sentEmail.groupBy({
          by: ["language"],
          where: { campaignId: id },
          _count: { _all: true },
        });

        // By contact type (via prospect sourceContactType)
        const byType = await prisma.$queryRawUnsafe<{ type: string; count: bigint }[]>(`
          SELECT p."sourceContactType" as type, COUNT(*) as count
          FROM sent_emails se
          JOIN prospects p ON se."prospectId" = p.id
          WHERE se."campaignId" = ${id}
          GROUP BY p."sourceContactType"
          ORDER BY count DESC
        `);

        // By status
        const byStatus = await prisma.sentEmail.groupBy({
          by: ["status"],
          where: { campaignId: id },
          _count: { _all: true },
        });

        const eligible = await countEligibleContacts(id);

        return {
          ...campaign,
          eligibleRemaining: eligible,
          byLanguage: byLanguage.map((l) => ({ language: l.language, count: l._count._all })),
          byType: byType.map((t) => ({ type: t.type, count: Number(t.count) })),
          byStatus: byStatus.reduce((acc, s) => { acc[s.status] = s._count._all; return acc; }, {} as Record<string, number>),
        };
      });

      if (!data) return reply.status(404).send({ error: "Campaign not found" });
      return reply.send({ data });
    },
  );

  // ───── GET /:id/recipients ─── Paginated recipient list ────────
  app.get(
    "/:id/recipients",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "50")));
      const skip = (page - 1) * limit;

      const [emails, total] = await Promise.all([
        prisma.sentEmail.findMany({
          where: { campaignId: id },
          orderBy: { sentAt: "desc" },
          skip,
          take: limit,
          include: {
            contact: { select: { email: true, firstName: true, lastName: true, sourceContactType: true } },
            prospect: { select: { domain: true, language: true, country: true } },
          },
        }),
        prisma.sentEmail.count({ where: { campaignId: id } }),
      ]);

      return reply.send({
        data: emails,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ───── POST /:id/preview ─── Preview eligible contacts ─────────
  app.post(
    "/:id/preview",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);

      const [count, sample] = await Promise.all([
        countEligibleContacts(id),
        getEligibleContacts(id, 10),
      ]);

      return reply.send({
        data: {
          totalEligible: count,
          sample: sample.map((c) => ({
            email: c.email,
            name: [c.firstName, c.lastName].filter(Boolean).join(" "),
            type: c.sourceContactType,
            language: c.language,
            domain: c.domain,
          })),
        },
      });
    },
  );

  // ───── POST /:id/start ─── Start campaign ──────────────────────
  app.post(
    "/:id/start",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      await prisma.campaign.update({
        where: { id },
        data: { isActive: true },
      });

      return reply.send({ message: "Campaign started", isActive: true });
    },
  );

  // ───── POST /:id/pause ─── Pause campaign ──────────────────────
  app.post(
    "/:id/pause",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      await prisma.campaign.update({
        where: { id },
        data: { isActive: false },
      });

      return reply.send({ message: "Campaign paused", isActive: false });
    },
  );

  // ───── POST /:id/test-send ─── Send test email ─────────────────
  app.post(
    "/:id/test-send",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { email: string; contactName?: string; contactType?: string; language?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { email, contactName, contactType, language } = request.body;

      if (!email) {
        return reply.status(400).send({ error: "email is required" });
      }

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const sourceEmail = campaign.sourceEmail as { subject: string; body: string } | null;
      if (!sourceEmail) {
        return reply.status(400).send({ error: "Campaign has no source email" });
      }

      // Generate one variation and send it
      const { getVariations, pickAndPersonalize } = await import("../../services/broadcast/variationCache.js");
      const lang = language || campaign.language || "fr";
      const type = contactType || "other";

      const variations = await getVariations(id, lang, type, sourceEmail, campaign.brief || "");
      const personalized = pickAndPersonalize(variations, contactName || "Test", "test-domain.com");

      // Try to send
      try {
        const { getEmailEngineClient } = await import("../../services/outreach/emailEngineClient.js");
        const emailEngine = getEmailEngineClient();

        if (emailEngine.isConfigured()) {
          await emailEngine.sendEmail({
            toEmail: email,
            toName: contactName || "Test",
            subject: `[TEST] ${personalized.subject}`,
            body: personalized.body,
            tags: ["broadcast-test", `campaign:${id}`],
          });
        }
      } catch (err) {
        return reply.status(500).send({
          error: "Failed to send test email",
          detail: err instanceof Error ? err.message : "Unknown error",
        });
      }

      return reply.send({
        message: "Test email sent",
        preview: personalized,
      });
    },
  );
}
