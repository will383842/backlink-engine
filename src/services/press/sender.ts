/**
 * Press email sender — 2026-04-22 (brand entity Vague 4.3)
 *
 * Uses nodemailer with SMTP credentials of the 5 presse@* inboxes from
 * the Mailflow warmup infrastructure (mémoire `project_mailflow_warmup`).
 * Supports rotation for deliverability + per-language dedicated inbox.
 *
 * Env vars expected:
 *   PRESS_SMTP_HOST           (shared host, e.g. mail.sos-expat.com)
 *   PRESS_SMTP_PORT           (587 or 465)
 *   PRESS_SMTP_SECURE         ("true" for 465)
 *   PRESS_INBOX_FR_USER       (presse-fr@sos-expat.com or presse@)
 *   PRESS_INBOX_FR_PASS       (SMTP password)
 *   PRESS_INBOX_EN_USER       ...
 *   PRESS_INBOX_EN_PASS       ...
 *   ... one pair per inbox (5 inboxes minimum per Mailflow setup)
 *   PRESS_INBOX_DEFAULT_USER  fallback
 *   PRESS_INBOX_DEFAULT_PASS  fallback
 */
import nodemailer from "nodemailer";
import type { PressLang } from "@prisma/client";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("press-sender");

// ---------------------------------------------------------------------------
// Inbox configuration (reads env vars — 5 presse@* inboxes + fallback)
// ---------------------------------------------------------------------------

function envInbox(key: string): string | undefined {
  return process.env[`PRESS_INBOX_${key}_USER`];
}

function envPass(key: string): string | undefined {
  return process.env[`PRESS_INBOX_${key}_PASS`];
}

/**
 * Resolve inbox per language — prefers dedicated lang inbox if configured,
 * otherwise falls back to rotation.
 */
export const PRESSE_INBOXES = {
  byLang: {
    fr: envInbox("FR"),
    en: envInbox("EN"),
    es: envInbox("ES"),
    de: envInbox("DE"),
    pt: envInbox("PT"),
    ru: envInbox("RU"),
    zh: envInbox("ZH"),
    hi: envInbox("HI"),
    ar: envInbox("AR"),
    et: envInbox("ET"),
  } as Partial<Record<PressLang, string>>,
  rotation: [
    envInbox("FR"),
    envInbox("EN"),
    envInbox("ES"),
    envInbox("DE"),
    envInbox("DEFAULT"),
  ].filter((v): v is string => Boolean(v)),
} as const;

// ---------------------------------------------------------------------------
// Transporter cache — one per inbox (avoid recreating for each email)
// ---------------------------------------------------------------------------

const transporters = new Map<string, nodemailer.Transporter>();

function inboxKey(fromEmail: string): string {
  // Map "presse-fr@sos-expat.com" → "FR", "presse-en@..." → "EN", etc.
  const local = fromEmail.split("@")[0] ?? "";
  const langMatch = local.match(/presse-([a-z]{2})/i);
  return langMatch ? langMatch[1]!.toUpperCase() : "DEFAULT";
}

function getTransporter(fromEmail: string): nodemailer.Transporter {
  if (transporters.has(fromEmail)) return transporters.get(fromEmail)!;

  const noAuth = process.env.PRESS_SMTP_NOAUTH === "true";

  // 2026-04-22: relay-mode (PRESS_SMTP_NOAUTH=true) skips SMTP auth entirely
  // — we trust the local Postfix on host.docker.internal / 172.17.0.1:25 which
  // is configured with mynetworks including the Docker bridge. This removes
  // the need to manage 5 Dovecot passwords.
  let auth: { user: string; pass: string } | undefined;

  if (!noAuth) {
    const key = inboxKey(fromEmail);
    const user = envInbox(key) ?? envInbox("DEFAULT");
    const pass = envPass(key) ?? envPass("DEFAULT");
    if (!user || !pass) {
      throw new Error(
        `Missing SMTP credentials for inbox ${fromEmail}: set PRESS_INBOX_${key}_USER and PRESS_INBOX_${key}_PASS (or PRESS_INBOX_DEFAULT_*), or enable PRESS_SMTP_NOAUTH=true for local relay.`,
      );
    }
    auth = { user, pass };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.PRESS_SMTP_HOST,
    port: Number(process.env.PRESS_SMTP_PORT ?? 587),
    secure: process.env.PRESS_SMTP_SECURE === "true",
    ignoreTLS: noAuth, // local relay, encryption handled by hop-to-hop
    ...(auth ? { auth } : {}),
    // Delivery tuning for press — longer timeout, small pool per inbox
    pool: true,
    maxConnections: 1,
    maxMessages: 5,
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });

  transporters.set(fromEmail, transporter);
  return transporter;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

export interface SendPressEmailArgs {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; url: string }>;
  headers?: Record<string, string>;
  replyTo?: string;
}

export async function sendPressEmail(args: SendPressEmailArgs): Promise<{ messageId: string }> {
  const transporter = getTransporter(args.from);

  // Fetch attachments as buffers (nodemailer supports URL but buffer
  // is safer for retry semantics — avoids mid-send 404 if press page
  // gets cached-invalidated)
  const attachments = await Promise.all(
    (args.attachments ?? []).map(async (att) => {
      const res = await fetch(att.url);
      if (!res.ok) {
        log.warn({ url: att.url, status: res.status }, "Attachment fetch failed; sending without it");
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { filename: att.filename, content: buf };
    }),
  ).then((arr) => arr.filter((a): a is { filename: string; content: Buffer } => Boolean(a)));

  const info = await transporter.sendMail({
    from: `"Williams Jullin — SOS-Expat" <${args.from}>`,
    to: args.to,
    replyTo: args.replyTo ?? "contact@sos-expat.com",
    subject: args.subject,
    text: args.text,
    html: args.html,
    attachments,
    headers: args.headers,
  });

  log.info({ messageId: info.messageId, to: args.to, from: args.from }, "Press email sent");
  return { messageId: info.messageId };
}

// ---------------------------------------------------------------------------
// Health check — test all configured inboxes
// ---------------------------------------------------------------------------

export async function verifyPressInboxes(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const [lang, email] of Object.entries(PRESSE_INBOXES.byLang)) {
    if (!email) {
      results[lang] = false;
      continue;
    }
    try {
      const t = getTransporter(email);
      await t.verify();
      results[lang] = true;
    } catch (err) {
      log.warn({ lang, email, err: (err as Error).message }, "Inbox verification failed");
      results[lang] = false;
    }
  }
  return results;
}
