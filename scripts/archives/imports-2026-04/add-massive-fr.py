#!/usr/bin/env python3
"""Add MASSIVE francophone prospects — country by country, all niches."""
import subprocess

prospects = []

# FRANCE - Blogs voyage
for d in ["a-contresens.net","aventuredumonde.fr","bestjobersblog.com","bonsbaisersde.com","carigami.fr","come4news.com","conseilsdevoyage.fr","curiositesdevoyageuses.com","destination-reportage.com","detours-du-monde.com","entre-deux-escales.com","esprit-voyage.com","familytrip.fr","girltrotter.com","globetrotteuse.com","greaterdays.fr","happyusbook.com","journalduvoyageur.com","lachouetteplanete.com","lapointed.fr","laprochaineescale.com","lateteenlair.net","lemondedejustine.fr","lesvoyagesdecindy.com","lost-in-adventures.com","milesandlove.com","missaround.com","moncoindumonde.com","myatlas.com","noobvoyage.fr","planetevoyages.net","quandondecidedepartir.com","roadtripin.fr","routedesvoyages.com","travel-me-happy.com","unmondeailleurs.net","voirlemonde.com","worldwildbrice.com","zen-et-organisee.com"]:
    prospects.append((d, "FR"))

# CANADA francophone
for d in ["jeparsaucanada.com","pvtcanada.com","immigrer.com","montrealaddicts.com","lapresse.ca","lactualite.com","francaisaucanada.com","expatcanada.com","ledevoir.com","authentikcanada.com","guidecanada.com","destinationcanada.com","voyagecanada.info"]:
    prospects.append((d, "CA"))

# BELGIQUE
for d in ["bruxelles-les-bons-plans.com","bxlblog.be","dolcecity.com","vivreenbelgique.be","visitbrussels.be","belgique-tourisme.fr"]:
    prospects.append((d, "BE"))

# SUISSE
for d in ["expatsuisse.com","vivreettravailler.ch","geneve-tourisme.ch","myswitzerland.com","swissinfo.ch"]:
    prospects.append((d, "CH"))

# MAROC
for d in ["visa-maroc.com","maroc-voyages.com","expatmaroc.com","visitmorocco.com","maroc-tourisme.com","yabiladi.com","medias24.com","hespress.com","telquel.ma","lavieeco.com"]:
    prospects.append((d, "MA"))

# TUNISIE
for d in ["tunisie-voyage.com","tunisiebooking.com","espritdetunisie.com","tunisienumerique.com","businessnews.com.tn","webdo.tn"]:
    prospects.append((d, "TN"))

# SENEGAL + Afrique Ouest
for d in ["au-senegal.com","expat-dakar.com","seneweb.com","leral.net","dakaractu.com","abidjan.net","fratmat.info","abamako.com","guineenews.org","guinee360.com","lequotidien.sn","galseninfo.com","senegal-online.com"]:
    prospects.append((d, "SN"))

# MADAGASCAR
for d in ["vivreamadagascar.com","madagascar-tourisme.com","lexpressmada.com","midi-madagasikara.mg","newsmada.com"]:
    prospects.append((d, "MG"))

# COTE D'IVOIRE + Afrique Centrale
for d in ["connectionivoirienne.net","linfodrome.com","koaci.com","congo-autrement.com","gabonreview.com","camerpost.com","journalducameroun.com"]:
    prospects.append((d, "CI"))

# LIBAN + DUBAI
for d in ["liban-voyage.com","lorientlejour.com","libnanews.com","vivre-a-dubai.com","dubaimadame.com","frenchiesdubai.com","dubai-expat.fr"]:
    prospects.append((d, "LB"))

# OCEAN INDIEN
for d in ["ile-maurice.fr","expatmaurice.com","reunionnaisdumonde.com","lareunion-tourisme.com"]:
    prospects.append((d, "MU"))

# ASIE francophone
for d in ["vivre-en-thailande.com","expatthailande.com","gaijinjapan.org","japanfm.fr","japon-infos.com","chinesedays.fr","coree-du-sud.net","jeveuxvivreencoree.com","investir-a-bali.com","siamactu.fr","singapour-live.com","cambodgepost.com"]:
    prospects.append((d, "TH"))

