// ─────────────────────────────────────────────────────────────
// Tag Auto-Detection Service
// ─────────────────────────────────────────────────────────────

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("tag-detector");

// ─────────────────────────────────────────────────────────────
// Tag Detection Rules
// ─────────────────────────────────────────────────────────────

interface TagRule {
  tagName: string;
  category: string;
  detect: (domain: string, content?: string, metadata?: Record<string, unknown>) => boolean;
}

// Mutually exclusive tag groups — assigning one removes the others from the same group
const EXCLUSIVE_GROUPS: string[][] = [
  ["has_email", "form_only", "email_and_form", "unreachable"],
  ["premium", "high_authority", "mid_quality", "low_quality"],
];

const TAG_RULES: TagRule[] = [
  // ═══════════════════════════════════════════════════════════
  // TYPE (Type de site)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "presse_ecrite",
    category: "type",
    detect: (domain, content) => {
      const keywords = ["journal", "presse", "news", "magazine", "quotidien", "hebdo"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "blogueur",
    category: "type",
    detect: (domain, content) => {
      const keywords = ["blog", "bloguer", "blogger"];
      return keywords.some(k => domain.toLowerCase().includes(k));
    },
  },
  {
    tagName: "influenceur",
    category: "type",
    detect: (domain, content, metadata) => {
      // Détection basée sur category = influencer OU présence social media
      if (metadata?.category === "influencer") return true;
      const socialKeywords = ["instagram", "youtube", "tiktok", "influenc"];
      return content ? socialKeywords.some(k => content.toLowerCase().includes(k)) : false;
    },
  },
  {
    tagName: "media",
    category: "type",
    detect: (domain, content, metadata) => {
      if (metadata?.category === "media") return true;
      const keywords = ["tv", "radio", "média", "media", "télé"];
      return keywords.some(k => domain.toLowerCase().includes(k));
    },
  },

  // ═══════════════════════════════════════════════════════════
  // SECTOR (Secteur d'activité)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "assurance",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["assurance", "insurance", "mutuelle"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "finance",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["banque", "finance", "bank", "crédit", "credit", "investissement"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "voyage",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["voyage", "travel", "tourisme", "tourism", "vacances", "holiday"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "tech",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["tech", "technologie", "technology", "digital", "numérique", "software", "app"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "sante",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["santé", "health", "médical", "medical", "hopital", "hospital", "clinique"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "immobilier",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["immobilier", "immo", "real estate", "property", "maison", "appartement"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },
  {
    tagName: "education",
    category: "sector",
    detect: (domain, content) => {
      const keywords = ["education", "école", "school", "university", "université", "formation", "cours"];
      const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
      const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
      return domainMatch || contentMatch;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // QUALITY (Qualité)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "premium",
    category: "quality",
    detect: (domain, content, metadata) => {
      return metadata?.tier === 1;
    },
  },
  {
    tagName: "high_authority",
    category: "quality",
    detect: (domain, content, metadata) => {
      return typeof metadata?.score === "number" && metadata.score >= 80;
    },
  },
  {
    tagName: "verified",
    category: "quality",
    detect: (domain, content, metadata) => {
      // Site vérifié = a un email vérifié + score > 50
      return metadata?.hasVerifiedEmail === true &&
             typeof metadata?.score === "number" &&
             metadata.score >= 50;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // GEOGRAPHY (Géographie)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "france",
    category: "geography",
    detect: (domain, content, metadata) => {
      return metadata?.country === "FR";
    },
  },
  {
    tagName: "europe",
    category: "geography",
    detect: (domain, content, metadata) => {
      const europeanCountries = [
        "FR", "DE", "ES", "IT", "UK", "NL", "BE", "CH", "AT", "PT",
        "PL", "SE", "NO", "FI", "DK", "IE", "GR", "CZ", "RO", "HU"
      ];
      return !!metadata?.country && europeanCountries.includes(metadata.country as string);
    },
  },
  {
    tagName: "international",
    category: "geography",
    detect: (domain, content, metadata) => {
      // Site international = multi-langues OU contient "international" dans domain
      const hasInternational = domain.toLowerCase().includes("international");
      const isMultiLang = content ?
        (content.match(/lang=/g) || []).length > 2 : // Détection multi-langues basique
        false;
      return hasInternational || isMultiLang;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // CONTACTABILITY (4 tags mutually exclusive — each prospect gets exactly one)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "has_email",
    category: "other",
    detect: (_, __, metadata) =>
      metadata?.hasValidEmail === true && metadata?.hasForm !== true,
  },
  {
    tagName: "form_only",
    category: "other",
    detect: (_, __, metadata) =>
      metadata?.hasForm === true && metadata?.hasValidEmail !== true,
  },
  {
    tagName: "email_and_form",
    category: "other",
    detect: (_, __, metadata) =>
      metadata?.hasValidEmail === true && metadata?.hasForm === true,
  },
  {
    tagName: "unreachable",
    category: "other",
    detect: (_, __, metadata) =>
      metadata?.hasValidEmail !== true && metadata?.hasForm !== true,
  },

  // ═══════════════════════════════════════════════════════════
  // CATEGORY FALLBACK (1 tag per Prospect enum category — ensures 100% tagging)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "cat_blogger",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "blogger",
  },
  {
    tagName: "cat_media",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "media",
  },
  {
    tagName: "cat_influencer",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "influencer",
  },
  {
    tagName: "cat_association",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "association",
  },
  {
    tagName: "cat_corporate",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "corporate",
  },
  {
    tagName: "cat_partner",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "partner",
  },
  {
    tagName: "cat_agency",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "agency",
  },
  {
    tagName: "cat_ecommerce",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "ecommerce",
  },
  {
    tagName: "cat_other",
    category: "type",
    detect: (_, __, metadata) => metadata?.category === "other",
  },

  // ═══════════════════════════════════════════════════════════
  // QUALITY FALLBACK (mid/low) — complements existing "premium" (tier 1) and "high_authority" (score 80+)
  // ═══════════════════════════════════════════════════════════
  {
    tagName: "mid_quality",
    category: "quality",
    detect: (_, __, metadata) => {
      if (metadata?.tier === 2) return true;
      if (typeof metadata?.score === "number" && metadata.score >= 30 && metadata.score < 80) return true;
      return false;
    },
  },
  {
    tagName: "low_quality",
    category: "quality",
    detect: (_, __, metadata) => {
      if (metadata?.tier === 3 || metadata?.tier === 4) return true;
      if (typeof metadata?.score === "number" && metadata.score > 0 && metadata.score < 30) return true;
      return false;
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

/**
 * Detect and assign tags to a prospect automatically
 */
export async function detectAndAssignTags(
  prospectId: number,
  domain: string,
  content?: string,
  metadata?: {
    category?: string;
    tier?: number;
    score?: number;
    country?: string;
    hasVerifiedEmail?: boolean;
    hasValidEmail?: boolean;
    hasForm?: boolean;
  }
): Promise<string[]> {
  const assignedTags: string[] = [];

  log.debug({ prospectId, domain }, "Starting tag detection");

  // Remove any pre-existing tags from exclusive groups so only the freshly-detected one remains
  const exclusiveNames = EXCLUSIVE_GROUPS.flat();
  if (exclusiveNames.length > 0) {
    await prisma.prospectTag.deleteMany({
      where: {
        prospectId,
        tag: { name: { in: exclusiveNames } },
      },
    });
  }

  for (const rule of TAG_RULES) {
    try {
      if (rule.detect(domain, content, metadata)) {
        // Ensure tag exists in database
        const tag = await ensureTagExists(rule.tagName, rule.category as any);

        // Assign tag to prospect (if not already assigned)
        await assignTagToProspect(prospectId, tag.id, "auto");

        assignedTags.push(rule.tagName);
      }
    } catch (err) {
      log.error({ err, rule: rule.tagName }, "Failed to detect/assign tag");
    }
  }

  log.info({ prospectId, assignedTags }, `Auto-assigned ${assignedTags.length} tags`);

  return assignedTags;
}

/**
 * Ensure a tag exists in the database (create if not exists)
 */
async function ensureTagExists(
  name: string,
  category: "type" | "sector" | "quality" | "geography" | "source" | "other"
): Promise<{ id: number; name: string }> {
  const existing = await prisma.tag.findUnique({
    where: { name },
  });

  if (existing) {
    return existing;
  }

  // Create new tag
  const label = formatTagLabel(name);
  const color = getTagColor(category);

  return prisma.tag.create({
    data: {
      name,
      label,
      category,
      color,
      isAutoTag: true,
    },
  });
}

/**
 * Assign a tag to a prospect (idempotent - no error if already assigned)
 */
export async function assignTagToProspect(
  prospectId: number,
  tagId: number,
  assignedBy: string = "auto"
): Promise<void> {
  try {
    await prisma.prospectTag.create({
      data: {
        prospectId,
        tagId,
        assignedBy,
      },
    });
  } catch (err: any) {
    // Ignore duplicate key error (already assigned)
    if (err?.code !== "P2002") {
      throw err;
    }
  }
}

/**
 * Remove a tag from a prospect
 */
export async function removeTagFromProspect(
  prospectId: number,
  tagId: number
): Promise<void> {
  await prisma.prospectTag.delete({
    where: {
      prospectId_tagId: { prospectId, tagId },
    },
  });
}

/**
 * Get all tags for a prospect
 */
export async function getProspectTags(prospectId: number) {
  return prisma.prospectTag.findMany({
    where: { prospectId },
    include: { tag: true },
    orderBy: [
      { tag: { category: "asc" } },
      { tag: { name: "asc" } },
    ],
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTagLabel(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTagColor(category: string): string {
  const colors: Record<string, string> = {
    type: "#3B82F6",      // Blue
    sector: "#10B981",    // Green
    quality: "#F59E0B",   // Amber
    geography: "#8B5CF6", // Purple
    source: "#6B7280",    // Gray
    other: "#EF4444",     // Red — also used for contactability tags
  };
  return colors[category] || "#6B7280";
}
