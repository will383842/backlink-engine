#!/usr/bin/env python3
"""ULTRA batch — encore plus de prospects francophones."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# INFLUENCEURS VOYAGE FR (Instagram/YouTube/TikTok avec blog)
# ═══════════════════════════════════════════════════════════
for d in [
    "brunomaltor.com","lesfrancaisvoyagent.com","alexstrohl.com","jeremyjanin.com",
    "emmavoyage.com","jordhanbruno.com","vincentprevost.com","bacpackeronroadtrip.com",
    "pfrancaisvoyage.com","lebackpacker.com","travelwithjulien.com","lafrancaisavoyage.com",
    "voyage2reves.com","voyageurindependant.com","blogdesvoyageurs.fr","1voyageur.com",
    "carnetsdevoyagesetdimages.com","guidedubackpacker.com","voyagerplus.com",
    "voyagersansargent.com","nomadefrancais.com","enroutepourlavoyage.com",
    "carnetsdevoyages.net","voyagesapetitprix.com","globetrotter-blog.com",
    "voyageurmalin.com","voyagemonde.fr","guidevoyageur.com","planeteailleurs.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# WEBZINES / MAGAZINES EN LIGNE FR
# ═══════════════════════════════════════════════════════════
for d in [
    "konbini.com","brut.media","maddyness.com","frenchweb.fr","siecledigital.fr",
    "presse-citron.net","journaldugeek.com","numerama.com","01net.com",
    "clubic.com","tomsguide.fr","phonandroid.com","frandroid.com",
    "creapills.com","ado-mode.com","ladn.eu","influenth.com",
    "meltyfashion.fr","demotivateur.fr","positivr.fr","dailygeekshow.com",
    "topito.com","minutebuzz.com","madmoizelle.com","neonmag.fr",
    "ulysse.co","greenweez-magazine.com","wedemain.fr","reporterre.net",
    "usbeketrica.com","theconversation.com","courriercadres.com",
    "cadreemploi.fr","cadreo.com","regionsjob.com","monster.fr",
    "indeed.fr","linkedin.com","glassdoor.fr","welcometothejungle.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PODCASTS VOYAGE/EXPAT FR (avec site web)
# ═══════════════════════════════════════════════════════════
for d in [
    "podcasts-voyage.com","lesballadesfr.com","voyagerpodcast.fr",
    "unpodcastenvoyage.com","tripcast.fr","podcastexpat.fr",
    "audiotouriste.com","audionautes.fr","globalpodcast.fr",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# AGENCES DE VOYAGE FR (pour partenariats)
# ═══════════════════════════════════════════════════════════
for d in [
    "voyageursdumonde.fr","comptoir.fr","terresdaventure.com","chamina-voyages.com",
    "nomade-aventure.com","allibert-trekking.com","tirfrancophone.com",
    "voyageschine.com","asiatica-travel.fr","marco-vasco.com","evaneos.fr",
    "prestige-voyages.com","amplitudes.com","tirfrancais.com",
    "club-aventure.fr","atalante.fr","ucpa.com","clubmed.fr",
    "tui.fr","fram.fr","look-voyages.fr","marmara.com",
    "nouvelles-frontieres.fr","thomas-cook.fr","kuoni.fr","jet-tours.com",
    "voyages-pirates.fr","secretflying.fr","dealabs.com","vente-privee.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# ASSOCIATIONS EXPAT / ONG FR
# ═══════════════════════════════════════════════════════════
for d in [
    "francaisaletranger.fr","ufe.org","fiafe.org","assemblee-afe.fr",
    "diplomatie.gouv.fr","consulat.fr","notaires.fr","cnb.avocat.fr",
    "service-public.fr","ameli.fr","info-retraite.fr","agirc-arrco.fr",
    "caissedesdepots.fr","banquedefrance.fr","tresor.economie.gouv.fr",
    "impots.gouv.fr","pole-emploi.fr","apec.fr","ofii.fr",
    "france-volontaires.org","la-croix-rouge.fr","msf.fr","medecinsdumonde.org",
    "acted.org","actioncontrelafaim.org","handicap-international.fr",
    "solidarites.org","fondation-france.org","secours-populaire.fr",
    "emmaus-france.org","restosducoeur.org","unicef.fr","unhcr.org",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PRESSE LOCALE FR (villes principales)
# ═══════════════════════════════════════════════════════════
for d in [
    "actu.fr","lyonmag.com","rue89lyon.fr","marsactu.fr","bordeaux-gazette.com",
    "toulouse-infos.fr","strasbourg.eu","nantes-tourisme.com","montpellier-tourisme.fr",
    "lille-tourisme.com","rennes-tourisme.com","grenoble-tourisme.com",
    "visitparisregion.com","lyon-france.com","bordeaux-tourisme.com",
    "marseille-tourisme.com","nice-tourisme.com","biarritz-tourisme.com",
    "saint-malo-tourisme.com","colmar-tourisme.com","avignon-tourisme.com",
    "chamonix.com","megeve.com","courchevel.com","val-thorens.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# BLOGS CUISINE/GASTRONOMIE VOYAGE FR
# ═══════════════════════════════════════════════════════════
for d in [
    "papillesetpupilles.fr","marmiton.org","750g.com","cuisineaz.com",
    "ptitchef.com","hervecuisine.com","jujube-en-cuisine.fr",
    "unepincedecuisine.com","lacuisinedebernard.com","iletaitunefoislapatisserie.com",
    "chefnini.com","recettesdecuisine.tv","cuisinemoiunmouton.com",
    "streetfoodenfrance.fr","foodandtravel.fr","timeout.fr",
    "lfourchette.com","thefork.fr","yelp.fr","tripadvisor.fr",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PRESSE AFRIQUE FRANCOPHONE — COMPLEMENT
# ═══════════════════════════════════════════════════════════
for d in [
    # Presse panafricaine FR
    "jeuneafrique.com","africanews.com","rfi.fr","france24.com",
    "lemonde.fr","afrique.lepoint.fr","courrierinternational.com",
    "mondafrique.com","agenceecofin.com","financialafrik.com",
    "afriquemagazine.com","afrik.com","slateafrique.com",
    "theafricareport.com","africanarguments.org","africaintelligence.fr",
    "afriqueitnews.com","cio-mag.com","scidev.net",
    # Tchad
    "tchadinfos.com","alwihdainfo.com",
    # Congo Brazzaville
    "adiac-congo.com","vox.cg",
    # Centrafrique
    "radiondekeluka.org","centrafrique-presse.com",
    # Haïti (francophone)
    "lenouvelliste.com","haitilibre.com","alterpresse.org",
    "metropolehaiti.com","haitiprogresmedia.com",
    # Mauritanie
    "cridem.org","sahara-media.net",
    # Seychelles
    "seychellesnewsagency.com",
]:
    prospects.append((d, "SN"))

# ═══════════════════════════════════════════════════════════
# IMMOBILIER EXPAT FR
# ═══════════════════════════════════════════════════════════
for d in [
    "seloger.com","leboncoin.fr","pap.fr","logic-immo.com",
    "bienici.com","superimmo.com","avendrealouer.fr","explorimmo.com",
    "orpi.com","century21.fr","laforet.com","guyanimmobilier.com",
    "immobilier-danger.com","meilleursagents.com","efficity.com",
    "hosman.co","proprioo.com","liberkeys.com","vendezvotremaison.be",
    "immoweb.be","athome.lu","immotop.lu","homegate.ch","immoscout24.ch",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# SANTÉ / BIEN-ÊTRE EXPAT FR
# ═══════════════════════════════════════════════════════════
for d in [
    "doctissimo.fr","passeportsante.net","allodocteurs.fr","medisite.fr",
    "topsante.com","santemagazine.fr","psychologies.com","femmeactuelle.fr",
    "e-sante.fr","pourquoidocteur.fr","vidal.fr","ameli.fr",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# ÉDUCATION / UNIVERSITÉS FR (partenariats)
# ═══════════════════════════════════════════════════════════
for d in [
    "campusfrance.org","etudiant.gouv.fr","letudiant.fr","studyrama.com",
    "onisep.fr","parcoursup.fr","education.gouv.fr","enseignementsup-recherche.gouv.fr",
    "ciep.fr","alliancefrancaise.org","institutfrancais.com","francophonie.org",
    "auf.org","aefe.fr","mlfmonde.org","efemaroc.org",
]:
    prospects.append((d, "FR"))

# Deduplicate
seen = set()
unique = []
for domain, country in prospects:
    if domain not in seen:
        seen.add(domain)
        unique.append((domain, country))

print(f"Total unique prospects to add: {len(unique)}")

values = []
for domain, country in unique:
    values.append(f"('{domain}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", 'fr', '{country}', NOW(), NOW())")

batch_size = 100
total_inserted = 0
for i in range(0, len(values), batch_size):
    batch = values[i:i+batch_size]
    sql = 'INSERT INTO prospects (domain, source, status, language, country, "createdAt", "updatedAt") VALUES\n' + ",\n".join(batch) + "\nON CONFLICT (domain) DO NOTHING;"
    result = subprocess.run(
        ["docker", "exec", "-i", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine"],
        input=sql, capture_output=True, text=True
    )
    count = result.stdout.strip().replace("INSERT 0 ", "")
    try:
        total_inserted += int(count)
    except:
        pass

print(f"Inserted: {total_inserted}")

for q in [
    'SELECT count(*) as total FROM prospects;',
    "SELECT count(*) as francophone FROM prospects WHERE language = 'fr';",
    "SELECT status, count(*) FROM prospects GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
