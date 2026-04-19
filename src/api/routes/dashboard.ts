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
        // Urgent: replies needing action (only unhandled ones)
        prisma.event.count({
          where: {
            eventType: "reply_received",
            NOT: { data: { path: ["isHandled"], equals: true } },
          },
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

  // ───── GET /outreach-overview ─── Clear view: contactable / no method / enriching ───
  app.get(
    "/outreach-overview",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const data = await getCached(
        "dashboard:outreach-overview",
        60,
        async () => {
          // Contactable: has valid email OR contact form
          const [
            readyWithEmail,
            readyWithForm,
            readyWithBoth,
            readyNoMethod,
            enriching,
            newProspects,
            contacted,
            replied,
            won,
          ] = await Promise.all([
            // Ready + valid email (not invalid, not opted out)
            prisma.$queryRaw<[{count: bigint}]>`
              SELECT COUNT(DISTINCT p.id) as count FROM prospects p
              JOIN contacts c ON c."prospectId" = p.id
              WHERE p.status = 'READY_TO_CONTACT'
                AND c."emailStatus" NOT IN ('invalid')
                AND c."optedOut" = false
            `,
            // Ready + contact form
            prisma.prospect.count({
              where: { status: "READY_TO_CONTACT", contactFormUrl: { not: null } },
            }),
            // Ready + both
            prisma.$queryRaw<[{count: bigint}]>`
              SELECT COUNT(DISTINCT p.id) as count FROM prospects p
              JOIN contacts c ON c."prospectId" = p.id
              WHERE p.status = 'READY_TO_CONTACT'
                AND c."emailStatus" NOT IN ('invalid')
                AND c."optedOut" = false
                AND p."contactFormUrl" IS NOT NULL
            `,
            // Ready + NO contact method
            prisma.$queryRaw<[{count: bigint}]>`
              SELECT COUNT(*) as count FROM prospects p
              WHERE p.status = 'READY_TO_CONTACT'
                AND p."contactFormUrl" IS NULL
                AND NOT EXISTS (
                  SELECT 1 FROM contacts c
                  WHERE c."prospectId" = p.id
                    AND c."emailStatus" NOT IN ('invalid')
                    AND c."optedOut" = false
                )
            `,
            // Currently enriching
            prisma.prospect.count({
              where: { status: { in: ["NEW", "ENRICHING"] } },
            }),
            // NEW only
            prisma.prospect.count({ where: { status: "NEW" } }),
            // Already contacted
            prisma.prospect.count({
              where: { status: { in: ["CONTACTED_EMAIL", "CONTACTED_MANUAL", "FOLLOWUP_DUE"] } },
            }),
            // Replied
            prisma.prospect.count({
              where: { status: { in: ["REPLIED", "NEGOTIATING"] } },
            }),
            // Won
            prisma.prospect.count({
              where: { status: { in: ["WON", "LINK_PENDING", "LINK_VERIFIED"] } },
            }),
          ]);

          const emailCount = Number(readyWithEmail[0]?.count ?? 0);
          const formCount = readyWithForm;
          const bothCount = Number(readyWithBoth[0]?.count ?? 0);
          const noMethodCount = Number(readyNoMethod[0]?.count ?? 0);
          // Email only = email - both, Form only = form - both
          const emailOnly = emailCount - bothCount;
          const formOnly = formCount - bothCount;
          const totalContactable = emailOnly + formOnly + bothCount;

          return {
            contactable: {
              total: totalContactable,
              emailOnly,
              formOnly,
              both: bothCount,
            },
            noContactMethod: noMethodCount,
            enriching: {
              total: enriching,
              newCount: newProspects,
            },
            outreach: {
              contacted,
              replied,
              won,
            },
          };
        },
      );

      return reply.send({ data });
    },
  );

  // ───── GET /mission-control-sync ─── MC webhook sync overview ─────
  app.get(
    "/mission-control-sync",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const data = await getCached(
        "dashboard:mc-sync",
        60,
        async () => {
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfWeek = new Date(startOfDay);
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

          // Check webhook health: last MC-synced prospect created
          // MC webhook creates prospects with source="csv_import" + sourceContactType set
          const lastMCProspect = await prisma.prospect.findFirst({
            where: { source: "csv_import", sourceContactType: { not: null } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });

          // Count contacts received via MC webhook
          const [totalFromMC, todayFromMC, weekFromMC] = await Promise.all([
            prisma.prospect.count({ where: { source: "csv_import", sourceContactType: { not: null } } }),
            prisma.prospect.count({
              where: {
                source: "csv_import",
                sourceContactType: { not: null },
                createdAt: { gte: startOfDay },
              },
            }),
            prisma.prospect.count({
              where: {
                source: "csv_import",
                sourceContactType: { not: null },
                createdAt: { gte: startOfWeek },
              },
            }),
          ]);

          // Distribution by sourceContactType (original MC type)
          const typeDistribution = await prisma.prospect.groupBy({
            by: ["sourceContactType"],
            where: { source: "csv_import", sourceContactType: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { sourceContactType: "desc" } },
          });

          // Distribution by mapped category
          const categoryDistribution = await prisma.prospect.groupBy({
            by: ["category"],
            where: { source: "csv_import", sourceContactType: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { category: "desc" } },
          });

          // Enrichment status of MC contacts
          const enrichmentStatus = await prisma.prospect.groupBy({
            by: ["status"],
            where: { source: "csv_import", sourceContactType: { not: null } },
            _count: { _all: true },
          });

          // Last 20 contacts received via MC
          const recentContacts = await prisma.prospect.findMany({
            where: { source: "csv_import", sourceContactType: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              domain: true,
              sourceContactType: true,
              category: true,
              language: true,
              country: true,
              status: true,
              score: true,
              createdAt: true,
              contacts: {
                select: { email: true, firstName: true, lastName: true },
                take: 1,
              },
            },
          });

          // Webhook health status
          const webhookHealthy = lastMCProspect
            ? (now.getTime() - new Date(lastMCProspect.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000 // active within 7 days
            : false;

          return {
            webhook: {
              healthy: webhookHealthy,
              lastEventAt: lastMCProspect?.createdAt ?? null,
            },
            counts: {
              total: totalFromMC,
              today: todayFromMC,
              thisWeek: weekFromMC,
            },
            typeDistribution: typeDistribution.map((t) => ({
              type: t.sourceContactType,
              count: t._count._all,
            })),
            categoryDistribution: categoryDistribution.map((c) => ({
              category: c.category,
              count: c._count._all,
            })),
            enrichmentStatus: enrichmentStatus.reduce(
              (acc, e) => {
                acc[e.status] = e._count._all;
                return acc;
              },
              {} as Record<string, number>,
            ),
            recentContacts,
          };
        },
      );

      return reply.send({ data });
    },
  );

  // ───── GET /campaigns ─── Campaign performance statistics ───────
  app.get(
    "/campaigns",
    async (request: FastifyRequest<{
      Querystring: {
        campaignId?: string;
        startDate?: string;
        endDate?: string;
      };
    }>, reply: FastifyReply) => {
      const { campaignId, startDate, endDate } = request.query;

      // Date range filtering
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      // If specific campaign requested
      if (campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: parseInt(campaignId) },
          include: {
            tags: {
              include: { tag: true },
            },
            _count: {
              select: { enrollments: true },
            },
          },
        });

        if (!campaign) {
          return reply.status(404).send({ error: 'Campaign not found' });
        }

        // Get detailed stats for this campaign
        const enrollments = await prisma.enrollment.findMany({
          where: { campaignId: parseInt(campaignId) },
          include: {
            prospect: {
              include: {
                events: {
                  where: Object.keys(dateFilter).length > 0
                    ? { createdAt: dateFilter }
                    : undefined,
                },
              },
            },
          },
        });

        // Calculate metrics
        let emailsSent = 0;
        let delivered = 0;
        let bounces = 0;
        let opens = 0;
        let clicks = 0;
        let replies = 0;
        let unsubscribes = 0;

        for (const enrollment of enrollments) {
          const events = enrollment.prospect.events;

          emailsSent += events.filter(e => e.eventType === 'email_sent').length;
          delivered += events.filter(e => e.eventType === 'delivered').length;
          bounces += events.filter(e =>
            ['bounce', 'hard_bounce', 'soft_bounce'].includes(e.eventType)
          ).length;
          opens += events.filter(e => e.eventType === 'email_opened').length;
          clicks += events.filter(e => e.eventType === 'link_clicked').length;
          replies += events.filter(e => e.eventType === 'reply_received').length;
          unsubscribes += events.filter(e => e.eventType === 'unsubscribed').length;
        }

        // Calculate rates
        const deliveryRate = emailsSent > 0 ? (delivered / emailsSent) * 100 : 0;
        const bounceRate = emailsSent > 0 ? (bounces / emailsSent) * 100 : 0;
        const openRate = delivered > 0 ? (opens / delivered) * 100 : 0;
        const clickRate = opens > 0 ? (clicks / opens) * 100 : 0;
        const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;

        return reply.send({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            language: campaign.language,
            isActive: campaign.isActive,
            tags: campaign.tags.map(ct => ct.tag),
          },
          metrics: {
            totalEnrolled: campaign._count.enrollments,
            emailsSent,
            delivered,
            bounces,
            opens,
            clicks,
            replies,
            unsubscribes,
          },
          rates: {
            deliveryRate: Math.round(deliveryRate * 100) / 100,
            bounceRate: Math.round(bounceRate * 100) / 100,
            openRate: Math.round(openRate * 100) / 100,
            clickRate: Math.round(clickRate * 100) / 100,
            replyRate: Math.round(replyRate * 100) / 100,
          },
        });
      }

      // Otherwise, return stats for all campaigns
      const campaigns = await prisma.campaign.findMany({
        include: {
          tags: {
            include: { tag: true },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const campaignsStats = await Promise.all(
        campaigns.map(async (campaign) => {
          // Get event counts for this campaign's enrollments
          const enrollments = await prisma.enrollment.findMany({
            where: { campaignId: campaign.id },
            select: { prospectId: true },
          });

          const prospectIds = enrollments.map(e => e.prospectId);

          if (prospectIds.length === 0) {
            return {
              id: campaign.id,
              name: campaign.name,
              language: campaign.language,
              isActive: campaign.isActive,
              tags: campaign.tags.map(ct => ct.tag),
              enrolled: 0,
              sent: 0,
              replied: 0,
              won: 0,
              replyRate: 0,
            };
          }

          const whereEvents: any = {
            prospectId: { in: prospectIds },
          };
          if (Object.keys(dateFilter).length > 0) {
            whereEvents.createdAt = dateFilter;
          }

          const [sent, replied] = await Promise.all([
            prisma.event.count({
              where: { ...whereEvents, eventType: 'email_sent' },
            }),
            prisma.event.count({
              where: { ...whereEvents, eventType: 'reply_received' },
            }),
          ]);

          const replyRate = sent > 0 ? (replied / sent) * 100 : 0;

          return {
            id: campaign.id,
            name: campaign.name,
            language: campaign.language,
            isActive: campaign.isActive,
            tags: campaign.tags.map(ct => ct.tag),
            enrolled: campaign._count.enrollments,
            sent,
            replied: campaign.totalReplied,
            won: campaign.totalWon,
            replyRate: Math.round(replyRate * 100) / 100,
          };
        })
      );

      return reply.send({
        campaigns: campaignsStats,
        total: campaigns.length,
      });
    },
  );
}
