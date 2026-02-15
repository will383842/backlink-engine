-- CreateTable: campaign_tags (many-to-many Campaign <-> Tag)
CREATE TABLE IF NOT EXISTS "campaign_tags" (
    "campaignId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_tags_pkey" PRIMARY KEY ("campaignId","tagId")
);

-- CreateTable: template_tags (many-to-many OutreachTemplate <-> Tag)
CREATE TABLE IF NOT EXISTS "template_tags" (
    "templateId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_tags_pkey" PRIMARY KEY ("templateId","tagId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_tags_campaignId_idx" ON "campaign_tags"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_tags_tagId_idx" ON "campaign_tags"("tagId");
CREATE INDEX IF NOT EXISTS "template_tags_templateId_idx" ON "template_tags"("templateId");
CREATE INDEX IF NOT EXISTS "template_tags_tagId_idx" ON "template_tags"("tagId");

-- AddForeignKey
ALTER TABLE "campaign_tags" ADD CONSTRAINT "campaign_tags_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_tags" ADD CONSTRAINT "campaign_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "outreach_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
