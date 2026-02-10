// ---------------------------------------------------------------------------
// Reply Categorizer - Classify reply emails using Claude LLM
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../config/database.js";
import {
  REPLY_CATEGORIES,
  type ReplyCategory,
  CONFIDENCE_THRESHOLD,
} from "../../config/constants.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("reply-categorizer");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryResult {
  /** The classified category */
  category: ReplyCategory;
  /** Confidence score 0-1 */
  confidence: number;
  /** Short summary of the reply content */
  summary: string;
  /** Suggested next action */
  suggestedAction: string;
  /** Whether a human should review this */
  requiresHuman: boolean;
}

interface LlmClassification {
  category: string;
  confidence: number;
  summary: string;
  suggested_action: string;
  requires_human: boolean;
}

// ---------------------------------------------------------------------------
// Category to status/action mapping
// ---------------------------------------------------------------------------

const CATEGORY_ACTIONS: Record<
  ReplyCategory,
  {
    prospectStatus: string;
    enrollmentAction: "stop" | "continue" | "pause";
    stoppedReason?: string;
  }
> = {
  INTERESTED: {
    prospectStatus: "NEGOTIATING",
    enrollmentAction: "stop",
    stoppedReason: "prospect_interested",
  },
  NOT_INTERESTED: {
    prospectStatus: "LOST",
    enrollmentAction: "stop",
    stoppedReason: "prospect_not_interested",
  },
  ASKING_PRICE: {
    prospectStatus: "NEGOTIATING",
    enrollmentAction: "pause",
  },
  ASKING_QUESTIONS: {
    prospectStatus: "NEGOTIATING",
    enrollmentAction: "pause",
  },
  ALREADY_LINKED: {
    prospectStatus: "WON",
    enrollmentAction: "stop",
    stoppedReason: "already_linked",
  },
  OUT_OF_OFFICE: {
    prospectStatus: "REPLIED",
    enrollmentAction: "continue", // Keep sequence going, they'll see it later
  },
  BOUNCE: {
    prospectStatus: "LOST",
    enrollmentAction: "stop",
    stoppedReason: "bounce",
  },
  UNSUBSCRIBE: {
    prospectStatus: "DO_NOT_CONTACT",
    enrollmentAction: "stop",
    stoppedReason: "unsubscribed",
  },
  SPAM: {
    prospectStatus: "DO_NOT_CONTACT",
    enrollmentAction: "stop",
    stoppedReason: "marked_spam",
  },
  OTHER: {
    prospectStatus: "REPLIED",
    enrollmentAction: "pause",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Categorize a reply email using Claude LLM.
 *
 * Steps:
 * 1. Call Claude with categorization prompt
 * 2. Parse the JSON response
 * 3. Apply automatic actions based on category
 * 4. Log event with classification details
 *
 * @returns Classification result with category, confidence, and suggested action
 */
export async function categorizeReply(
  prospectId: number,
  enrollmentId: number,
  replyText: string,
): Promise<CategoryResult> {
  log.info({ prospectId, enrollmentId }, "Categorizing reply");

  // 1. Classify via LLM
  const classification = await classifyWithClaude(replyText);

  // 2. Validate and normalize category
  const category = validateCategory(classification.category);
  const confidence = Math.max(0, Math.min(1, classification.confidence));

  const result: CategoryResult = {
    category,
    confidence,
    summary: classification.summary,
    suggestedAction: classification.suggested_action,
    requiresHuman: classification.requires_human || confidence < CONFIDENCE_THRESHOLD,
  };

  // 3. Apply automatic actions (only if confidence is above threshold)
  if (confidence >= CONFIDENCE_THRESHOLD) {
    await applyAutomaticActions(prospectId, enrollmentId, category);
  } else {
    log.info(
      { prospectId, confidence, threshold: CONFIDENCE_THRESHOLD },
      "Low confidence: skipping automatic actions, flagging for human review",
    );
  }

  // 4. Log classification event
  await prisma.event.create({
    data: {
      prospectId,
      enrollmentId,
      eventType: "REPLY_CLASSIFIED",
      eventSource: "reply_categorizer",
      data: {
        category: result.category,
        confidence: result.confidence,
        summary: result.summary,
        suggestedAction: result.suggestedAction,
        requiresHuman: result.requiresHuman,
        replyPreview: replyText.slice(0, 300),
      },
    },
  });

  log.info(
    {
      prospectId,
      enrollmentId,
      category: result.category,
      confidence: result.confidence,
      requiresHuman: result.requiresHuman,
    },
    "Reply categorized",
  );

  return result;
}

// ---------------------------------------------------------------------------
// Claude LLM classification
// ---------------------------------------------------------------------------

async function classifyWithClaude(replyText: string): Promise<LlmClassification> {
  try {
    const anthropic = new Anthropic();

    const categoriesList = REPLY_CATEGORIES.join(", ");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are classifying a reply email received in response to a backlink outreach campaign.

Available categories: ${categoriesList}

Category definitions:
- INTERESTED: The person expresses interest in the backlink/partnership/guest post
- NOT_INTERESTED: Clear rejection or decline
- ASKING_PRICE: They want to know pricing/costs for placement
- ASKING_QUESTIONS: They have questions about the offer/site/content
- ALREADY_LINKED: They say they already have a link or already did this
- OUT_OF_OFFICE: Automatic out-of-office/vacation reply
- BOUNCE: Delivery failure / mailbox full / address not found
- UNSUBSCRIBE: They explicitly ask to be removed from the mailing list
- SPAM: They accuse us of spam or threaten to report
- OTHER: Doesn't fit any category above

Analyze this reply email and respond with a JSON object (no markdown, just raw JSON):

{
  "category": "<one of the categories above>",
  "confidence": <float 0.0-1.0>,
  "summary": "<1-2 sentence summary of what they said>",
  "suggested_action": "<brief recommended next step>",
  "requires_human": <true if ambiguous or needs manual review>
}

Reply email:
---
${replyText.slice(0, 2000)}
---`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const responseText = textBlock?.text?.trim() ?? "";

    // Parse JSON from response (handle possible markdown code blocks)
    const jsonStr = responseText
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as LlmClassification;
    return parsed;
  } catch (err) {
    log.error({ err }, "Failed to classify reply with Claude");

    // Return a safe fallback that requires human review
    return {
      category: "OTHER",
      confidence: 0,
      summary: "Classification failed - requires manual review",
      suggested_action: "Review manually",
      requires_human: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Automatic actions
// ---------------------------------------------------------------------------

async function applyAutomaticActions(
  prospectId: number,
  enrollmentId: number,
  category: ReplyCategory,
): Promise<void> {
  const action = CATEGORY_ACTIONS[category];

  // Update prospect status
  await prisma.prospect.update({
    where: { id: prospectId },
    data: { status: action.prospectStatus },
  });

  // Handle enrollment based on action type
  switch (action.enrollmentAction) {
    case "stop":
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "stopped",
          stoppedReason: action.stoppedReason ?? `reply_${category.toLowerCase()}`,
          completedAt: new Date(),
        },
      });
      break;

    case "pause":
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "paused",
          stoppedReason: `awaiting_response_${category.toLowerCase()}`,
        },
      });
      break;

    case "continue":
      // No enrollment change - sequence continues
      break;
  }

  // Handle special cases
  if (category === "UNSUBSCRIBE" || category === "SPAM") {
    // Mark contact as opted out
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { contactId: true },
    });

    if (enrollment) {
      await prisma.contact.update({
        where: { id: enrollment.contactId },
        data: {
          optedOut: true,
          optedOutAt: new Date(),
        },
      });
    }
  }

  // Update campaign stats if the prospect was won
  if (category === "INTERESTED" || category === "ALREADY_LINKED") {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { campaignId: true },
    });

    if (enrollment) {
      await prisma.campaign.update({
        where: { id: enrollment.campaignId },
        data: { totalReplied: { increment: 1 } },
      });

      if (category === "ALREADY_LINKED") {
        await prisma.campaign.update({
          where: { id: enrollment.campaignId },
          data: { totalWon: { increment: 1 } },
        });
      }
    }
  }

  log.debug(
    { prospectId, enrollmentId, category, action: action.enrollmentAction },
    "Automatic actions applied",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a string is a valid ReplyCategory, falling back to "OTHER".
 */
function validateCategory(raw: string): ReplyCategory {
  const upper = raw.toUpperCase().trim();
  if ((REPLY_CATEGORIES as readonly string[]).includes(upper)) {
    return upper as ReplyCategory;
  }
  log.warn({ rawCategory: raw }, "Unknown category from LLM, defaulting to OTHER");
  return "OTHER";
}
