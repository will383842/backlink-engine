import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("unsubscribe");

const HMAC_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET || "backlink-engine-unsubscribe-key";

// ---------------------------------------------------------------------------
// Public helpers (used by other modules to generate links)
// ---------------------------------------------------------------------------

/**
 * Generate a signed unsubscribe URL for an email address.
 */
export function generateUnsubscribeUrl(email: string): string {
  const token = crypto.createHmac("sha256", HMAC_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
  const base = process.env.PUBLIC_URL || "https://backlinks.life-expat.com";
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

/**
 * Generate List-Unsubscribe headers for an email.
 */
export function getUnsubscribeHeaders(email: string, fromDomain: string): Record<string, string> {
  const url = generateUnsubscribeUrl(email);
  return {
    "List-Unsubscribe": `<${url}>, <mailto:unsubscribe@${fromDomain}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ---------------------------------------------------------------------------
// Route plugin (public — no auth required)
// ---------------------------------------------------------------------------

export default async function unsubscribeRoutes(app: FastifyInstance): Promise<void> {

  // GET /unsubscribe?email=xxx&token=xxx — One-click unsubscribe (from email link)
  app.get(
    "/unsubscribe",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (
      request: FastifyRequest<{ Querystring: { email?: string; token?: string } }>,
      reply: FastifyReply,
    ) => {
      const { email, token } = request.query;

      if (!email || !token) {
        return reply.status(400).type("text/html").send(errorPage("Lien invalide."));
      }

      // Verify HMAC token
      const expectedToken = crypto.createHmac("sha256", HMAC_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
      if (token !== expectedToken) {
        return reply.status(403).type("text/html").send(errorPage("Lien expire ou invalide."));
      }

      const emailNormalized = email.toLowerCase().trim();

      try {
        // Add to suppression list
        await prisma.suppressionEntry.upsert({
          where: { emailNormalized },
          create: { emailNormalized, reason: "unsubscribed", source: "one_click_unsubscribe" },
          update: {},
        });

        // Mark contact as opted out
        const contact = await prisma.contact.findUnique({ where: { emailNormalized } });
        if (contact) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { optedOut: true, optedOutAt: new Date() },
          });

          // Stop all active enrollments
          await prisma.enrollment.updateMany({
            where: { contactId: contact.id, status: "active" },
            data: { status: "stopped", stoppedReason: "unsubscribed" },
          });
        }

        log.info({ email: emailNormalized }, "Contact unsubscribed via one-click link.");

        return reply.type("text/html").send(successPage(emailNormalized));
      } catch (err) {
        log.error({ err, email: emailNormalized }, "Error processing unsubscribe.");
        return reply.status(500).type("text/html").send(errorPage("Erreur technique. Veuillez reessayer."));
      }
    },
  );

  // POST /unsubscribe — RFC 8058 one-click (List-Unsubscribe-Post)
  app.post(
    "/unsubscribe",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (
      request: FastifyRequest<{ Body: { email?: string; token?: string } | string }>,
      reply: FastifyReply,
    ) => {
      // RFC 8058: body is "List-Unsubscribe=One-Click" or JSON
      const body = typeof request.body === "string" ? {} : (request.body ?? {});
      const email = (body as Record<string, string>).email;
      const token = (body as Record<string, string>).token;

      if (!email || !token) {
        return reply.status(200).send({ status: "ok" }); // ISPs expect 200 even on bad request
      }

      const expectedToken = crypto.createHmac("sha256", HMAC_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
      if (token !== expectedToken) {
        return reply.status(200).send({ status: "ok" });
      }

      const emailNormalized = email.toLowerCase().trim();

      await prisma.suppressionEntry.upsert({
        where: { emailNormalized },
        create: { emailNormalized, reason: "unsubscribed", source: "list_unsubscribe_post" },
        update: {},
      });

      const contact = await prisma.contact.findUnique({ where: { emailNormalized } });
      if (contact) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { optedOut: true, optedOutAt: new Date() },
        });
      }

      log.info({ email: emailNormalized }, "Contact unsubscribed via List-Unsubscribe-Post.");
      return reply.status(200).send({ status: "ok" });
    },
  );
}

// ---------------------------------------------------------------------------
// HTML pages
// ---------------------------------------------------------------------------

function successPage(email: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Desinscription</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;}.card{text-align:center;padding:3rem;border-radius:1rem;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:400px;}.icon{font-size:3rem;margin-bottom:1rem;}p{color:#64748b;margin-top:0.5rem;}</style></head><body><div class="card"><div class="icon">✅</div><h1>Desinscription confirmee</h1><p>${email} ne recevra plus nos emails.</p></div></body></html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Erreur</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;}.card{text-align:center;padding:3rem;border-radius:1rem;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:400px;}.icon{font-size:3rem;margin-bottom:1rem;}p{color:#64748b;margin-top:0.5rem;}</style></head><body><div class="card"><div class="icon">⚠️</div><h1>Erreur</h1><p>${message}</p></div></body></html>`;
}
