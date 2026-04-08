// ---------------------------------------------------------------------------
// Outreach Mode — auto vs review
// ---------------------------------------------------------------------------
// - "auto":   emails are generated and sent immediately (no human review)
// - "review": emails are generated as drafts, requiring manual approval
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("outreach-mode");

export type OutreachMode = "auto" | "review";

const SETTING_KEY = "outreach_mode";

/**
 * Get current outreach mode. Defaults to "review" (safe default).
 */
export async function getOutreachMode(): Promise<OutreachMode> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row) {
      const val = (row.value as Record<string, unknown>).mode;
      if (val === "auto" || val === "review") return val;
    }
  } catch {
    // DB error — default to safe mode
  }
  return "review";
}

/**
 * Set outreach mode.
 */
export async function setOutreachMode(mode: OutreachMode): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: { mode } as any },
    update: { value: { mode } as any },
  });
  log.info({ mode }, "Outreach mode updated");
}

/**
 * Check if we should send immediately or create a draft.
 */
export async function shouldSendImmediately(): Promise<boolean> {
  return (await getOutreachMode()) === "auto";
}
