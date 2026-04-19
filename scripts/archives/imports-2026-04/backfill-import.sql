CREATE TEMP TABLE mc_import (
  email TEXT, name TEXT, first_name TEXT, last_name TEXT,
  contact_type TEXT, country TEXT, lang TEXT,
  source_url TEXT, mc_id TEXT, mc_table TEXT
);
\copy mc_import FROM '/tmp/remaining_tab.csv'
SELECT 'Loaded:', COUNT(*) FROM mc_import;

ALTER TABLE mc_import ADD COLUMN domain TEXT;
UPDATE mc_import SET domain = SPLIT_PART(email, '@', 2);

ALTER TABLE mc_import ADD COLUMN cat TEXT;
UPDATE mc_import SET cat = CASE contact_type
  WHEN 'presse' THEN 'media' WHEN 'blog' THEN 'blogger' WHEN 'podcast_radio' THEN 'media'
  WHEN 'influenceur' THEN 'influencer' WHEN 'youtubeur' THEN 'influencer' WHEN 'instagrammeur' THEN 'influencer'
  WHEN 'consulat' THEN 'association' WHEN 'association' THEN 'association' WHEN 'ecole' THEN 'association'
  WHEN 'institut_culturel' THEN 'association' WHEN 'chambre_commerce' THEN 'association'
  WHEN 'alliance_francaise' THEN 'association' WHEN 'ufe' THEN 'association'
  WHEN 'communaute_expat' THEN 'association' WHEN 'lieu_communautaire' THEN 'association'
  WHEN 'avocat' THEN 'corporate' WHEN 'immobilier' THEN 'corporate' WHEN 'assurance' THEN 'corporate'
  WHEN 'banque_fintech' THEN 'corporate' WHEN 'traducteur' THEN 'corporate'
  WHEN 'agence_voyage' THEN 'corporate' WHEN 'emploi' THEN 'corporate' WHEN 'coworking_coliving' THEN 'corporate'
  ELSE 'other' END;

CREATE TEMP TABLE generic_domains AS
SELECT unnest(ARRAY['gmail.com','yahoo.com','yahoo.fr','hotmail.com','outlook.com','live.com','icloud.com','protonmail.com','aol.com','mail.com','hotmail.fr','outlook.fr','orange.fr','free.fr','wanadoo.fr','laposte.net','sfr.fr','gmx.fr','gmx.com','ymail.com']) as domain;

-- 1. Prospects for non-generic domains
INSERT INTO prospects (domain, source, category, "sourceContactType", language, country, status, "createdAt", "updatedAt")
SELECT DISTINCT ON (m.domain) m.domain, 'csv_import'::"ProspectSource", m.cat::"ProspectCategory", m.contact_type,
  NULLIF(m.lang, ''), CASE WHEN LENGTH(m.country) <= 2 THEN NULLIF(m.country, '') ELSE NULL END, 'NEW'::"ProspectStatus", NOW(), NOW()
FROM mc_import m
WHERE NOT EXISTS (SELECT 1 FROM generic_domains g WHERE g.domain = m.domain)
  AND NOT EXISTS (SELECT 1 FROM prospects p WHERE p.domain = m.domain)
ON CONFLICT (domain) DO NOTHING;

-- 2. Contacts for non-generic
INSERT INTO contacts ("prospectId", email, "emailNormalized", "firstName", "lastName", name, "sourceContactType", "emailStatus", "discoveredVia", "createdAt")
SELECT p.id, m.email, m.email, NULLIF(m.first_name, ''), NULLIF(m.last_name, ''), NULLIF(m.name, ''),
  m.contact_type, 'unverified'::"EmailStatus", 'csv_import', NOW()
FROM mc_import m
JOIN prospects p ON p.domain = m.domain
WHERE NOT EXISTS (SELECT 1 FROM generic_domains g WHERE g.domain = m.domain)
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c."emailNormalized" = m.email)
ON CONFLICT ("emailNormalized") DO NOTHING;

-- 3. Prospects from source_url for generic emails
INSERT INTO prospects (domain, source, category, "sourceContactType", language, country, status, "createdAt", "updatedAt")
SELECT DISTINCT ON (SPLIT_PART(REPLACE(REPLACE(m.source_url, 'https://', ''), 'http://', ''), '/', 1))
  SPLIT_PART(REPLACE(REPLACE(m.source_url, 'https://', ''), 'http://', ''), '/', 1),
  'csv_import'::"ProspectSource", m.cat::"ProspectCategory", m.contact_type,
  NULLIF(m.lang, ''), CASE WHEN LENGTH(m.country) <= 2 THEN NULLIF(m.country, '') ELSE NULL END, 'NEW'::"ProspectStatus", NOW(), NOW()
FROM mc_import m
WHERE EXISTS (SELECT 1 FROM generic_domains g WHERE g.domain = m.domain)
  AND m.source_url IS NOT NULL AND m.source_url != ''
  AND LENGTH(SPLIT_PART(REPLACE(REPLACE(m.source_url, 'https://', ''), 'http://', ''), '/', 1)) > 3
ON CONFLICT (domain) DO NOTHING;

-- 4. Contacts for generic emails with source_url
INSERT INTO contacts ("prospectId", email, "emailNormalized", "firstName", "lastName", name, "sourceContactType", "emailStatus", "discoveredVia", "createdAt")
SELECT p.id, m.email, m.email, NULLIF(m.first_name, ''), NULLIF(m.last_name, ''), NULLIF(m.name, ''),
  m.contact_type, 'unverified'::"EmailStatus", 'csv_import', NOW()
FROM mc_import m
JOIN prospects p ON p.domain = SPLIT_PART(REPLACE(REPLACE(m.source_url, 'https://', ''), 'http://', ''), '/', 1)
WHERE EXISTS (SELECT 1 FROM generic_domains g WHERE g.domain = m.domain)
  AND m.source_url IS NOT NULL AND m.source_url != ''
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c."emailNormalized" = m.email)
ON CONFLICT ("emailNormalized") DO NOTHING;

SELECT 'IMPORT COMPLETE' as status;
SELECT category, COUNT(*) as total FROM prospects GROUP BY category ORDER BY total DESC;
SELECT COUNT(*) as total_contacts FROM contacts;
SELECT "sourceContactType", COUNT(*) FROM contacts WHERE "sourceContactType" IS NOT NULL GROUP BY "sourceContactType" ORDER BY COUNT(*) DESC;
