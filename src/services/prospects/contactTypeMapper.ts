// ---------------------------------------------------------------------------
// Contact Type Mapper — canonical source of truth for sourceContactType → ProspectCategory
// ---------------------------------------------------------------------------
//
// Replaces the CATEGORY_MAP hard-coded in webhooks.ts. Entries are stored in
// the DB (ContactTypeMapping) so they can be edited from the admin UI without
// redeploying.
//
// Cache: 60s in-memory — same pattern as automationToggles.ts:36.
// ---------------------------------------------------------------------------

import type { ProspectCategory } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("contact-type-mapper");

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  map: Map<string, ProspectCategory>;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

/**
 * Normalise a user-provided contact type to a canonical lookup key.
 * Lowercase, strip diacritics, trim, collapse whitespace to a single hyphen.
 * "Journaliste Presse" → "journaliste-presse"; "Youtubeur" → "youtubeur".
 */
export function normalizeTypeKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadMap(): Promise<Map<string, ProspectCategory>> {
  const rows = await prisma.contactTypeMapping.findMany({
    select: { typeKey: true, category: true },
  });
  const map = new Map<string, ProspectCategory>();
  for (const row of rows) map.set(row.typeKey, row.category);
  return map;
}

async function getMap(forceRefresh = false): Promise<Map<string, ProspectCategory>> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.map;
  }
  const map = await loadMap();
  cache = { map, fetchedAt: Date.now() };
  return map;
}

/**
 * Look up a ProspectCategory from a free-text sourceContactType.
 * Falls back to "other" when no mapping exists.
 */
export async function inferCategory(
  sourceContactType: string | null | undefined,
): Promise<ProspectCategory> {
  const key = normalizeTypeKey(sourceContactType);
  if (!key) return "other";
  const map = await getMap();
  return map.get(key) ?? "other";
}

/**
 * Invalidate the in-memory cache so the next lookup refetches from DB.
 * Called by CRUD routes after writes.
 */
export function invalidateMappingCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// CRUD helpers (used by the REST routes)
// ---------------------------------------------------------------------------

export async function listMappings() {
  return prisma.contactTypeMapping.findMany({
    orderBy: [{ category: "asc" }, { typeKey: "asc" }],
  });
}

export async function createMapping(input: {
  typeKey: string;
  category: ProspectCategory;
  label?: string | null;
  isSystem?: boolean;
}) {
  const typeKey = normalizeTypeKey(input.typeKey);
  if (!typeKey) {
    throw Object.assign(new Error("typeKey is empty after normalisation"), {
      statusCode: 400,
    });
  }
  const row = await prisma.contactTypeMapping.create({
    data: {
      typeKey,
      category: input.category,
      label: input.label ?? null,
      isSystem: input.isSystem ?? false,
    },
  });
  invalidateMappingCache();
  log.info({ typeKey, category: input.category }, "Contact type mapping created.");
  return row;
}

export async function updateMapping(
  id: number,
  patch: { category?: ProspectCategory; label?: string | null; typeKey?: string },
) {
  const existing = await prisma.contactTypeMapping.findUniqueOrThrow({ where: { id } });

  const data: {
    category?: ProspectCategory;
    label?: string | null;
    typeKey?: string;
  } = {};

  if (patch.category !== undefined) data.category = patch.category;
  if (patch.label !== undefined) data.label = patch.label;

  if (patch.typeKey !== undefined) {
    if (existing.isSystem) {
      throw Object.assign(new Error("Cannot rename typeKey on a system mapping"), {
        statusCode: 400,
      });
    }
    const key = normalizeTypeKey(patch.typeKey);
    if (!key) {
      throw Object.assign(new Error("typeKey is empty after normalisation"), {
        statusCode: 400,
      });
    }
    data.typeKey = key;
  }

  const row = await prisma.contactTypeMapping.update({ where: { id }, data });
  invalidateMappingCache();
  log.info({ id, patch }, "Contact type mapping updated.");
  return row;
}

export async function deleteMapping(id: number) {
  const existing = await prisma.contactTypeMapping.findUniqueOrThrow({ where: { id } });
  if (existing.isSystem) {
    throw Object.assign(new Error("Cannot delete a system mapping"), {
      statusCode: 400,
    });
  }
  await prisma.contactTypeMapping.delete({ where: { id } });
  invalidateMappingCache();
  log.info({ id, typeKey: existing.typeKey }, "Contact type mapping deleted.");
}
