import { createTransport, type Transporter } from "nodemailer";
import { createChildLogger } from "../../utils/logger.js";
import { getUnsubscribeHeaders } from "../../api/routes/unsubscribe.js";

const log = createChildLogger("smtp-sender");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST || "204.168.180.175";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "10025");
const SMTP_SECURE = false; // Port 10025 is not TLS (Postfix local relay)

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    log.info({ host: SMTP_HOST, port: SMTP_PORT }, "SMTP transporter created.");
  }
  return transporter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SmtpSendOptions {
  toEmail: string;
  toName?: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via SMTP (Postfix → OpenDKIM → PowerMTA).
 * DKIM signing happens automatically via OpenDKIM milter.
 */
export async function sendViaSMTP(opts: SmtpSendOptions): Promise<SmtpSendResult> {
  try {
    const transport = getTransporter();

    // Generate unsubscribe headers
    const unsubHeaders = getUnsubscribeHeaders(opts.toEmail, opts.fromEmail.split("@")[1] || "hub-travelers.com");

    // Build HTML from text if not provided
    const html = opts.bodyHtml || opts.bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const result = await transport.sendMail({
      from: `${opts.fromName} <${opts.fromEmail}>`,
      to: opts.toName ? `${opts.toName} <${opts.toEmail}>` : opts.toEmail,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.bodyText,
      html,
      headers: {
        "List-Unsubscribe": unsubHeaders["List-Unsubscribe"],
        "List-Unsubscribe-Post": unsubHeaders["List-Unsubscribe-Post"],
      },
    });

    log.info({ to: opts.toEmail, messageId: result.messageId }, "Email sent via SMTP.");
    return { success: true, messageId: result.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, to: opts.toEmail }, "Failed to send email via SMTP.");
    return { success: false, error: message };
  }
}

/**
 * Check if SMTP is configured and reachable.
 */
export async function checkSmtpHealth(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
