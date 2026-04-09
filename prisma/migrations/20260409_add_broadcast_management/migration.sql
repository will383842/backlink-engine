-- Broadcast exclusions: per-campaign contact exclusion list
CREATE TABLE "broadcast_exclusions" (
  "id" SERIAL PRIMARY KEY,
  "campaignId" INTEGER NOT NULL,
  "contactId" INTEGER NOT NULL,
  "reason" VARCHAR(255),
  "excludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_exclusions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE,
  CONSTRAINT "broadcast_exclusions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE,
  CONSTRAINT "broadcast_exclusions_campaignId_contactId_key" UNIQUE ("campaignId", "contactId")
);
CREATE INDEX "broadcast_exclusions_campaignId_idx" ON "broadcast_exclusions"("campaignId");

-- Broadcast manual recipients: manually added email addresses per campaign
CREATE TABLE "broadcast_manual_recipients" (
  "id" SERIAL PRIMARY KEY,
  "campaignId" INTEGER NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(255),
  "contactType" VARCHAR(30),
  "language" VARCHAR(10),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "sentAt" TIMESTAMP(3),
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_manual_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE,
  CONSTRAINT "broadcast_manual_recipients_campaignId_email_key" UNIQUE ("campaignId", "email")
);
CREATE INDEX "broadcast_manual_recipients_campaignId_idx" ON "broadcast_manual_recipients"("campaignId");
CREATE INDEX "broadcast_manual_recipients_status_idx" ON "broadcast_manual_recipients"("status");
