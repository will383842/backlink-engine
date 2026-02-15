import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { Language } from "@prisma/client";

const log = createChildLogger("template-selector");

interface SelectedTemplate {
  id: number;
  name: string;
  language: string;
  purpose: string;
  subject: string;
  body: string;
  formalityLevel: string;
}

/**
 * Select the best active template for a given language and purpose.
 *
 * Strategy:
 *  1. Tag-based matching (if tags provided) → pick template with matching tags
 *  2. Exact language match → pick highest replyRate, then most recent
 *  3. English fallback   → same ranking
 *  4. null               → no template available
 */
export async function selectTemplate(
  language: string,
  purpose: string,
  options?: {
    prospectTags?: number[]; // Tag IDs from prospect
    campaignTags?: number[]; // Tag IDs from campaign
  }
): Promise<SelectedTemplate | null> {
  const { prospectTags = [], campaignTags = [] } = options || {};

  // 1. Try tag-based matching if tags are provided
  if (prospectTags.length > 0 || campaignTags.length > 0) {
    // Combine all tags (priority: prospect tags, then campaign tags)
    const relevantTags = [...new Set([...prospectTags, ...campaignTags])];

    // Find templates that have ANY of these tags
    const templatesWithTags = await prisma.outreachTemplate.findMany({
      where: {
        language: language as Language,
        purpose,
        isActive: true,
        tags: {
          some: {
            tagId: { in: relevantTags },
          },
        },
      },
      include: {
        tags: {
          include: { tag: true },
        },
      },
      orderBy: [{ replyRate: "desc" }, { createdAt: "desc" }],
    });

    // Score templates by number of matching tags
    if (templatesWithTags.length > 0) {
      const scored = templatesWithTags.map(template => {
        const matchingTags = template.tags.filter(tt =>
          relevantTags.includes(tt.tagId)
        ).length;
        return { template, matchingTags };
      });

      // Sort by: 1) most matching tags, 2) reply rate, 3) most recent
      scored.sort((a, b) => {
        if (b.matchingTags !== a.matchingTags) {
          return b.matchingTags - a.matchingTags;
        }
        const aRate = a.template.replyRate?.toNumber() || 0;
        const bRate = b.template.replyRate?.toNumber() || 0;
        if (bRate !== aRate) {
          return bRate - aRate;
        }
        return b.template.createdAt.getTime() - a.template.createdAt.getTime();
      });

      const best = scored[0].template;
      log.info(
        {
          language,
          purpose,
          templateId: best.id,
          matchingTags: scored[0].matchingTags,
          tags: best.tags.map(tt => tt.tag.name),
        },
        "Tag-based template selected."
      );

      return best;
    }

    log.debug({ language, purpose, relevantTags }, "No templates found with matching tags, falling back to standard selection.");
  }

  // 2. Try exact language match (no tag filtering)
  const exact = await prisma.outreachTemplate.findFirst({
    where: { language: language as Language, purpose, isActive: true },
    orderBy: [{ replyRate: "desc" }, { createdAt: "desc" }],
  });

  if (exact) {
    log.debug({ language, purpose, templateId: exact.id }, "Exact language match found.");
    return exact;
  }

  // 3. Fallback to English
  if (language !== "en") {
    const fallback = await prisma.outreachTemplate.findFirst({
      where: { language: "en" as Language, purpose, isActive: true },
      orderBy: [{ replyRate: "desc" }, { createdAt: "desc" }],
    });

    if (fallback) {
      log.info({ language, purpose, templateId: fallback.id }, "Using English fallback template.");
      return fallback;
    }
  }

  log.warn({ language, purpose }, "No template found for language or English fallback.");
  return null;
}
