import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";

// ─────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────

export default async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET /today ─── Daily dashboard: urgent, to-do, opportunities, stats
  app.get(
    "/today",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Urgent items: follow-ups that are overdue
      const overdueFollowups = await prisma.prospect.findMany({
        where: {
          nextFollowupAt: { lt: now },
          status: { in: ["OUTREACH", "FOLLOW_UP", "NEGOTIATION"] },
        },
        orderBy: { nextFollowupAt: "asc" },
        take: 20,
        select: {
          id: true,
          domain: true,
          status: true,
          nextFollowupAt: true,
          tier: true,
          contacts: {
            select: { id: true, email: true, name: true },
            take: 1,
          },
        },
      });

      // To-do items: follow-ups due today
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const todayFollowups = await prisma.prospect.findMany({
        where: {
          nextFollowupAt: { gte: now, lt: endOfDay },
          status: { in: ["OUTREACH", "FOLLOW_UP", "NEGOTIATION"] },
        },
        orderBy: { nextFollowupAt: "asc" },
        take: 20,
        select: {
          id: true,
          domain: true,
          status: true,
          nextFollowupAt: true,
          tier: true,
        },
      });

      // Opportunities: new high-score prospects not yet contacted
      const opportunities = await prisma.prospect.findMany({
        where: {
          status: "NEW",
          score: { gte: 50 },
        },
        orderBy: { score: "desc" },
        take: 10,
        select: {
          id: true,
          domain: true,
          score: true,
          tier: true,
          mozDa: true,
          language: true,
          country: true,
        },
      });

      // Today's stats
      const [
        prospectsCreatedToday,
        emailsSentToday,
        repliesReceivedToday,
        backlinksWonToday,
      ] = await Promise.all([
        prisma.prospect.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.event.count({
          where: { eventType: "email_sent", createdAt: { gte: startOfDay } },
        }),
        prisma.event.count({
          where: { eventType: "reply_received", createdAt: { gte: startOfDay } },
        }),
        prisma.backlink.count({
          where: { createdAt: { gte: startOfDay } },
        }),
      ]);

      return reply.send({
        data: {
          urgent: overdueFollowups,
          todo: todayFollowups,
          opportunities,
          stats: {
            prospectsCreatedToday,
            emailsSentToday,
            repliesReceivedToday,
            backlinksWonToday,
          },
        },
      });
    },
  );

  // ───── GET /stats ─── Global KPIs ────────────────────────
  app.get(
    "/stats",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        totalProspects,
        totalContacts,
        totalBacklinks,
        liveBacklinks,
        totalCampaigns,
        activeCampaigns,
        totalEnrollments,
        // This month
        prospectsThisMonth,
        backlinksThisMonth,
        repliesThisMonth,
        emailsSentThisMonth,
        // Last month (for comparison)
        prospectsLastMonth,
        backlinksLastMonth,
        repliesLastMonth,
        emailsSentLastMonth,
      ] = await Promise.all([
        prisma.prospect.count(),
        prisma.contact.count(),
        prisma.backlink.count(),
        prisma.backlink.count({ where: { isLive: true } }),
        prisma.campaign.count(),
        prisma.campaign.count({ where: { isActive: true } }),
        prisma.enrollment.count(),
        // This month
        prisma.prospect.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.backlink.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.event.count({
          where: { eventType: "reply_received", createdAt: { gte: startOfMonth } },
        }),
        prisma.event.count({
          where: { eventType: "email_sent", createdAt: { gte: startOfMonth } },
        }),
        // Last month
        prisma.prospect.count({
          where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        prisma.backlink.count({
          where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        prisma.event.count({
          where: {
            eventType: "reply_received",
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
        }),
        prisma.event.count({
          where: {
            eventType: "email_sent",
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
        }),
      ]);

      const overallReplyRate =
        emailsSentThisMonth > 0
          ? Math.round((repliesThisMonth / emailsSentThisMonth) * 10000) / 100
          : 0;

      return reply.send({
        data: {
          totals: {
            prospects: totalProspects,
            contacts: totalContacts,
            backlinks: totalBacklinks,
            liveBacklinks,
            campaigns: totalCampaigns,
            activeCampaigns,
            enrollments: totalEnrollments,
          },
          thisMonth: {
            prospects: prospectsThisMonth,
            backlinks: backlinksThisMonth,
            replies: repliesThisMonth,
            emailsSent: emailsSentThisMonth,
            replyRate: overallReplyRate,
          },
          lastMonth: {
            prospects: prospectsLastMonth,
            backlinks: backlinksLastMonth,
            replies: repliesLastMonth,
            emailsSent: emailsSentLastMonth,
          },
        },
      });
    },
  );

  // ───── GET /pipeline ─── Prospect counts by status ───────
  app.get(
    "/pipeline",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Get counts for each status
      const statusCounts = await prisma.prospect.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { _count: { status: "desc" } },
      });

      // Transform into a map
      const pipeline: Record<string, number> = {};
      for (const entry of statusCounts) {
        pipeline[entry.status] = entry._count._all;
      }

      // Also get tier distribution
      const tierCounts = await prisma.prospect.groupBy({
        by: ["tier"],
        _count: { _all: true },
        orderBy: { tier: "asc" },
      });

      const tiers: Record<string, number> = {};
      for (const entry of tierCounts) {
        tiers[`tier_${entry.tier}`] = entry._count._all;
      }

      return reply.send({
        data: {
          byStatus: pipeline,
          byTier: tiers,
          total: Object.values(pipeline).reduce((sum, n) => sum + n, 0),
        },
      });
    },
  );
}
