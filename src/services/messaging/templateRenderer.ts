// ─────────────────────────────────────────────────────────────
// Template Renderer - Render message templates with variables
// ENHANCED: Supports category-specific templates with fallback
// ─────────────────────────────────────────────────────────────

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("template-renderer");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TemplateVariables {
  siteName: string;
  yourName: string;
  yourCompany: string;
  yourWebsite: string;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
  templateId: number;
  templateCategory: string | null;
}

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get best matching template for language + category (with fallback)
 * Priority: category+language > general+language > fallback to English
 */
export async function getBestTemplate(
  language: string,
  category?: string | null
): Promise<any | null> {
  try {
    // 1. Try to find category-specific template (e.g., fr+blogger)
    if (category) {
      const categoryTemplate = await prisma.messageTemplate.findUnique({
        where: {
          language_category: {
            language: language as any,
            category: category as any,
          },
        },
      });

      if (categoryTemplate) {
        log.debug({ language, category }, "Found category-specific template");
        return categoryTemplate;
      }
    }

    // 2. Fallback to general template for language (category = NULL)
    const generalTemplate = await prisma.messageTemplate.findFirst({
      where: {
        language: language as any,
        category: null,
      },
    });

    if (generalTemplate) {
      log.debug({ language }, "Found general template for language");
      return generalTemplate;
    }

    // 3. Ultimate fallback: English general template
    log.warn({ language, category }, "No template found for language, falling back to English");
    const englishTemplate = await prisma.messageTemplate.findFirst({
      where: {
        language: "en",
        category: null,
      },
    });

    return englishTemplate || null;
  } catch (err) {
    log.error({ err, language, category }, "Failed to get best template");
    return null;
  }
}

/**
 * Render a template with variables
 * ENHANCED: Supports category-specific templates
 */
export async function renderTemplate(
  language: string,
  variables: TemplateVariables,
  category?: string | null
): Promise<RenderedTemplate | null> {
  try {
    // Get best matching template
    const template = await getBestTemplate(language, category);

    if (!template) {
      log.warn({ language, category }, "No template found");
      return null;
    }

    // Replace variables
    let renderedSubject = template.subject;
    let renderedBody = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      renderedSubject = renderedSubject.replaceAll(placeholder, value);
      renderedBody = renderedBody.replaceAll(placeholder, value);
    }

    return {
      subject: renderedSubject,
      body: renderedBody,
      templateId: template.id,
      templateCategory: template.category,
    };
  } catch (err) {
    log.error({ err, language, category }, "Failed to render template");
    return null;
  }
}

/**
 * Render template for a specific prospect
 * ENHANCED: Uses prospect's category for better template matching
 */
export async function renderTemplateForProspect(
  prospectId: number,
  customVariables?: Partial<TemplateVariables>
): Promise<RenderedTemplate | null> {
  try {
    // Fetch prospect with language AND category
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        domain: true,
        language: true,
        category: true,  // Get category for template matching
      },
    });

    if (!prospect) {
      log.warn({ prospectId }, "Prospect not found");
      return null;
    }

    if (!prospect.language) {
      log.warn({ prospectId }, "Prospect has no language set");
      return null;
    }

    // Extract site name from domain (remove TLD)
    const siteName = prospect.domain.split(".")[0];

    // Get default sender info
    const senderInfo = await getSenderInfo();

    // Build variables (merge custom with defaults)
    const variables: TemplateVariables = {
      siteName: siteName.charAt(0).toUpperCase() + siteName.slice(1),
      yourName: customVariables?.yourName || senderInfo.yourName,
      yourCompany: customVariables?.yourCompany || senderInfo.yourCompany,
      yourWebsite: customVariables?.yourWebsite || senderInfo.yourWebsite,
    };

    // Render with category-aware template selection
    return renderTemplate(prospect.language, variables, prospect.category);
  } catch (err) {
    log.error({ err, prospectId }, "Failed to render template for prospect");
    return null;
  }
}

/**
 * Get default sender info from app settings (fallback to env vars)
 */
export async function getSenderInfo(): Promise<{
  yourName: string;
  yourCompany: string;
  yourWebsite: string;
}> {
  try {
    // Try to get from app_settings table
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: ["sender_name", "sender_company", "sender_website"],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return {
      yourName: (settingsMap.get("sender_name") as string) || process.env.SENDER_NAME || "Votre Nom",
      yourCompany: (settingsMap.get("sender_company") as string) || process.env.SENDER_COMPANY || "Votre Entreprise",
      yourWebsite: (settingsMap.get("sender_website") as string) || process.env.SENDER_WEBSITE || "https://votre-site.com",
    };
  } catch (err) {
    log.error({ err }, "Failed to get sender info from settings, using defaults");
    return {
      yourName: process.env.SENDER_NAME || "Votre Nom",
      yourCompany: process.env.SENDER_COMPANY || "Votre Entreprise",
      yourWebsite: process.env.SENDER_WEBSITE || "https://votre-site.com",
    };
  }
}
