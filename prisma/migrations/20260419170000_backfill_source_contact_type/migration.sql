-- ─────────────────────────────────────────────────────────────
-- Backfill sourceContactType on prospects + contacts (100% coverage)
-- ─────────────────────────────────────────────────────────────
--
-- Fully additive & idempotent:
--   • WHERE "sourceContactType" IS NULL → only fills NULL rows
--   • Re-running = 0 updates (safe to replay)
--   • No DROP / DELETE / column change
--
-- Mapping category → canonical typeKey picked from the existing
-- ContactTypeMapping seeds so the inferCategory() lookup round-trips
-- cleanly (category → typeKey → same category).
-- ─────────────────────────────────────────────────────────────

-- 1. Prospects: derive typeKey from category for any NULL sourceContactType
UPDATE "prospects"
SET "sourceContactType" = CASE "category"
  WHEN 'blogger'     THEN 'blog'
  WHEN 'media'       THEN 'media'
  WHEN 'influencer'  THEN 'influencer'
  WHEN 'podcast'     THEN 'podcast'
  WHEN 'association' THEN 'association'
  WHEN 'education'   THEN 'ecole'
  WHEN 'partner'     THEN 'partenaire'
  WHEN 'corporate'   THEN 'entreprise'
  WHEN 'agency'      THEN 'agence'
  WHEN 'ecommerce'   THEN 'ecommerce'
  WHEN 'forum'       THEN 'forum'
  WHEN 'directory'   THEN 'annuaire'
  ELSE 'scraped'
END
WHERE "sourceContactType" IS NULL;

-- 2. Contacts: inherit from their parent prospect when NULL.
--    If the parent was also NULL (now filled by step 1), they pick up the
--    newly-derived value in the same transaction.
UPDATE "contacts" c
SET "sourceContactType" = p."sourceContactType"
FROM "prospects" p
WHERE c."prospectId" = p.id
  AND c."sourceContactType" IS NULL
  AND p."sourceContactType" IS NOT NULL;

-- 3. Safety net: any remaining NULL contact (orphan / race) → 'scraped'
UPDATE "contacts"
SET "sourceContactType" = 'scraped'
WHERE "sourceContactType" IS NULL;

-- 4. Register every backfill typeKey in contact_type_mappings so
--    inferCategory() round-trips cleanly (typeKey → category). Already-seeded
--    keys are left untouched thanks to ON CONFLICT DO NOTHING.
INSERT INTO "contact_type_mappings"
  ("typeKey", "category", "label", "isSystem", "createdAt", "updatedAt")
VALUES
  ('scraped',    'other',      'Scraped (auto)',    true, NOW(), NOW()),
  ('partenaire', 'partner',    'Partenaire',        true, NOW(), NOW()),
  ('entreprise', 'corporate',  'Entreprise',        true, NOW(), NOW()),
  ('agence',     'agency',     'Agence',            true, NOW(), NOW()),
  ('annuaire',   'directory',  'Annuaire',          true, NOW(), NOW())
ON CONFLICT ("typeKey") DO NOTHING;
