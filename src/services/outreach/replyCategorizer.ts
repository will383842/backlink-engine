// ---------------------------------------------------------------------------
// Reply Categorizer - Classify reply emails using Claude LLM
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import {
  REPLY_CATEGORIES,
  type ReplyCategory,
  CONFIDENCE_THRESHOLD,
} from "../../config/constants.js";
import { createChildLogger } from "../../utils/logger.js";
import { getLlmClient } from "../../llm/index.js";

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
  const classification = await classifyWithLlm(replyText);

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
// LLM classification
// ---------------------------------------------------------------------------

async function classifyWithLlm(replyText: string): Promise<LlmClassification> {
  try {
    const result = await getLlmClient().categorizeReply(replyText, "auto");

    return {
      category: result.category,
      confidence: result.confidence,
      summary: result.summary,
      suggested_action: result.suggestedAction,
      requires_human: result.requiresHuman,
    };
  } catch (err) {
    log.error({ err }, "Failed to classify reply with LLM");

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
