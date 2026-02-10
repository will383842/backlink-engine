import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

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
 *  1. Exact language match → pick highest replyRate, then most recent
 *  2. English fallback   → same ranking
 *  3. null               → no template available
 */
export async function selectTemplate(
  language: string,
  purpose: string,
): Promise<SelectedTemplate | null> {
  // 1. Try exact language match
  const exact = await prisma.outreachTemplate.findFirst({
    where: { language, purpose, isActive: true },
    orderBy: [{ replyRate: "desc" }, { createdAt: "desc" }],
  });

  if (exact) {
    log.debug({ language, purpose, templateId: exact.id }, "Exact language match found.");
    return exact;
  }

  // 2. Fallback to English
  if (language !== "en") {
    const fallback = await prisma.outreachTemplate.findFirst({
      where: { language: "en", purpose, isActive: true },
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
