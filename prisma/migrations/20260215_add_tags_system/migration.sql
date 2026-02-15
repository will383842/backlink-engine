-- ─────────────────────────────────────────────────────────────
-- Migration: Add Tag System (Multi-tagging for prospects)
-- Date: 2026-02-15
-- ─────────────────────────────────────────────────────────────

-- 1. Create TagCategory enum
CREATE TYPE "TagCategory" AS ENUM ('type', 'sector', 'quality', 'geography', 'source', 'other');

-- 2. Create tags table
CREATE TABLE IF NOT EXISTS "tags" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) UNIQUE NOT NULL,
  "label" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(7) DEFAULT '#3B82F6' NOT NULL,
  "category" "TagCategory" DEFAULT 'other' NOT NULL,
  "isAutoTag" BOOLEAN DEFAULT false NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Create prospect_tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS "prospect_tags" (
  "prospectId" INTEGER NOT NULL,
  "tagId" INTEGER NOT NULL,
  "assignedBy" VARCHAR(255) DEFAULT 'auto' NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,

  PRIMARY KEY ("prospectId", "tagId"),

  CONSTRAINT "prospect_tags_prospectId_fkey" FOREIGN KEY ("prospectId")
    REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "prospect_tags_tagId_fkey" FOREIGN KEY ("tagId")
    REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS "tags_category_idx" ON "tags"("category");
CREATE INDEX IF NOT EXISTS "tags_isAutoTag_idx" ON "tags"("isAutoTag");
CREATE INDEX IF NOT EXISTS "prospect_tags_prospectId_idx" ON "prospect_tags"("prospectId");
CREATE INDEX IF NOT EXISTS "prospect_tags_tagId_idx" ON "prospect_tags"("tagId");

-- 5. Insert default tags
INSERT INTO "tags" ("name", "label", "description", "color", "category", "isAutoTag") VALUES
  -- TYPE
  ('presse_ecrite', 'Presse Écrite', 'Journaux, magazines, médias écrits', '#3B82F6', 'type', true),
  ('blogueur', 'Blogueur', 'Blogs personnels ou professionnels', '#3B82F6', 'type', true),
  ('influenceur', 'Influenceur', 'Influenceurs sur réseaux sociaux', '#3B82F6', 'type', true),
  ('media', 'Média', 'Médias TV, radio, presse', '#3B82F6', 'type', true),

  -- SECTOR
  ('assurance', 'Assurance', 'Secteur de l''assurance et mutuelles', '#10B981', 'sector', true),
  ('finance', 'Finance', 'Banques, crédits, investissements', '#10B981', 'sector', true),
  ('voyage', 'Voyage', 'Tourisme, vacances, voyages', '#10B981', 'sector', true),
  ('tech', 'Tech', 'Technologie, digital, software', '#10B981', 'sector', true),
  ('sante', 'Santé', 'Médical, santé, bien-être', '#10B981', 'sector', true),
  ('immobilier', 'Immobilier', 'Immobilier, maisons, appartements', '#10B981', 'sector', true),
  ('education', 'Éducation', 'Écoles, universités, formations', '#10B981', 'sector', true),

  -- QUALITY
  ('premium', 'Premium', 'Prospects de qualité premium (Tier 1)', '#F59E0B', 'quality', true),
  ('high_authority', 'Haute Autorité', 'Score d''autorité élevé (≥80)', '#F59E0B', 'quality', true),
  ('verified', 'Vérifié', 'Email vérifié et score ≥50', '#F59E0B', 'quality', true),

  -- GEOGRAPHY
  ('france', 'France', 'Sites français (TLD .fr ou pays FR)', '#8B5CF6', 'geography', true),
  ('europe', 'Europe', 'Sites européens', '#8B5CF6', 'geography', true),
  ('international', 'International', 'Sites internationaux multi-langues', '#8B5CF6', 'geography', true)
ON CONFLICT ("name") DO NOTHING;

-- 6. Add helpful comments
COMMENT ON TABLE "tags" IS 'Tags pour catégoriser les prospects (multi-tagging)';
COMMENT ON TABLE "prospect_tags" IS 'Association many-to-many entre prospects et tags';
COMMENT ON COLUMN "tags"."isAutoTag" IS 'Tag auto-assigné par enrichissement (true) ou manuel (false)';
COMMENT ON COLUMN "prospect_tags"."assignedBy" IS 'Qui a assigné ce tag : auto | user:{userId} | enrichment | manual';
