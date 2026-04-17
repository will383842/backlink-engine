// ---------------------------------------------------------------------------
// Tracking API — public pixel tracking for email opens
// ---------------------------------------------------------------------------
// Route: GET /api/track/open/:id.gif → returns 1x1 transparent GIF and updates
//   sent_emails.openCount + sent_emails.firstOpenedAt atomically.
// No authentication — must be reachable by recipient email clients.
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("tracking");

// 1x1 transparent GIF (43 bytes)
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// Bot User-Agents that pre-fetch pixels (Apple Mail Privacy Protection,
// Google image proxies, anti-phishing scanners). We still serve the pixel
// but don't count them as real opens.
const BOT_UA_PATTERNS = [
  /GoogleImageProxy/i,
  /AppleMailPrivacyProxy/i,
  /CloudMailIn/i,
  /barracuda/i,
  /mimecast/i,
  /proofpoint/i,
  /mailscanner/i,
  /Symantec/i,
];

function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

export default async function trackingRoutes(app: FastifyInstance): Promise<void> {
  // ───── GET /open/:id.gif ─── Pixel open tracker ─────────────
  app.get<{ Params: { id: string } }>(
    "/open/:id.gif",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      // Always return the pixel, whatever happens. Never block email rendering.
      reply
        .header("Content-Type", "image/gif")
        .header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        .header("Pragma", "no-cache")
        .header("Expires", "0")
        .header("Content-Length", PIXEL_GIF.length);

      try {
        const id = parseInt(request.params.id.replace(/\.gif$/, ""), 10);
        if (Number.isFinite(id) && id > 0) {
          const ua = request.headers["user-agent"];
          const isBot = isBotUserAgent(ua);

          if (!isBot) {
            // Update atomically. Don't await DB failure: serve the pixel anyway.
            prisma.sentEmail
              .update({
                where: { id },
                data: {
                  openCount: { increment: 1 },
                  firstOpenedAt: { set: new Date() }, // overwritten only if null via the filter below
                  status: "opened",
                },
              })
              .catch(async () => {
                // fallback: only set firstOpenedAt if currently null
                await prisma.sentEmail
                  .updateMany({
                    where: { id, firstOpenedAt: null },
                    data: { firstOpenedAt: new Date() },
                  })
                  .catch(() => void 0);
              });

            // Log Event for history
            prisma.sentEmail
              .findUnique({ where: { id }, select: { prospectId: true, contactId: true, enrollmentId: true } })
              .then((se) => {
                if (!se) return;
                return prisma.event.create({
                  data: {
                    prospectId: se.prospectId,
                    contactId: se.contactId,
                    enrollmentId: se.enrollmentId,
                    eventType: "email_opened",
                    eventSource: "tracking_pixel",
                    data: {
                      sentEmailId: id,
                      userAgent: ua ?? null,
                      ip: request.ip,
                    },
                  },
                });
              })
              .catch(() => void 0);
          } else {
            log.debug({ id, ua }, "Bot-fetched pixel, not counted as open");
          }
        }
      } catch (err) {
        log.warn({ err: String(err) }, "tracking pixel handler failed (pixel still served)");
      }

      return reply.send(PIXEL_GIF);
    },
  );

  // ───── GET /click/:id ─── Click tracker + redirect ──────────
  app.get<{ Params: { id: string }; Querystring: { url?: string } }>(
    "/click/:id",
    async (request, reply) => {
      const url = request.query.url;
      if (!url || !/^https?:\/\//i.test(url)) {
        return reply.code(400).send({ error: "invalid url" });
      }

      try {
        const id = parseInt(request.params.id, 10);
        if (Number.isFinite(id) && id > 0) {
          prisma.sentEmail
            .update({
              where: { id },
              data: {
                clickCount: { increment: 1 },
                firstClickedAt: { set: new Date() },
                status: "clicked",
              },
            })
            .catch(() => void 0);
        }
      } catch {
        /* non-blocking */
      }

      return reply.redirect(url, 302);
    },
  );
}
