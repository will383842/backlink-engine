import { redis } from "../../config/redis.js";
import { getLlmClient } from "../../llm/index.js";
import { createChildLogger } from "../../utils/logger.js";
import type { GeneratedEmail } from "../../llm/types.js";

const log = createChildLogger("variation-cache");

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_VARIATION_COUNT = 15;

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

  const llm = getLlmClient();
  const variations = await llm.generateBroadcastVariations({
    sourceSubject: sourceEmail.subject,
    sourceBody: sourceEmail.body,
    brief,
    language,
    contactType,
    count: DEFAULT_VARIATION_COUNT,
  });

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
