import { prisma } from "../../config/database.js";

// ─────────────────────────────────────────────────────────────
// MailWizz configuration helper
// ─────────────────────────────────────────────────────────────

export interface MailwizzConfig {
  enabled: boolean;
  dryRun: boolean;
  apiUrl: string | null;
  apiKey: string | null;
}

/**
 * Get current MailWizz configuration from DB (with fallback to env vars).
 *
 * Priority:
 * 1. Database AppSettings (if exists)
 * 2. Environment variables (fallback)
 * 3. Defaults (disabled, dry-run)
 */
export async function getMailwizzConfig(): Promise<MailwizzConfig> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "mailwizz" },
    });

    if (setting) {
      const config = setting.value as Record<string, unknown>;
      return {
        enabled: config.enabled === true,
        dryRun: config.dryRun !== false, // Default to true for safety
        apiUrl: (config.apiUrl as string) || process.env.MAILWIZZ_API_URL || null,
        apiKey: (config.apiKey as string) || process.env.MAILWIZZ_API_KEY || null,
      };
    }
  } catch (err) {
    // DB might not be available yet (first boot)
    console.warn("Could not load MailWizz config from DB, using env defaults");
  }

  // Fallback to environment variables
  return {
    enabled: process.env.MAILWIZZ_ENABLED === "true",
    dryRun: process.env.MAILWIZZ_DRY_RUN !== "false", // Default to true
    apiUrl: process.env.MAILWIZZ_API_URL || null,
    apiKey: process.env.MAILWIZZ_API_KEY || null,
  };
}

/**
 * Check if MailWizz is enabled and ready to send emails.
 *
 * Returns true only if:
 * - enabled: true
 * - dryRun: false
 * - apiUrl and apiKey are configured
 */
export async function isMailwizzReady(): Promise<boolean> {
  const config = await getMailwizzConfig();

  return (
    config.enabled === true &&
    config.dryRun === false &&
    !!config.apiUrl &&
    !!config.apiKey
  );
}

/**
 * Check if dry-run mode is enabled (log without sending).
 */
export async function isMailwizzDryRun(): Promise<boolean> {
  const config = await getMailwizzConfig();
  return config.enabled === true && config.dryRun === true;
}
