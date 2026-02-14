import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";
import { getCached, DASHBOARD_CACHE } from "../../services/cacheService.js";

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

      // Use Redis cache (TTL: 60s) to avoid hitting PostgreSQL on every request
      const data = await getCached(
        DASHBOARD_CACHE.TODAY,
        DASHBOARD_CACHE.TTL,
        async () => {
          const [
            repliesToHandle,
            bounces,
            lostBacklinks,
            prospectsReady,
            formsToFill,
            lostRecontactable,
            sentToMailwizz,
            repliesReceived,
            backlinksWon,
            prospectsAddedToday,
          ] = await Promise.all([
        // Urgent: replies needing action (unprocessed reply events)
        prisma.event.count({
          where: { eventType: "reply_received" },
        }).catch(() => 0),
        // Urgent: bounces
        prisma.event.count({
          where: { eventType: { in: ["hard_bounce", "soft_bounce", "bounce"] } },
        }).catch(() => 0),
        // Urgent: lost backlinks
        prisma.backlink.count({
          where: { isLive: false },
        }).catch(() => 0),
        // Todo: prospects ready to contact
        prisma.prospect.count({
          where: { status: "READY_TO_CONTACT" },
        }).catch(() => 0),
        // Todo: prospects with contact forms to fill
        prisma.prospect.count({
          where: { contactFormUrl: { not: null }, status: "NEW" },
        }).catch(() => 0),
        // Opportunities: lost prospects recontactable
        prisma.prospect.count({
          where: { status: "LOST", score: { gte: 30 } },
        }).catch(() => 0),
        // Stats: sent today
        prisma.event.count({
          where: { eventType: "email_sent", createdAt: { gte: startOfDay } },
        }).catch(() => 0),
        // Stats: replies received today
        prisma.event.count({
          where: { eventType: "reply_received", createdAt: { gte: startOfDay } },
        }).catch(() => 0),
        // Stats: backlinks won today
        prisma.backlink.count({
          where: { createdAt: { gte: startOfDay } },
        }).catch(() => 0),
        // Stats: prospects added today
        prisma.prospect.count({
          where: { createdAt: { gte: startOfDay } },
        }).catch(() => 0),
          ]);

          return {
            urgent: {
              repliesToHandle,
              bounces,
              lostBacklinks,
            },
            todo: {
              prospectsReady,
              formsToFill,
            },
            opportunities: {
              lostRecontactable,
            },
            stats: {
              sentToMailwizz,
              repliesReceived,
              backlinksWon,
              prospectsAddedBySource: { manual: prospectsAddedToday },
            },
          };
        },
      );

      return reply.send(data);
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

      // Use Redis cache (TTL: 60s)
      const data = await getCached(
        DASHBOARD_CACHE.STATS,
        DASHBOARD_CACHE.TTL,
        async () => {
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

          return {
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
          };
        },
      );

      return reply.send({ data });
    },
  );

  // ───── GET /pipeline ─── Prospect counts by status ───────
  app.get(
    "/pipeline",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Use Redis cache (TTL: 60s)
      const data = await getCached(
        DASHBOARD_CACHE.PIPELINE,
        DASHBOARD_CACHE.TTL,
        async () => {
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

          return {
            byStatus: pipeline,
            byTier: tiers,
            total: Object.values(pipeline).reduce((sum, n) => sum + n, 0),
          };
        },
      );

      return reply.send({ data });
    },
  );
}
