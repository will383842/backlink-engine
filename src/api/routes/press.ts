/**
 * Press outreach API routes — 2026-04-22 (brand entity Vague 4.3)
 *
 * Endpoints:
 *   POST   /api/press/outreach/start       Enqueue initial sends for a batch
 *   POST   /api/press/reply-received       Webhook called by Mailflow on reply
 *   GET    /api/press/contacts             List contacts with filters
 *   PATCH  /api/press/contacts/:id         Update (article_url, status, notes)
 *   POST   /api/press/contacts             Create one contact
 *   POST   /api/press/contacts/bulk        Bulk import JSON array
 *   GET    /api/press/stats                Aggregated dashboard stats
 *   POST   /api/press/verify-inboxes       Health check SMTP inboxes
 */
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { PressContactStatus, PressLang, PressAngle, ProspectCategory } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { pressOutreachQueue } from "../../jobs/queue.js";
import { verifyPressInboxes } from "../../services/press/sender.js";
import {
  renderPitchEmail,
  invalidateTemplatesCache,
  PRESS_PITCH_TEMPLATES_KEY,
} from "../../services/press/pitchRenderer.js";
import { EMBEDDED_PITCHES } from "../../services/press/templates/pitches.js";
import { createChildLogger } from "../../utils/logger.js";
import { sendTelegramMessage } from "../../services/notifications/telegramService.js";

const log = createChildLogger("press-api");

