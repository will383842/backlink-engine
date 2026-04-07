import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { ProspectCategory } from "@prisma/client";

const log = createChildLogger("message-template-selector");

interface SelectedMessageTemplate {
  id: number;
  language: string;
  category: string | null;
  subject: string;
  body: string;
  isDefault: boolean;
}

/**
 * Select the best message template for contact forms.
 *
 * Strategy:
 *  1. Tag-based matching (if tags provided) → pick template with matching category
 *  2. Exact category + language match
 *  3. General template (category = null) for the language
 *  4. English fallback with category
 *  5. English fallback general
 *  6. null → no template available
 */
export async function selectMessageTemplate(
  language: string,
  options?: {
    prospectTags?: number[];        // Tag IDs from prospect
    prospectCategory?: string;      // Prospect category (blogger, media, etc.)
    preferredCategory?: string;     // Override category selection
  }
): Promise<SelectedMessageTemplate | null> {
  const {
    prospectTags = [],
    prospectCategory,
    preferredCategory
  } = options || {};

  // Determine target category (preferredCategory > prospectCategory > null)
  const targetCategory = preferredCategory || prospectCategory || null;

  log.debug({
    language,
    targetCategory,
    prospectTags,
  }, "Selecting message template");

  // 1. Try exact category + language match
  if (targetCategory) {
    const exactMatch = await prisma.messageTemplate.findUnique({
      where: {
        language_category: {
          language: language,
          category: targetCategory as ProspectCategory,
        },
      },
    });

    if (exactMatch) {
      log.info({
        language,
        category: targetCategory,
        templateId: exactMatch.id,
      }, "Exact category + language match found");
      return exactMatch;
    }

    log.debug({
      language,
      category: targetCategory,
    }, "No exact category + language match, trying general template");
  }

  // 2. Try general template (category = null) for this language
  const generalTemplate = await prisma.messageTemplate.findFirst({
    where: {
      language: language,
      category: null,
    },
  });

  if (generalTemplate) {
    log.info({
      language,
      templateId: generalTemplate.id,
    }, "General template found for language");
    return generalTemplate;
  }

  // 3. Fallback to English with target category
  if (language !== "en" && targetCategory) {
    const englishCategory = await prisma.messageTemplate.findUnique({
      where: {
        language_category: {
          language: "en",
          category: targetCategory as ProspectCategory,
        },
      },
    });

    if (englishCategory) {
      log.warn({
        originalLanguage: language,
        category: targetCategory,
        templateId: englishCategory.id,
      }, "Using English fallback with category");
      return englishCategory;
    }
  }

  // 4. Fallback to English general template
  if (language !== "en") {
    const englishGeneral = await prisma.messageTemplate.findFirst({
      where: {
        language: "en",
        category: null,
      },
    });

    if (englishGeneral) {
      log.warn({
        originalLanguage: language,
        templateId: englishGeneral.id,
      }, "Using English general fallback template");
      return englishGeneral;
    }
  }

  // 5. Last resort: any template in the target language
  const anyInLanguage = await prisma.messageTemplate.findFirst({
    where: {
      language: language,
    },
    orderBy: {
      category: "asc", // Prefer general (null) over specific categories
    },
  });

  if (anyInLanguage) {
    log.warn({
      language,
      templateId: anyInLanguage.id,
      category: anyInLanguage.category,
    }, "Using any available template in language");
    return anyInLanguage;
  }

  log.error({
    language,
    targetCategory,
  }, "❌ No message template found (not even English fallback)");

  return null;
}

/**
 * Helper to get template with variable replacement
 */
export function replaceTemplateVariables(
  template: SelectedMessageTemplate,
  variables: {
    siteName?: string;
    yourName?: string;
    yourCompany?: string;
    yourWebsite?: string;
  }
): { subject: string; body: string } {
  const {
    siteName = "[Site Name]",
    yourName = "[Your Name]",
    yourCompany = "[Your Company]",
    yourWebsite = "[Your Website]",
  } = variables;

  let subject = template.subject;
  let body = template.body;

  // Replace all variables
  subject = subject
    .replace(/{siteName}/g, siteName)
    .replace(/{yourName}/g, yourName)
    .replace(/{yourCompany}/g, yourCompany)
    .replace(/{yourWebsite}/g, yourWebsite);

  body = body
    .replace(/{siteName}/g, siteName)
    .replace(/{yourName}/g, yourName)
    .replace(/{yourCompany}/g, yourCompany)
    .replace(/{yourWebsite}/g, yourWebsite);

  return { subject, body };
}
