-- ─────────────────────────────────────────────────────────────
-- Migration: Add impactful category-specific templates
-- ─────────────────────────────────────────────────────────────

-- Insert category-specific templates (FRANÇAIS - High impact)
-- MODÈLE : 10$ par appel passé + 5$ par appel reçu (partenaires référés : avocats ou expatriés aidants)

-- BLOGGER (Blog voyage/expat)
INSERT INTO message_templates ("language", "category", "subject", "body", "isDefault", "createdAt", "updatedAt") VALUES
('fr', 'blogger', '💰 10$ par appel : Monétisez votre audience d''expatriés', E'Bonjour,

Je suis {yourName} de {yourCompany}.

J''ai découvert {siteName} et je vois que vous touchez une audience d''expatriés/voyageurs qui a besoin d''assistance urgente à l''étranger.

**SOS Expat = Plateforme d''assistance d''urgence 24/7** (médical, juridique, rapatriement) pour expatriés.

💡 **Pourquoi je vous contacte ?**

Nous proposons un **programme d''affiliation simple et lucratif** pour monétiser votre blog :

💸 **Vos revenus :**
✅ **10$ par appel passé** via votre lien (un lecteur appelle SOS Expat)
✅ **5$ sur TOUS les appels reçus** par les partenaires que vous référez (avocats, expatriés aidants, etc.)
✅ **Double revenu** : clients + partenaires référés

📊 **Potentiel concret :**

**Scénario blogueur voyage (5K visiteurs/mois) :**
- 20 appels/mois via votre lien = **200$/mois** (20 × 10$)
- 2 partenaires référés - avocat + expatrié aidant (10 appels chacun/mois) = **100$/mois** (20 × 5$)
- **TOTAL : 300$/mois** en revenus passifs

**Scénario blogueur expat établi (20K visiteurs/mois) :**
- 80 appels/mois = **800$/mois**
- 10 partenaires (avocats, expatriés aidants - 50 appels totaux) = **250$/mois**
- **TOTAL : 1 050$/mois** (12 600$/an) 🚀

🎯 **Gagnant-gagnant :**
- Vous offrez un service **vital** à vos lecteurs (urgences 24/7)
- Vous monétisez **chaque interaction** (pas d''abonnement compliqué)
- Vos revenus croissent avec votre audience

**Comment ça marche ?**
1. Vous publiez 1 article + bannière sur SOS Expat
2. Vous partagez votre lien d''affiliation unique
3. **Vous gagnez 10$ à chaque appel** passé via votre lien
4. Bonus : Vous référez des partenaires (avocats, expatriés aidants, etc.) et gagnez **5$ sur TOUS leurs appels à vie**

**Intéressé(e) pour discuter ?**

Répondez à cet email, je vous envoie tout (bannières, article, tracking dashboard).

Cordialement,
{yourName}
{yourCompany}
📧 {yourWebsite}', FALSE),

-- MEDIA (Presse, média en ligne)
('fr', 'media', '💼 Média : 10$ par appel + revenus prestataires (modèle scalable)', E'Bonjour,

Je suis {yourName}, responsable partenariats chez {yourCompany}.

{siteName} touche une audience expatriée qualifiée. Je vous propose un **partenariat média** avec un modèle de revenus simple et scalable.

**SOS Expat en bref :**
Plateforme d''assistance d''urgence 24/7 pour expatriés (médicale, juridique, administrative, rapatriement).

💰 **Programme partenaire média :**

✅ **10$ par appel client** passé via votre lien
✅ **5$ sur TOUS les appels reçus** par chaque partenaire que vous référez
✅ **Revenus croissants** : plus vous publiez, plus vous gagnez

📊 **Potentiel média (50K lecteurs/mois) :**

**Revenus clients (appels directs) :**
- 150 appels/mois via vos articles = **1 500$/mois** (150 × 10$)

**Revenus partenaires (avocats, expatriés aidants référés) :**
- 20 partenaires référés (100 appels totaux/mois) = **500$/mois** (100 × 5$)

**TOTAL : 2 000$/mois** (24 000$/an) 🚀

**Avec croissance sur 12 mois :**
- Mois 1-3 : 800$/mois (démarrage)
- Mois 4-6 : 1 500$/mois (traction)
- Mois 7-12 : **2 500-4 000$/mois** (established)

🎯 **Avantages média :**
- **Contenus clés en main** (articles SEO, bannières, landing pages)
- **Dashboard tracking** (appels, revenus, prestataires)
- **Support dédié** : account manager pour optimiser vos revenus
- **Co-branding possible** (votre logo sur landing pages)

**Modèle gagnant-gagnant :**
- Vous offrez un service essentiel à vos lecteurs
- Vous diversifiez vos revenus (pas de dépendance pub)
- Vos revenus croissent automatiquement avec le trafic

**Intéressé(e) pour structurer ce partenariat ?**

Appelons-nous 15min pour discuter intégration, contenus, et tracking.

Cordialement,
{yourName}
{yourCompany}
📞 {yourWebsite}/contact', FALSE),

-- INFLUENCER (Instagram, YouTube, TikTok)
('fr', 'influencer', '🚀 10$ par appel : Monétise tes stories d''expat', E'Salut,

{yourName} ici, de {yourCompany}.

T''as une grosse commu d''expats/voyageurs sur {siteName}.

Je te propose un deal ultra-simple : **10$ à chaque fois qu''un de tes followers appelle SOS Expat** (assistance urgence 24/7 pour expats).

💸 **Le deal :**

✅ Tu postes 1-2 stories/posts sur SOS Expat
✅ Tu partages ton lien unique
✅ **10$ par appel** passé via ton lien
✅ **5$ sur TOUS les appels reçus** par les partenaires que tu réfères (avocats, expatriés aidants, etc.)

🔥 **Concrètement :**

**Influenceur voyage (80K followers) :**
- 1 post + story = **40-60 appels** = **400-600$** immédiat
- 3 posts sur 6 mois = **150 appels** = **1 500$**
- + Partenaires référés (5 avocats/expatriés aidants, 30 appels/mois) = **150$/mois** récurrent

**Total sur 6 mois : 1 500$ + (150$ × 6) = 2 400$** 🚀

**Influenceur expat établi (200K+ followers) :**
- Post mensuel = 80-100 appels/mois = **800-1 000$/mois**
- Partenaires (10 avocats/expatriés aidants, 60 appels/mois) = **300$/mois**
- **TOTAL : 1 000-1 300$/mois** en automatique

📊 **Pourquoi ça marche ?**
- Ta commu est **ultra-ciblée** (expats = besoin réel)
- Pas d''abonnement à vendre (juste "appelle si urgence")
- **Action immédiate** = conversion facile
- Tu protèges ta commu (service vital)

🎯 **Comment faire ?**
1. Je t''envoie ton lien + visuels
2. Tu postes (story IG, video TikTok, post YouTube)
3. **Tu gagnes 10$ par appel** à vie
4. Bonus : Tu réfères des partenaires (avocats, expatriés aidants) = **5$ sur TOUS leurs appels**

**On en parle ?**

DM-moi ou réponds, je t''envoie tout (scripts, visuels, tracking).

À très vite,
{yourName}
{yourCompany}
📱 {yourWebsite}', FALSE),

-- ASSOCIATION (Assoc expats, chambres de commerce)
('fr', 'association', '🤝 Partenariat association : 10$ par appel membre + revenus prestataires', E'Bonjour,

Je suis {yourName} de {yourCompany}.

{siteName} accompagne une communauté d''expatriés. Nous cherchons à **soutenir les associations** comme la vôtre avec un partenariat gagnant-gagnant.

**SOS Expat :**
Plateforme d''assistance d''urgence 24/7 pour expatriés (médicale, juridique, administrative, rapatriement).

🤝 **Programme partenaire association :**

✅ **10$ par appel** passé par vos membres (via votre lien)
✅ **5$ sur TOUS les appels reçus** par les partenaires membres (avocats, expatriés aidants, etc.)
✅ **Tarif préférentiel négocié** pour vos membres (-20% sur appels)
✅ **Service exclusif** : vos membres ont accès prioritaire

💰 **Revenus potentiels :**

**Association de 500 membres :**
- 30 appels/mois (6% utilisation) = **300$/mois** (30 × 10$)
- 10 partenaires membres - avocats/expatriés aidants (50 appels/mois) = **250$/mois** (50 × 5$)
- **TOTAL : 550$/mois** (6 600$/an)

**Association de 2 000 membres :**
- 120 appels/mois = **1 200$/mois**
- 30 partenaires - avocats/expatriés aidants (150 appels/mois) = **750$/mois**
- **TOTAL : 1 950$/mois** (23 400$/an) 🚀

🎯 **Avantages concrets :**
- Vous renforcez la **valeur de votre adhésion** (service vital inclus)
- Vous générez des revenus pour **financer vos actions**
- Vos membres sont **protégés** en cas d''urgence
- **Co-branding** : nous mettons votre logo en avant

**Double opportunité :**
1. **Revenus clients** : Vos membres appellent SOS Expat
2. **Revenus partenaires** : Vos membres partenaires (avocats, expatriés aidants) reçoivent des appels

**Intéressé(e) pour structurer un partenariat officiel ?**

Nous pouvons créer une convention, des supports de communication, etc.

Cordialement,
{yourName}
{yourCompany}
📧 {yourWebsite}/contact', FALSE),

-- CORPORATE / AGENCY (Agences relocation, RH international)
('fr', 'corporate', '💼 Partenariat B2B : 10$ par appel client + 5$ par appel prestataire', E'Bonjour,

Je suis {yourName}, responsable partenariats B2B chez {yourCompany}.

{siteName} accompagne des clients dans leur expatriation/mobilité internationale. Je vous propose d''**intégrer SOS Expat** dans votre offre avec un modèle de revenus simple.

**SOS Expat :**
Plateforme d''assistance d''urgence 24/7 pour expatriés (médicale, juridique, administrative, rapatriement).

💼 **Programme partenaire B2B :**

✅ **10$ par appel client** que vous référez
✅ **5$ sur TOUS les appels reçus** par les partenaires que vous référez
✅ **White-label possible** : intégrez SOS Expat dans votre package
✅ **API & intégration** : workflow automatisé
✅ **Support dédié** : account manager

💰 **Business model :**

**Agence relocation (20 expatriations/mois) :**
- 15 clients utilisent SOS Expat (3 appels chacun sur 6 mois) = **450$** (45 × 10$)
- 5 partenaires (avocats, expatriés aidants - 40 appels/mois) = **200$/mois**

**Sur 12 mois :**
- Revenus clients : **900$** (nouveaux clients continus)
- Revenus partenaires : **2 400$** (200$/mois × 12)
- **TOTAL : 3 300$/an** minimum

**Agence établie (50+ expatriations/mois) :**
- **2 000-3 000$/mois** en revenus récurrents

🎯 **Gagnant-gagnant :**
- Vous **différenciez votre offre** (service premium)
- Vous monétisez votre **base client existante**
- Vous offrez une **vraie valeur** à vos expatriés
- **White-label** : votre marque en avant

**Intégration facile :**
1. Vous intégrez SOS Expat dans vos packages relocation
2. Vos clients reçoivent un lien unique
3. **Vous gagnez 10$ par appel**
4. Bonus : Vous référez des partenaires locaux (avocats, expatriés aidants) = **5$ sur TOUS leurs appels**

**Intéressé(e) pour explorer un partenariat structuré ?**

Appelons-nous pour discuter intégration, white-label, et API.

Cordialement,
{yourName}
{yourCompany}
📞 {yourWebsite}/partners', FALSE, NOW(), NOW());

-- ─────────────────────────────────────────────────────────────
-- English templates (High impact)
-- ─────────────────────────────────────────────────────────────

INSERT INTO message_templates ("language", "category", "subject", "body", "isDefault", "createdAt", "updatedAt") VALUES
('en', 'blogger', '💰 $10 per call: Monetize your expat audience', E'Hi there,

I''m {yourName} from {yourCompany}.

I discovered {siteName} and I can see you have an expat/traveler audience that needs emergency assistance abroad.

**SOS Expat = 24/7 emergency assistance platform** (medical, legal, repatriation) for expats.

💡 **Why am I reaching out?**

We offer a **simple and lucrative affiliate program** to monetize your blog:

💸 **Your earnings:**
✅ **$10 per call** made via your link (a reader calls SOS Expat)
✅ **$5 on ALL calls received** by partners you refer (lawyers, helping expats, etc.)
✅ **Double income**: clients + referred partners

📊 **Real potential:**

**Travel blogger scenario (5K visitors/month):**
- 20 calls/month via your link = **$200/month** (20 × $10)
- 2 referred partners - lawyer + helping expat (10 calls each/month) = **$100/month** (20 × $5)
- **TOTAL: $300/month** passive income

**Established expat blogger (20K visitors/month):**
- 80 calls/month = **$800/month**
- 10 partners (lawyers, helping expats - 50 total calls) = **$250/month**
- **TOTAL: $1,050/month** ($12,600/year) 🚀

🎯 **Win-win:**
- You offer a **vital service** to your readers (24/7 emergencies)
- You monetize **every interaction** (no complicated subscription)
- Your income grows with your audience

**How it works:**
1. You publish 1 article + banner about SOS Expat
2. You share your unique affiliate link
3. **You earn $10 per call** made via your link
4. Bonus: Refer partners (lawyers, helping expats, etc.) and earn **$5 on ALL their calls for life**

**Interested in discussing?**

Reply to this email, I''ll send you everything (banners, article, tracking dashboard).

Best regards,
{yourName}
{yourCompany}
📧 {yourWebsite}', FALSE),

('en', 'influencer', '🚀 $10 per call: Monetize your expat stories', E'Hey,

{yourName} here, from {yourCompany}.

You have a large expat/traveler community on {siteName}.

I have a super simple deal for you: **$10 every time one of your followers calls SOS Expat** (24/7 emergency assistance for expats).

💸 **The deal:**

✅ You post 1-2 stories/posts about SOS Expat
✅ You share your unique link
✅ **$10 per call** made via your link
✅ **$5 on ALL calls received** by partners you refer (lawyers, helping expats, etc.)

🔥 **Concretely:**

**Travel influencer (80K followers):**
- 1 post + story = **40-60 calls** = **$400-600** immediate
- 3 posts over 6 months = **150 calls** = **$1,500**
- + Referred partners (5 lawyers/helping expats, 30 calls/month) = **$150/month** recurring

**Total over 6 months: $1,500 + ($150 × 6) = $2,400** 🚀

**Established expat influencer (200K+ followers):**
- Monthly post = 80-100 calls/month = **$800-1,000/month**
- Partners (10 lawyers/helping expats, 60 calls/month) = **$300/month**
- **TOTAL: $1,000-1,300/month** automatically

📊 **Why it works:**
- Your community is **ultra-targeted** (expats = real need)
- No subscription to sell (just "call if emergency")
- **Immediate action** = easy conversion
- You protect your community (vital service)

🎯 **How to do it:**
1. I send you your link + visuals
2. You post (IG story, TikTok video, YouTube post)
3. **You earn $10 per call** for life
4. Bonus: Refer partners (lawyers, helping expats) = **$5 on ALL their calls**

**Let''s talk?**

DM me or reply, I''ll send you everything (scripts, visuals, tracking).

Talk soon,
{yourName}
{yourCompany}
📱 {yourWebsite}', FALSE, NOW(), NOW());

-- Update general templates with correct commission model
UPDATE "message_templates"
SET
  "subject" = '💰 10$ par appel : Programme partenaire SOS Expat',
  "body" = E'Bonjour,

Je suis {yourName} de {yourCompany}.

J''ai découvert {siteName} et je pense que votre audience pourrait bénéficier de notre service d''assistance 24/7 pour expatriés.

**SOS Expat = Assistance d''urgence complète** (médicale, juridique, rapatriement, etc.)

💰 **Programme d''affiliation :**

✅ **10$ par appel** passé via votre lien
✅ **5$ sur TOUS les appels reçus** par les partenaires que vous référez
✅ **Double revenu** : clients + partenaires référés

📊 **Exemples concrets :**
- 20 appels/mois = 200$/mois
- + 2 partenaires - avocat + expatrié aidant (20 appels) = 100$/mois
- **TOTAL : 300$/mois**

🎯 **Gagnant-gagnant :**
- Vous offrez un service vital à votre audience
- Vous monétisez chaque interaction
- Revenus croissants avec votre trafic

**Intéressé(e) ?** Répondez à cet email ou visitez {yourWebsite}

Cordialement,
{yourName}
{yourCompany}'
WHERE "language" = 'fr' AND "category" IS NULL;

UPDATE "message_templates"
SET
  "subject" = '💰 $10 per call: SOS Expat Partner Program',
  "body" = E'Hello,

I''m {yourName} from {yourCompany}.

I discovered {siteName} and I think your audience would benefit from our 24/7 assistance service for expats.

**SOS Expat = Complete emergency assistance** (medical, legal, repatriation, etc.)

💰 **Affiliate program:**

✅ **$10 per call** made via your link
✅ **$5 on ALL calls received** by partners you refer
✅ **Double income**: clients + referred partners

📊 **Concrete examples:**
- 20 calls/month = $200/month
- + 2 partners - lawyer + helping expat (20 calls) = $100/month
- **TOTAL: $300/month**

🎯 **Win-win:**
- You offer a vital service to your audience
- You monetize every interaction
- Growing income with your traffic

**Interested?** Reply to this email or visit {yourWebsite}

Best regards,
{yourName}
{yourCompany}'
WHERE "language" = 'en' AND "category" IS NULL;
