import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  countEligibleContacts,
  getEligibleContacts,
  getEligibleContactsPaginated,
  enrollBroadcastRecipient,
} from "../../services/broadcast/broadcastManager.js";
import {
  getBroadcastDailyLimit,
  getBroadcastSentToday,
} from "../../services/broadcast/warmupScheduler.js";
import {
  invalidateCampaignVariations,
  getAllCampaignVariations,
  setVariations,
  getVariations as getOrGenerateVariations,
} from "../../services/broadcast/variationCache.js";
import { getCached } from "../../services/cacheService.js";
import { isInSuppressionList } from "../../services/suppression/suppressionManager.js";

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
          sequenceConfig?: { steps: { stepNumber: number; delayDays: number; sourceEmail?: { subject: string; body: string } }[] };
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { name, language, brief, sourceEmail, targetSourceContactTypes, warmupSchedule, stopOnBounce, sequenceConfig } = request.body;

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
          sequenceConfig: sequenceConfig || null,
          stopOnBounce: stopOnBounce ?? true,
          stopOnReply: sequenceConfig ? true : false,
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
          sequenceConfig?: { steps: { stepNumber: number; delayDays: number; sourceEmail?: { subject: string; body: string } }[] } | null;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { name, brief, sourceEmail, targetSourceContactTypes, warmupSchedule, language, sequenceConfig } = request.body;

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
      if (sequenceConfig !== undefined) data.sequenceConfig = sequenceConfig;

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
        const byType = await prisma.$queryRaw<{ type: string; count: bigint }[]>`
          SELECT p."sourceContactType" as type, COUNT(*) as count
          FROM sent_emails se
          JOIN prospects p ON se."prospectId" = p.id
          WHERE se."campaignId" = ${id}
          GROUP BY p."sourceContactType"
          ORDER BY count DESC
        `;

        // By status
        const byStatus = await prisma.sentEmail.groupBy({
          by: ["status"],
          where: { campaignId: id },
          _count: { _all: true },
        });

        const eligible = await countEligibleContacts(id);

        // By step (for multi-step sequences)
        const byStep = await prisma.sentEmail.groupBy({
          by: ["stepNumber"],
          where: { campaignId: id },
          _count: { _all: true },
          orderBy: { stepNumber: "asc" },
        });

        return {
          ...campaign,
          eligibleRemaining: eligible,
          byLanguage: byLanguage.map((l) => ({ language: l.language, count: l._count._all })),
          byType: byType.map((t) => ({ type: t.type, count: Number(t.count) })),
          byStatus: byStatus.reduce((acc, s) => { acc[s.status] = s._count._all; return acc; }, {} as Record<string, number>),
          byStep: byStep.map((s) => ({ step: s.stepNumber, count: s._count._all })),
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

      // Try to send via SMTP (primary)
      try {
        const { sendViaSMTP } = await import("../../services/outreach/smtpSender.js");
        const { getNextSendingDomain } = await import("../../services/outreach/domainRotator.js");
        const domain = await getNextSendingDomain();

        const result = await sendViaSMTP({
          toEmail: email,
          toName: contactName || "Test",
          fromEmail: domain.fromEmail,
          fromName: domain.fromName,
          replyTo: domain.replyTo,
          subject: `[TEST] ${personalized.subject}`,
          bodyText: personalized.body,
        });

        if (!result.success) {
          throw new Error(result.error || "SMTP send failed");
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

  // ───── GET /:id/variations ─── List cached variations ─────────────────
  app.get(
    "/:id/variations",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const variations = await getAllCampaignVariations(id);
      return reply.send({ data: variations });
    },
  );

  // ───── PUT /:id/variations/:language/:contactType ─── Update variations ──
  app.put(
    "/:id/variations/:language/:contactType",
    async (
      request: FastifyRequest<{
        Params: { id: string; language: string; contactType: string };
        Body: { variations: { subject: string; body: string }[] };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { language, contactType } = request.params;
      const { variations } = request.body;

      if (!variations || !Array.isArray(variations) || variations.length === 0) {
        return reply.status(400).send({ error: "variations array is required and must not be empty" });
      }

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      await setVariations(id, language, contactType, variations);
      return reply.send({ message: "Variations updated", count: variations.length });
    },
  );

  // ───── POST /:id/variations/generate ─── Force regenerate variations ────
  app.post(
    "/:id/variations/generate",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { language: string; contactType: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { language, contactType } = request.body;

      if (!language || !contactType) {
        return reply.status(400).send({ error: "language and contactType are required" });
      }

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const sourceEmail = campaign.sourceEmail as { subject: string; body: string } | null;
      if (!sourceEmail) {
        return reply.status(400).send({ error: "Campaign has no source email" });
      }

      // Invalidate existing cache for this combo
      const { redis } = await import("../../config/redis.js");
      try {
        await redis.del(`broadcast:${id}:variations:${language}:${contactType}`);
      } catch { /* ignore */ }

      // Generate fresh
      const variations = await getOrGenerateVariations(id, language, contactType, sourceEmail, campaign.brief || "");
      return reply.send({ data: { language, contactType, variations, count: variations.length } });
    },
  );

  // ───── GET /:id/eligible-contacts ─── Paginated eligible contacts ──────
  app.get(
    "/:id/eligible-contacts",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { page?: string; limit?: string; sourceContactType?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "25")));
      const sourceContactType = request.query.sourceContactType || undefined;

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const { data, total } = await getEligibleContactsPaginated(id, page, limit, sourceContactType);
      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ───── POST /:id/exclusions ─── Exclude a contact from campaign ────────
  app.post(
    "/:id/exclusions",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { contactId: number; reason?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { contactId, reason } = request.body;

      if (!contactId) {
        return reply.status(400).send({ error: "contactId is required" });
      }

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const exclusion = await prisma.broadcastExclusion.upsert({
        where: { campaignId_contactId: { campaignId: id, contactId } },
        create: { campaignId: id, contactId, reason: reason || "manual" },
        update: { reason: reason || "manual" },
      });

      return reply.status(201).send({ data: exclusion });
    },
  );

  // ───── GET /:id/exclusions ─── List excluded contacts ──────────────────
  app.get(
    "/:id/exclusions",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "25")));

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const [data, total] = await Promise.all([
        prisma.broadcastExclusion.findMany({
          where: { campaignId: id },
          include: {
            contact: {
              include: { prospect: { select: { language: true, domain: true } } },
            },
          },
          orderBy: { excludedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.broadcastExclusion.count({ where: { campaignId: id } }),
      ]);

      return reply.send({
        data: data.map((e) => ({
          id: e.id,
          contactId: e.contactId,
          email: e.contact.email,
          firstName: e.contact.firstName,
          lastName: e.contact.lastName,
          sourceContactType: e.contact.sourceContactType,
          language: e.contact.prospect?.language,
          domain: e.contact.prospect?.domain,
          reason: e.reason,
          excludedAt: e.excludedAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ───── DELETE /:id/exclusions/:contactId ─── Remove exclusion ──────────
  app.delete(
    "/:id/exclusions/:contactId",
    async (
      request: FastifyRequest<{ Params: { id: string; contactId: string } }>,
      reply: FastifyReply,
    ) => {
      const campaignId = parseInt(request.params.id);
      const contactId = parseInt(request.params.contactId);

      try {
        await prisma.broadcastExclusion.delete({
          where: { campaignId_contactId: { campaignId, contactId } },
        });
      } catch {
        return reply.status(404).send({ error: "Exclusion not found" });
      }

      return reply.send({ message: "Contact re-included" });
    },
  );

  // ───── POST /:id/manual-recipients ─── Add manual recipient ────────────
  app.post(
    "/:id/manual-recipients",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { email: string; name?: string; contactType?: string; language?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const { email, name, contactType, language } = request.body;

      if (!email) {
        return reply.status(400).send({ error: "email is required" });
      }

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      // Check suppression list
      if (await isInSuppressionList(email)) {
        return reply.status(400).send({ error: "Email is in suppression list" });
      }

      try {
        const recipient = await prisma.broadcastManualRecipient.upsert({
          where: { campaignId_email: { campaignId: id, email: email.toLowerCase().trim() } },
          create: {
            campaignId: id,
            email: email.toLowerCase().trim(),
            name: name || null,
            contactType: contactType || null,
            language: language || campaign.language || "fr",
          },
          update: {
            name: name || undefined,
            contactType: contactType || undefined,
            language: language || undefined,
          },
        });
        return reply.status(201).send({ data: recipient });
      } catch {
        return reply.status(409).send({ error: "Recipient already exists in this campaign" });
      }
    },
  );

  // ───── GET /:id/manual-recipients ─── List manual recipients ───────────
  app.get(
    "/:id/manual-recipients",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "25")));

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      const [data, total] = await Promise.all([
        prisma.broadcastManualRecipient.findMany({
          where: { campaignId: id },
          orderBy: { addedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.broadcastManualRecipient.count({ where: { campaignId: id } }),
      ]);

      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ───── DELETE /:id/manual-recipients/:recipientId ─── Remove ───────────
  app.delete(
    "/:id/manual-recipients/:recipientId",
    async (
      request: FastifyRequest<{ Params: { id: string; recipientId: string } }>,
      reply: FastifyReply,
    ) => {
      const recipientId = parseInt(request.params.recipientId);

      try {
        await prisma.broadcastManualRecipient.delete({ where: { id: recipientId } });
      } catch {
        return reply.status(404).send({ error: "Manual recipient not found" });
      }

      return reply.send({ message: "Manual recipient removed" });
    },
  );

  // ───── GET /:id/replies ─── List replies for a broadcast campaign ──────
  app.get(
    "/:id/replies",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const id = parseInt(request.params.id);
      const page = Math.max(1, parseInt(request.query.page || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "25")));

      const campaign = await prisma.campaign.findUnique({ where: { id } });
      if (!campaign || campaign.campaignType !== "broadcast") {
        return reply.status(404).send({ error: "Broadcast campaign not found" });
      }

      // Find enrollments that were stopped due to reply, or have reply events
      const [replyEvents, total] = await Promise.all([
        prisma.event.findMany({
          where: {
            eventType: { in: ["reply_received", "REPLY_RECEIVED", "prospect_replied"] },
            enrollment: { campaignId: id },
          },
          include: {
            contact: { select: { email: true, firstName: true, lastName: true, sourceContactType: true } },
            prospect: { select: { domain: true, language: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.event.count({
          where: {
            eventType: { in: ["reply_received", "REPLY_RECEIVED", "prospect_replied"] },
            enrollment: { campaignId: id },
          },
        }),
      ]);

      // Also get stopped enrollments (reply/unsub/bounce)
      const stoppedEnrollments = await prisma.enrollment.findMany({
        where: {
          campaignId: id,
          status: "stopped",
          stoppedReason: { not: null },
        },
        include: {
          contact: { select: { email: true, firstName: true, lastName: true, sourceContactType: true } },
          prospect: { select: { domain: true, language: true } },
        },
        orderBy: { completedAt: "desc" },
      });

      return reply.send({
        data: {
          replies: replyEvents.map((e) => ({
            id: e.id,
            email: e.contact?.email,
            name: [e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ") || null,
            type: e.contact?.sourceContactType,
            domain: e.prospect?.domain,
            language: e.prospect?.language,
            eventType: e.eventType,
            date: e.createdAt,
            data: e.data,
          })),
          stoppedEnrollments: stoppedEnrollments.map((en) => ({
            id: en.id,
            email: en.contact?.email,
            name: [en.contact?.firstName, en.contact?.lastName].filter(Boolean).join(" ") || null,
            type: en.contact?.sourceContactType,
            domain: en.prospect?.domain,
            reason: en.stoppedReason,
            stoppedAt: en.completedAt,
            step: en.currentStep,
          })),
          totalReplies: total,
          totalStopped: stoppedEnrollments.length,
        },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}
