-- ─────────────────────────────────────────────────────────────
-- MessageTemplate: add sourceContactType + translation link
-- ─────────────────────────────────────────────────────────────
--
-- Fully additive: every column is nullable with no default.  Runtime
-- code keeps working with the old (language, category) templates
-- until the admin creates per-type ones.  Safe to replay.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "message_templates"
  ADD COLUMN IF NOT EXISTS "sourceContactType" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "translatedFromId"  INTEGER;

-- FK + ON DELETE SET NULL so translations survive if the master is deleted
DO $$ BEGIN
  ALTER TABLE "message_templates"
    ADD CONSTRAINT "message_templates_translatedFromId_fkey"
    FOREIGN KEY ("translatedFromId")
    REFERENCES "message_templates"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "message_templates_sourceContactType_idx"
  ON "message_templates" ("sourceContactType");

CREATE INDEX IF NOT EXISTS "message_templates_language_sourceContactType_idx"
  ON "message_templates" ("language", "sourceContactType");

-- Partial unique: one row per (language, sourceContactType) when the type is
-- set.  General (NULL) templates are still bounded by the existing
-- (language, category) unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_language_sourceContactType_unique"
  ON "message_templates" ("language", "sourceContactType")
  WHERE "sourceContactType" IS NOT NULL;
