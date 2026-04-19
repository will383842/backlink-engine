#!/usr/bin/env python3
"""Add MASSIVE francophone press, journalists, media, bloggers."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# PRESSE NATIONALE FRANÇAISE
# ═══════════════════════════════════════════════════════════
for d in [
    "lefigaro.fr","lemonde.fr","liberation.fr","leparisien.fr","lexpress.fr",
    "lepoint.fr","lobs.com","marianne.net","slate.fr","mediapart.fr",
    "huffingtonpost.fr","20minutes.fr","bfmtv.com","cnews.fr","franceinfo.fr",
    "france24.com","rfi.fr","tv5monde.com","arte.tv","lci.fr",
    "europe1.fr","rtl.fr","franceinter.fr","sudouest.fr","ouest-france.fr",
    "lavoixdunord.fr","ledauphine.com","midilibre.fr","nicematin.com",
    "laprovence.com","lalsace.fr","dna.fr","estrepublicain.fr",
    "lanouvellerepublique.fr","centrepresseaveyron.fr","ladepeche.fr",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PRESSE MAGAZINE VOYAGE/LIFESTYLE FR
# ═══════════════════════════════════════════════════════════
for d in [
    "geo.fr","nationalgeographic.fr","grandreportage.com","detours.canal.fr",
    "vogue.fr","elle.fr","madame.lefigaro.fr","terrafemina.com",
    "cosmopolitan.fr","glamour.fr","grazia.fr","femmeactuelle.fr",
    "journaldesfemmes.fr","aufeminin.com","mariefrancemagazine.fr",
    "psychologies.com","topsante.com","santemagazine.fr",
    "capital.fr","challenges.fr","lentreprise.lexpress.fr",
    "management.fr","chefdentreprise.com","dynamique-mag.com",
    "latribune.fr","lesechos.fr","boursorama.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PRESSE EN LIGNE VOYAGE FR (pure players)
# ═══════════════════════════════════════════════════════════
for d in [
    "petitfute.com","routard.com","lonelyplanet.fr","michelin.fr",
    "geo.fr","detoursenfrance.fr","voyages-sncf.com","oui.sncf",
    "airfrance.fr","tgv-lyria.com","skyscanner.fr","kayak.fr",
    "liligo.fr","easyvoyage.com","opodo.fr","lastminute.com",
    "promovacances.com","govoyages.com","monnuage.fr","cityzeum.com",
    "tripadvisor.fr","booking.com","airbnb.fr","homelidays.com",
    "abritel.fr","expedia.fr","hotels.com","trivago.fr",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# BLOGUEURS VOYAGE FR — TOP 200
# ═══════════════════════════════════════════════════════════
for d in [
    # Top FR travel bloggers
    "leblogdesarah.com","alexcorner.fr","arpenterlechemin.com","bestofmontreal.ca",
    "bigbangvoyageurs.com","bfrancais.com","blogdigital.fr","bloggrr.com",
    "blogueursvoyageurs.com","bfrancophone.com","camillealacanopee.com",
    "carnets-voyage.com","chouettevoyage.com","commedesfrancophones.com",
    "conseil-voyage.fr","couleursdevoyages.com","damfrancophone.com",
    "decouverte-voyage.fr","departures.fr","explorevoyages.fr",
    "faimdevoyages.com","femmedevoyage.com","francaisenmouvement.com",
    "francophone-voyage.com","frenchvoyage.com","guide-voyage.fr",
    "horizons-voyages.com","imaginetavie.com","itinerairesdevoyages.com",
    "jetaimelemonde.com","lameilleurevacance.com","laroutededeux.com",
    "latribudevoyage.com","lemondeenvtt.com","les2pieds.com",
    "lesbonsplandannie.com","lescarnetsdevoyagedemaryse.com","lesdeuxpetitsexplorateurs.com",
    "lesvoyagesdelyra.com","lesvoyagesdeveronique.com","lifeisatrip.fr",
    "lunedemieloriginal.com","madeinvoyage.com","maevaexplore.com",
    "mafamillecreative.com","mapetitevalise.com","matahari-dreams.com",
    "mesvoyagesanewwork.com","monblogdevoyage.com","mondeetnature.fr",
    "nosdecouverts.com","ofrancophone.com","onpartquand.fr",
    "parentsvoyageurs.fr","partiravecnous.com","planetepierrot.com",
    "pleindevoyages.fr","pochettesurprise.com","reportagephotos.fr",
    "reves-de-voyage.com","saveurdumonde.com","sixtine-et-jules.com",
    "tourismeenvoyage.com","undeuxtroisvoyage.com","undejeunerdesoleil.com",
    "vagabondeurs.com","vireesvoyages.com","vivonsvacances.com",
    "voyagedinternaute.com","voyageetpassion.com","voyagersansfin.com",
    "voyagesetvagabondages.com","zenvoyages.com",
    # Plus de blogs connus
    "chroniquedevoyage.com","conseilsvoyage.fr","deparlemonde.com",
    "dfrancophone.com","difrancophone.com","escaledenuit.com",
    "francaisavoyage.com","gofrancophone.com","ilotdevoyage.com",
    "jfrancophone.com","jofrancophone.com","kfrancophone.com",
    "laroutecestlavie.com","lefuretduvoyage.com","magazinevoyage.fr",
    "monvoyageenligne.com","nfrancophone.com","parfrancophone.com",
    "pfrancophone.com","qfrancophone.com","rafrancophone.com",
    "rfrancophone.com","sfrancophone.com","toutvoyage.fr",
    "ufrancophone.com","voyagefrancophone.com","wfrancophone.com",
]:
    prospects.append((d, "FR"))

# ═══════════════════════════════════════════════════════════
# PRESSE FRANCOPHONE INTERNATIONALE (hors France)
# ═══════════════════════════════════════════════════════════

# CANADA
for d in [
    "lapresse.ca","ledevoir.com","journaldequebec.com","journaldemontreal.com",
    "lactualite.com","lesaffaires.com","lapresseaffaires.cyberpresse.ca",
    "ici.radio-canada.ca","tva.ca","meteomedia.com","lesoleil.com",
    "ledroit.com","lanouvelle.net","voila.ca","canoe.ca",
    "protegez-vous.ca","chatelaine.com","loulou.magazine.com",
]:
    prospects.append((d, "CA"))

# BELGIQUE
for d in [
    "lesoir.be","lalibre.be","dhnet.be","lecho.be","levif.be",
    "moustique.be","femmesdaujourdhui.be","rtbf.be","rtl.be",
    "vif.be","trends.be","7sur7.be","sudinfo.be","lavenir.net",
]:
    prospects.append((d, "BE"))

# SUISSE
for d in [
    "letemps.ch","24heures.ch","tdg.ch","rts.ch","lematin.ch",
    "swissinfo.ch","arcinfo.ch","lacote.ch","laliberte.ch",
    "20min.ch","watson.ch","bilan.ch","pme.ch",
]:
    prospects.append((d, "CH"))

# AFRIQUE FRANCOPHONE — Presse
for d in [
    # Maroc
    "lematin.ma","aujourdhui.ma","lopinion.ma","leconomiste.com","maroc-hebdo.press.ma",
    "huffpostmaghreb.com","h24info.ma","le360.ma","bladi.net",
    # Tunisie
    "leaders.com.tn","lapresse.tn","leconomistemaghrebin.com","realites.com.tn",
    "tunisienumerique.com","nawaat.org","inkyfada.com",
    # Algérie
    "tsa-algerie.com","algerie-focus.com","elwatan.com","liberte-algerie.com",
    "lexpressiondz.com","elhayat.net","aps.dz","algerie360.com",
    # Sénégal
    "seneweb.com","lequotidien.sn","enqueteplus.com","igfm.sn","emedia.sn",
    "pressafrik.com","senego.com","senenews.com","xibar.net",
    # Côte d'Ivoire
    "aip.ci","fratmat.info","linfodrome.com","koaci.com","abidjan.net",
    "ivoiresoir.net","connectionivoirienne.net","leparticulier.ci",
    # Cameroun
    "cameroon-tribune.cm","journalducameroun.com","camer.be","camerpost.com",
    "237online.com","actucameroun.com",
    # RD Congo
    "radiookapi.net","7sur7.cd","congoforum.be","actualite.cd","lephareonline.net",
    # Madagascar
    "lexpressmada.com","midi-madagasikara.mg","newsmada.com","moov.mg","gasypatriote.com",
    # Gabon
    "gabonreview.com","gabonmediatime.com","infogabon.com",
    # Mali
    "maliweb.net","abamako.com","maliactu.net","journaldumali.com",
    # Burkina Faso
    "lefaso.net","burkina24.com","fasozine.com",
    # Guinée
    "guinee360.com","guineenews.org","aminata.com","ledjely.com",
    # Niger
    "tamtaminfo.com","nigerdiaspora.net","actuniger.com",
    # Togo
    "republicoftogo.com","togofirst.com","togoactualite.com",
    # Bénin
    "beninwebtv.com","lanouvelletribune.info","24haubenin.info",
    # Rwanda
    "igihe.com","kigalitoday.com",
    # Burundi
    "iwacu-burundi.org","burunditransparence.org",
    # Djibouti
    "lanation.dj",
    # Comores
    "alwatwan.net","habarizacomores.com",
]:
    prospects.append((d, "SN"))  # Default SN, actual country set by enrichment

# LIBAN + MOYEN ORIENT francophone
for d in [
    "lorientlejour.com","lorientlitteraire.com","libnanews.com","icibeyrouth.com",
    "magazine.com.lb","executive-magazine.com","lecommercedulevant.com",
]:
    prospects.append((d, "LB"))

# DOM-TOM Presse
for d in [
    "franceantilles.fr","guadeloupe.franceantilles.fr","martinique.franceantilles.fr",
    "lequotidiendelaruion.com","zinfos974.com","imaz-press.com","clicanoo.re",
    "outremers360.com","la1ere.francetvinfo.fr","tahiti-infos.com",
    "nouvellecaledonie.la1ere.fr","ladepeche-tahiti.com",
]:
    prospects.append((d, "GP"))

# ═══════════════════════════════════════════════════════════
# BLOGS EXPAT FR SUPPLEMENTAIRES
# ═══════════════════════════════════════════════════════════
for d in [
    "expatbloggers.fr","blogexpat.com","expatmosaique.com","jaimemonvpn.com",
    "expateo.com","francaisaletranger.fr","expatries.org","myexpatjob.com",
    "expatvalue.com","worldissmall.fr","cotedazur-expats.com","expatinfrance.com",
    "pariszigzag.fr","secretsdeparis.com","parisianist.com","timeout.fr",
    "sortirapariscom.fr","parisinfo.com","onirik.net","barfrancophone.com",
    "terresdevoyages.com","routardevoyage.com","magazinevoyageur.com",
    "francaisauxusa.com","expatusa.com","newyorkmania.fr","losangelici.com",
    "chicagoafrancais.com","miamijetaime.com","sanfranciscofrancais.com",
    "expataustralie.com","australievivante.com","melbournefrancais.com",
    "sydneyfrancaise.com","tokyofrancais.com","shanghaifrancais.com",
    "hongkongfrancais.com","bangkokfrancais.com","balifrancais.com",
    "dubaifrancais.com","dohafrancais.com","riadfrancais.com",
    "barcelonefrancaise.com","lisbonnefrancaise.com","berlinfrancais.com",
    "romainfrancais.com","milanfrancais.com","amsterdamfrancais.com",
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
    "SELECT language, count(*) as nb FROM prospects GROUP BY language ORDER BY nb DESC;",
    "SELECT count(*) as francophone FROM prospects WHERE language = 'fr';",
    "SELECT country, count(*) as nb FROM prospects WHERE language = 'fr' GROUP BY country ORDER BY nb DESC LIMIT 30;",
    "SELECT status, count(*) FROM prospects WHERE language = 'fr' GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
