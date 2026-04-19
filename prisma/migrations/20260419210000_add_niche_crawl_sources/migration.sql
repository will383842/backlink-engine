-- ─────────────────────────────────────────────────────────────
-- Add 85 new crawl_sources covering niches + press + forums + write-for-us
-- ─────────────────────────────────────────────────────────────
--
-- Rationale: existing 190 blog_directory sources plateaued (0 new prospects
-- since 2026-04-09). These new sources target high-value niches that SOS-Expat
-- actually serves (legal, insurance, real estate, education, health, tax) and
-- press/journalist directories for media outreach.
--
-- Idempotency: Prisma tracks applied migrations in _prisma_migrations, so
-- replay is not a concern. To also survive manual partial re-runs we use an
-- advisory `WHERE NOT EXISTS` subquery on each row.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "crawl_sources" ("name", "type", "baseUrl", "config", "isActive", "createdAt", "updatedAt") VALUES
  -- ── Press / Media directories ──────────────────────────────
  ('Press - Cision Journalist Directory', 'blog_directory', 'https://www.cision.com/us/resources/media-research/', '{}', true, NOW(), NOW()),
  ('Press - Muck Rack Journalists', 'blog_directory', 'https://muckrack.com/search?q=expat&type=journalists', '{}', true, NOW(), NOW()),
  ('Press - French Entrepreneurs Abroad', 'blog_directory', 'https://www.lepetitjournal.com/', '{"linkSelector": "a.article-title"}', true, NOW(), NOW()),
  ('Press - Expatica News', 'blog_directory', 'https://www.expatica.com/', '{"linkSelector": "a[href*=\"/author/\"]"}', true, NOW(), NOW()),
  ('Press - Global Voices Expat', 'blog_directory', 'https://globalvoices.org/-/topics/migration-immigration/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Press - The Local Europe', 'blog_directory', 'https://www.thelocal.com/', '{"linkSelector": "a.article-link"}', true, NOW(), NOW()),
  ('Press - International Living', 'blog_directory', 'https://internationalliving.com/about-us/writers/', '{"linkSelector": "a[href*=\"/author/\"]"}', true, NOW(), NOW()),
  ('Press - Live and Invest Overseas', 'blog_directory', 'https://www.liveandinvestoverseas.com/authors/', '{"linkSelector": ".author-card a"}', true, NOW(), NOW()),
  ('Press - Expat Exchange News', 'blog_directory', 'https://www.expatexchange.com/expat-articles.html', '{"linkSelector": "a.article-title"}', true, NOW(), NOW()),
  ('Press - Transitions Abroad Writers', 'blog_directory', 'https://www.transitionsabroad.com/information/writers/index.shtml', '{}', true, NOW(), NOW()),

  -- ── Legal / Avocats ────────────────────────────────────────
  ('Legal - Lawyers Abroad International Legal Directory', 'blog_directory', 'https://www.internationallawyerguide.com/', '{}', true, NOW(), NOW()),
  ('Legal - Hg.org International Lawyers', 'blog_directory', 'https://www.hg.org/attorney.asp?country=expat', '{}', true, NOW(), NOW()),
  ('Legal - Martindale Expat Lawyers', 'blog_directory', 'https://www.martindale.com/by-location/international/', '{}', true, NOW(), NOW()),
  ('Legal - Lawyers French Abroad', 'blog_directory', 'https://www.expatriatlaw.com/', '{}', true, NOW(), NOW()),
  ('Legal - Global Legal Directory', 'blog_directory', 'https://www.globallegalinsights.com/', '{}', true, NOW(), NOW()),
  ('Legal - Allawyers Worldwide', 'blog_directory', 'https://www.allaboutlaw.co.uk/international-law-firms', '{}', true, NOW(), NOW()),

  -- ── Insurance / Assurance ──────────────────────────────────
  ('Insurance - International Health Insurance Blog', 'blog_directory', 'https://www.pacificprime.com/blog/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Insurance - William Russell Expat Health Blog', 'blog_directory', 'https://www.william-russell.com/blog/', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Insurance - Cigna Global Expat Resources', 'blog_directory', 'https://www.cignaglobal.com/blog/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Insurance - APRIL International Blog', 'blog_directory', 'https://www.april-international.com/blog/', '{}', true, NOW(), NOW()),
  ('Insurance - AXA Expat Blog', 'blog_directory', 'https://www.axa-schengen.com/en/blog', '{}', true, NOW(), NOW()),

  -- ── Real Estate / Immobilier ───────────────────────────────
  ('RealEstate - Global Property Guide Blog', 'blog_directory', 'https://www.globalpropertyguide.com/real-estate-news/', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('RealEstate - Rightmove Overseas Blog', 'blog_directory', 'https://www.rightmove.co.uk/overseas-property-blog/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('RealEstate - Knight Frank International Blog', 'blog_directory', 'https://www.knightfrank.com/blog/', '{"linkSelector": "a.blog-card"}', true, NOW(), NOW()),
  ('RealEstate - Expat Housing Directory', 'blog_directory', 'https://www.expatriates.com/classifieds/', '{}', true, NOW(), NOW()),

  -- ── Education / International Schools ──────────────────────
  ('Education - International Schools Database', 'blog_directory', 'https://www.international-schools-database.com/', '{"linkSelector": "a.school-card"}', true, NOW(), NOW()),
  ('Education - ISC Research International Schools', 'blog_directory', 'https://www.iscresearch.com/', '{}', true, NOW(), NOW()),
  ('Education - Expat Arrivals Schools', 'blog_directory', 'https://www.expatarrivals.com/category/education', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Education - Study Abroad Blogs', 'blog_directory', 'https://www.goabroad.com/articles/study-abroad', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Education - Erasmus Student Blogs', 'blog_directory', 'https://erasmusu.com/en/blog', '{"linkSelector": "a.blog-post-title"}', true, NOW(), NOW()),

  -- ── Health / Medical ───────────────────────────────────────
  ('Health - Expat Health Info', 'blog_directory', 'https://www.expathealthinfo.com/', '{}', true, NOW(), NOW()),
  ('Health - International SOS Blog', 'blog_directory', 'https://www.internationalsos.com/blog', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),

  -- ── Tax / Accounting ───────────────────────────────────────
  ('Tax - Greenback Expat Tax Blog', 'blog_directory', 'https://www.greenbacktaxservices.com/blog/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Tax - Bright!Tax Expat Tax Blog', 'blog_directory', 'https://brighttax.com/blog/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Tax - Expatriate Tax Returns Blog', 'blog_directory', 'https://www.expatriatetaxreturns.com/blog/', '{}', true, NOW(), NOW()),
  ('Tax - Taxes For Expats Blog', 'blog_directory', 'https://www.taxesforexpats.com/articles/expat-tax-rules-blog.html', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),

  -- ── Banking / Fintech ──────────────────────────────────────
  ('Banking - Wise Expat Blog', 'blog_directory', 'https://wise.com/gb/blog/', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Banking - Revolut Blog', 'blog_directory', 'https://blog.revolut.com/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Banking - HSBC Expat Blog', 'blog_directory', 'https://www.expat.hsbc.com/expat-explorer/', '{"linkSelector": "a.article-link"}', true, NOW(), NOW()),
  ('Banking - N26 Expat Blog', 'blog_directory', 'https://n26.com/en-eu/blog', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),

  -- ── Jobs / Careers ─────────────────────────────────────────
  ('Jobs - Expat Network Jobs', 'blog_directory', 'https://www.expatnetwork.com/latest/employment/', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Jobs - Relocate Global', 'blog_directory', 'https://www.relocatemagazine.com/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('Jobs - Expat Network Employer', 'blog_directory', 'https://www.escapeartist.com/category/jobs/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),

  -- ── Forums / Communities ───────────────────────────────────
  ('Forum - ExpatFocus Forum Experts', 'blog_directory', 'https://www.expatfocus.com/forum/', '{}', true, NOW(), NOW()),
  ('Forum - Toytown Germany', 'blog_directory', 'https://www.toytowngermany.com/', '{}', true, NOW(), NOW()),
  ('Forum - Angloinfo Blogs', 'blog_directory', 'https://blogs.angloinfo.com/', '{"linkSelector": "h3 a"}', true, NOW(), NOW()),
  ('Forum - InterNations Communities', 'blog_directory', 'https://www.internations.org/communities/', '{}', true, NOW(), NOW()),
  ('Forum - Nomadlist Cities', 'blog_directory', 'https://nomadlist.com/', '{}', true, NOW(), NOW()),
  ('Forum - Expatriates Community', 'blog_directory', 'https://www.expatriates.com/cls/', '{}', true, NOW(), NOW()),

  -- ── Podcast / YouTube directories ──────────────────────────
  ('Podcast - Podchaser Expat', 'blog_directory', 'https://www.podchaser.com/search?q=expat', '{"linkSelector": "a.podcast-card"}', true, NOW(), NOW()),
  ('Podcast - Podchaser Nomad', 'blog_directory', 'https://www.podchaser.com/search?q=digital+nomad', '{"linkSelector": "a.podcast-card"}', true, NOW(), NOW()),
  ('Podcast - Apple Expat Podcasts', 'blog_directory', 'https://podcasts.apple.com/us/genre/podcasts-society-culture-places-travel/id1324', '{}', true, NOW(), NOW()),
  ('YouTube - SocialBlade Travel', 'blog_directory', 'https://socialblade.com/youtube/top/category/howtoandstyle', '{}', true, NOW(), NOW()),

  -- ── Consulates / Embassies / Institutional ─────────────────
  ('Institutional - French Consulates Worldwide', 'blog_directory', 'https://www.diplomatie.gouv.fr/fr/le-ministere-et-son-reseau/annuaires-et-contacts/ambassades-et-consulats-francais-a-l-etranger/', '{"linkSelector": "a[href*=\"ambafrance\"]"}', true, NOW(), NOW()),
  ('Institutional - Alliance Française Worldwide', 'blog_directory', 'https://www.fondation-alliancefr.org/?cat=6', '{"linkSelector": "a"}', true, NOW(), NOW()),
  ('Institutional - Instituts Français', 'blog_directory', 'https://www.institutfrancais.com/fr/le-reseau/dans-le-monde', '{}', true, NOW(), NOW()),
  ('Institutional - Consulat General France', 'blog_directory', 'https://www.service-public.fr/particuliers/vosdroits/F33307', '{}', true, NOW(), NOW()),
  ('Institutional - UFE Worldwide Offices', 'blog_directory', 'https://www.ufe.org/nos-implantations-dans-le-monde', '{}', true, NOW(), NOW()),

  -- ── Niche expat communities per language ───────────────────
  ('ES - Españoles en el Exterior', 'blog_directory', 'https://espanolesenelexterior.com/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('ES - Emigrar Net', 'blog_directory', 'https://www.emigrar.net/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('DE - Auslandskurier', 'blog_directory', 'https://www.auslandskurier.de/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('DE - Deutsche im Ausland', 'blog_directory', 'https://www.deutsche-im-ausland.org/', '{}', true, NOW(), NOW()),
  ('PT - Mundo Portugues', 'blog_directory', 'https://www.mundoportugues.org/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('IT - Italiani Nel Mondo', 'blog_directory', 'https://www.italianinelmondo.it/', '{"linkSelector": "h2 a"}', true, NOW(), NOW()),
  ('NL - Buitenlandbemanning', 'blog_directory', 'https://www.expat.nl/', '{}', true, NOW(), NOW()),

  -- ── Write-for-us per niche (high-intent for backlinks) ─────
  ('WriteFor - Expat Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+expat', '{}', true, NOW(), NOW()),
  ('WriteFor - Travel Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+travel+abroad', '{}', true, NOW(), NOW()),
  ('WriteFor - Immigration Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+immigration+visa', '{}', true, NOW(), NOW()),
  ('WriteFor - Relocation Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22contribute%22+relocation+abroad', '{}', true, NOW(), NOW()),
  ('WriteFor - Digital Nomad Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+digital+nomad', '{}', true, NOW(), NOW()),
  ('WriteFor - Legal Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22guest+post%22+international+law', '{}', true, NOW(), NOW()),
  ('WriteFor - International School Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22guest+post%22+international+school', '{}', true, NOW(), NOW()),
  ('WriteFor - Study Abroad Write For Us', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+study+abroad', '{}', true, NOW(), NOW()),
  ('WriteFor - Digital Nomad Visa', 'write_for_us', 'https://www.google.com/search?q=%22contribute%22+digital+nomad+visa', '{}', true, NOW(), NOW()),
  ('WriteFor - Global Mobility', 'write_for_us', 'https://www.google.com/search?q=%22write+for+us%22+global+mobility', '{}', true, NOW(), NOW()),

  -- ── Search engines — new niche queries per language ────────
  ('Search - Expat Lawyer Multi-country', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat lawyer {country}", "immigration attorney {country}", "avocat expatri\u00e9 {country}"]}', true, NOW(), NOW()),
  ('Search - Expat Real Estate', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat real estate {country}", "buying property abroad {country}", "immobilier expatri\u00e9 {country}"]}', true, NOW(), NOW()),
  ('Search - Expat Health Insurance', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat health insurance {country}", "international health cover {country}", "assurance sant\u00e9 expatri\u00e9 {country}"]}', true, NOW(), NOW()),
  ('Search - Expat Tax Services', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat tax {country}", "international tax advisor {country}", "fiscalit\u00e9 expatri\u00e9 {country}"]}', true, NOW(), NOW()),
  ('Search - Expat Banking', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat banking {country}", "international bank account {country}", "banque expatri\u00e9 {country}"]}', true, NOW(), NOW()),
  ('Search - International Schools Listings', 'search_engine', 'https://www.google.com/search', '{"queries": ["international schools {country} list", "\u00e9coles internationales {country}", "escuelas internacionales {country}"]}', true, NOW(), NOW()),
  ('Search - Digital Nomad Guides', 'search_engine', 'https://www.google.com/search', '{"queries": ["digital nomad guide {country}", "nomad visa {country}", "coliving {country}"]}', true, NOW(), NOW()),
  ('Search - Expat Community Groups', 'search_engine', 'https://www.google.com/search', '{"queries": ["expat community {country}", "expat meetup {country}", "communaut\u00e9 fran\u00e7aise {country}"]}', true, NOW(), NOW()),
  ('Search - Press Contacts Expat', 'search_engine', 'https://www.google.com/search', '{"queries": ["press contact expat magazine", "journalist expatriate", "{country} expat newspaper"]}', true, NOW(), NOW()),
  ('Search - Influencer Travel', 'search_engine', 'https://www.google.com/search', '{"queries": ["travel influencer {country}", "nomad influencer {country}", "expat blogger {country}"]}', true, NOW(), NOW()),
  ('Search - Specialist Lawyers', 'search_engine', 'https://www.google.com/search', '{"queries": ["divorce lawyer abroad {country}", "estate planning expat {country}", "{country} family law foreigner"]}', true, NOW(), NOW()),
  ('Search - Expat Relocation Services', 'search_engine', 'https://www.google.com/search', '{"queries": ["relocation services {country}", "moving abroad {country} guide", "d\u00e9m\u00e9nagement international {country}"]}', true, NOW(), NOW()),

  -- ── Competitor backlinks (reverse-engineer competitor outreach) ─
  ('Competitor - InterNations Backlinks', 'competitor_backlinks', 'https://www.internations.org/', '{}', true, NOW(), NOW()),
  ('Competitor - Expatica Backlinks', 'competitor_backlinks', 'https://www.expatica.com/', '{}', true, NOW(), NOW()),
  ('Competitor - HSBC Expat Backlinks', 'competitor_backlinks', 'https://www.expat.hsbc.com/', '{}', true, NOW(), NOW()),
  ('Competitor - Expat Explorer Backlinks', 'competitor_backlinks', 'https://www.expat.hsbc.com/expat-explorer/', '{}', true, NOW(), NOW()),
  ('Competitor - Cigna Global Backlinks', 'competitor_backlinks', 'https://www.cignaglobal.com/', '{}', true, NOW(), NOW())
;
