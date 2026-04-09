import OpenAI from "openai";
import { createChildLogger } from "../utils/logger.js";
import { CATEGORIZATION_PROMPT } from "./prompts/categorizeReply.js";
import { PERSONALIZATION_PROMPT } from "./prompts/personalizeEmail.js";
import { LANGUAGE_DETECTION_PROMPT } from "./prompts/detectLanguage.js";
import { THEMATIC_CLASSIFICATION_PROMPT } from "./prompts/classifyThematic.js";
import { OPPORTUNITY_DETECTION_PROMPT } from "./prompts/detectOpportunity.js";
import {
  GENERATE_OUTREACH_EMAIL_PROMPT,
  GENERATE_OUTREACH_EMAIL_FOLLOW_UP_HINT,
  AB_VARIANT_A_INSTRUCTIONS,
  AB_VARIANT_B_INSTRUCTIONS,
} from "./prompts/generateOutreachEmail.js";
import { GENERATE_BROADCAST_VARIATIONS_PROMPT } from "./prompts/generateBroadcastVariations.js";
import { CONFIDENCE_THRESHOLD } from "../config/constants.js";
import type { CategoryResult, PersonalizationInput, ThematicResult, OpportunityResult, GeneratedEmail, GenerateEmailInput, GenerateBroadcastVariationsInput } from "./types.js";

const log = createChildLogger("llm-client");

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Anthropic API direct call (no SDK dependency needed)
// ---------------------------------------------------------------------------

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  messages: ClaudeMessage[],
  maxTokens: number = 1024,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as ClaudeResponse;
  return data.content?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Dual-LLM Client
// ---------------------------------------------------------------------------

/**
 * LLM client for the Backlink Engine.
 *
 * Uses TWO models:
 * - **Claude Sonnet** for email generation (native-quality multilingual writing)
 * - **GPT-4o-mini** for fast tasks (classification, language detection, categorization)
 *
 * Falls back to GPT-4o-mini for everything if Claude API key is not configured.
 */
export class LlmClient {
  private client: OpenAI;
  private enabled: boolean;
  private model: string;
  private claudeApiKey: string | null;
  private claudeModel: string;

