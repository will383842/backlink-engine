-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('outreach', 'broadcast');

-- AlterTable: Add broadcast fields to campaigns
ALTER TABLE "campaigns" ADD COLUMN "campaignType" "CampaignType" NOT NULL DEFAULT 'outreach';
ALTER TABLE "campaigns" ADD COLUMN "brief" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "sourceEmail" JSONB;
ALTER TABLE "campaigns" ADD COLUMN "targetSourceContactTypes" JSONB;
ALTER TABLE "campaigns" ADD COLUMN "warmupSchedule" JSONB;
ALTER TABLE "campaigns" ADD COLUMN "currentWarmupDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalDelivered" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalOpened" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalClicked" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalBounced" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "totalComplained" INTEGER NOT NULL DEFAULT 0;

-- Make sequenceConfig nullable (was required, now optional for broadcast campaigns)
ALTER TABLE "campaigns" ALTER COLUMN "sequenceConfig" DROP NOT NULL;

-- Make sentAt nullable on sent_emails (drafts have no sentAt)
ALTER TABLE "sent_emails" ALTER COLUMN "sentAt" DROP NOT NULL;
ALTER TABLE "sent_emails" ALTER COLUMN "sentAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "campaigns_campaignType_isActive_idx" ON "campaigns"("campaignType", "isActive");
