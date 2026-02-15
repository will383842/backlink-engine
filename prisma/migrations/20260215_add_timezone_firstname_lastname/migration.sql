-- ─────────────────────────────────────────────────────────────
-- Migration: Add timezone, firstName, lastName, extended EmailStatus
-- Date: 2026-02-15
-- ─────────────────────────────────────────────────────────────

-- 1. Add timezone to prospects
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50);
CREATE INDEX IF NOT EXISTS "prospects_timezone_idx" ON "prospects"("timezone");

-- 2. Add firstName and lastName to contacts (keep name for backward compatibility)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- 3. Extend EmailStatus enum with new values
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'risky';
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'disposable';
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'role';

-- 4. Migrate existing name data to firstName/lastName (simple split on first space)
UPDATE "contacts"
SET
  "firstName" = SPLIT_PART("name", ' ', 1),
  "lastName" = NULLIF(SUBSTRING("name" FROM POSITION(' ' IN "name") + 1), '')
WHERE "name" IS NOT NULL AND "firstName" IS NULL;

-- 5. Add helpful comment
COMMENT ON COLUMN "contacts"."name" IS 'DEPRECATED: Use firstName + lastName instead (kept for backward compatibility)';
COMMENT ON COLUMN "prospects"."timezone" IS 'IANA timezone identifier (e.g., Europe/Paris) for smart campaign scheduling';