  constructor(opts?: { apiKey?: string; enabled?: boolean; model?: string }) {
    const apiKey = opts?.apiKey || process.env.OPENAI_API_KEY;
    this.enabled = opts?.enabled ?? true;
    this.model = opts?.model ?? DEFAULT_MODEL;

    // Claude for email generation (native-quality multilingual)
    this.claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
    this.claudeModel = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;

    if (!apiKey && !this.claudeApiKey) {
      log.warn("No LLM API key configured. LLM calls will return fallbacks.");
      this.enabled = false;
    }

    this.client = new OpenAI({ apiKey: apiKey || "sk-placeholder" });

    log.info(
      {
        enabled: this.enabled,
        openaiModel: this.model,
        claudeEnabled: !!this.claudeApiKey,
        claudeModel: this.claudeApiKey ? this.claudeModel : "disabled",
      },
      "LlmClient initialised (dual-model: Claude Sonnet for emails, GPT-4o-mini for fast tasks).",
    );
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

      // Use Claude for personalization (multilingual quality)
      if (this.claudeApiKey) {
        const line = await callClaude(
          this.claudeApiKey,
          this.claudeModel,
          PERSONALIZATION_PROMPT,
          [{ role: "user", content: userMessage }],
          256,
        );
        log.info({ domain, language, lineLength: line.length }, "Personalised line generated (Claude).");
        return line.trim();
      }

      // Fallback: GPT-4o-mini
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
  // Thematic classification
  // -----------------------------------------------------------------------

  async classifyThematic(
    domain: string,
    content?: string,
  ): Promise<ThematicResult> {
    if (!this.enabled) {
      return { relevance: 0, themes: [], reasoning: "AI disabled." };
    }

    log.debug({ domain }, "Classifying thematic relevance...");

    try {
      const userMessage = content
        ? `Domain: ${domain}\n\nPage content (excerpt):\n${content.slice(0, 2000)}`
        : `Domain: ${domain}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          { role: "system", content: THEMATIC_CLASSIFICATION_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const jsonStr = raw
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as ThematicResult;
      log.info(
        { domain, relevance: parsed.relevance, themes: parsed.themes },
        "Thematic classification complete.",
      );
      return parsed;
    } catch (err) {
      log.error({ err, domain }, "Failed to classify thematic.");
      return { relevance: 0, themes: [], reasoning: "Classification failed." };
    }
  }

  // -----------------------------------------------------------------------
  // Opportunity detection
  // -----------------------------------------------------------------------

  async detectOpportunity(
    domain: string,
    content?: string,
  ): Promise<OpportunityResult> {
    if (!this.enabled) {
      return {
        opportunityType: "resource_link",
        confidence: 0,
        reasoning: "AI disabled.",
        notes: "",
      };
    }

    log.debug({ domain }, "Detecting opportunity type...");

    try {
      const userMessage = content
        ? `Domain: ${domain}\n\nPage content (excerpt):\n${content.slice(0, 2000)}`
        : `Domain: ${domain}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        messages: [
          { role: "system", content: OPPORTUNITY_DETECTION_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const jsonStr = raw
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as OpportunityResult;
      log.info(
        { domain, type: parsed.opportunityType, confidence: parsed.confidence },
        "Opportunity detection complete.",
      );
      return parsed;
    } catch (err) {
      log.error({ err, domain }, "Failed to detect opportunity.");
      return {
        opportunityType: "resource_link",
        confidence: 0,
        reasoning: "Detection failed.",
        notes: "",
      };
    }
  }

  // -----------------------------------------------------------------------
  // Outreach email generation (full email unique per prospect)
  // -----------------------------------------------------------------------

  async generateOutreachEmail(input: GenerateEmailInput): Promise<GeneratedEmail> {
    if (!this.enabled) {
      return {
        subject: `Partnership proposal - ${input.domain}`,
        body: `Hello,\n\nI noticed your website ${input.domain} and would love to discuss a content partnership.\n\nBest regards`,
      };
    }

    log.debug(
      { domain: input.domain, step: input.stepNumber, lang: input.language, variant: input.variant },
      "Generating outreach email...",
    );

    try {
      const userLines = [
        `domain: ${input.domain}`,
        `language: ${input.language}`,
        input.country ? `country: ${input.country}` : "",
        input.themes?.length ? `themes: ${input.themes.join(", ")}` : "",
        input.opportunityType ? `opportunityType: ${input.opportunityType}` : "",
        input.contactName ? `contactName: ${input.contactName}` : "contactName: (unknown)",
        input.contactType ? `contactType: ${input.contactType}` : "",
        input.channel ? `channel: ${input.channel}` : "channel: email",
        `stepNumber: ${input.stepNumber}`,
        `yourWebsite: ${input.yourWebsite}`,
        `yourCompany: ${input.yourCompany}`,
        input.variant ? `abVariant: ${input.variant}` : "",
      ].filter(Boolean).join("\n");

      let systemPrompt = GENERATE_OUTREACH_EMAIL_PROMPT;

      // Inject A/B variant instructions
      if (input.variant === "A") {
        systemPrompt += AB_VARIANT_A_INSTRUCTIONS;
      } else if (input.variant === "B") {
        systemPrompt += AB_VARIANT_B_INSTRUCTIONS;
      }

      if (input.stepNumber > 0 && input.previousSubject) {
        systemPrompt += GENERATE_OUTREACH_EMAIL_FOLLOW_UP_HINT
          .replace("{{stepNumber}}", String(input.stepNumber))
          .replace("{{previousSubject}}", input.previousSubject);
      }

      let raw: string;

      if (this.claudeApiKey) {
        // PRIMARY: Claude Sonnet — native-quality multilingual emails
        raw = await callClaude(
          this.claudeApiKey,
          this.claudeModel,
          systemPrompt,
          [{ role: "user", content: userLines }],
          1024,
        );
        log.debug({ domain: input.domain, model: this.claudeModel }, "Email generated via Claude Sonnet.");
      } else {
        // FALLBACK: GPT-4o-mini
        const completion = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userLines },
          ],
        });
        raw = completion.choices[0]?.message?.content?.trim() ?? "";
        log.debug({ domain: input.domain, model: this.model }, "Email generated via GPT-4o-mini fallback.");
      }

      const jsonStr = raw
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as GeneratedEmail;

      if (!parsed.subject || !parsed.body) {
        throw new Error("Missing subject or body in LLM response");
      }

      log.info(
        { domain: input.domain, step: input.stepNumber, subjectLen: parsed.subject.length, model: this.claudeApiKey ? "claude" : "gpt" },
        "Outreach email generated.",
      );
      return parsed;
    } catch (err) {
      log.error({ err, domain: input.domain }, "Failed to generate outreach email, using fallback.");
      return {
        subject: `Partnership proposal - ${input.domain}`,
        body: `Hello,\n\nI noticed your website ${input.domain} and would love to discuss a content partnership.\n\nBest regards`,
      };
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

  // -----------------------------------------------------------------------
  // Broadcast email variations (batch generation)
  // -----------------------------------------------------------------------

  async generateBroadcastVariations(
    input: GenerateBroadcastVariationsInput,
  ): Promise<GeneratedEmail[]> {
    if (!this.enabled) {
      return Array.from({ length: input.count }, (_, i) => ({
        subject: `${input.sourceSubject} (v${i + 1})`,
        body: input.sourceBody,
      }));
    }

    log.debug(
      { lang: input.language, type: input.contactType, count: input.count },
      "Generating broadcast variations...",
    );

    try {
      const userLines = [
        `sourceSubject: ${input.sourceSubject}`,
        `sourceBody: ${input.sourceBody}`,
        `brief: ${input.brief}`,
        `language: ${input.language}`,
        `contactType: ${input.contactType}`,
        `count: ${input.count}`,
      ].join("\n\n");

      const systemPrompt = GENERATE_BROADCAST_VARIATIONS_PROMPT.replace(
        "{count}",
        String(input.count),
      );

      let raw: string;

      if (this.claudeApiKey) {
        raw = await callClaude(
          this.claudeApiKey,
          this.claudeModel,
          systemPrompt,
          [{ role: "user", content: userLines }],
          4096,
        );
        log.debug({ model: this.claudeModel, count: input.count }, "Broadcast variations generated via Claude.");
      } else {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userLines },
          ],
        });
        raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
        log.debug({ model: this.model, count: input.count }, "Broadcast variations generated via GPT fallback.");
      }

      const jsonStr = raw
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as GeneratedEmail[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("LLM returned empty or non-array response");
      }

      log.info(
        { lang: input.language, type: input.contactType, generated: parsed.length },
        "Broadcast variations generated.",
      );
      return parsed;
    } catch (err) {
      log.error({ err, lang: input.language, type: input.contactType }, "Failed to generate broadcast variations, using fallback.");
      return Array.from({ length: input.count }, (_, i) => ({
        subject: `${input.sourceSubject} (v${i + 1})`,
        body: input.sourceBody,
      }));
    }
  }
}
