// ---------------------------------------------------------------------------
// Auto-Enrollment Configuration Service
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("auto-enrollment-config");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoEnrollmentConfig {
  /** Global enable/disable auto-enrollment */
  enabled: boolean;

  /** Throttle: max enrollments per hour (0 = unlimited) */
  maxPerHour: number;

  /** Throttle: max enrollments per day (0 = unlimited) */
  maxPerDay: number;

  /** Minimum score required for auto-enrollment */
  minScore: number;

  /** Minimum tier allowed (1-4, where 1 is best) */
  minTier: number;

  /** Categories eligible for auto-enrollment */
  allowedCategories: string[];

  /** Languages eligible for auto-enrollment */
  allowedLanguages: string[];

  /** Only enroll if prospect has verified email */
  requireVerifiedEmail: boolean;
}

// Default configuration
const DEFAULT_CONFIG: AutoEnrollmentConfig = {
  enabled: false, // Disabled by default for safety
  maxPerHour: 50,
  maxPerDay: 500,
  minScore: 50,
  minTier: 3, // Tiers 1-3 are eligible
  allowedCategories: ["blogger", "influencer", "media"],
  allowedLanguages: ["fr", "en", "de", "es", "pt"],
  requireVerifiedEmail: true,
};

// ---------------------------------------------------------------------------
// Config retrieval (DB → env → defaults)
// ---------------------------------------------------------------------------

/**
 * Get auto-enrollment configuration.
 * Priority: DB settings → defaults
 */
export async function getAutoEnrollmentConfig(): Promise<AutoEnrollmentConfig> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "auto_enrollment" },
    });

    if (setting?.value) {
      const dbConfig = setting.value as Partial<AutoEnrollmentConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...dbConfig,
      };
    }
  } catch (err) {
    log.warn({ err }, "Failed to load auto-enrollment config from DB, using defaults.");
  }

  return DEFAULT_CONFIG;
}

/**
 * Update auto-enrollment configuration in DB.
 */
export async function updateAutoEnrollmentConfig(
  config: Partial<AutoEnrollmentConfig>
): Promise<void> {
  const current = await getAutoEnrollmentConfig();
  const updated = { ...current, ...config };

  await prisma.appSetting.upsert({
    where: { key: "auto_enrollment" },
    create: {
      key: "auto_enrollment",
      value: updated,
    },
    update: {
      value: updated,
    },
  });

  log.info({ config: updated }, "Auto-enrollment config updated.");
}

// ---------------------------------------------------------------------------
// Throttle tracking
// ---------------------------------------------------------------------------

interface ThrottleStats {
  enrolledLastHour: number;
  enrolledToday: number;
}

/**
 * Get current throttle stats (enrollments in last hour and today).
 */
export async function getThrottleStats(): Promise<ThrottleStats> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [lastHour, today] = await Promise.all([
    prisma.enrollment.count({
      where: {
        enrolledAt: { gte: oneHourAgo },
      },
    }),
    prisma.enrollment.count({
      where: {
        enrolledAt: { gte: startOfDay },
      },
    }),
  ]);

  return {
    enrolledLastHour: lastHour,
    enrolledToday: today,
  };
}

/**
 * Check if auto-enrollment is allowed based on throttle limits.
 */
export async function canAutoEnroll(): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const config = await getAutoEnrollmentConfig();

  if (!config.enabled) {
    return { allowed: false, reason: "auto_enrollment_disabled" };
  }

  const stats = await getThrottleStats();

  if (config.maxPerHour > 0 && stats.enrolledLastHour >= config.maxPerHour) {
    return {
      allowed: false,
      reason: `hourly_limit_reached (${stats.enrolledLastHour}/${config.maxPerHour})`,
    };
  }

  if (config.maxPerDay > 0 && stats.enrolledToday >= config.maxPerDay) {
    return {
      allowed: false,
      reason: `daily_limit_reached (${stats.enrolledToday}/${config.maxPerDay})`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a prospect is eligible for auto-enrollment based on config rules.
 */
export async function isProspectEligible(prospectId: number): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const config = await getAutoEnrollmentConfig();

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      contacts: {
        where: {
          optedOut: false,
          emailStatus: { not: "invalid" },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!prospect) {
    return { eligible: false, reason: "prospect_not_found" };
  }

  // Must have a valid contact
  const validContact = prospect.contacts[0];
  if (!validContact) {
    return { eligible: false, reason: "no_valid_contact" };
  }

  // Must have verified email if required
  if (config.requireVerifiedEmail && validContact.emailStatus !== "verified") {
    return { eligible: false, reason: "email_not_verified" };
  }

  // Must be in READY_TO_CONTACT status
  if (prospect.status !== "READY_TO_CONTACT") {
    return { eligible: false, reason: `wrong_status:${prospect.status}` };
  }

  // Check score threshold
  if (prospect.score < config.minScore) {
    return {
      eligible: false,
      reason: `score_too_low:${prospect.score}<${config.minScore}`,
    };
  }

  // Check tier threshold (1 is best, 4 is worst)
  if (prospect.tier > config.minTier) {
    return {
      eligible: false,
      reason: `tier_too_low:T${prospect.tier}>T${config.minTier}`,
    };
  }

  // Check category whitelist
  if (!config.allowedCategories.includes(prospect.category)) {
    return {
      eligible: false,
      reason: `category_not_allowed:${prospect.category}`,
    };
  }

  // Check language whitelist (if language is set)
  if (prospect.language && !config.allowedLanguages.includes(prospect.language)) {
    return {
      eligible: false,
      reason: `language_not_allowed:${prospect.language}`,
    };
  }

  return { eligible: true };
}
