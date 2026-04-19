// ---------------------------------------------------------------------------
// Mailboxes API — unified view of all VPS mailboxes + compose/reply via SMTP
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/auth.js";
import { MAILBOXES, listMessages, getMessage } from "../../services/mailbox/maildirReader.js";
import { sendViaSMTP } from "../../services/outreach/smtpSender.js";
import { getSendingDomains } from "../../services/outreach/domainRotator.js";
import { redis } from "../../config/redis.js";
import { createChildLogger } from "../../utils/logger.js";

// Soft-delete state lives in Redis so we don't need to touch Maildir files
// (which are owned by local mail users and outside the container's write
// access). Key: `mailbox:trash:<address>` — a SET of message IDs. TTL 30d
// auto-purges so the trash doesn't grow forever.
const TRASH_KEY = (address: string) => `mailbox:trash:${address}`;
const TRASH_TTL_SEC = 30 * 24 * 60 * 60;

async function getTrashSet(address: string): Promise<Set<string>> {
  const ids = await redis.smembers(TRASH_KEY(address));
  return new Set(ids);
}

const log = createChildLogger("mailboxes-api");

export default async function mailboxesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List available mailboxes ─────────────────────
  app.get("/", async (_request, reply) => {
    // Cross-check MAILBOXES with the configured sending_domains so the UI
    // can warn the admin when a mailbox has no active sending domain
    // (compose would fail because domainRotator wouldn't offer the match).
    const sendingDomains = await getSendingDomains();
    const sendingDomainSet = new Set(sendingDomains.map((d) => d.domain));

    const enriched = MAILBOXES.map((mb) => {
      const domain = mb.address.split("@")[1] ?? "";
      return {
        address: mb.address,
        localUser: mb.localUser,
        label: mb.label,
        canSend: sendingDomainSet.has(domain),
      };
    });

    return reply.send({ data: enriched });
  });

  // ───── GET /:address/messages ─── List messages ───────────────
  //
  // ?folder=inbox (default) excludes soft-deleted IDs.
  // ?folder=trash returns ONLY soft-deleted IDs.
  app.get<{
    Params: { address: string };
    Querystring: { limit?: string; folder?: "inbox" | "trash" };
  }>(
    "/:address/messages",
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const limit = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 200);
      const folder = request.query.folder ?? "inbox";
      try {
        const messages = await listMessages(address, 200);
        const trash = await getTrashSet(address);
        const filtered =
          folder === "trash"
            ? messages.filter((m) => trash.has(m.id))
            : messages.filter((m) => !trash.has(m.id));
        return reply.send({ data: filtered.slice(0, limit) });
      } catch (err) {
        log.error({ err, address }, "Failed to list messages");
        return reply.status(500).send({ error: "failed_to_list", message: String(err) });
      }
    },
  );

  // ───── POST /:address/messages/:id/delete ─── Soft delete ─────
  app.post<{ Params: { address: string; id: string } }>(
    "/:address/messages/:id/delete",
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const id = request.params.id;
      await redis.sadd(TRASH_KEY(address), id);
      await redis.expire(TRASH_KEY(address), TRASH_TTL_SEC);
      return reply.send({ data: { address, id, deleted: true } });
    },
  );

  // ───── POST /:address/messages/:id/restore ─── Un-delete ──────
  app.post<{ Params: { address: string; id: string } }>(
    "/:address/messages/:id/restore",
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const id = request.params.id;
      await redis.srem(TRASH_KEY(address), id);
      return reply.send({ data: { address, id, restored: true } });
    },
  );

  // ───── GET /:address/messages/:id ─── Full message detail ─────
  app.get<{ Params: { address: string; id: string } }>(
    "/:address/messages/:id",
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const id = request.params.id;
      try {
        const detail = await getMessage(address, id);
        if (!detail) return reply.status(404).send({ error: "not_found" });
        return reply.send({ data: detail });
      } catch (err) {
        log.error({ err, address, id }, "Failed to read message");
        return reply.status(500).send({ error: "failed_to_read", message: String(err) });
      }
    },
  );

  // ───── POST /:address/send ─── Compose + send from this mailbox ─
  //
  // The request specifies the FROM mailbox (via URL) and the destination +
  // body. We re-use the SMTP direct pipeline that campaigns go through, so
  // Postfix signs with OpenDKIM, PMTA routes, and the whole tracking stack
  // is identical to outreach emails. `inReplyTo` + `references` are wired
  // so threaded replies keep their Gmail/Apple Mail thread intact.
  app.post<{
    Params: { address: string };
    Body: {
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
      cc?: string;
      bcc?: string;
    };
  }>(
    "/:address/send",
    {
      schema: {
        body: {
          type: "object",
          required: ["to", "subject", "body"],
          properties: {
            to: { type: "string", minLength: 3 },
            subject: { type: "string" },
            body: { type: "string" },
            inReplyTo: { type: "string" },
            references: { type: "string" },
            cc: { type: "string" },
            bcc: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const mb = MAILBOXES.find((m) => m.address === address);
      if (!mb) {
        return reply.status(404).send({ error: "unknown_mailbox" });
      }

      const domain = mb.address.split("@")[1] ?? "";
      const sendingDomains = await getSendingDomains();
      const match = sendingDomains.find((d) => d.domain === domain);
      if (!match) {
        return reply.status(400).send({
          error: "no_sending_domain",
          message: `No active sending domain configured for ${domain}. Add it in /settings.`,
        });
      }

      const { to, subject, body, inReplyTo, references, cc, bcc } = request.body;

      try {
        const result = await sendViaSMTP({
          toEmail: to,
          fromEmail: match.fromEmail,
          fromName: match.fromName,
          replyTo: match.replyTo,
          subject,
          bodyText: body,
          inReplyTo,
          references,
          cc,
          bcc,
        });

        if (!result.success) {
          return reply.status(502).send({
            error: "smtp_failed",
            message: result.error ?? "SMTP delivery failed",
          });
        }

        return reply.send({
          data: {
            messageId: result.messageId,
            from: match.fromEmail,
            to,
            subject,
          },
        });
      } catch (err) {
        log.error({ err, address }, "Mailbox send failed");
        return reply.status(500).send({ error: "internal", message: String(err) });
      }
    },
  );
}
