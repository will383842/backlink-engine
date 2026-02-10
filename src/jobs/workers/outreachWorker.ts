import { Worker, type Job } from "bullmq";
import { redis } from "../../config/redis.js";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { mailwizzConfig, isMailwizzConfigured } from "../../config/mailwizz.js";
import { QUEUE_NAMES } from "../queue.js";

const log = createChildLogger("outreach-worker");

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

interface RetryFailedJobData {
  type: "retry-failed";
  /** Optional: restrict retry to a specific enrollment ID */
  enrollmentId?: number;
  /** Optional: restrict retry to enrollments with this status */
  failedStatus?: string;
}

type OutreachJobData = RetryFailedJobData;

// ---------------------------------------------------------------------------
// MailWizz API helper
// ---------------------------------------------------------------------------

interface MailwizzApiResult {
  success: boolean;
  subscriberUid?: string;
  error?: string;
}

/**
 * Add or update a subscriber in MailWizz via its REST API.
 */
async function addSubscriberToMailwizz(
  listUid: string,
  email: string,
  fields: Record<string, string>
): Promise<MailwizzApiResult> {
  if (!isMailwizzConfigured()) {
    return { success: false, error: "MailWizz not configured" };
  }

  try {
    const url = `${mailwizzConfig.apiUrl}/lists/${listUid}/subscribers`;
    const body: Record<string, unknown> = {
      EMAIL: email,
      ...fields,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": mailwizzConfig.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.warn({ status: res.status, listUid, email, text }, "MailWizz API error.");
      return { success: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as {
      status: string;
      data?: { record?: { subscriber_uid?: string } };
    };

    const subscriberUid = data.data?.record?.subscriber_uid;
    return { success: true, subscriberUid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ err: message, listUid, email }, "MailWizz API call failed.");
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function processOutreachJob(job: Job<OutreachJobData>): Promise<void> {
  const { type, enrollmentId, failedStatus } = job.data;

  if (type !== "retry-failed") {
    log.warn({ type, jobId: job.id }, "Unknown outreach job type, skipping.");
    return;
  }

  log.info({ jobId: job.id, enrollmentId, failedStatus }, "Processing outreach retry.");

  // Build query to find enrollments that need retry
  const where: Record<string, unknown> = {
    status: failedStatus ?? "failed",
  };
  if (enrollmentId) {
    where["id"] = enrollmentId;
  }

  const failedEnrollments = await prisma.enrollment.findMany({
    where,
    include: {
      contact: true,
      campaign: true,
      prospect: true,
    },
    take: 50, // process in batches
  });

  if (failedEnrollments.length === 0) {
    log.info("No failed enrollments to retry.");
    return;
  }

  log.info({ count: failedEnrollments.length }, "Found failed enrollments to retry.");

  let successCount = 0;
  let failCount = 0;

  for (const enrollment of failedEnrollments) {
    const { contact, campaign, prospect } = enrollment;

    if (!contact || !campaign) {
      log.warn({ enrollmentId: enrollment.id }, "Enrollment missing contact or campaign.");
      failCount++;
      continue;
    }

    // Determine the MailWizz list UID from campaign or config
    const listUid = enrollment.mailwizzListUid ?? campaign.mailwizzListUid;
    if (!listUid) {
      log.warn(
        { enrollmentId: enrollment.id },
        "No MailWizz list UID for enrollment."
      );
      failCount++;
      continue;
    }

    // Attempt to re-add subscriber to MailWizz
    const result = await addSubscriberToMailwizz(listUid, contact.email, {
      FNAME: contact.name ?? "",
      DOMAIN: prospect.domain,
    });

    if (result.success) {
      // Update enrollment status and subscriber UID
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "active",
          mailwizzSubscriberUid: result.subscriberUid ?? enrollment.mailwizzSubscriberUid,
          stoppedReason: null,
        },
      });

      // Log success event
      await prisma.event.create({
        data: {
          prospectId: prospect.id,
          contactId: contact.id,
          enrollmentId: enrollment.id,
          eventType: "outreach_retry_success",
          eventSource: "outreach_worker",
          data: { subscriberUid: result.subscriberUid },
        },
      });

      successCount++;
    } else {
      // Log retry failure event
      await prisma.event.create({
        data: {
          prospectId: prospect.id,
          contactId: contact.id,
          enrollmentId: enrollment.id,
          eventType: "outreach_retry_failed",
          eventSource: "outreach_worker",
          data: { error: result.error },
        },
      });

      failCount++;
    }

    await job.updateProgress(
      Math.round(
        ((successCount + failCount) / failedEnrollments.length) * 100
      )
    );
  }

  log.info(
    { successCount, failCount, total: failedEnrollments.length },
    "Outreach retry batch complete."
  );
}

// ---------------------------------------------------------------------------
// Exported start function
// ---------------------------------------------------------------------------

let worker: Worker<OutreachJobData> | null = null;

/**
 * Start the outreach BullMQ worker.
 * Processes 'retry-failed' jobs that re-attempt failed MailWizz API calls.
 */
export function startOutreachWorker(): Worker<OutreachJobData> {
  const connection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
    password: redis.options.password,
    db: redis.options.db ?? 0,
  };

  worker = new Worker<OutreachJobData>(
    QUEUE_NAMES.OUTREACH,
    processOutreachJob,
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 30,
        duration: 60_000, // max 30 retries per minute
      },
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Outreach job completed.");
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, err: err.message },
      "Outreach job failed."
    );
  });

  worker.on("error", (err) => {
    log.error({ err: err.message }, "Outreach worker error.");
  });

  log.info("Outreach worker started.");
  return worker;
}
