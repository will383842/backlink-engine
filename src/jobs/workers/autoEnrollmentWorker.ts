/**
 * Auto-Enrollment Worker
 *
 * Automatically enrolls prospects in campaigns based on matching criteria:
 * - Language
 * - Country
 * - Tier (score range)
 * - Category
 *
 * Triggered by cron job every 10 minutes
 */

import { Job, Worker } from "bullmq";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { getCampaignByProspect } from "../../services/autoEnrollment/campaignSelector.js";
import { outreachQueue } from "../queue.js";
import { redisConnection } from "../../config/redis.js";

const log = logger.child({ worker: "auto-enrollment" });

export interface AutoEnrollmentJobData {
  triggeredAt: string;
}

export async function processAutoEnrollment(
  job: Job<AutoEnrollmentJobData>
): Promise<{ enrolled: number; skipped: number }> {
  const { triggeredAt } = job.data;

  log.info({ triggeredAt }, "Starting auto-enrollment batch");

  let enrolled = 0;
  let skipped = 0;

  try {
    // ────────────────────────────────────────────────────────────
    // 1. Fetch prospects ready to contact
    // ────────────────────────────────────────────────────────────

    const prospects = await prisma.prospect.findMany({
      where: {
        status: "READY_TO_CONTACT",
        // Not already enrolled
        enrollments: {
          none: {},
        },
      },
      take: 100, // Batch size (process 100 at a time)
      orderBy: {
        enrichedScore: "desc", // Prioritize high-score prospects
      },
    });

    if (prospects.length === 0) {
      log.info("No prospects ready for auto-enrollment");
      return { enrolled: 0, skipped: 0 };
    }

    log.info({ count: prospects.length }, "Found prospects for auto-enrollment");

    // ────────────────────────────────────────────────────────────
    // 2. For each prospect, find matching campaign
    // ────────────────────────────────────────────────────────────

    for (const prospect of prospects) {
      try {
        // Find best matching campaign
        const campaign = await getCampaignByProspect(prospect);

        if (!campaign) {
          log.debug(
            {
              prospectId: prospect.id,
              domain: prospect.domain,
              language: prospect.language,
              country: prospect.country,
              tier: prospect.tier,
            },
            "No matching campaign found for prospect"
          );
          skipped++;
          continue;
        }

        // ────────────────────────────────────────────────────────────
        // 3. Create enrollment
        // ────────────────────────────────────────────────────────────

        const contact = await prisma.contact.findFirst({
          where: { prospectId: prospect.id },
        });

        if (!contact) {
          log.warn(
            { prospectId: prospect.id },
            "Prospect has no contact, skipping enrollment"
          );
          skipped++;
          continue;
        }

        await prisma.enrollment.create({
          data: {
            prospectId: prospect.id,
            contactId: contact.id,
            campaignId: campaign.id,
            status: "active",
            enrolledAt: new Date(),
          },
        });

        // ────────────────────────────────────────────────────────────
        // 4. Create event
        // ────────────────────────────────────────────────────────────

        await prisma.event.create({
          data: {
            prospectId: prospect.id,
            contactId: contact.id,
            eventType: "ENROLLED",
            eventData: {
              campaignId: campaign.id,
              campaignName: campaign.name,
              autoEnrolled: true,
              enrolledAt: new Date().toISOString(),
            },
          },
        });

        log.info(
          {
            prospectId: prospect.id,
            domain: prospect.domain,
            campaignId: campaign.id,
            campaignName: campaign.name,
          },
          "Prospect auto-enrolled successfully"
        );

        enrolled++;
      } catch (error) {
        log.error(
          {
            err: error,
            prospectId: prospect.id,
            domain: prospect.domain,
          },
          "Failed to auto-enroll prospect"
        );
        skipped++;
      }
    }

    // ────────────────────────────────────────────────────────────
    // 5. Log summary
    // ────────────────────────────────────────────────────────────

    log.info(
      {
        total: prospects.length,
        enrolled,
        skipped,
        triggeredAt,
      },
      "Auto-enrollment batch completed"
    );

    return { enrolled, skipped };
  } catch (error) {
    log.error({ err: error }, "Auto-enrollment batch failed");
    throw error;
  }
}

/**
 * Start the auto-enrollment worker
 * Listens to the outreach queue for "auto-enrollment" jobs
 */
export function startAutoEnrollmentWorker(): void {
  const worker = new Worker(
    outreachQueue.name,
    async (job: Job) => {
      // Only process auto-enrollment jobs
      if (job.data.type === "auto-enrollment") {
        return await processAutoEnrollment(job as Job<AutoEnrollmentJobData>);
      }
      // Let other workers handle other job types
      return null;
    },
    {
      connection: redisConnection,
      concurrency: 1, // Process one batch at a time
    }
  );

  worker.on("completed", (job) => {
    log.info(
      {
        jobId: job.id,
        result: job.returnvalue,
      },
      "Auto-enrollment job completed"
    );
  });

  worker.on("failed", (job, err) => {
    log.error(
      {
        jobId: job?.id,
        err,
      },
      "Auto-enrollment job failed"
    );
  });

  log.info("Auto-enrollment worker started");
}
