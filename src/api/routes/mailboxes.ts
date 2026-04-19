// ---------------------------------------------------------------------------
// Mailboxes API — unified view of all VPS mailboxes + compose/reply via SMTP
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/auth.js";
import { MAILBOXES, listMessages, getMessage } from "../../services/mailbox/maildirReader.js";
import { sendViaSMTP } from "../../services/outreach/smtpSender.js";
import { getSendingDomains } from "../../services/outreach/domainRotator.js";
import { createChildLogger } from "../../utils/logger.js";

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

  // ───── GET /:address/messages ─── List last 50 messages ───────
  app.get<{ Params: { address: string }; Querystring: { limit?: string } }>(
    "/:address/messages",
    async (request, reply) => {
      const address = decodeURIComponent(request.params.address);
      const limit = Math.min(parseInt(request.query.limit ?? "50", 10) || 50, 200);
      try {
        const messages = await listMessages(address, limit);
        return reply.send({ data: messages });
      } catch (err) {
        log.error({ err, address }, "Failed to list messages");
        return reply.status(500).send({ error: "failed_to_list", message: String(err) });
      }
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
