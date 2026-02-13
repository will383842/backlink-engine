// ---------------------------------------------------------------------------
// Ingestion Service - Core ingestion pipeline
// ---------------------------------------------------------------------------

import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";
import { normalizeUrl, extractDomain } from "../../utils/urlNormalizer.js";
import { detectLanguage } from "../enrichment/languageDetector.js";
import { detectCountry } from "../enrichment/countryDetector.js";
import { enrichmentQueue } from "../../jobs/queue.js";

const log = createChildLogger("ingest");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestInput {
  url: string;
  email?: string;
  name?: string;
  language?: string;
  country?: string;
  category?: string;
  contactFormUrl?: string;
  notes?: string;
  source: "manual" | "csv_import" | "scraper";
  meta?: Record<string, unknown>;
}

export interface IngestResult {
  status: "created" | "duplicate" | "error";
  prospectId?: number;
  existingStatus?: string;
  error?: string;
}

export interface BulkIngestResult {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
  details: IngestResult[];
}

// ---------------------------------------------------------------------------
// Single prospect ingestion
// ---------------------------------------------------------------------------

export async function ingestProspect(data: IngestInput): Promise<IngestResult> {
  try {
    // 1. Normalize URL and extract domain
    const normalized = normalizeUrl(data.url);
    const domain = extractDomain(data.url);

    log.info({ domain, source: data.source }, "Ingesting prospect");

    // 2. Check for duplicate domain
    const existing = await prisma.prospect.findUnique({
      where: { domain },
      select: { id: true, status: true },
    });

    if (existing) {
      log.info({ domain, existingId: existing.id }, "Duplicate domain found");

      // Still add the source URL if it's new
      const existingUrl = await prisma.sourceUrl.findUnique({
        where: { urlNormalized: normalized },
      });

      if (!existingUrl) {
        await prisma.sourceUrl.create({
          data: {
            prospectId: existing.id,
            url: data.url,
            urlNormalized: normalized,
            discoveredVia: data.source,
            notes: data.notes,
          },
        });
        log.debug({ domain, url: normalized }, "Added new source URL to existing prospect");
      }

      return {
        status: "duplicate",
        prospectId: existing.id,
        existingStatus: existing.status,
      };
    }

    // 3. Detect language and country from TLD if not provided
    const language = detectLanguage(domain, data.language);
    const country = detectCountry(domain, data.country);

    // 4. Create prospect, source URL, and optionally a contact in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the prospect
      const prospect = await tx.prospect.create({
        data: {
          domain,
          source: data.source,
          category: data.category || "blogger",
          language: language !== "unknown" ? language : null,
          country: country || null,
          contactFormUrl: data.contactFormUrl,
          status: "NEW",
        },
      });

      // Create the source URL
      await tx.sourceUrl.create({
        data: {
          prospectId: prospect.id,
          url: data.url,
          urlNormalized: normalized,
          discoveredVia: data.source,
          notes: data.notes,
        },
      });

      // Create contact if email provided
      if (data.email) {
        const emailNormalized = data.email.trim().toLowerCase();
        await tx.contact.create({
          data: {
            prospectId: prospect.id,
            email: data.email,
            emailNormalized,
            name: data.name ?? null,
            discoveredVia: data.source,
          },
        });
      }

      // Create ingestion event
      await tx.event.create({
        data: {
          prospectId: prospect.id,
          eventType: "PROSPECT_CREATED",
          eventSource: data.source,
          data: {
            url: data.url,
            language,
            country,
            meta: (data.meta ?? null) as import("@prisma/client").Prisma.InputJsonValue | null,
          } as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });

      return prospect;
    });

    // 5. Trigger enrichment job (async, non-blocking)
    await triggerEnrichmentJob(result.id, domain);

    log.info({ prospectId: result.id, domain }, "Prospect created successfully");

    return {
      status: "created",
      prospectId: result.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, url: data.url }, "Failed to ingest prospect");
    return {
      status: "error",
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Bulk ingestion
// ---------------------------------------------------------------------------

export async function ingestBulk(
  prospects: IngestInput[],
): Promise<BulkIngestResult> {
  const details: IngestResult[] = [];
  let created = 0;
  let duplicates = 0;
  let errors = 0;

  log.info({ total: prospects.length }, "Starting bulk ingestion");

  for (const prospect of prospects) {
    const result = await ingestProspect(prospect);
    details.push(result);

    switch (result.status) {
      case "created":
        created++;
        break;
      case "duplicate":
        duplicates++;
        break;
      case "error":
        errors++;
        break;
    }
  }

  const summary: BulkIngestResult = {
    total: prospects.length,
    created,
    duplicates,
    errors,
    details,
  };

  log.info(
    { total: summary.total, created, duplicates, errors },
    "Bulk ingestion complete",
  );

  return summary;
}

// ---------------------------------------------------------------------------
// Enrichment job trigger (BullMQ)
// ---------------------------------------------------------------------------

async function triggerEnrichmentJob(
  prospectId: number,
  domain: string,
): Promise<void> {
  try {
    // FIX: Trigger BullMQ enrichment job
    await enrichmentQueue.add(
      "auto-score",
      {
        type: "auto-score" as const,
        prospectId,
      },
      {
        jobId: `enrich-${prospectId}`,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    );

    // Update prospect status to ENRICHING
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "ENRICHING" },
    });

    log.debug({ prospectId, domain }, "Enrichment job triggered");
  } catch (err) {
    log.error({ err, prospectId }, "Failed to trigger enrichment job");
    // Non-fatal: prospect stays as NEW and can be enriched later
  }
}
