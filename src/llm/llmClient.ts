import OpenAI from "openai";
import { createChildLogger } from "../utils/logger.js";
import { CATEGORIZATION_PROMPT } from "./prompts/categorizeReply.js";
import { PERSONALIZATION_PROMPT } from "./prompts/personalizeEmail.js";
import { LANGUAGE_DETECTION_PROMPT } from "./prompts/detectLanguage.js";
import { CONFIDENCE_THRESHOLD } from "../config/constants.js";
import type { CategoryResult, PersonalizationInput } from "./types.js";

const log = createChildLogger("llm-client");

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * LLM client for the Backlink Engine using OpenAI GPT-4o-mini.
 * Provides domain-specific methods: reply categorisation, email
 * personalisation, and language detection.
 */
export class LlmClient {
  private client: OpenAI;
  private enabled: boolean;
  private model: string;

  constructor(opts?: { apiKey?: string; enabled?: boolean; model?: string }) {
    const apiKey = opts?.apiKey || process.env.OPENAI_API_KEY;
    this.enabled = opts?.enabled ?? true;
    this.model = opts?.model ?? DEFAULT_MODEL;

    if (!apiKey) {
      log.warn("No OpenAI API key configured. LLM calls will return fallbacks.");
      this.enabled = false;
    }

    this.client = new OpenAI({ apiKey: apiKey || "sk-placeholder" });
    log.info({ enabled: this.enabled, model: this.model }, "LlmClient initialised.");
  }

  // -----------------------------------------------------------------------
  // Reply categorisation
  // -----------------------------------------------------------------------

  async categorizeReply(
    replyText: string,
    language: string,
  ): Promise<CategoryResult> {
    if (!this.enabled) {
      return {
        category: "OTHER",
        confidence: 0,
        summary: "AI disabled - requires manual review.",
        suggestedAction: "escalate_to_human",
        requiresHuman: true,
      };
    }

    log.debug({ language, chars: replyText.length }, "Categorising reply...");

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 512,
        messages: [
          { role: "system", content: CATEGORIZATION_PROMPT },
          { role: "user", content: `Language hint: ${language}\n\n---\n\n${replyText}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";

      const jsonStr = raw
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as CategoryResult;

      if (parsed.confidence < CONFIDENCE_THRESHOLD) {
        parsed.requiresHuman = true;
      }

      log.info(
        { category: parsed.category, confidence: parsed.confidence },
        "Reply categorised.",
      );

      return parsed;
    } catch (err) {
      log.error({ err }, "Failed to parse categorisation response.");
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

  async generatePersonalizedLine(
    language: string,
    domain: string,
    blogName?: string,
    country?: string,
  ): Promise<string> {
    if (!this.enabled) return "";

    const input: PersonalizationInput = { language, domain, blogName, country };
    log.debug(input, "Generating personalised line...");

    try {
      const userMessage = [
        `language: ${language}`,
        `domain: ${domain}`,
        blogName ? `blog_name: ${blogName}` : "blog_name: (not available)",
        country ? `country: ${country}` : "country: (not available)",
      ].join("\n");

      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          { role: "system", content: PERSONALIZATION_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      const line = completion.choices[0]?.message?.content?.trim() ?? "";
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

  async detectLanguage(text: string): Promise<string> {
    if (!this.enabled) return "en";

    log.debug({ chars: text.length }, "Detecting language...");

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 16,
        messages: [
          { role: "system", content: LANGUAGE_DETECTION_PROMPT },
          { role: "user", content: text },
        ],
      });

      const code = (completion.choices[0]?.message?.content?.trim() ?? "en")
        .toLowerCase()
        .slice(0, 2);
      log.info({ detectedLanguage: code }, "Language detected.");
      return code;
    } catch (err) {
      log.error({ err }, "Failed to detect language, falling back to 'en'.");
      return "en";
    }
  }
}
