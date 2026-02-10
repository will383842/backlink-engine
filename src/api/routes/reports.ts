import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";

export default async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── Aggregated stats ─────────────────────────
  app.get("/", async (_request, reply) => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const [
      totalProspects,
      totalBacklinks,
      liveBacklinks,
      totalCampaigns,
      totalReplies,
      totalWon,
      prospectsByStatus,
      prospectsBySource,
      prospectsByCountry,
      backlinksPerMonth,
      campaigns,
    ] = await Promise.all([
      prisma.prospect.count(),
      prisma.backlink.count(),
      prisma.backlink.count({ where: { isLive: true } }),
      prisma.campaign.count(),
      prisma.event.count({ where: { eventType: { in: ["reply_received", "REPLY_CLASSIFIED"] } } }),
      prisma.prospect.count({ where: { status: "WON" } }),
      prisma.prospect.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.prospect.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.prospect.groupBy({ by: ["country"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 20 }),
      prisma.backlink.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: sixMonthsAgo } },
        _count: { id: true },
      }),
      prisma.campaign.findMany({
        where: { totalEnrolled: { gt: 0 } },
        select: { id: true, name: true, totalEnrolled: true, totalReplied: true, totalWon: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Aggregate backlinks by month
    const monthlyBacklinks: Record<string, number> = {};
    for (const row of backlinksPerMonth) {
      const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`;
      monthlyBacklinks[key] = (monthlyBacklinks[key] ?? 0) + row._count.id;
    }

    // Pipeline funnel
    const pipeline: Record<string, number> = {};
    for (const row of prospectsByStatus) {
      pipeline[row.status] = row._count.id;
    }

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {};
    for (const row of prospectsBySource) {
      sourceBreakdown[row.source] = row._count.id;
    }

    // Country breakdown
    const countryBreakdown: Record<string, number> = {};
    for (const row of prospectsByCountry) {
      countryBreakdown[row.country ?? "unknown"] = row._count.id;
    }

    // Reply rate per campaign
    const campaignStats = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      enrolled: c.totalEnrolled,
      replied: c.totalReplied,
      won: c.totalWon,
      replyRate: c.totalEnrolled > 0
        ? Math.round((c.totalReplied / c.totalEnrolled) * 10000) / 100
        : 0,
    }));

    return reply.send({
      data: {
        overview: {
          totalProspects,
          totalBacklinks,
          liveBacklinks,
          totalCampaigns,
          totalReplies,
          totalWon,
        },
        backlinksPerMonth: monthlyBacklinks,
        pipeline,
        sourceBreakdown,
        countryBreakdown,
        campaignStats,
      },
    });
  });
}
