-- CreateEnum
CREATE TYPE "PressContactStatus" AS ENUM ('PENDING', 'SENT', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'RESPONDED', 'PUBLISHED', 'BOUNCED', 'UNSUBSCRIBED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PressAngle" AS ENUM ('launch', 'ymyl', 'expat', 'estonia', 'human_interest', 'tech_startup', 'innovation', 'diaspora');

-- CreateEnum
CREATE TYPE "PressLang" AS ENUM ('fr', 'en', 'es', 'de', 'pt', 'ru', 'zh', 'hi', 'ar', 'et');

-- CreateTable
CREATE TABLE "press_contacts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "mediaName" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaDr" INTEGER,
    "lang" "PressLang" NOT NULL,
    "angle" "PressAngle" NOT NULL,
    "market" TEXT,
    "sentAt" TIMESTAMP(3),
    "followUp1At" TIMESTAMP(3),
    "followUp2At" TIMESTAMP(3),
    "fromInbox" TEXT,
    "respondedAt" TIMESTAMP(3),
    "articleUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "campaignTag" TEXT,
    "notes" TEXT,
    "status" "PressContactStatus" NOT NULL DEFAULT 'PENDING',
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "press_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "press_contacts_email_key" ON "press_contacts"("email");

-- CreateIndex
CREATE INDEX "press_contacts_lang_status_idx" ON "press_contacts"("lang", "status");

-- CreateIndex
CREATE INDEX "press_contacts_angle_idx" ON "press_contacts"("angle");

-- CreateIndex
CREATE INDEX "press_contacts_sentAt_idx" ON "press_contacts"("sentAt");

-- CreateIndex
CREATE INDEX "press_contacts_status_sentAt_idx" ON "press_contacts"("status", "sentAt");
