-- ─────────────────────────────────────────────────────────────
-- Seed 22 FR MessageTemplates, 1 per distinct contact-type concept
-- ─────────────────────────────────────────────────────────────
--
-- Idempotent & additive: each INSERT ... ON CONFLICT DO NOTHING
-- skips the row if (language, sourceContactType) already exists.
-- Safe to replay. Leaves existing hand-written templates alone.
--
-- Variables rendered at runtime:
--   {siteName} / {domain}  — target website domain
--   {contactName}          — recipient first name (may be empty; preceded by
--                            a space in the greeting so " " becomes no-op)
--   {yourName}, {yourCompany}, {yourWebsite} — sender settings
-- ─────────────────────────────────────────────────────────────

-- Helper: a small macro-like function would be nicer, but plain INSERTs keep
-- the migration self-contained and easy to review diff-wise.

INSERT INTO "message_templates"
  ("language", "sourceContactType", "subject", "body", "isDefault", "createdAt", "updatedAt")
VALUES

-- 1. Presse (journalistes, redactions, magazines, media generiques)
('fr', 'presse',
 'Ressource pour vos lecteurs expatries - {siteName}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et la qualite de vos publications sur les sujets internationaux.\n\nJe travaille avec {yourCompany} ({yourWebsite}) : nous mettons en relation des expatries et voyageurs avec des avocats et experts en moins de 5 minutes, partout dans le monde. Nos specialistes couvrent 150+ pays.\n\nJe pense que nos donnees et retours d''experience pourraient servir de ressource concrete pour vos lecteurs : interview d''un de nos experts, tribune sur un enjeu expatries (fiscalite, urgences juridiques, assurance), ou simple mention dans un article ressource.\n\nSeriez-vous ouvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 2. Podcast / Radio
('fr', 'podcast',
 'Invite pour votre podcast expatriation - {yourCompany}',
 E'Bonjour{contactName},\n\nJ''ecoute {siteName} avec interet. Les temoignages et experts que vous invitez apportent vraiment du concret aux auditeurs.\n\nJe travaille avec {yourCompany} ({yourWebsite}) : nous aidons des milliers d''expatries et voyageurs a trouver avocats et experts en situation urgente, dans 150+ pays.\n\nUn de nos experts pourrait etre un invite pertinent pour un episode : parcours vecu, questions recurrentes des expatries, cas concrets de situations juridiques a l''etranger.\n\nAvez-vous des creneaux ouverts pour en parler ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 3. Blog / Blogueur
('fr', 'blog',
 'Partenariat de contenu pour {siteName}',
 E'Bonjour{contactName},\n\nVotre blog {siteName} couvre vraiment bien la vie a l''etranger. Je reconnais le travail de fond et l''authenticite de vos retours.\n\nAvec {yourCompany} ({yourWebsite}), nous aidons les expatries a joindre des avocats et experts en urgence (droit local, assurance, demenagement international, fiscalite). 150+ pays couverts.\n\nDeux pistes pour votre audience :\n- Article invite : je peux ecrire un guide pratique adapte a vos lecteurs (sur un sujet de votre choix)\n- Ressource : ajout d''une mention dans un de vos articles "liens utiles"\n\nQu''en pensez-vous ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 4. YouTubeur
('fr', 'youtubeur',
 'Collaboration video expatriation - {yourCompany}',
 E'Bonjour{contactName},\n\nJe suis votre chaine {siteName}, les formats et le ton touchent vraiment les expatries.\n\nJe represente {yourCompany} ({yourWebsite}), plateforme qui met en relation expatries et experts (avocats, conseillers) en urgence, 150+ pays.\n\nTrois pistes de collab possibles :\n- Video sponsor d''un de nos experts sur un cas concret d''expat en difficulte\n- Interview avec un de nos avocats sur des questions que vous recevez souvent\n- Simple mention dans une description de video (resource utile pour vos abonnes)\n\nOuvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 5. Instagrammeur
('fr', 'instagrammeur',
 'Collaboration Instagram expatriation - {yourCompany}',
 E'Bonjour{contactName},\n\nJe suis {siteName} sur Instagram, votre contenu expatriation parle vraiment a la communaute.\n\nAvec {yourCompany} ({yourWebsite}), nous connectons expatries et experts en 5 minutes, 150+ pays. Je cherche des createurs comme vous pour partager des ressources concretes avec votre audience.\n\nQuelques formats possibles : post sponsor, story avec lien swipe-up, collab sur un carousel "droits des expatries", ou simple mention dans une bio/story.\n\nTu serais partant pour en discuter ?\n\nA bientot,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 6. TikTokeur
('fr', 'tiktokeur',
 'Collab TikTok - {yourCompany}',
 E'Salut{contactName},\n\nJe suis {siteName} sur TikTok, ton contenu expat capte vraiment la Gen Z qui reve de partir.\n\n{yourCompany} ({yourWebsite}) aide les expatries a joindre des avocats et experts en moins de 5 min, partout dans le monde.\n\nJe te propose une collab : sponsor d''une video sur un sujet que tu choisis (galeres administratives a l''etranger, visa refuse, etc), ou mention simple dans une video.\n\nTu serais partant ?\n\nA bientot,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 7. Influenceur (generique)
('fr', 'influenceur',
 'Partenariat createur - {yourCompany}',
 E'Bonjour{contactName},\n\nJ''apprecie votre travail sur {siteName}, votre audience d''expatries et voyageurs est exactement celle que {yourCompany} ({yourWebsite}) accompagne au quotidien.\n\nNous aidons les expatries a joindre des avocats et experts en urgence dans 150+ pays. Je cherche des partenaires createurs de contenu pour promouvoir la ressource aupres de leur communaute.\n\nPost sponsor, story, video, mention : le format qui vous convient. Remuneration a discuter selon audience et engagement.\n\nSeriez-vous ouvert a en parler ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 8. Content creator (EN-leaning but FR text, for creators who prefer EN term)
('fr', 'content-creator',
 'Partenariat createur de contenu - {yourCompany}',
 E'Bonjour{contactName},\n\nJe suis votre travail sur {siteName} et la communaute que vous avez construite.\n\nAvec {yourCompany} ({yourWebsite}), nous aidons les expatries a joindre avocats et experts dans 150+ pays. Je cherche des createurs pour promouvoir la ressource.\n\nPlusieurs formats possibles : partenariat sponsor, article invite, mention ressource, affiliation longue duree. Ouvert aux idees.\n\nOuvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 9. Ecole / Universite / Formation
('fr', 'ecole',
 'Ressource pour vos etudiants internationaux - {siteName}',
 E'Bonjour,\n\nJe me permets de vous contacter au sujet de {siteName}. Nous accompagnons chaque jour des etudiants internationaux et expatries qui rencontrent des difficultes administratives, juridiques ou d''assurance a l''etranger.\n\n{yourCompany} ({yourWebsite}) permet en moins de 5 minutes de joindre un avocat ou un expert specialise dans 150+ pays (immigration, logement, banque, assurance sante).\n\nPourrions-nous etre listes comme ressource pour vos etudiants internationaux (partie admissions/vie etudiante de votre site, ou fiche pratique remise a la rentree) ?\n\nJe reste a votre disposition pour tout detail supplementaire.\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 10. Avocat
('fr', 'avocat',
 'Reseau d''avocats internationaux - {yourCompany}',
 E'Maitre,\n\nJe me permets de vous contacter car {siteName} correspond au profil de cabinets avec qui nous travaillons.\n\n{yourCompany} ({yourWebsite}) est une plateforme qui met en relation expatries et voyageurs avec des avocats qualifies en moins de 5 minutes, dans 150+ pays. Nos utilisateurs sont en situation urgente : immigration, difficultes administratives, litige local.\n\nDeux pistes :\n- Referencement de votre cabinet sur notre plateforme (dossiers adresses a titre payant)\n- Recommandation mutuelle : backlink sur votre page ressources\n\nSeriez-vous ouvert a un echange ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 11. Assurance / Banque / Fintech
('fr', 'assurance',
 'Partenariat services financiers expatries - {yourCompany}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et votre positionnement sur le marche expatries.\n\nAvec {yourCompany} ({yourWebsite}), nous aidons chaque jour des milliers d''expatries et voyageurs a joindre avocats et experts en situation urgente, dans 150+ pays. Un partenariat croise pourrait beneficier nos audiences respectives.\n\nPistes : inclusion reciproque dans les pages ressources, co-webinar sur les enjeux expatries, articles invites.\n\nOuvert a en echanger ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 12. Immobilier / Logement
('fr', 'immobilier',
 'Partenariat immobilier expatries - {yourCompany}',
 E'Bonjour{contactName},\n\n{siteName} couvre precisement le sujet logement/immobilier qui nous interesse. {yourCompany} ({yourWebsite}) connecte chaque jour expatries et experts dans 150+ pays, dont nombreux en recherche de logement ou en litige immobilier a l''etranger.\n\nPartenariat possible : mention reciproque dans les pages ressources, article co-signe sur l''immobilier pour expatries, ou referencement de vos biens pour notre audience.\n\nSeriez-vous interesse ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 13. Agence de voyage
('fr', 'agence-voyage',
 'Partenariat voyage - {yourCompany}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et votre offre pour voyageurs au long cours et expatries.\n\nAvec {yourCompany} ({yourWebsite}), nous aidons les voyageurs et expatries a joindre avocats et experts en urgence dans 150+ pays (perte de papiers, probleme de visa, urgence medicale, litige local).\n\nPartenariat possible : ressource utile pour vos clients voyageurs, mention reciproque, co-contenu.\n\nOuvert a en parler ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 14. Emploi / RH
('fr', 'emploi',
 'Partenariat mobilite internationale - {yourCompany}',
 E'Bonjour{contactName},\n\n{siteName} accompagne precisement les profils en mobilite internationale que notre plateforme aide au quotidien.\n\n{yourCompany} ({yourWebsite}) met en relation expatries et experts (avocats, fiscalistes, conseillers immigration) en 5 minutes, dans 150+ pays. Ressource concrete pour les salaries que vous accompagnez.\n\nPartenariat envisageable : inclusion dans votre package expatrie, co-webinar, article invite sur les enjeux juridiques de la mobilite.\n\nSeriez-vous ouvert ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 15. Traducteur
('fr', 'traducteur',
 'Reseau de traducteurs internationaux - {yourCompany}',
 E'Bonjour{contactName},\n\nJe me permets de vous contacter car {siteName} correspond au profil de traducteurs avec qui nous travaillons.\n\n{yourCompany} ({yourWebsite}) aide chaque jour des expatries dans 150+ pays. Beaucoup ont besoin de traductions assermentees urgentes (etat civil, diplomes, contrats).\n\nInteresse par du referencement sur notre plateforme (commandes adressees) ou une recommandation croisee ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 16. Consulat / Ambassade
('fr', 'consulat',
 'Ressource pour les ressortissants francais a l''etranger',
 E'Bonjour,\n\nJe me permets de vous contacter au sujet de {siteName}.\n\n{yourCompany} ({yourWebsite}) est une plateforme qui met en relation les ressortissants francais a l''etranger avec des avocats et experts en moins de 5 minutes, dans 150+ pays. Nous sommes souvent consultes par les personnes qui ont besoin d''une aide juridique urgente.\n\nSerait-il envisageable d''ajouter notre service a votre page "ressources pratiques" ou "numeros utiles" ? Nous sommes egalement disponibles pour partager statistiques et retours terrain avec vos equipes.\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 17. Alliance Francaise / Institut Culturel
('fr', 'alliance-francaise',
 'Ressource pour la communaute francaise locale - {siteName}',
 E'Bonjour,\n\nJe me permets de vous contacter car {siteName} est un lieu de reference pour les francophones locaux.\n\n{yourCompany} ({yourWebsite}) aide en moins de 5 minutes les expatries et voyageurs francais a joindre avocats et experts specialises, dans 150+ pays. Nous sommes souvent sollicites pour des urgences (juridique, administratif, sante).\n\nPourrions-nous etre ajoutes a vos ressources pratiques pour la communaute francaise locale ? Nous sommes aussi disponibles pour intervenir lors d''evenements ou partager nos retours sur les besoins des expatries.\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 18. Association / ONG
('fr', 'association',
 'Partenariat associatif pour expatries - {siteName}',
 E'Bonjour,\n\nJe decouvre {siteName} et le travail que vous menez aupres des expatries et voyageurs.\n\n{yourCompany} ({yourWebsite}) met en relation en moins de 5 minutes les expatries avec des avocats et experts specialises, dans 150+ pays. Beaucoup de personnes que nous aidons seraient tres interessees par l''action que vous menez.\n\nSerait-il envisageable d''etablir un partenariat (ressources croisees, recommandation mutuelle, intervention) ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 19. UFE
('fr', 'ufe',
 'Partenariat UFE - {yourCompany}',
 E'Bonjour,\n\nL''UFE accompagne depuis longtemps les francais a l''etranger, un travail que nous saluons chez {yourCompany} ({yourWebsite}).\n\nNotre plateforme permet aux expatries de joindre avocats et experts en moins de 5 minutes dans 150+ pays. De nombreux membres UFE pourraient en beneficier (aide juridique, administrative, assurance).\n\nPourrions-nous etablir un partenariat : inclusion dans vos ressources membres, article dans votre publication, ou intervention lors d''un evenement ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 20. Communaute expat / Lieu communautaire
('fr', 'communaute-expat',
 'Ressource pour votre communaute expatries - {siteName}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et la communaute que vous avez construite autour de l''expatriation.\n\n{yourCompany} ({yourWebsite}) aide les expatries a joindre avocats et experts en 5 minutes (150+ pays, urgences juridiques, administratives, assurance).\n\nPourrions-nous etre listes parmi vos ressources utiles ? Je peux aussi rediger un guide pratique pour vos membres.\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 21. Chambre de commerce
('fr', 'chambre-commerce',
 'Ressource pour entrepreneurs expatries - {siteName}',
 E'Bonjour,\n\nJe me permets de vous contacter car {siteName} accompagne precisement les entrepreneurs expatries que nous aidons au quotidien.\n\n{yourCompany} ({yourWebsite}) met en relation expatries et experts (avocats, fiscalistes, conseillers) en moins de 5 minutes, dans 150+ pays. Ressource utile pour vos membres internationaux.\n\nSerait-il envisageable d''etre ajoutes a vos ressources ou de co-organiser un evenement ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 22. Coworking / Coliving
('fr', 'coworking-coliving',
 'Ressource pour vos residents nomades - {siteName}',
 E'Bonjour{contactName},\n\n{siteName} accueille exactement la communaute nomade/expatriee que nous aidons au quotidien.\n\n{yourCompany} ({yourWebsite}) permet de joindre avocats et experts en moins de 5 minutes dans 150+ pays : visa, contrats de prestation, fiscalite nomade, assurance.\n\nInterese par un partenariat ? On peut partager votre espace avec nos utilisateurs nomades et vice-versa.\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 23. Forum / Discord / Reddit / WhatsApp / Telegram
('fr', 'forum',
 'Ressource utile pour votre communaute - {siteName}',
 E'Bonjour{contactName},\n\nJ''ai vu l''activite de {siteName}, vos membres parlent souvent de sujets sur lesquels {yourCompany} ({yourWebsite}) pourrait aider.\n\nNous mettons en relation expatries et voyageurs avec avocats et experts en 5 minutes, 150+ pays. Exactement le genre de ressource utile quand quelqu''un pose une question juridique/administrative.\n\nPourrais-je etre autorise a partager la ressource aupres de votre communaute (epingle, FAQ, bot) ? Ou faire une intervention moderee ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 24. Annuaire / Directory / Listing
('fr', 'annuaire',
 'Demande d''inscription - {yourCompany}',
 E'Bonjour,\n\nJe souhaiterais inscrire {yourCompany} ({yourWebsite}) sur {siteName}.\n\nNotre service permet aux expatries et voyageurs de joindre avocats et experts en moins de 5 minutes, dans 150+ pays. Service disponible 24h/24, en 9 langues.\n\nPouvez-vous m''indiquer la procedure d''inscription (formulaire, tarifs, delai de validation) ?\n\nMerci d''avance,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 25. Plateforme nomad
('fr', 'plateforme-nomad',
 'Partenariat plateforme nomade - {yourCompany}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName}, exactement le type de plateforme que les nomades digitaux que nous aidons utilisent.\n\n{yourCompany} ({yourWebsite}) permet aux nomades de joindre avocats et experts (fiscalite internationale, contrats, visa) en 5 minutes, 150+ pays.\n\nPartenariat envisageable : reference croisee, article invite sur la fiscalite nomade, ou integration de notre service dans votre app.\n\nOuvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 26. Agence (generique)
('fr', 'agence',
 'Partenariat agence - {yourCompany}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et votre positionnement.\n\n{yourCompany} ({yourWebsite}) met en relation expatries et experts (avocats, fiscalistes, conseillers) dans 150+ pays en moins de 5 minutes.\n\nPartenariat envisageable si vos clients/prospects ont des problematiques internationales : recommandation mutuelle, co-contenu, affiliation.\n\nSeriez-vous interesse ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 27. E-commerce / Boutique
('fr', 'ecommerce',
 'Partenariat pour vos clients expatries - {siteName}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et votre clientele internationale.\n\n{yourCompany} ({yourWebsite}) aide expatries et voyageurs a joindre avocats et experts en 5 minutes dans 150+ pays. Ressource utile pour vos clients qui rencontrent des difficultes a l''etranger (douanes, livraison, contrats).\n\nPartenariat envisageable : mention dans votre FAQ, newsletter co-signee, code de reduction.\n\nOuvert a en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 28. Corporate / B2B / Entreprise
('fr', 'corporate',
 'Partenariat entreprise - {yourCompany}',
 E'Bonjour{contactName},\n\nJe me permets de vous contacter au sujet de {siteName}.\n\n{yourCompany} ({yourWebsite}) met en relation en 5 minutes expatries et experts (avocats, fiscalistes, conseillers) dans 150+ pays. Solution utile pour vos salaries en mobilite internationale, ou vos clients internationaux.\n\nPlusieurs formats possibles : inclusion dans votre package employes expatries, partenariat de contenu, co-webinar.\n\nAvez-vous un creneau pour en discuter ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 29. Partenaire (generique)
('fr', 'partenaire',
 'Proposition de partenariat - {yourCompany}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et j''aimerais explorer une collaboration.\n\n{yourCompany} ({yourWebsite}) aide chaque jour des milliers d''expatries et voyageurs a joindre avocats et experts qualifies en moins de 5 minutes, dans 150+ pays.\n\nPartenariat envisageable selon votre activite : referencement croise, article invite, affiliation, co-webinar. Ouvert aux idees.\n\nSeriez-vous ouvert a en echanger ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW()),

-- 30. Scraped (fallback pour prospects crawles sans type humain)
('fr', 'scraped',
 'Proposition de collaboration - {siteName}',
 E'Bonjour{contactName},\n\nJe decouvre {siteName} et la qualite de vos contenus sur les sujets expatriation/voyage.\n\n{yourCompany} ({yourWebsite}) aide les expatries et voyageurs a joindre avocats et experts en moins de 5 minutes, dans 150+ pays. Nous travaillons avec de nombreux sites comme le votre.\n\nPartenariat possible selon votre ligne editoriale : article invite, ressource dans votre liens utiles, recommandation mutuelle.\n\nOuvert a en parler ?\n\nBien cordialement,\n{yourName}\n{yourCompany}',
 false, NOW(), NOW())

ON CONFLICT ("language", "sourceContactType")
  WHERE "sourceContactType" IS NOT NULL
  DO NOTHING;
