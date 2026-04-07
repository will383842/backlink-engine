// ---------------------------------------------------------------------------
// Sent Emails API - Full audit trail of every email sent
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";

export default async function sentEmailsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List sent emails with filters ──────────────
  app.get<{
    Querystring: {
      prospectId?: string;
      contactId?: string;
      enrollmentId?: string;
      campaignId?: string;
      status?: string;
      stepNumber?: string;
      page?: string;
      limit?: string;
    };
  }>("/", async (request, reply) => {
    const {
      prospectId,
      contactId,
      enrollmentId,
      campaignId,
      status,
      stepNumber,
      page = "1",
      limit = "50",
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (prospectId) where["prospectId"] = parseInt(prospectId, 10);
    if (contactId) where["contactId"] = parseInt(contactId, 10);
    if (enrollmentId) where["enrollmentId"] = parseInt(enrollmentId, 10);
    if (campaignId) where["campaignId"] = parseInt(campaignId, 10);
    if (status) where["status"] = status;
    if (stepNumber !== undefined) where["stepNumber"] = parseInt(stepNumber, 10);

    const [emails, total] = await Promise.all([
      prisma.sentEmail.findMany({
        where,
        include: {
          prospect: { select: { id: true, domain: true } },
          contact: { select: { id: true, email: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.sentEmail.count({ where }),
    ]);

    return reply.send({
      data: emails,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  // ───── GET /:id ─── Single email with full content ─────────
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const email = await prisma.sentEmail.findUnique({
      where: { id },
      include: {
        prospect: { select: { id: true, domain: true, status: true } },
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true, language: true } },
        enrollment: { select: { id: true, status: true, currentStep: true } },
      },
    });

    if (!email) {
      return reply.status(404).send({ error: "Sent email not found" });
    }

    return reply.send({ data: email });
  });

  // ───── GET /stats ─── Aggregated email sending statistics ───
  app.get("/stats", async (_request, reply) => {
    const [
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplained,
      totalFailed,
      byStep,
      byCampaign,
    ] = await Promise.all([
      prisma.sentEmail.count({ where: { status: { not: "failed" } } }),
      prisma.sentEmail.count({ where: { deliveredAt: { not: null } } }),
      prisma.sentEmail.count({ where: { firstOpenedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { firstClickedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { bouncedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { complainedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { status: "failed" } }),
      prisma.sentEmail.groupBy({
        by: ["stepNumber"],
        _count: { id: true },
        where: { status: { not: "failed" } },
      }),
      prisma.sentEmail.groupBy({
        by: ["campaignId"],
        _count: { id: true },
        _avg: { openCount: true },
        where: { status: { not: "failed" } },
      }),
    ]);

    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0";
    const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : "0";

    return reply.send({
      data: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        totalFailed,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
        byStep: byStep.map((s) => ({
          step: s.stepNumber,
          count: s._count.id,
          label: s.stepNumber === 0 ? "Initial" : `Follow-up ${s.stepNumber}`,
        })),
        byCampaign,
      },
    });
  });

  // ───── GET /ab-stats ─── A/B test statistics per campaign ────────
  app.get("/ab-stats", async (_request, reply) => {
    // Find campaigns with A/B testing enabled
    const abCampaigns = await prisma.campaign.findMany({
      where: { abTestEnabled: true },
      select: { id: true, name: true, language: true },
    });

    if (abCampaigns.length === 0) {
      return reply.send({ data: [] });
    }

    const campaignIds = abCampaigns.map((c) => c.id);

    // Fetch all A/B sent emails for these campaigns (excluding failed)
    const abEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId: { in: campaignIds },
        abVariant: { not: null },
        status: { not: "failed" },
      },
      select: {
        campaignId: true,
        abVariant: true,
        firstOpenedAt: true,
        firstClickedAt: true,
        status: true,
      },
    });

    // Also count replies per campaign+variant via events
    const replyEvents = await prisma.event.findMany({
      where: {
        eventType: { in: ["reply_received", "REPLY_RECEIVED"] },
        enrollment: {
          campaignId: { in: campaignIds },
        },
      },
      select: {
        enrollmentId: true,
      },
    });

    // Map enrollmentId to abVariant+campaignId via sent emails
    const enrollmentVariantMap = new Map<number, { variant: string; campaignId: number }>();
    const enrollmentEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId: { in: campaignIds },
        abVariant: { not: null },
        stepNumber: 0, // initial email determines the variant
      },
      select: {
        enrollmentId: true,
        abVariant: true,
        campaignId: true,
      },
    });
    for (const se of enrollmentEmails) {
      if (se.abVariant) {
        enrollmentVariantMap.set(se.enrollmentId, {
          variant: se.abVariant,
          campaignId: se.campaignId,
        });
      }
    }

    // Count replies per campaign+variant
    const replyCounts = new Map<string, number>(); // key: "campaignId:variant"
    for (const re of replyEvents) {
      if (re.enrollmentId) {
        const info = enrollmentVariantMap.get(re.enrollmentId);
        if (info) {
          const key = `${info.campaignId}:${info.variant}`;
          replyCounts.set(key, (replyCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // Aggregate stats per campaign per variant
    const results = abCampaigns.map((campaign) => {
      const campaignEmails = abEmails.filter((e) => e.campaignId === campaign.id);

      const buildVariantStats = (variant: string) => {
        const variantEmails = campaignEmails.filter((e) => e.abVariant === variant);
        const sent = variantEmails.length;
        const opened = variantEmails.filter((e) => e.firstOpenedAt !== null).length;
        const clicked = variantEmails.filter((e) => e.firstClickedAt !== null).length;
        const replied = replyCounts.get(`${campaign.id}:${variant}`) ?? 0;

        return {
          variant,
          sent,
          openRate: sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : "0%",
          clickRate: sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : "0%",
          replyRate: sent > 0 ? `${((replied / sent) * 100).toFixed(1)}%` : "0%",
          opened,
          clicked,
          replied,
        };
      };

      const variantA = buildVariantStats("A");
      const variantB = buildVariantStats("B");

      // Determine winner based on reply rate first, then open rate
      let winner: string | null = null;
      if (variantA.sent >= 5 && variantB.sent >= 5) {
        // Need minimum sample size for meaningful comparison
        const aReplyPct = variantA.sent > 0 ? variantA.replied / variantA.sent : 0;
        const bReplyPct = variantB.sent > 0 ? variantB.replied / variantB.sent : 0;

        if (aReplyPct !== bReplyPct) {
          winner = aReplyPct > bReplyPct ? "A" : "B";
        } else {
          // Tiebreaker: open rate
          const aOpenPct = variantA.sent > 0 ? variantA.opened / variantA.sent : 0;
          const bOpenPct = variantB.sent > 0 ? variantB.opened / variantB.sent : 0;
          if (aOpenPct !== bOpenPct) {
            winner = aOpenPct > bOpenPct ? "A" : "B";
          }
        }
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        language: campaign.language,
        variantA,
        variantB,
        winner,
        winnerLabel: winner
          ? winner === "A"
            ? "Benefit-focused (A)"
            : "Curiosity-focused (B)"
          : "Not enough data (min 5 per variant)",
      };
    });

    return reply.send({ data: results });
  });

  // ───── GET /prospect/:prospectId ─── All emails for a prospect ──
  app.get<{ Params: { prospectId: string } }>(
    "/prospect/:prospectId",
    async (request, reply) => {
      const prospectId = parseIdParam(request.params.prospectId);

      const emails = await prisma.sentEmail.findMany({
        where: { prospectId },
        include: {
          contact: { select: { id: true, email: true, firstName: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "asc" },
      });

      return reply.send({ data: emails });
    },
  );
}
