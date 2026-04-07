-- A/B Testing for outreach emails

-- Add abTestEnabled to campaigns
ALTER TABLE "campaigns" ADD COLUMN "abTestEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add abVariant to sent_emails
ALTER TABLE "sent_emails" ADD COLUMN "abVariant" VARCHAR(1);

-- Index for A/B stats queries
CREATE INDEX "sent_emails_campaignId_abVariant_idx" ON "sent_emails"("campaignId", "abVariant");
