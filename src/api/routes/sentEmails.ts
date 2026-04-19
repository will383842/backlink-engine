// ---------------------------------------------------------------------------
// Sent Emails API - Full audit trail of every email sent
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database.js";
import { authenticateUser, parseIdParam } from "../middleware/auth.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("sent-emails-api");

export default async function sentEmailsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  // ───── GET / ─── List sent emails with filters ──────────────
  app.get<{
    Querystring: {
      prospectId?: string;
      contactId?: string;
      enrollmentId?: string;
      campaignId?: string;
      status?: string;
      stepNumber?: string;
      page?: string;
      limit?: string;
    };
  }>("/", async (request, reply) => {
    const {
      prospectId,
      contactId,
      enrollmentId,
      campaignId,
      status,
      stepNumber,
      page = "1",
      limit = "50",
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (prospectId) where["prospectId"] = parseInt(prospectId, 10);
    if (contactId) where["contactId"] = parseInt(contactId, 10);
    if (enrollmentId) where["enrollmentId"] = parseInt(enrollmentId, 10);
    if (campaignId) where["campaignId"] = parseInt(campaignId, 10);
    if (status) where["status"] = status;
    if (stepNumber !== undefined) where["stepNumber"] = parseInt(stepNumber, 10);

    const [emails, total] = await Promise.all([
      prisma.sentEmail.findMany({
        where,
        include: {
          prospect: { select: { id: true, domain: true } },
          contact: { select: { id: true, email: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.sentEmail.count({ where }),
    ]);

    return reply.send({
      data: emails,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  // ───── GET /:id ─── Single email with full content ─────────
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const email = await prisma.sentEmail.findUnique({
      where: { id },
      include: {
        prospect: { select: { id: true, domain: true, status: true } },
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true, language: true } },
        enrollment: { select: { id: true, status: true, currentStep: true } },
      },
    });

    if (!email) {
      return reply.status(404).send({ error: "Sent email not found" });
    }

    return reply.send({ data: email });
  });

  // ───── GET /stats ─── Aggregated email sending statistics ───
  app.get("/stats", async (_request, reply) => {
    const [
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplained,
      totalFailed,
      totalDrafts,
      byStep,
      byCampaign,
    ] = await Promise.all([
      prisma.sentEmail.count({ where: { status: { notIn: ["failed", "draft"] } } }),
      prisma.sentEmail.count({ where: { deliveredAt: { not: null } } }),
      prisma.sentEmail.count({ where: { firstOpenedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { firstClickedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { bouncedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { complainedAt: { not: null } } }),
      prisma.sentEmail.count({ where: { status: "failed" } }),
      prisma.sentEmail.count({ where: { status: "draft" } }),
      prisma.sentEmail.groupBy({
        by: ["stepNumber"],
        _count: { id: true },
        where: { status: { not: "failed" } },
      }),
      prisma.sentEmail.groupBy({
        by: ["campaignId"],
        _count: { id: true },
        _avg: { openCount: true },
        where: { status: { not: "failed" } },
      }),
    ]);

    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0";
    const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : "0";

    return reply.send({
      data: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        totalFailed,
        totalDrafts,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
        byStep: byStep.map((s) => ({
          step: s.stepNumber,
          count: s._count.id,
          label: s.stepNumber === 0 ? "Initial" : `Follow-up ${s.stepNumber}`,
        })),
        byCampaign,
      },
    });
  });

  // ───── GET /ab-stats ─── A/B test statistics per campaign ────────
  app.get("/ab-stats", async (_request, reply) => {
    // Find campaigns with A/B testing enabled
    const abCampaigns = await prisma.campaign.findMany({
      where: { abTestEnabled: true },
      select: { id: true, name: true, language: true },
    });

    if (abCampaigns.length === 0) {
      return reply.send({ data: [] });
    }

    const campaignIds = abCampaigns.map((c) => c.id);

    // Fetch all A/B sent emails for these campaigns (excluding failed)
    const abEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId: { in: campaignIds },
        abVariant: { not: null },
        status: { not: "failed" },
      },
      select: {
        campaignId: true,
        abVariant: true,
        firstOpenedAt: true,
        firstClickedAt: true,
        status: true,
      },
    });

    // Also count replies per campaign+variant via events
    const replyEvents = await prisma.event.findMany({
      where: {
        eventType: { in: ["reply_received", "REPLY_RECEIVED"] },
        enrollment: {
          campaignId: { in: campaignIds },
        },
      },
      select: {
        enrollmentId: true,
      },
    });

    // Map enrollmentId to abVariant+campaignId via sent emails
    const enrollmentVariantMap = new Map<number, { variant: string; campaignId: number }>();
    const enrollmentEmails = await prisma.sentEmail.findMany({
      where: {
        campaignId: { in: campaignIds },
        abVariant: { not: null },
        stepNumber: 0, // initial email determines the variant
      },
      select: {
        enrollmentId: true,
        abVariant: true,
        campaignId: true,
      },
    });
    for (const se of enrollmentEmails) {
      if (se.abVariant) {
        enrollmentVariantMap.set(se.enrollmentId, {
          variant: se.abVariant,
          campaignId: se.campaignId,
        });
      }
    }

    // Count replies per campaign+variant
    const replyCounts = new Map<string, number>(); // key: "campaignId:variant"
    for (const re of replyEvents) {
      if (re.enrollmentId) {
        const info = enrollmentVariantMap.get(re.enrollmentId);
        if (info) {
          const key = `${info.campaignId}:${info.variant}`;
          replyCounts.set(key, (replyCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // Aggregate stats per campaign per variant
    const results = abCampaigns.map((campaign) => {
      const campaignEmails = abEmails.filter((e) => e.campaignId === campaign.id);

      const buildVariantStats = (variant: string) => {
        const variantEmails = campaignEmails.filter((e) => e.abVariant === variant);
        const sent = variantEmails.length;
        const opened = variantEmails.filter((e) => e.firstOpenedAt !== null).length;
        const clicked = variantEmails.filter((e) => e.firstClickedAt !== null).length;
        const replied = replyCounts.get(`${campaign.id}:${variant}`) ?? 0;

        return {
          variant,
          sent,
          openRate: sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : "0%",
          clickRate: sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : "0%",
          replyRate: sent > 0 ? `${((replied / sent) * 100).toFixed(1)}%` : "0%",
          opened,
          clicked,
          replied,
        };
      };

      const variantA = buildVariantStats("A");
      const variantB = buildVariantStats("B");

      // Determine winner based on reply rate first, then open rate
      let winner: string | null = null;
      if (variantA.sent >= 5 && variantB.sent >= 5) {
        // Need minimum sample size for meaningful comparison
        const aReplyPct = variantA.sent > 0 ? variantA.replied / variantA.sent : 0;
        const bReplyPct = variantB.sent > 0 ? variantB.replied / variantB.sent : 0;

        if (aReplyPct !== bReplyPct) {
          winner = aReplyPct > bReplyPct ? "A" : "B";
        } else {
          // Tiebreaker: open rate
          const aOpenPct = variantA.sent > 0 ? variantA.opened / variantA.sent : 0;
          const bOpenPct = variantB.sent > 0 ? variantB.opened / variantB.sent : 0;
          if (aOpenPct !== bOpenPct) {
            winner = aOpenPct > bOpenPct ? "A" : "B";
          }
        }
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        language: campaign.language,
        variantA,
        variantB,
        winner,
        winnerLabel: winner
          ? winner === "A"
            ? "Benefit-focused (A)"
            : "Curiosity-focused (B)"
          : "Not enough data (min 5 per variant)",
      };
    });

    return reply.send({ data: results });
  });

  // ───── GET /drafts ─── List all draft emails pending review ──────
  app.get("/drafts", async (_request, reply) => {
    const drafts = await prisma.sentEmail.findMany({
      where: { status: "draft" },
      include: {
        prospect: { select: { id: true, domain: true, status: true, country: true, language: true } },
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true, language: true } },
        enrollment: { select: { id: true, status: true, currentStep: true } },
      },
      orderBy: { id: "desc" },
    });

    return reply.send({ data: drafts, total: drafts.length });
  });

  // ───── POST /:id/approve ─── Approve and send a draft email ────
  app.post<{ Params: { id: string } }>("/:id/approve", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const email = await prisma.sentEmail.findUnique({
      where: { id },
      include: {
        contact: true,
        prospect: true,
        enrollment: true,
        campaign: true,
      },
    });

    if (!email) {
      return reply.status(404).send({ error: "Email not found" });
    }

    if (email.status !== "draft") {
      return reply.status(400).send({ error: `Cannot approve email with status "${email.status}". Only drafts can be approved.` });
    }

    // Send the draft via SMTP direct (Postfix/PMTA) with domain rotation.
    // MailWizz + emailEngine fallbacks removed — we only use local SMTP now.
    const { sendViaSMTP } = await import("../../services/outreach/smtpSender.js");
    const { getNextSendingDomain } = await import("../../services/outreach/domainRotator.js");

    let senderSettings = { fromEmail: "", fromName: "", replyTo: "" };
    try {
      const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
      if (row) Object.assign(senderSettings, row.value);
    } catch { /* defaults */ }

    let messageId: string | undefined;
    let emailSent = false;
    let sendingDomain: { domain: string; fromEmail: string; fromName: string; replyTo: string } | null = null;

    try {
      sendingDomain = await getNextSendingDomain();
      const fromEmail = senderSettings.fromEmail || sendingDomain.fromEmail;
      const fromName = senderSettings.fromName || sendingDomain.fromName;
      const replyTo = senderSettings.replyTo || sendingDomain.replyTo;

      const result = await sendViaSMTP({
        sentEmailId: id,
        toEmail: email.contact.email,
        toName: email.contact.firstName ?? email.contact.name ?? undefined,
        fromEmail,
        fromName,
        replyTo,
        subject: email.subject,
        bodyText: email.body,
      });

      if (result.success) {
        messageId = result.messageId;
        emailSent = true;
      }
    } catch {
      // fall through — will be handled below
    }

    const now = new Date();

    if (!emailSent) {
      // SMTP failed — keep as draft for retry, don't update enrollment/prospect
      await prisma.event.create({
        data: {
          prospectId: email.prospectId,
          contactId: email.contactId,
          enrollmentId: email.enrollmentId,
          eventType: "DRAFT_APPROVE_FAILED",
          eventSource: "admin",
          data: { sentEmailId: id, reason: "smtp_send_failed", domain: sendingDomain?.domain ?? null },
        },
      });

      return reply.status(502).send({
        status: "error",
        message: "Email could not be sent via SMTP. Draft preserved — check sending domain DNS and retry.",
      });
    }

    // Email sent successfully — update everything
    await prisma.$transaction(async (tx) => {
      await tx.sentEmail.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: now,
          mailwizzMessageId: messageId ?? null,
        },
      });

      // Update enrollment lastSentAt + calculate next followup
      if (email.enrollment && email.campaign) {
        const config = email.campaign.sequenceConfig as { steps?: { delayDays: number }[] } | null;
        const nextStepIndex = email.stepNumber + 1;
        let nextSendAt: Date | null = null;

        if (config?.steps && nextStepIndex < config.steps.length) {
          const nextStep = config.steps[nextStepIndex];
          if (nextStep) {
            nextSendAt = new Date(now.getTime() + nextStep.delayDays * 86_400_000);
          }
        }

        await tx.enrollment.update({
          where: { id: email.enrollmentId },
          data: {
            lastSentAt: now,
            nextSendAt,
          },
        });
      }

      // Update prospect status
      await tx.prospect.update({
        where: { id: email.prospectId },
        data: {
          status: "CONTACTED_EMAIL",
          firstContactedAt: (email.prospect.status === "NEW" || email.prospect.status === "READY_TO_CONTACT") ? now : undefined,
          lastContactedAt: now,
        },
      });

      await tx.event.create({
        data: {
          prospectId: email.prospectId,
          contactId: email.contactId,
          enrollmentId: email.enrollmentId,
          eventType: "DRAFT_APPROVED",
          eventSource: "admin",
          data: {
            sentEmailId: id,
            emailSent: true,
            messageId: messageId ?? null,
          },
        },
      });
    });

    return reply.send({
      data: { id, status: "sent", sentAt: now },
    });
  });

  // ───── POST /:id/reject ─── Reject a draft email ──────────────
  app.post<{ Params: { id: string } }>("/:id/reject", async (request, reply) => {
    const id = parseIdParam(request.params.id);

    const email = await prisma.sentEmail.findUnique({ where: { id } });

    if (!email) {
      return reply.status(404).send({ error: "Email not found" });
    }

    if (email.status !== "draft") {
      return reply.status(400).send({ error: `Cannot reject email with status "${email.status}".` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sentEmail.update({
        where: { id },
        data: { status: "rejected" },
      });

      // Stop the enrollment — user explicitly rejected this prospect
      if (email.enrollmentId) {
        await tx.enrollment.update({
          where: { id: email.enrollmentId },
          data: {
            status: "stopped",
            stoppedReason: "draft_rejected",
            completedAt: new Date(),
            nextSendAt: null,
          },
        });
      }

      await tx.event.create({
        data: {
          prospectId: email.prospectId,
          contactId: email.contactId,
          enrollmentId: email.enrollmentId,
          eventType: "DRAFT_REJECTED",
          eventSource: "admin",
          data: { sentEmailId: id },
        },
      });
    });

    return reply.send({ data: { id, status: "rejected" } });
  });

  // ───── PUT /:id ─── Edit a draft email (subject + body) ───────
  app.put<{
    Params: { id: string };
    Body: { subject?: string; body?: string };
  }>(
    "/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = parseIdParam(request.params.id);
      const { subject, body } = request.body;

      const email = await prisma.sentEmail.findUnique({ where: { id } });

      if (!email) {
        return reply.status(404).send({ error: "Email not found" });
      }

      if (email.status !== "draft") {
        return reply.status(400).send({ error: `Cannot edit email with status "${email.status}". Only drafts can be edited.` });
      }

      const updated = await prisma.sentEmail.update({
        where: { id },
        data: {
          ...(subject !== undefined && { subject }),
          ...(body !== undefined && { body }),
          generatedBy: "manual", // Mark as manually edited
        },
      });

      return reply.send({ data: updated });
    },
  );

  // ───── POST /approve-all ─── Approve + send N draft emails at once ────
  //
  // Body: { ids?: number[] }   — explicit selection (preferred from UI)
  // If `ids` is omitted we default to ALL drafts in DB (capped at 100 for
  // safety so the HTTP request doesn't time out and so a fat-finger click
  // can't blast thousands of emails).
  //
  // For each id we run the same SMTP-direct logic as POST /:id/approve:
  //   • get next sending domain
  //   • sendViaSMTP
  //   • on success → status=sent, sentAt=now, prospect=CONTACTED_EMAIL,
  //     log ENROLLMENT_SENT event, increment campaign counter
  //   • on failure → leave as draft, log DRAFT_APPROVE_FAILED event
  // A failure on one draft never blocks the rest.
  app.post<{ Body: { ids?: number[] } }>(
    "/approve-all",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            ids: { type: "array", items: { type: "integer" }, maxItems: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sendViaSMTP } = await import("../../services/outreach/smtpSender.js");
      const { getNextSendingDomain } = await import("../../services/outreach/domainRotator.js");

      const requestedIds = request.body?.ids;
      const drafts = await prisma.sentEmail.findMany({
        where: {
          status: "draft",
          ...(requestedIds && requestedIds.length > 0 ? { id: { in: requestedIds } } : {}),
        },
        include: {
          contact: true,
          prospect: true,
          enrollment: true,
          campaign: true,
        },
        take: 100,
      });

      if (drafts.length === 0) {
        return reply.send({ data: { approved: 0, failed: 0, errors: [] } });
      }

      let senderSettings = { fromEmail: "", fromName: "", replyTo: "" };
      try {
        const row = await prisma.appSetting.findUnique({ where: { key: "sender" } });
        if (row) Object.assign(senderSettings, row.value);
      } catch { /* defaults */ }

      const errors: Array<{ id: number; reason: string }> = [];
      let approved = 0;

      for (const email of drafts) {
        try {
          const domain = await getNextSendingDomain();
          const fromEmail = senderSettings.fromEmail || domain.fromEmail;
          const fromName = senderSettings.fromName || domain.fromName;
          const replyTo = senderSettings.replyTo || domain.replyTo;

          const result = await sendViaSMTP({
            sentEmailId: email.id,
            toEmail: email.contact.email,
            toName: email.contact.firstName ?? email.contact.name ?? undefined,
            fromEmail,
            fromName,
            replyTo,
            subject: email.subject,
            bodyText: email.body,
          });

          if (!result.success) {
            errors.push({ id: email.id, reason: result.error ?? "smtp_failed" });
            await prisma.event.create({
              data: {
                prospectId: email.prospectId,
                contactId: email.contactId,
                enrollmentId: email.enrollmentId,
                eventType: "DRAFT_APPROVE_FAILED",
                eventSource: "admin_bulk",
                data: { sentEmailId: email.id, reason: result.error ?? "smtp_failed", domain: domain.domain },
              },
            });
            continue;
          }

          const now = new Date();
          await prisma.$transaction(async (tx) => {
            await tx.sentEmail.update({
              where: { id: email.id },
              data: { status: "sent", sentAt: now, mailwizzMessageId: result.messageId ?? null },
            });
            await tx.enrollment.update({
              where: { id: email.enrollmentId },
              data: { status: "active", lastSentAt: now },
            });
            await tx.prospect.update({
              where: { id: email.prospectId },
              data: {
                status: "CONTACTED_EMAIL",
                lastContactedAt: now,
                firstContactedAt:
                  email.prospect.status === "NEW" || email.prospect.status === "READY_TO_CONTACT"
                    ? now
                    : undefined,
              },
            });
            await tx.campaign.update({
              where: { id: email.campaignId },
              data: { totalSent: { increment: 1 } },
            });
            await tx.event.create({
              data: {
                prospectId: email.prospectId,
                contactId: email.contactId,
                enrollmentId: email.enrollmentId,
                eventType: "ENROLLMENT_SENT",
                eventSource: "admin_bulk",
                data: { sentEmailId: email.id, messageId: result.messageId ?? null, domain: domain.domain },
              },
            });
          });
          approved++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ id: email.id, reason: message });
          log.error({ err, sentEmailId: email.id }, "Bulk approve failed for one draft");
        }
      }

      return reply.send({
        data: {
          requested: drafts.length,
          approved,
          failed: errors.length,
          errors: errors.slice(0, 20),
        },
      });
    },
  );

  // ───── GET /prospect/:prospectId ─── All emails for a prospect ──
  app.get<{ Params: { prospectId: string } }>(
    "/prospect/:prospectId",
    async (request, reply) => {
      const prospectId = parseIdParam(request.params.prospectId);

      const emails = await prisma.sentEmail.findMany({
        where: { prospectId },
        include: {
          contact: { select: { id: true, email: true, firstName: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "asc" },
      });

      return reply.send({ data: emails });
    },
  );
}
