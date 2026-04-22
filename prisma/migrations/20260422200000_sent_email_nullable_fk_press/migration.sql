-- 2026-04-22: allow SentEmail rows without enrollment/prospect/contact/campaign
-- so the press-outreach worker can persist each send for deliverability tracking
-- and per-inbox health monitoring.

-- Drop existing FK constraints so columns can become nullable
ALTER TABLE "sent_emails" DROP CONSTRAINT IF EXISTS "sent_emails_enrollmentId_fkey";
ALTER TABLE "sent_emails" DROP CONSTRAINT IF EXISTS "sent_emails_prospectId_fkey";
ALTER TABLE "sent_emails" DROP CONSTRAINT IF EXISTS "sent_emails_contactId_fkey";
ALTER TABLE "sent_emails" DROP CONSTRAINT IF EXISTS "sent_emails_campaignId_fkey";

-- Relax NOT NULL
ALTER TABLE "sent_emails" ALTER COLUMN "enrollmentId" DROP NOT NULL;
ALTER TABLE "sent_emails" ALTER COLUMN "prospectId"   DROP NOT NULL;
ALTER TABLE "sent_emails" ALTER COLUMN "contactId"    DROP NOT NULL;
ALTER TABLE "sent_emails" ALTER COLUMN "campaignId"   DROP NOT NULL;

-- Re-create FK constraints (ON DELETE CASCADE as before; still cascades
-- when the parent row exists; nullable for press-outreach inserts).
ALTER TABLE "sent_emails"
  ADD CONSTRAINT "sent_emails_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sent_emails"
  ADD CONSTRAINT "sent_emails_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "prospects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sent_emails"
  ADD CONSTRAINT "sent_emails_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sent_emails"
  ADD CONSTRAINT "sent_emails_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- New optional link to PressContact
ALTER TABLE "sent_emails" ADD COLUMN "pressContactId" TEXT;

ALTER TABLE "sent_emails"
  ADD CONSTRAINT "sent_emails_pressContactId_fkey"
  FOREIGN KEY ("pressContactId") REFERENCES "press_contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "sent_emails_pressContactId_idx" ON "sent_emails"("pressContactId");