# AMERIQUE LATINE francophone
for d in ["vivreaumexique.com","vivreaupanama.com","vivre-au-costarica.com","buenosairesfrench.com","brasilfr.com","perou-voyage.com","chile-excepcion.com","argentinevoyage.com","colombie-decouverte.com"]:
    prospects.append((d, "MX"))

# EUROPE SUD francophone
for d in ["vivre-en-espagne.com","lesfrancaisabarcelone.com","vivre-au-portugal.com","vivrealisbonne.com","expatportugal.com","lisbonne-affinites.com","investirauportugal.com","barcelona-autrement.com"]:
    prospects.append((d, "ES"))

# UK + IRLANDE francophone
for d in ["unfrancaisalandres.com","lefrancaisadublin.com","lafrancaiseinlondon.com","frenchtouch-london.com","londonmaniere.com"]:
    prospects.append((d, "GB"))

# ALLEMAGNE francophone
for d in ["vivreaberlin.com","francaisaberlin.com","berlinestanous.com"]:
    prospects.append((d, "DE"))

# OCEANIE francophone
for d in ["vivre-en-australie.com","australieenfamille.com","myfrenchlife.org","pvtaustralie.com","australie-voyage.fr"]:
    prospects.append((d, "AU"))

# USA francophone
for d in ["frenchmorning.com","frenchdistrict.com","frenchradar.com","franceamerique.com","newyorkinfrench.net","miamienfrance.com"]:
    prospects.append((d, "US"))

# DOM-TOM
for d in ["martinique.org","guadeloupe-tourisme.com","tahiti-tourisme.com","nouvellecaledonie-tourisme.com","guyane-amazonie.fr"]:
    prospects.append((d, "GP"))

# PHOTOGRAPHES VOYAGE FR
for d in ["lostnomad.fr","gregoryrohart.com","objectif-photographe.fr","lesvoyagesdalexa.com","voyager-en-photos.fr","madame-oreille.com","evasionsenimages.com","phototrend.fr","nikonpassion.com","posepartager.fr"]:
    prospects.append((d, "FR"))

# DIGITAL NOMADS FR
for d in ["nomadedigital.org","nomade-digital.net","teletravaileursdumonde.com","freelancerepat.com","remoters.net","travaillerdepartout.com"]:
    prospects.append((d, "FR"))

# ETUDIANTS INTERNATIONAUX FR
for d in ["etudionsaletranger.fr","studyrama.com","letudiant.fr","campusfrance.org","erasmusworld.org","digischool.fr"]:
    prospects.append((d, "FR"))

# RETRAITES A L'ETRANGER FR
for d in ["retraitealetranger.fr","prendresaretraite.com","retraite-etranger.fr","seniorplanet.fr","notretemps.com"]:
    prospects.append((d, "FR"))

# INVESTISSEURS EXPAT FR
for d in ["investir-a-bali.com","investirauportugal.com","frenchtouchproperties.com","patrimoine-expat.com","immobilier-expat.com"]:
    prospects.append((d, "FR"))

# ASSURANCE EXPAT FR
for d in ["acs-ami.com","mondassur.com","april-international.com","chapkadirect.com","asfe-expat.com","mutuelle-des-francais-a-letranger.com"]:
    prospects.append((d, "FR"))

# BANQUE EXPAT FR
for d in ["mon-banquier.com","boursorama.com","fortuneo.fr","hellobank.fr"]:
    prospects.append((d, "FR"))

# DEMENAGEMENT INTERNATIONAL FR
for d in ["demenageur-international.com","movinga.fr","ags-demenagement.com","demenager-seul.com"]:
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
    "SELECT language, count(*) FROM prospects GROUP BY language ORDER BY count(*) DESC;",
    "SELECT country, count(*) as nb FROM prospects WHERE language = 'fr' GROUP BY country ORDER BY nb DESC LIMIT 25;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
