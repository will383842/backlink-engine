-- Migration: add ContactTypeMapping + extend ProspectCategory enum
-- Fully additive: no destructive changes.

-- 1. Extend ProspectCategory with new values
ALTER TYPE "ProspectCategory" ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE "ProspectCategory" ADD VALUE IF NOT EXISTS 'forum';
ALTER TYPE "ProspectCategory" ADD VALUE IF NOT EXISTS 'directory';
ALTER TYPE "ProspectCategory" ADD VALUE IF NOT EXISTS 'education';

-- 2. Create contact_type_mappings table
CREATE TABLE IF NOT EXISTS "contact_type_mappings" (
    "id" SERIAL NOT NULL,
    "typeKey" VARCHAR(60) NOT NULL,
    "category" "ProspectCategory" NOT NULL,
    "label" VARCHAR(120),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_type_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contact_type_mappings_typeKey_key" ON "contact_type_mappings"("typeKey");
CREATE INDEX IF NOT EXISTS "contact_type_mappings_category_idx" ON "contact_type_mappings"("category");
