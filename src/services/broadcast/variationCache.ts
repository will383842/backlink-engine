import { redis } from "../../config/redis.js";
import { getLlmClient } from "../../llm/index.js";
import { createChildLogger } from "../../utils/logger.js";
import type { GeneratedEmail } from "../../llm/types.js";

const log = createChildLogger("variation-cache");

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_VARIATION_COUNT = 15;

/**
 * Fallback templates used when Claude API fails.
 * Keyed by language, each with 3 basic variations.
 */
const FALLBACK_TEMPLATES: Record<string, GeneratedEmail[]> = {
  fr: [
    { subject: "Proposition de collaboration — SOS Expat", body: "Bonjour {{CONTACT_NAME}},\n\nSOS Expat accompagne les expatriés du monde entier en les connectant avec des professionnels qualifiés.\n\nNous pensons qu'une collaboration avec {{DOMAIN}} pourrait être bénéfique pour nos deux communautés.\n\nSeriez-vous disponible pour un échange ?\n\nCordialement,\nSOS Expat\nhttps://sos-expat.com" },
    { subject: "Partenariat SOS Expat × {{DOMAIN}}", body: "Bonjour {{CONTACT_NAME}},\n\nJe me permets de vous contacter depuis SOS Expat, plateforme d'assistance internationale pour expatriés.\n\nVotre activité sur {{DOMAIN}} rejoint notre mission. Un partenariat pourrait offrir une belle visibilité à nos deux organisations.\n\nÀ bientôt,\nL'équipe SOS Expat\nhttps://sos-expat.com" },
    { subject: "SOS Expat — Opportunité de partenariat", body: "Bonjour {{CONTACT_NAME}},\n\nSOS Expat met en relation les expatriés avec des avocats, consultants et experts dans plus de 50 pays.\n\nNous aimerions explorer une synergie avec {{DOMAIN}} pour mieux servir la communauté expatriée.\n\nBien cordialement,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  en: [
    { subject: "Partnership opportunity — SOS Expat", body: "Hello {{CONTACT_NAME}},\n\nSOS Expat connects expatriates worldwide with qualified professionals: lawyers, consultants, and experts.\n\nWe believe a partnership with {{DOMAIN}} could benefit both our communities.\n\nWould you be open to a brief conversation?\n\nBest regards,\nSOS Expat Team\nhttps://sos-expat.com" },
    { subject: "SOS Expat × {{DOMAIN}} — Collaboration", body: "Hi {{CONTACT_NAME}},\n\nI'm reaching out from SOS Expat, an international assistance platform for expatriates.\n\nYour work at {{DOMAIN}} aligns with our mission. A collaboration could bring valuable exposure to both our audiences.\n\nLooking forward to hearing from you,\nSOS Expat\nhttps://sos-expat.com" },
    { subject: "SOS Expat — Let's partner up", body: "Hello {{CONTACT_NAME}},\n\nSOS Expat helps expatriates find lawyers, consultants, and experts in 50+ countries.\n\nWe'd love to explore synergies with {{DOMAIN}} to better serve the expat community.\n\nKind regards,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  de: [
    { subject: "Partnerschaftsmöglichkeit — SOS Expat", body: "Hallo {{CONTACT_NAME}},\n\nSOS Expat verbindet Expatriates weltweit mit qualifizierten Fachleuten: Anwälte, Berater und Experten.\n\nWir glauben, dass eine Partnerschaft mit {{DOMAIN}} für beide Seiten vorteilhaft wäre.\n\nWären Sie offen für ein kurzes Gespräch?\n\nMit freundlichen Grüßen,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  es: [
    { subject: "Oportunidad de colaboración — SOS Expat", body: "Hola {{CONTACT_NAME}},\n\nSOS Expat conecta a expatriados de todo el mundo con profesionales cualificados: abogados, consultores y expertos.\n\nCreemos que una colaboración con {{DOMAIN}} podría beneficiar a nuestras comunidades.\n\n¿Estaría disponible para una breve conversación?\n\nSaludos cordiales,\nSOS Expat\nhttps://sos-expat.com" },
  ],
  pt: [
    { subject: "Oportunidade de parceria — SOS Expat", body: "Olá {{CONTACT_NAME}},\n\nA SOS Expat conecta expatriados em todo o mundo com profissionais qualificados: advogados, consultores e especialistas.\n\nAcreditamos que uma parceria com {{DOMAIN}} poderia beneficiar ambas as comunidades.\n\nEstaria disponível para uma breve conversa?\n\nAtenciosamente,\nSOS Expat\nhttps://sos-expat.com" },
  ],
};

/**
 * Get the Redis cache key for a campaign's variations.
 */
function cacheKey(campaignId: number, language: string, contactType: string): string {
  return `broadcast:${campaignId}:variations:${language}:${contactType}`;
}

/**
 * Get or generate variations for a campaign + language + contactType combo.
 * Caches in Redis for 7 days.
 */
export async function getVariations(
  campaignId: number,
  language: string,
  contactType: string,
  sourceEmail: { subject: string; body: string },
  brief: string,
): Promise<GeneratedEmail[]> {
  const key = cacheKey(campaignId, language, contactType);

  // Try cache first
  try {
    const cached = await redis.get(key);
    if (cached) {
      log.debug({ campaignId, language, contactType }, "Variation cache HIT");
      return JSON.parse(cached) as GeneratedEmail[];
    }
  } catch {
    // Redis error — proceed with generation
  }

  log.info({ campaignId, language, contactType }, "Variation cache MISS — generating...");

  let variations: GeneratedEmail[];
  try {
    const llm = getLlmClient();
    variations = await llm.generateBroadcastVariations({
      sourceSubject: sourceEmail.subject,
      sourceBody: sourceEmail.body,
      brief,
      language,
      contactType,
      count: DEFAULT_VARIATION_COUNT,
    });
  } catch (err) {
    log.warn({ campaignId, language, contactType, error: err instanceof Error ? err.message : String(err) }, "LLM generation failed — using fallback templates.");
    variations = FALLBACK_TEMPLATES[language] ?? FALLBACK_TEMPLATES["en"] ?? [
      { subject: "Partnership proposal — SOS Expat", body: "Hello {{CONTACT_NAME}},\n\nWe would love to discuss a collaboration with {{DOMAIN}}.\n\nBest regards,\nSOS Expat\nhttps://sos-expat.com" },
    ];
  }

  // Store in cache
  try {
    await redis.setex(key, CACHE_TTL, JSON.stringify(variations));
    log.info({ campaignId, language, contactType, count: variations.length }, "Variations cached.");
  } catch {
    // Redis error — variations still usable
  }

  return variations;
}

/**
 * Pick a random variation and personalize it with the recipient's info.
 */
export function pickAndPersonalize(
  variations: GeneratedEmail[],
  contactName: string | null,
  domain: string | null,
): GeneratedEmail {
  if (!variations.length) {
    return { subject: "Partnership proposal", body: "Hello,\n\nWe would love to discuss a collaboration.\n\nBest regards" };
  }
  const idx = Math.floor(Math.random() * variations.length);
  const variation = variations[idx];

  const name = contactName || "";
  const domainStr = domain || "";

  return {
    subject: variation.subject
      .replace(/\{\{CONTACT_NAME\}\}/g, name)
      .replace(/\{\{DOMAIN\}\}/g, domainStr),
    body: variation.body
      .replace(/\{\{CONTACT_NAME\}\}/g, name)
      .replace(/\{\{DOMAIN\}\}/g, domainStr),
  };
}

/**
 * Invalidate all cached variations for a campaign (e.g., when source email changes).
 */
export async function invalidateCampaignVariations(campaignId: number): Promise<void> {
  try {
    const keys = await redis.keys(`broadcast:${campaignId}:variations:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      log.info({ campaignId, count: keys.length }, "Variation cache invalidated.");
    }
  } catch {
    // Ignore Redis errors
  }
}
