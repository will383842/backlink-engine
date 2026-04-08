// ---------------------------------------------------------------------------
// Email Engine Client - Send emails via the email-engine API
// ---------------------------------------------------------------------------
//
// The email-engine handles: IP warmup, PowerMTA SMTP, blacklist monitoring,
// DKIM signing, bounce handling, and delivery tracking.
//
// This client replaces direct MailWizz calls. Emails are sent through
// dedicated sending domains (hub-travelers.com, etc.) — never sos-expat.com.
//
// Architecture:
//   backlink-engine → email-engine API → MailWizz → PowerMTA → prospect inbox
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("email-engine-client");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EMAIL_ENGINE_URL = (process.env["EMAIL_ENGINE_API_URL"] ?? "").replace(/\/+$/, "");
const EMAIL_ENGINE_API_KEY = process.env["EMAIL_ENGINE_API_KEY"] ?? "";
const EMAIL_ENGINE_TENANT_ID = parseInt(process.env["EMAIL_ENGINE_TENANT_ID"] ?? "1", 10);
const EMAIL_ENGINE_DATA_SOURCE_ID = parseInt(process.env["EMAIL_ENGINE_DATA_SOURCE_ID"] ?? "1", 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailRequest {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  language?: string;
  category?: string;
  tags?: string[];
  /** Custom fields stored with the contact */
  metadata?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  campaignId?: number;
  contactId?: number;
  error?: string;
}

export interface QuotaStatus {
  canSend: boolean;
  remainingToday: number;
  message: string;
}

interface EmailEngineApiResponse {
  success?: boolean;
  campaign?: { id: number; status: string };
  total_processed?: number;
  new_contacts?: number;
  errors?: string[];
  can_send?: boolean;
  remaining_today?: string;
  message?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class EmailEngineClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly tenantId: number;
  private readonly dataSourceId: number;

  constructor(opts?: {
    baseUrl?: string;
    apiKey?: string;
    tenantId?: number;
    dataSourceId?: number;
  }) {
    this.baseUrl = opts?.baseUrl ?? EMAIL_ENGINE_URL;
    this.apiKey = opts?.apiKey ?? EMAIL_ENGINE_API_KEY;
    this.tenantId = opts?.tenantId ?? EMAIL_ENGINE_TENANT_ID;
    this.dataSourceId = opts?.dataSourceId ?? EMAIL_ENGINE_DATA_SOURCE_ID;
  }

  /**
   * Check if the email-engine is configured and reachable.
   */
  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  /**
   * Health check — verify email-engine API is reachable.
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: "EMAIL_ENGINE_API_URL not configured" };
    }

    try {
      const res = await this.request("GET", "/health");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Check daily sending quota.
   */
  async checkQuota(emailsToSend: number = 1): Promise<QuotaStatus> {
    if (!this.isConfigured()) {
      return { canSend: false, remainingToday: 0, message: "Email engine not configured" };
    }

    try {
      const res = await this.request<EmailEngineApiResponse>(
        "POST",
        `/api/v2/quotas/${this.tenantId}/check`,
        { emails_to_send: emailsToSend },
      );

      return {
        canSend: res.can_send ?? false,
        remainingToday: parseInt(String(res.remaining_today ?? "0"), 10),
        message: res.message ?? "",
      };
    } catch (err) {
      log.warn({ err }, "Quota check failed, assuming can send.");
      return { canSend: true, remainingToday: 999, message: "Quota check failed, proceeding" };
    }
  }

  /**
   * Send a single email via the email-engine.
   *
   * Flow:
   * 1. Ingest the contact (if not already in email-engine)
   * 2. Create a template with the AI-generated content
   * 3. Create a micro-campaign targeting this contact
   * 4. Trigger the send
   *
   * Returns campaignId for tracking.
   */
  async sendEmail(req: SendEmailRequest): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      log.warn("Email engine not configured, email not sent.");
      return { success: false, error: "EMAIL_ENGINE_API_URL not configured" };
    }

    const startTime = Date.now();

    try {
      // Step 1: Ingest contact
      const contactTag = `bl_${Date.now()}`;
      const ingestRes = await this.request<EmailEngineApiResponse>(
        "POST",
        "/api/v2/contacts/ingest",
        {
          contacts: [
            {
              tenant_id: this.tenantId,
              data_source_id: this.dataSourceId,
              email: req.toEmail,
              first_name: req.toName ?? null,
              language: req.language ?? "en",
              category: req.category ?? null,
              tags: [...(req.tags ?? []), contactTag, "backlink_outreach"],
              custom_fields: req.metadata ?? {},
            },
          ],
        },
      );

      if (!ingestRes.success) {
        throw new Error(`Contact ingest failed: ${JSON.stringify(ingestRes.errors)}`);
      }

      // Step 2: Create template with the unique AI-generated content
      const templateRes = await this.request<{ id?: number }>(
        "POST",
        "/api/v2/templates/",
        {
          tenant_id: this.tenantId,
          name: `BL Auto - ${req.toEmail} - ${Date.now()}`,
          language: req.language ?? "en",
          category: req.category ?? null,
          subject: req.subject,
          body_html: this.textToHtml(req.body),
          body_text: req.body,
          variables: [],
          is_default: false,
        },
      );

      const templateId = templateRes.id;
      if (!templateId) {
        throw new Error("Template creation failed: no ID returned");
      }

      // Step 3: Create micro-campaign targeting only this contact
      const campaignRes = await this.request<EmailEngineApiResponse>(
        "POST",
        "/api/v2/campaigns/",
        {
          tenant_id: this.tenantId,
          name: `Backlink - ${req.toEmail}`,
          template_id: templateId,
          language: req.language ?? "en",
          tags_all: [contactTag],
        },
      );

      const campaignId = campaignRes.campaign?.id;
      if (!campaignId) {
        throw new Error("Campaign creation failed: no ID returned");
      }

      // Step 4: Send the campaign
      const sendRes = await this.request<EmailEngineApiResponse>(
        "POST",
        `/api/v2/campaigns/${this.tenantId}/${campaignId}/send`,
        {},
      );

      const elapsed = Date.now() - startTime;
      log.info(
        { toEmail: req.toEmail, campaignId, elapsed },
        "Email sent via email-engine.",
      );

      return { success: true, campaignId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, toEmail: req.toEmail }, "Failed to send email via email-engine.");
      return { success: false, error: message };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async request<T = unknown>(
    method: "GET" | "POST" | "PUT",
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    let json: T;
    try {
      json = JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON from email-engine: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(`Email-engine API error (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    return json;
  }

  private textToHtml(text: string): string {
    return text
      .split("\n")
      .map((line) => {
        if (line.trim() === "") return "<br>";
        // Linkify URLs first (on raw text), then escape the non-URL parts
        const withLinks = this.linkifyAndEscape(line);
        return `<p>${withLinks}</p>`;
      })
      .join("\n");
  }

  /**
   * Find URLs in plain text, wrap them in <a> tags, and escape everything else.
   * URLs are extracted first to avoid escaping their special characters.
   */
  private linkifyAndEscape(line: string): string {
    const urlRegex = /(?:https?:\/\/|www\.)[^\s<>)"]+/gi;
    let lastIndex = 0;
    const parts: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(line)) !== null) {
      // Escape text before the URL
      if (match.index > lastIndex) {
        parts.push(this.escapeHtml(line.slice(lastIndex, match.index)));
      }
      // Add the URL as a clickable link (not escaped)
      const url = match[0];
      const href = url.startsWith("www.") ? `https://${url}` : url;
      parts.push(`<a href="${href}" style="color:#4F46E5;text-decoration:underline" target="_blank">${this.escapeHtml(url)}</a>`);
      lastIndex = match.index + url.length;
    }

    // Escape remaining text after last URL
    if (lastIndex < line.length) {
      parts.push(this.escapeHtml(line.slice(lastIndex)));
    }

    return parts.length > 0 ? parts.join("") : this.escapeHtml(line);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: EmailEngineClient | null = null;

export function getEmailEngineClient(): EmailEngineClient {
  if (!instance) {
    instance = new EmailEngineClient();
  }
  return instance;
}

export function resetEmailEngineClient(opts?: {
  baseUrl?: string;
  apiKey?: string;
  tenantId?: number;
}): void {
  instance = new EmailEngineClient(opts);
}
