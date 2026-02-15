-- Create missing enums for Backlink Engine
-- Generated: 2026-02-15

-- ProspectStatus enum
CREATE TYPE "ProspectStatus" AS ENUM (
  'NEW',
  'ENRICHING',
  'READY_TO_CONTACT',
  'CONTACTED_EMAIL',
  'CONTACTED_MANUAL',
  'FOLLOWUP_DUE',
  'REPLIED',
  'NEGOTIATING',
  'WON',
  'LINK_PENDING',
  'LINK_VERIFIED',
  'LINK_LOST',
  'RE_CONTACTED',
  'LOST',
  'DO_NOT_CONTACT'
);

-- ProspectSource enum
CREATE TYPE "ProspectSource" AS ENUM ('manual', 'csv_import', 'scraper');

-- EmailStatus enum
CREATE TYPE "EmailStatus" AS ENUM ('unverified', 'verified', 'invalid', 'risky', 'disposable', 'role');

-- EnrollmentStatus enum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'stopped', 'completed');

-- LinkType enum
CREATE TYPE "LinkType" AS ENUM ('dofollow', 'nofollow', 'sponsored', 'ugc', 'mixed');

-- Language enum
CREATE TYPE "Language" AS ENUM ('fr', 'en', 'de', 'es', 'pt', 'ru', 'ar', 'zh', 'hi');

-- UserRole enum
CREATE TYPE "UserRole" AS ENUM ('ops', 'admin');

-- ProspectCategory enum
CREATE TYPE "ProspectCategory" AS ENUM ('blogger', 'association', 'partner', 'influencer', 'media', 'agency', 'corporate', 'ecommerce', 'other');

-- Update message_templates.language column to use Language enum
ALTER TABLE message_templates ALTER COLUMN language TYPE "Language" USING language::text::"Language";

COMMENT ON TYPE "ProspectStatus" IS 'Prospect lifecycle status';
COMMENT ON TYPE "Language" IS 'Supported languages for templates and prospects';
COMMENT ON TYPE "ProspectCategory" IS 'Prospect categorization for targeted messaging';
