-- Add soft bounce counter to contacts for retry logic
ALTER TABLE "contacts" ADD COLUMN "softBounceCount" INTEGER NOT NULL DEFAULT 0;