export async function pressRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // -------------------------------------------------------------------------
  // POST /api/press/outreach/start
  // Enqueue initial press pitches for contacts matching a filter.
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: {
      lang?: PressLang;
      angle?: PressAngle;
      status?: PressContactStatus;
      campaignTag?: string;
      limit?: number;
      dryRun?: boolean;
    };
  }>("/api/press/outreach/start", async (request, reply) => {
    const { lang, angle, status, campaignTag, limit, dryRun } = request.body;

    const contacts = await prisma.pressContact.findMany({
      where: {
        ...(lang && { lang }),
        ...(angle && { angle }),
        status: status ?? PressContactStatus.PENDING,
      },
      take: limit ?? 200,
      orderBy: { mediaDr: "desc" }, // prioritize high-DR media
    });

    if (dryRun) {
      return reply.send({
        dryRun: true,
        wouldEnqueue: contacts.length,
        sample: contacts.slice(0, 5).map((c) => ({ id: c.id, media: c.mediaName, lang: c.lang })),
      });
    }

    let enqueued = 0;
    for (const contact of contacts) {
      await pressOutreachQueue.add(
        `initial:${contact.id}`,
        { contactId: contact.id, template: "initial", campaignTag },
        {
          // Stagger 2-6 seconds between sends to avoid rate-limiting at the
          // SMTP server level (even with 5 rotating inboxes)
          delay: enqueued * (2000 + Math.floor(Math.random() * 4000)),
        },
      );
      enqueued++;
    }

    log.info({ enqueued, lang, angle, campaignTag }, "Press outreach batch enqueued");
    return reply.send({ enqueued, totalMatched: contacts.length });
  });

  // -------------------------------------------------------------------------
  // POST /api/press/reply-received
  // Called by Mailflow `/opt/mail-forwarder` when a reply is detected
  // in any presse@* inbox.
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: {
      from: string;
      subject: string;
      body?: string;
      contactId?: string; // optional if Mailflow extracts X-Press-Contact-Id
      messageHeaders?: Record<string, string>;
    };
  }>("/api/press/reply-received", async (request, reply) => {
    const { from, subject, body: emailBody, contactId, messageHeaders } = request.body;

    // Try to match by explicit contact ID (from X-Press-Contact-Id header)
    let contact = contactId
      ? await prisma.pressContact.findUnique({ where: { id: contactId } })
      : null;

    // Fallback: match by sender email address
    if (!contact) {
      contact = await prisma.pressContact.findUnique({ where: { email: from } });
    }

    if (!contact) {
      log.warn({ from, subject }, "Reply received but no matching PressContact");
      return reply.code(404).send({ error: "contact_not_found", from });
    }

    await prisma.pressContact.update({
      where: { id: contact.id },
      data: {
        respondedAt: new Date(),
        status: PressContactStatus.RESPONDED,
        notes: `[AUTO] Reply: ${subject}${emailBody ? `\n---\n${emailBody.slice(0, 2000)}` : ""}`,
      },
    });

    // Cancel pending follow-ups in BullMQ
    const delayedJobs = await pressOutreachQueue.getJobs(["delayed"]);
    for (const job of delayedJobs) {
      if (job.data.contactId === contact.id) {
        await job.remove();
        log.info({ jobId: job.id, contactId: contact.id }, "Removed pending follow-up");
      }
    }

    // Telegram notification via existing bot (@sosexpat_admin_bot).
    // Reuses the same telegram_notifications AppSetting row as the rest of
    // the Backlink Engine (bot token + default chat id configured via admin UI).
    try {
      const telegramSetting = await prisma.appSetting.findUnique({
        where: { key: "telegram_notifications" },
      });
      const cfg = telegramSetting?.value as
        | { enabled?: boolean; botToken?: string; chatId?: string; pressChatId?: string }
        | undefined;

      if (cfg?.enabled && cfg.botToken) {
        const pressChatId = cfg.pressChatId ?? cfg.chatId ?? process.env.TELEGRAM_PRESS_CHAT_ID ?? "7560535072";
        const message = [
          `📰 <b>Nouvelle réponse presse</b> — ${contact.mediaName}`,
          `Langue : ${contact.lang.toUpperCase()} · Angle : ${contact.angle}`,
          `De : ${from}`,
          `Sujet : ${subject}`,
          emailBody
            ? `\n<blockquote>${emailBody.slice(0, 300).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c)}${emailBody.length > 300 ? "…" : ""}</blockquote>`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
        await sendTelegramMessage(cfg.botToken, pressChatId, message, "HTML");
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "Telegram notification failed (non-blocking)");
    }

    return reply.send({ ok: true, contactId: contact.id });
  });

  // -------------------------------------------------------------------------
  // GET /api/press/contacts
  // List with filters.
  // -------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      lang?: PressLang;
      angle?: PressAngle;
      status?: PressContactStatus;
      page?: string;
      limit?: string;
    };
  }>("/api/press/contacts", async (request, reply) => {
    const page = Number(request.query.page ?? 1);
    const limit = Math.min(Number(request.query.limit ?? 50), 200);

    const where = {
      ...(request.query.lang && { lang: request.query.lang }),
      ...(request.query.angle && { angle: request.query.angle }),
      ...(request.query.status && { status: request.query.status }),
    };

    const [contacts, total] = await Promise.all([
      prisma.pressContact.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.pressContact.count({ where }),
    ]);

    return reply.send({ contacts, total, page, limit });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/press/contacts/:id
  // Update status / article_url / notes (manual intervention).
  // -------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: {
      status?: PressContactStatus;
      articleUrl?: string;
      publishedAt?: string;
      notes?: string;
    };
  }>("/api/press/contacts/:id", async (request, reply) => {
    const updated = await prisma.pressContact.update({
      where: { id: request.params.id },
      data: {
        ...(request.body.status && { status: request.body.status }),
        ...(request.body.articleUrl && { articleUrl: request.body.articleUrl }),
        ...(request.body.publishedAt && { publishedAt: new Date(request.body.publishedAt) }),
        ...(request.body.notes && { notes: request.body.notes }),
      },
    });
    return reply.send(updated);
  });

  // -------------------------------------------------------------------------
  // POST /api/press/contacts
  // Create a single contact.
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: {
      email: string;
      mediaName: string;
      lang: PressLang;
      angle: PressAngle;
      firstName?: string;
      lastName?: string;
      mediaUrl?: string;
      mediaDr?: number;
      market?: string;
    };
  }>("/api/press/contacts", async (request, reply) => {
    const created = await prisma.pressContact.create({
      data: request.body,
    });
    return reply.code(201).send(created);
  });

  // -------------------------------------------------------------------------
  // POST /api/press/contacts/bulk
  // Bulk import (upsert by email).
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: {
      contacts: Array<{
        email: string;
        mediaName: string;
        lang: PressLang;
        angle: PressAngle;
        firstName?: string;
        lastName?: string;
        mediaUrl?: string;
        mediaDr?: number;
        market?: string;
      }>;
    };
  }>("/api/press/contacts/bulk", async (request, reply) => {
    let upserted = 0;
    for (const c of request.body.contacts) {
      await prisma.pressContact.upsert({
        where: { email: c.email },
        create: c,
        update: {
          mediaName: c.mediaName,
          mediaUrl: c.mediaUrl,
          mediaDr: c.mediaDr,
          lang: c.lang,
          angle: c.angle,
          market: c.market,
          firstName: c.firstName,
          lastName: c.lastName,
        },
      });
      upserted++;
    }
    return reply.send({ upserted, total: request.body.contacts.length });
  });

  // -------------------------------------------------------------------------
  // GET /api/press/stats
  // Dashboard aggregates.
  // -------------------------------------------------------------------------
  fastify.get("/api/press/stats", async (_request, reply) => {
    const [byStatus, byLang, byAngle, totalArticles] = await Promise.all([
      prisma.pressContact.groupBy({ by: ["status"], _count: true }),
      prisma.pressContact.groupBy({ by: ["lang"], _count: true }),
      prisma.pressContact.groupBy({ by: ["angle"], _count: true }),
      prisma.pressContact.count({ where: { articleUrl: { not: null } } }),
    ]);

    return reply.send({
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byLang: Object.fromEntries(byLang.map((l) => [l.lang, l._count])),
      byAngle: Object.fromEntries(byAngle.map((a) => [a.angle, a._count])),
      totalArticles,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/press/verify-inboxes
  // Test SMTP health on all configured presse@* inboxes.
  // -------------------------------------------------------------------------
  fastify.post("/api/press/verify-inboxes", async (_request, reply) => {
    const results = await verifyPressInboxes();
    return reply.send(results);
  });

  // -------------------------------------------------------------------------
  // GET /api/press/templates
  // Return all 9 press pitch templates (rendered with placeholder values) so
  // the admin can review each language before launching the campaign.
  // -------------------------------------------------------------------------
  fastify.get<{
    Querystring: { angle?: PressAngle; template?: "initial" | "follow_up_1" | "follow_up_2" };
  }>("/api/press/templates", async (request, reply) => {
    const angle = request.query.angle ?? "launch";
    const template = request.query.template ?? "initial";
    const langs: PressLang[] = ["fr", "en", "es", "de", "pt", "ru", "zh", "hi", "ar", "et"];

    const rendered = await Promise.all(
      langs.map(async (lang) => {
        const pitch = await renderPitchEmail({
          lang,
          angle,
          template,
          firstName: "[Prénom Journaliste]",
          mediaName: "[Nom du média]",
          mediaUrl: null,
        });
        return {
          lang,
          subject: pitch.subject,
          text: pitch.text,
          html: pitch.html,
          pdfUrl: pitch.pdfUrl,
        };
      }),
    );

    return reply.send({ angle, template, templates: rendered });
  });

  // -------------------------------------------------------------------------
  // GET /api/press/templates/raw
  // Returns the raw pitch bodies (embedded + DB overrides) so the admin UI
  // can prefill its edit forms.  Each entry has `lang`, `body`, and
  // `source` ("db" = overridden, "embedded" = default).
  // -------------------------------------------------------------------------
  fastify.get("/api/press/templates/raw", async (_request, reply) => {
    const langs: PressLang[] = ["fr", "en", "es", "de", "pt", "ru", "zh", "hi", "ar", "et"];
    const setting = await prisma.appSetting.findUnique({
      where: { key: PRESS_PITCH_TEMPLATES_KEY },
    });
    const overrides = (setting?.value ?? {}) as Partial<Record<PressLang, string>>;

    const items = langs.map((lang) => {
      const dbBody = overrides[lang];
      return {
        lang,
        body: typeof dbBody === "string" && dbBody.length > 0 ? dbBody : EMBEDDED_PITCHES[lang],
        source: typeof dbBody === "string" && dbBody.length > 0 ? ("db" as const) : ("embedded" as const),
        embeddedBody: EMBEDDED_PITCHES[lang],
      };
    });

    return reply.send({ templates: items });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/press/templates/:lang
  // Updates the pitch body for ONE language.  Stored as an AppSetting
  // override so the embedded defaults stay available in case of rollback.
  // Body can be empty string "" to reset the override (fall back to
  // embedded template).
  // -------------------------------------------------------------------------
  fastify.patch<{
    Params: { lang: string };
    Body: { body: string };
  }>("/api/press/templates/:lang", async (request, reply) => {
    const validLangs: PressLang[] = ["fr", "en", "es", "de", "pt", "ru", "zh", "hi", "ar", "et"];
    const lang = request.params.lang as PressLang;
    if (!validLangs.includes(lang)) {
      return reply.code(400).send({ error: "invalid_lang", validLangs });
    }

    const { body } = request.body;
    if (typeof body !== "string") {
      return reply.code(400).send({ error: "body_must_be_string" });
    }

    const existing = await prisma.appSetting.findUnique({
      where: { key: PRESS_PITCH_TEMPLATES_KEY },
    });
    const current = (existing?.value ?? {}) as Partial<Record<PressLang, string>>;

    if (body.trim().length === 0) {
      // Reset = remove override → revert to embedded
      delete current[lang];
    } else {
      current[lang] = body;
    }

    await prisma.appSetting.upsert({
      where: { key: PRESS_PITCH_TEMPLATES_KEY },
      create: { key: PRESS_PITCH_TEMPLATES_KEY, value: current as object },
      update: { value: current as object },
    });

    invalidateTemplatesCache();
    log.info({ lang, bodyLength: body.length }, "Press pitch template updated");

    return reply.send({
      lang,
      source: body.trim().length === 0 ? "embedded" : "db",
      bodyLength: body.length,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/press/sync-from-prospects
  // Imports existing Prospect rows (category=media OR sourceContactType
  // matching presse/journaliste/media) into PressContact.  Dry-run by default.
  // Set { confirm: true, wipeExisting: true } to replace the current set.
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: { confirm?: boolean; wipeExisting?: boolean };
  }>("/api/press/sync-from-prospects", async (request, reply) => {
    const { confirm = false, wipeExisting = false } = request.body ?? {};

    const prospects = await prisma.prospect.findMany({
      where: {
        OR: [
          { category: ProspectCategory.media },
          { sourceContactType: { in: ["presse", "journaliste", "journalist", "media"] } },
        ],
      },
      include: {
        contacts: {
          where: { optedOut: false },
          orderBy: { id: "asc" },
          take: 1,
        },
      },
    });

    const candidates = prospects
      .filter((p) => p.contacts.length > 0)
      .map((p) => {
        const contact = p.contacts[0];
        const langRaw = (p.language ?? "en").toLowerCase();
        const validLangs: PressLang[] = ["fr", "en", "es", "de", "pt", "ru", "zh", "hi", "ar", "et"];
        const lang = (validLangs.includes(langRaw as PressLang) ? langRaw : "en") as PressLang;
        const angle: PressAngle = (p.sourceContactType ?? "").toLowerCase().includes("juridi")
          ? "ymyl"
          : "launch";
        return {
          prospectId: p.id,
          email: contact.email.toLowerCase().trim(),
          mediaName: p.homepageTitle ?? p.domain,
          mediaUrl: `https://${p.domain}`,
          mediaDr: p.mozDa ?? null,
          lang,
          angle,
          firstName: contact.firstName ?? null,
          lastName: contact.lastName ?? null,
          market: p.country ?? null,
        };
      });

    if (!confirm) {
      return reply.send({
        dryRun: true,
        prospectsMatched: prospects.length,
        withContact: candidates.length,
        byLang: candidates.reduce<Record<string, number>>((acc, c) => {
          acc[c.lang] = (acc[c.lang] ?? 0) + 1;
          return acc;
        }, {}),
        sample: candidates.slice(0, 10).map((c) => ({
          email: c.email,
          media: c.mediaName,
          lang: c.lang,
          angle: c.angle,
        })),
      });
    }

    let deleted = 0;
    if (wipeExisting) {
      const result = await prisma.pressContact.deleteMany({
        where: { status: PressContactStatus.PENDING },
      });
      deleted = result.count;
    }

    let upserted = 0;
    for (const c of candidates) {
      await prisma.pressContact.upsert({
        where: { email: c.email },
        create: {
          email: c.email,
          mediaName: c.mediaName,
          mediaUrl: c.mediaUrl,
          mediaDr: c.mediaDr ?? undefined,
          lang: c.lang,
          angle: c.angle,
          firstName: c.firstName ?? undefined,
          lastName: c.lastName ?? undefined,
          market: c.market ?? undefined,
          notes: `[imported from prospect #${c.prospectId}]`,
        },
        update: {
          mediaName: c.mediaName,
          mediaUrl: c.mediaUrl,
          mediaDr: c.mediaDr ?? undefined,
          lang: c.lang,
          angle: c.angle,
          firstName: c.firstName ?? undefined,
          lastName: c.lastName ?? undefined,
          market: c.market ?? undefined,
        },
      });
      upserted++;
    }

    log.info({ deleted, upserted, wipeExisting }, "Sync prospects → press_contacts done");
    return reply.send({ deleted, upserted, total: candidates.length });
  });
}
