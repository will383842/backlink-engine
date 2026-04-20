// ---------------------------------------------------------------------------
// Domain Health Monitor — skip unhealthy sending domains in rotation.
//
// Calculates bounce rate + complaint rate over the last 7 days per sending
// domain. A domain exceeding either threshold is "unhealthy" and gets
// excluded from round-robin until its stats recover.
//
// This protects long-term reputation: one runaway domain can drag down the
// whole IP. A 10% bounce rate for a week is inbox-placement death on Gmail.
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("domain-health");

// Thresholds over a rolling 7-day window. Beyond these, the domain is paused.
// Both are conservative — Gmail/Microsoft start throttling around 0.3-0.5%.
const MAX_BOUNCE_RATE = 0.05; // 5%
const MAX_COMPLAINT_RATE = 0.01; // 1%

// Minimum sample size before we evaluate a domain. Below this, we don't have
// enough signal — keep the domain active.
const MIN_SAMPLE_SIZE = 20;

const WINDOW_DAYS = 7;

export interface DomainHealth {
  domain: string;
  sent: number;
  bounced: number;
  complained: number;
  bounceRate: number;
  complaintRate: number;
  healthy: boolean;
  reason?: string;
}

/**
 * Compute per-domain health over the last 7 days.
 * One row per domain that has sent at least one email in the window.
 */
export async function getDomainHealth(): Promise<DomainHealth[]> {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // Group SentEmail by the sender domain. fromEmail is stored like
  // "contact@plane-liberty.com" so we strip the local part.
  const rows = await prisma.sentEmail.findMany({
    where: { sentAt: { gte: cutoff }, status: { notIn: ["draft", "failed"] } },
    select: { fromEmail: true, bouncedAt: true, complainedAt: true },
  });

  const tally = new Map<string, { sent: number; bounced: number; complained: number }>();
  for (const row of rows) {
    const domain = (row.fromEmail ?? "").split("@")[1]?.toLowerCase();
    if (!domain) continue;
    if (!tally.has(domain)) tally.set(domain, { sent: 0, bounced: 0, complained: 0 });
    const entry = tally.get(domain)!;
    entry.sent++;
    if (row.bouncedAt) entry.bounced++;
    if (row.complainedAt) entry.complained++;
  }

  const result: DomainHealth[] = [];
  for (const [domain, { sent, bounced, complained }] of tally) {
    const bounceRate = sent > 0 ? bounced / sent : 0;
    const complaintRate = sent > 0 ? complained / sent : 0;
    let healthy = true;
    let reason: string | undefined;

    if (sent >= MIN_SAMPLE_SIZE) {
      if (bounceRate > MAX_BOUNCE_RATE) {
        healthy = false;
        reason = `bounce rate ${(bounceRate * 100).toFixed(1)}% > ${(MAX_BOUNCE_RATE * 100).toFixed(0)}%`;
      } else if (complaintRate > MAX_COMPLAINT_RATE) {
        healthy = false;
        reason = `complaint rate ${(complaintRate * 100).toFixed(2)}% > ${(MAX_COMPLAINT_RATE * 100).toFixed(1)}%`;
      }
    }

    result.push({ domain, sent, bounced, complained, bounceRate, complaintRate, healthy, reason });
  }

  return result.sort((a, b) => b.sent - a.sent);
}

/**
 * Return the set of unhealthy sending domains (to be skipped in rotation).
 */
export async function getUnhealthyDomains(): Promise<Set<string>> {
  try {
    const health = await getDomainHealth();
    const unhealthy = new Set<string>();
    for (const row of health) {
      if (!row.healthy) {
        unhealthy.add(row.domain);
        log.warn({ domain: row.domain, reason: row.reason, sent: row.sent }, "Domain flagged unhealthy");
      }
    }
    return unhealthy;
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, "Failed to compute domain health, returning empty set");
    return new Set<string>();
  }
}
