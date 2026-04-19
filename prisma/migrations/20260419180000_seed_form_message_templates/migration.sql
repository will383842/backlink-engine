-- ─────────────────────────────────────────────────────────────
-- Seed default form-outreach MessageTemplates (general, no category)
-- ─────────────────────────────────────────────────────────────
--
-- Fully additive & idempotent: ON CONFLICT DO NOTHING leaves any
-- template already created by the admin untouched.
--
-- Variables supported at render time (substituted by
-- /prospects/:id/generate-form-message):
--   {siteName} / {domain}  — the target website domain
--   {contactName}          — recipient's first name (may be empty)
--   {yourName}             — from app_settings.sender
--   {yourCompany}          — from app_settings.sender
--   {yourWebsite}          — from app_settings.sender
-- ─────────────────────────────────────────────────────────────

INSERT INTO "message_templates"
  ("language", "category", "subject", "body", "isDefault", "createdAt", "updatedAt")
VALUES
  (
    'fr',
    NULL,
    'Proposition de partenariat pour {siteName}',
    E'Bonjour{contactName},\n\nJe me permets de vous contacter car j''ai decouvert {siteName} et j''ai beaucoup apprecie la qualite de vos contenus.\n\nJe represente {yourCompany} ({yourWebsite}), et nous aidons des milliers d''expatries et voyageurs a travers le monde a trouver rapidement des avocats et experts pour des conseils urgents.\n\nJe pense qu''une collaboration pourrait apporter de la valeur a votre audience : article invite, ressource pratique pour vos lecteurs, ou recommandation mutuelle.\n\nSeriez-vous ouvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
    true,
    NOW(),
    NOW()
  ),
  (
    'en',
    NULL,
    'Partnership proposal for {siteName}',
    E'Hello{contactName},\n\nI recently came across {siteName} and was impressed by the quality of your content.\n\nI work with {yourCompany} ({yourWebsite}), we help thousands of expats and travellers worldwide connect with lawyers and experts for urgent advice.\n\nI believe a collaboration could bring real value to your audience: guest article, practical resource, or mutual recommendation.\n\nWould you be open to a quick discussion?\n\nBest regards,\n{yourName}\n{yourCompany}',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("language", "category") DO NOTHING;
