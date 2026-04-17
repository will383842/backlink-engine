// ---------------------------------------------------------------------------
// Mailbox Monitor API — stats aggregated per sending inbox (presse@*)
// ---------------------------------------------------------------------------
// Route: GET /api/mailbox/stats?days=7
//   → per-inbox KPIs: sent, delivered, opens, bounces, complaints, replies
//
// Route: GET /api/mailbox/timeline?days=30
//   → daily counts per inbox for chart rendering
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser } from "../middleware/auth.js";

// The 5 presse@ inboxes we track. Kept in code since domainRotator defaults
// aren't always persisted per SentEmail.
const TRACKED_INBOXES = [
  "presse@hub-travelers.com",
  "presse@plane-liberty.com",
  "presse@planevilain.com",
  "presse@emilia-mullerd.com",
  "presse@providers-expat.com",
];

interface InboxStat {
  fromEmail: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  health: "good" | "warning" | "bad" | "unknown";
}

function computeHealth(s: Omit<InboxStat, "health">): InboxStat["health"] {
  if (s.sent < 5) return "unknown";
  if (s.bounceRate > 5 || s.complained > 0) return "bad";
  if (s.openRate >= 25) return "good";
  if (s.openRate >= 15) return "warning";
  return "bad";
}

export default async function mailboxRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET /stats ─── per-inbox aggregated KPIs ─────────────
  app.get<{ Querystring: { days?: string } }>(
    "/stats",
    async (request: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply) => {
      const days = Math.min(90, Math.max(1, parseInt(request.query.days || "7", 10) || 7));
      const since = new Date();
      since.setDate(since.getDate() - days);

      const results: InboxStat[] = await Promise.all(
        TRACKED_INBOXES.map(async (fromEmail): Promise<InboxStat> => {
          const where = { fromEmail, sentAt: { gte: since } };

          const [sent, delivered, opened, clicked, bounced, hardBounced, complained] =
            await Promise.all([
              prisma.sentEmail.count({ where }).catch(() => 0),
              prisma.sentEmail
                .count({
                  where: {
                    ...where,
                    status: { in: ["delivered", "opened", "clicked"] },
                  },
                })
                .catch(() => 0),
              prisma.sentEmail
                .count({ where: { ...where, openCount: { gt: 0 } } })
                .catch(() => 0),
              prisma.sentEmail
                .count({ where: { ...where, clickCount: { gt: 0 } } })
                .catch(() => 0),
              prisma.sentEmail
                .count({ where: { ...where, status: "bounced" } })
                .catch(() => 0),
              prisma.sentEmail
                .count({ where: { ...where, bounceType: "hard" } })
                .catch(() => 0),
              prisma.sentEmail
                .count({ where: { ...where, complainedAt: { not: null } } })
                .catch(() => 0),
            ]);

          const openRate = sent > 0 ? (opened / sent) * 100 : 0;
          const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
          const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

          const base: Omit<InboxStat, "health"> = {
            fromEmail,
            sent,
            delivered,
            opened,
            clicked,
            bounced,
            hardBounced,
            complained,
            openRate: Math.round(openRate * 10) / 10,
            clickRate: Math.round(clickRate * 10) / 10,
            bounceRate: Math.round(bounceRate * 10) / 10,
          };

          return { ...base, health: computeHealth(base) };
        }),
      );

      // Totals across all inboxes
      const totals = results.reduce(
        (acc, r) => ({
          sent: acc.sent + r.sent,
          delivered: acc.delivered + r.delivered,
          opened: acc.opened + r.opened,
          clicked: acc.clicked + r.clicked,
          bounced: acc.bounced + r.bounced,
          complained: acc.complained + r.complained,
        }),
        { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 },
      );

      const globalOpenRate = totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0;

      return reply.send({
        data: {
          inboxes: results,
          totals: {
            ...totals,
            openRate: Math.round(globalOpenRate * 10) / 10,
          },
          period: { days, since: since.toISOString() },
        },
      });
    },
  );

  // ───── GET /timeline ─── daily sends/opens per inbox ─────────
  app.get<{ Querystring: { days?: string } }>(
    "/timeline",
    async (request, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(request.query.days || "14", 10) || 14));
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const rows = await prisma.$queryRawUnsafe<
        Array<{ day: string; from_email: string; sent: bigint; opened: bigint }>
      >(
        `
        SELECT
          date_trunc('day', "sentAt")::date::text AS day,
          "fromEmail"                              AS from_email,
          COUNT(*)::bigint                         AS sent,
          SUM(CASE WHEN "openCount" > 0 THEN 1 ELSE 0 END)::bigint AS opened
        FROM sent_emails
        WHERE "sentAt" >= $1 AND "fromEmail" IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `,
        since,
      ).catch(() => []);

      const timeline = rows.map((r) => ({
        day: r.day,
        fromEmail: r.from_email,
        sent: Number(r.sent),
        opened: Number(r.opened),
      }));

      return reply.send({
        data: { timeline, period: { days, since: since.toISOString() } },
      });
    },
  );
}
