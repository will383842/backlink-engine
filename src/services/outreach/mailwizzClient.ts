// ---------------------------------------------------------------------------
// MailWizz API Client
// ---------------------------------------------------------------------------

import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("mailwizz-client");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MailWizzSubscriberData {
  email: string;
  fname?: string;
  BLOG_NAME: string;
  BLOG_URL: string;
  COUNTRY: string;
  LANGUAGE: string;
  PERSONALIZED_LINE: string;
  PROSPECT_ID: string;
  CAMPAIGN_REF: string;
  [key: string]: string | undefined;
}

export interface MailWizzSubscriberResponse {
  subscriberUid: string;
}

interface MailWizzApiResponse {
  status: string;
  data?: {
    subscriber_uid?: string;
    record?: {
      subscriber_uid?: string;
      [key: string]: unknown;
    };
    records?: Array<{
      subscriber_uid?: string;
      email?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

/**
 * HTTP client for the MailWizz REST API.
 *
 * All requests use:
 * - `X-Api-Key` header for authentication
 * - `application/x-www-form-urlencoded` body encoding
 *
 * @see https://api-docs.mailwizz.com/
 */
export class MailWizzClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    // Strip trailing slash
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Create a new subscriber in a list.
   *
   * @param listUid - MailWizz list UID
   * @param data - Subscriber fields (email + custom fields)
   * @returns Object containing the new subscriber UID
   */
  async createSubscriber(
    listUid: string,
    data: MailWizzSubscriberData,
  ): Promise<MailWizzSubscriberResponse> {
    const endpoint = `/lists/${listUid}/subscribers`;
    const body = this.encodeFormData(data);

    log.info({ listUid, email: data.email }, "Creating MailWizz subscriber");

    const response = await this.request<MailWizzApiResponse>("POST", endpoint, body);

    const subscriberUid =
      response.data?.record?.subscriber_uid ??
      response.data?.subscriber_uid ??
      "";

    if (!subscriberUid) {
      throw new Error(
        `MailWizz did not return a subscriber_uid. Response: ${JSON.stringify(response)}`,
      );
    }

    log.info({ listUid, subscriberUid }, "Subscriber created");

    return { subscriberUid };
  }

  /**
   * Search for a subscriber by email in a list.
   *
   * @param listUid - MailWizz list UID
   * @param email - Email address to search for
   * @returns Subscriber record or null if not found
   */
  async searchSubscriber(
    listUid: string,
    email: string,
  ): Promise<MailWizzApiResponse["data"] | null> {
    const endpoint = `/lists/${listUid}/subscribers/search-by-email`;
    const params = new URLSearchParams({ EMAIL: email });

    log.debug({ listUid, email }, "Searching for subscriber");

    try {
      const response = await this.request<MailWizzApiResponse>(
        "GET",
        `${endpoint}?${params.toString()}`,
      );

      if (
        response.status === "success" &&
        response.data?.record?.subscriber_uid
      ) {
        return response.data;
      }

      return null;
    } catch (err) {
      // 404 means not found
      if (err instanceof MailWizzApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Unsubscribe a subscriber from a list.
   *
   * @param listUid - MailWizz list UID
   * @param subscriberUid - Subscriber UID to unsubscribe
   */
  async unsubscribeSubscriber(
    listUid: string,
    subscriberUid: string,
  ): Promise<void> {
    const endpoint = `/lists/${listUid}/subscribers/${subscriberUid}/unsubscribe`;

    log.info({ listUid, subscriberUid }, "Unsubscribing subscriber");

    await this.request("PUT", endpoint);

    log.info({ listUid, subscriberUid }, "Subscriber unsubscribed");
  }

  /**
   * Update a subscriber's fields.
   *
   * @param listUid - MailWizz list UID
   * @param subscriberUid - Subscriber UID to update
   * @param data - Fields to update
   */
  async updateSubscriber(
    listUid: string,
    subscriberUid: string,
    data: Partial<MailWizzSubscriberData>,
  ): Promise<void> {
    const endpoint = `/lists/${listUid}/subscribers/${subscriberUid}`;
    const body = this.encodeFormData(data);

    log.debug({ listUid, subscriberUid }, "Updating subscriber");

    await this.request("PUT", endpoint, body);

    log.debug({ listUid, subscriberUid }, "Subscriber updated");
  }

  /**
   * Send a transactional email to a subscriber.
   * Uses MailWizz transactional emails API.
   *
   * @param toEmail - Recipient email
   * @param toName - Recipient name
   * @param subject - Email subject
   * @param body - Email body (plain text or HTML)
   * @param fromEmail - Sender email (optional, uses default)
   * @param fromName - Sender name (optional, uses default)
   * @param replyTo - Reply-to email (optional)
   */
  async sendTransactionalEmail(opts: {
    toEmail: string;
    toName?: string;
    subject: string;
    body: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
  }): Promise<{ messageId?: string }> {
    const endpoint = "/transactional-emails";

    const formData: Record<string, string> = {
      to_name: opts.toName ?? "",
      to_email: opts.toEmail,
      subject: opts.subject,
      body: opts.body,
    };

    if (opts.fromEmail) formData["from_email"] = opts.fromEmail;
    if (opts.fromName) formData["from_name"] = opts.fromName;
    if (opts.replyTo) formData["reply_to"] = opts.replyTo;

    // Convert plain text body to HTML with clickable URLs if it doesn't contain HTML tags
    if (!opts.body.includes("<")) {
      formData["body"] = opts.body
        .split("\n")
        .map((line) => {
          if (line.trim() === "") return "<br>";
          const escaped = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
          // Convert URLs to clickable links
          const withLinks = escaped.replace(
            /(?:https?:\/\/|www\.)[^\s&lt;)]+/gi,
            (url) => {
              const href = url.startsWith("www.") ? `https://${url}` : url;
              return `<a href="${href}" style="color:#4F46E5;text-decoration:underline" target="_blank">${url}</a>`;
            },
          );
          return `<p>${withLinks}</p>`;
        })
        .join("\n");
      formData["plain_text"] = opts.body;
    }

    const body = this.encodeFormData(formData);

    log.info({ toEmail: opts.toEmail, subject: opts.subject.slice(0, 50) }, "Sending transactional email");

    const response = await this.request<MailWizzApiResponse>("POST", endpoint, body);

    const messageId = (response.data as Record<string, unknown>)?.message_id as string | undefined;

    log.info({ toEmail: opts.toEmail, messageId }, "Transactional email sent");

    return { messageId };
  }

  /**
   * Health check - verify MailWizz API is reachable and credentials are valid.
   * Returns true if API responds, false otherwise.
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.request<MailWizzApiResponse>("GET", "/lists");
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Make an authenticated request to the MailWizz API.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: string,
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
    };

    if (body && (method === "POST" || method === "PUT")) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === "GET" || method === "DELETE" ? undefined : body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await response.text();
      let json: T;

      try {
        json = JSON.parse(text) as T;
      } catch {
        throw new MailWizzApiError(
          `Invalid JSON response from MailWizz: ${text.slice(0, 200)}`,
          response.status,
        );
      }

      if (!response.ok) {
        const errorData = json as unknown as MailWizzApiResponse;
        throw new MailWizzApiError(
          errorData.error ?? `MailWizz API error (HTTP ${response.status})`,
          response.status,
        );
      }

      return json;
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof MailWizzApiError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        throw new MailWizzApiError("MailWizz API request timed out", 408);
      }

      throw new MailWizzApiError(
        `MailWizz API request failed: ${err instanceof Error ? err.message : String(err)}`,
        0,
      );
    }
  }

  /**
   * Encode an object as application/x-www-form-urlencoded.
   */
  private encodeFormData(data: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }
    return params.toString();
  }
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class MailWizzApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "MailWizzApiError";
    this.statusCode = statusCode;
  }
}
