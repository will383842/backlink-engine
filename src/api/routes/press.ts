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
import { auditPressContacts } from "../../services/press/emailAudit.js";
import {
  buildPressSchedule,
  getPressWarmupState,
  getPressDailyCap,
  getPressRemainingToday,
  advancePressWarmupDay,
  PRESS_WARMUP_KEY,
} from "../../services/press/pressWarmup.js";
import {
  runPressHealthCheck,
  getAllInboxesHealth,
  getPausedInboxes,
  pauseInbox,
  resumeInbox,
  isPressGloballyPaused,
  setPressGlobalPause,
} from "../../services/press/pressHealthMonitor.js";
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
      /** Bypass warmup scheduler — NOT recommended, used only for tests. */
      ignoreWarmup?: boolean;
    };
  }>("/api/press/outreach/start", async (request, reply) => {
    const { lang, angle, status, campaignTag, limit, dryRun, ignoreWarmup } = request.body;

    const contacts = await prisma.pressContact.findMany({
      where: {
        ...(lang && { lang }),
        ...(angle && { angle }),
        status: status ?? PressContactStatus.PENDING,
      },
      take: limit ?? 2000,
      orderBy: { mediaDr: "desc" }, // prioritize high-DR media
    });

    // Build warmup-aware schedule unless explicitly bypassed
    const schedule = ignoreWarmup ? null : await buildPressSchedule(contacts.length);
    const warmupState = await getPressWarmupState();
    const todayCap = await getPressDailyCap();
    const remainingToday = await getPressRemainingToday();

    if (dryRun) {
      return reply.send({
        dryRun: true,
        wouldEnqueue: contacts.length,
        warmup: {
          currentDay: warmupState.currentDay,
          todayCap,
          remainingToday,
          daysNeeded: schedule?.daysNeeded ?? 1,
          daysBreakdown: schedule?.daysBreakdown ?? [],
        },
        sample: contacts.slice(0, 5).map((c) => ({ id: c.id, media: c.mediaName, lang: c.lang })),
      });
    }

    let enqueued = 0;
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]!;
      let delay: number;
      if (ignoreWarmup) {
        // Legacy staggered behavior: 2-6s between sends
        delay = i * (2000 + Math.floor(Math.random() * 4000));
      } else {
        delay = schedule!.entries[i]!.delayMs;
      }

      await pressOutreachQueue.add(
        `initial:${contact.id}`,
        { contactId: contact.id, template: "initial", campaignTag },
        { delay },
      );
      enqueued++;
    }

    log.info(
      { enqueued, lang, angle, campaignTag, daysNeeded: schedule?.daysNeeded, ignoreWarmup },
      "Press outreach batch enqueued (warmup-aware)",
    );
    return reply.send({
      enqueued,
      totalMatched: contacts.length,
      warmup: {
        currentDay: warmupState.currentDay,
        todayCap,
        daysNeeded: schedule?.daysNeeded ?? 1,
        daysBreakdown: schedule?.daysBreakdown ?? [],
      },
    });
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
  // GET /api/press/contacts/:id/preview
  // Renders the exact email that would be sent (or was sent) to this
  // contact — subject, text, html, pdfUrl — with real placeholder values
  // (firstName, mediaName) so the owner can eyeball it.
  // Query: template=initial|follow_up_1|follow_up_2 (default initial)
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
    Querystring: { template?: "initial" | "follow_up_1" | "follow_up_2" };
  }>("/api/press/contacts/:id/preview", async (request, reply) => {
    const contact = await prisma.pressContact.findUnique({
      where: { id: request.params.id },
    });
    if (!contact) {
      return reply.code(404).send({ error: "contact_not_found" });
    }

    const template = request.query.template ?? "initial";
    const rendered = await renderPitchEmail({
      lang: contact.lang,
      angle: contact.angle,
      template,
      firstName: contact.firstName,
      mediaName: contact.mediaName,
      mediaUrl: contact.mediaUrl,
    });

    return reply.send({
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        mediaName: contact.mediaName,
        mediaUrl: contact.mediaUrl,
        lang: contact.lang,
        angle: contact.angle,
        status: contact.status,
        fromInbox: contact.fromInbox,
        sentAt: contact.sentAt,
      },
      template,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      pdfUrl: rendered.pdfUrl,
    });
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
  // GET /api/press/warmup
  // Current warmup state: day, schedule, today's cap and remaining.
  // -------------------------------------------------------------------------
  fastify.get("/api/press/warmup", async (_request, reply) => {
    const [state, todayCap, remaining] = await Promise.all([
      getPressWarmupState(),
      getPressDailyCap(),
      getPressRemainingToday(),
    ]);
    return reply.send({
      ...state,
      todayCap,
      remainingToday: remaining,
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/press/warmup
  // Update schedule / currentDay / perInboxCap (admin override).
  // -------------------------------------------------------------------------
  fastify.patch<{
    Body: {
      currentDay?: number;
      schedule?: number[];
      perInboxCap?: number;
    };
  }>("/api/press/warmup", async (request, reply) => {
    const current = await getPressWarmupState();
    const next = {
      ...current,
      ...(typeof request.body.currentDay === "number" ? { currentDay: request.body.currentDay } : {}),
      ...(Array.isArray(request.body.schedule) && request.body.schedule.every((n) => typeof n === "number" && n >= 0)
        ? { schedule: request.body.schedule }
        : {}),
      ...(typeof request.body.perInboxCap === "number" ? { perInboxCap: request.body.perInboxCap } : {}),
    };
    await prisma.appSetting.upsert({
      where: { key: PRESS_WARMUP_KEY },
      create: { key: PRESS_WARMUP_KEY, value: next as unknown as object },
      update: { value: next as unknown as object },
    });
    return reply.send(next);
  });

  // -------------------------------------------------------------------------
  // POST /api/press/warmup/advance
  // Force-advance the warmup day by 1 (normally done by daily cron).
  // -------------------------------------------------------------------------
  fastify.post("/api/press/warmup/advance", async (_request, reply) => {
    const result = await advancePressWarmupDay();
    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // POST /api/press/digest/send-now
  // Fire the daily digest Telegram message on demand (for test / early
  // preview).  Normally runs via cron every day at 20:00 UTC.
  // -------------------------------------------------------------------------
  fastify.post("/api/press/digest/send-now", async (_request, reply) => {
    const { sendPressDailyDigest } = await import("../../services/press/pressDailyDigest.js");
    const result = await sendPressDailyDigest();
    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // GET /api/press/health
  // 24h health report per inbox + paused inboxes list + global pause flag.
  // Updated live by the hourly monitor cron.
  // -------------------------------------------------------------------------
  fastify.get("/api/press/health", async (_request, reply) => {
    const [reports, paused, globalPaused] = await Promise.all([
      getAllInboxesHealth(24),
      getPausedInboxes(),
      isPressGloballyPaused(),
    ]);
    return reply.send({ reports, paused, globalPaused });
  });

  // -------------------------------------------------------------------------
  // POST /api/press/health/check-now
  // Trigger the hourly monitor on-demand (used by the admin UI "Refresh").
  // -------------------------------------------------------------------------
  fastify.post("/api/press/health/check-now", async (_request, reply) => {
    const result = await runPressHealthCheck();
    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // POST /api/press/pause and /api/press/resume
  // Manual kill switch for the whole press campaign.  Jobs already
  // enqueued stay queued — they will skip themselves via the worker
  // global-pause check.
  // -------------------------------------------------------------------------
  fastify.post<{ Body: { reason?: string } }>("/api/press/pause", async (request, reply) => {
    await setPressGlobalPause(true, request.body?.reason ?? "manual");
    return reply.send({ paused: true });
  });
  fastify.post("/api/press/resume", async (_request, reply) => {
    await setPressGlobalPause(false);
    return reply.send({ paused: false });
  });

  // -------------------------------------------------------------------------
  // POST /api/press/inboxes/:inbox/pause and /resume
  // Manually pause or resume a single presse@* inbox.  Worker
  // pickInboxForContact() will route around paused inboxes.
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: { inbox: string };
    Body: { reason?: string };
  }>("/api/press/inboxes/:inbox/pause", async (request, reply) => {
    await pauseInbox(request.params.inbox, request.body?.reason ?? "manual");
    return reply.send({ paused: request.params.inbox });
  });
  fastify.post<{ Params: { inbox: string } }>(
    "/api/press/inboxes/:inbox/resume",
    async (request, reply) => {
      await resumeInbox(request.params.inbox);
      return reply.send({ resumed: request.params.inbox });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/press/audit-contacts
  // Runs format + MX + duplicates + language audit on every PENDING
  // PressContact.  Dry-run by default — set { applySkip: true } to flip
  // every INVALID/SKIPPED contact to status=SKIPPED so they will never
  // be picked up by the outreach worker.  Safe to re-run (idempotent).
  // -------------------------------------------------------------------------
  fastify.post<{
    Body: { applySkip?: boolean; statusFilter?: PressContactStatus };
  }>("/api/press/audit-contacts", async (request, reply) => {
    const { applySkip = false, statusFilter = PressContactStatus.PENDING } = request.body ?? {};

    const contacts = await prisma.pressContact.findMany({
      where: { status: statusFilter },
      select: { id: true, email: true, mediaName: true, lang: true },
    });

    const summary = await auditPressContacts(contacts);

    let skipped = 0;
    if (applySkip) {
      const toSkip = summary.results
        .filter((r) => r.verdict === "INVALID" || r.verdict === "SKIPPED")
        .map((r) => r.contactId);

      if (toSkip.length > 0) {
        const result = await prisma.pressContact.updateMany({
          where: { id: { in: toSkip } },
          data: {
            status: PressContactStatus.SKIPPED,
            notes: "[AUTO-SKIPPED by email audit]",
          },
        });
        skipped = result.count;
      }
      log.info({ skipped, total: summary.total }, "Email audit applied — contacts flagged SKIPPED");
    }

    return reply.send({
      total: summary.total,
      byVerdict: summary.byVerdict,
      byLang: summary.byLang,
      topReasons: summary.topReasons,
      duplicateEmailsCount: summary.duplicateEmails.length,
      duplicateEmailsSample: summary.duplicateEmails.slice(0, 20),
      appliedSkip: applySkip,
      skippedCount: skipped,
      // Keep a sample for debugging, full results list too large for JSON
      worstOffenders: summary.results
        .filter((r) => r.verdict === "INVALID")
        .slice(0, 50)
        .map((r) => ({ email: r.email, media: r.mediaName, lang: r.lang, reasons: r.reasons })),
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
