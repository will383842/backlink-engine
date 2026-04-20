-- Add homepage content columns to prospects for LLM-grounded email generation.
-- All nullable: existing rows stay untouched, new scrapes fill in over time.

ALTER TABLE "prospects"
  ADD COLUMN "homepageTitle"       VARCHAR(300),
  ADD COLUMN "homepageMeta"        VARCHAR(500),
  ADD COLUMN "latestArticleTitles" JSONB,
  ADD COLUMN "aboutSnippet"        VARCHAR(500);
