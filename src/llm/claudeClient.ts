import Anthropic from "@anthropic-ai/sdk";
import { createChildLogger } from "../utils/logger.js";
import { CATEGORIZATION_PROMPT } from "./prompts/categorizeReply.js";
import { PERSONALIZATION_PROMPT } from "./prompts/personalizeEmail.js";
import { LANGUAGE_DETECTION_PROMPT } from "./prompts/detectLanguage.js";
import { CONFIDENCE_THRESHOLD } from "../config/constants.js";
import type { CategoryResult, PersonalizationInput } from "./types.js";

const log = createChildLogger("claude-client");

const MODEL = "claude-sonnet-4-5-20250514";

/**
 * Wrapper around the Anthropic SDK providing domain-specific methods
 * for the Backlink Engine: reply categorisation, email personalisation,
 * and language detection.
 */
export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is required. " +
          "Set it in your .env file."
      );
    }

    this.client = new Anthropic({ apiKey });
    log.info("ClaudeClient initialised.");
  }

  // -----------------------------------------------------------------------
  // Reply categorisation
  // -----------------------------------------------------------------------

  /**
   * Categorise an inbound email reply into one of 10 predefined categories.
   *
   * @param replyText - The raw email body text to classify.
   * @param language  - ISO 639-1 hint for the reply language (e.g. "fr").
   * @returns Structured classification with category, confidence, summary,
   *          suggested action, and whether human review is needed.
   */
  async categorizeReply(
    replyText: string,
    language: string
  ): Promise<CategoryResult> {
    log.debug({ language, chars: replyText.length }, "Categorising reply...");

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: CATEGORIZATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Language hint: ${language}\n\n---\n\n${replyText}`,
        },
      ],
    });

    const raw = this.extractText(response);

    try {
      const parsed = JSON.parse(raw) as CategoryResult;

      // Ensure requiresHuman flag when confidence is low
      if (parsed.confidence < CONFIDENCE_THRESHOLD) {
        parsed.requiresHuman = true;
      }

      log.info(
        { category: parsed.category, confidence: parsed.confidence },
        "Reply categorised."
      );

      return parsed;
    } catch (err) {
      log.error({ err, raw }, "Failed to parse categorisation response.");
      return {
        category: "OTHER",
        confidence: 0,
        summary: "Failed to parse LLM response.",
        suggestedAction: "escalate_to_human",
        requiresHuman: true,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Email personalisation
  // -----------------------------------------------------------------------

  /**
   * Generate a 1-2 sentence personalised opening line for an outreach email.
   *
   * @param language  - The language to write in (ISO 639-1).
   * @param domain    - The target blog domain.
   * @param blogName  - Optional human-readable blog name.
   * @param country   - Optional ISO 3166-1 alpha-2 country code.
   * @returns A plain-text personalised intro line.
   */
  async generatePersonalizedLine(
    language: string,
    domain: string,
    blogName?: string,
    country?: string
  ): Promise<string> {
    const input: PersonalizationInput = {
      language,
      domain,
      blogName,
      country,
    };

    log.debug(input, "Generating personalised line...");

    try {
      const userMessage = [
        `language: ${language}`,
        `domain: ${domain}`,
        blogName ? `blog_name: ${blogName}` : "blog_name: (not available)",
        country ? `country: ${country}` : "country: (not available)",
      ].join("\n");

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 256,
        system: PERSONALIZATION_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const line = this.extractText(response).trim();
      log.info({ domain, language, lineLength: line.length }, "Personalised line generated.");
      return line;
    } catch (err) {
      log.error({ err, domain, language }, "Failed to generate personalised line, using fallback.");
      return "";
    }
  }

  // -----------------------------------------------------------------------
  // Language detection
  // -----------------------------------------------------------------------

  /**
   * Detect the dominant language of a text snippet.
   *
   * @param text - The text to analyse.
   * @returns ISO 639-1 two-letter language code (e.g. "fr", "en").
   */
  async detectLanguage(text: string): Promise<string> {
    log.debug({ chars: text.length }, "Detecting language...");

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 16,
        system: LANGUAGE_DETECTION_PROMPT,
        messages: [{ role: "user", content: text }],
      });

      const code = this.extractText(response).trim().toLowerCase().slice(0, 2);
      log.info({ detectedLanguage: code }, "Language detected.");
      return code;
    } catch (err) {
      log.error({ err }, "Failed to detect language, falling back to 'en'.");
      return "en";
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Extract plain text from an Anthropic Messages API response.
   */
  private extractText(response: Anthropic.Message): string {
    const block = response.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }
}
