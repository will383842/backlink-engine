#!/usr/bin/env python3
"""Add francophone blog prospects directly to the database."""
import subprocess

blogs = [
    # Blogs voyage FR majeurs
    "generationvoyage.fr:FR","novo-monde.com:FR","instinct-voyageur.fr:FR","voyageway.com:FR",
    "onedayonetravel.com:FR","unsacsurledos.com:FR","voyagetips.com:FR","mademoiselle-voyage.fr:FR",
    "voyagefamily.com:FR","globe-trotting.com:FR","voyager-en-photos.fr:FR","leblogdesarah.com:FR",
    "madame-oreille.com:FR","carnetdevoyages.fr:FR","tourdumondiste.com:FR","partirloin.com:FR",
    "jdroadtrip.tv:FR","valisevirtuelle.fr:FR","blogvoyage.fr:FR","lesacados.com:FR",
    "lecoindesvoyageurs.fr:FR","monblogvoyage.com:FR","voyageavecnous.fr:FR","chroniquedevoyage.com:FR",
    # Medias expat FR
    "lepetitjournal.com:FR","femmexpat.com:FR","expatriation.com:FR","pvtistes.net:FR",
    "frenchmorning.com:US","frenchradar.com:FR","frenchdistrict.com:US","expatval.com:FR",
    # Vivre a...
    "vivre-en-thailande.com:TH","vivre-au-costarica.com:CR","vivre-au-portugal.com:PT",
    "vivre-en-espagne.com:ES","vivre-au-canada.com:CA","vivre-en-australie.com:AU",
    "vivreaumexique.com:MX","vivre-a-dubai.com:AE","vivreaupanama.com:PA","vivrealisbonne.com:PT",
    # Photographes voyage FR
    "lostnomad.fr:FR","gregoryrohart.com:FR","objectif-photographe.fr:FR","lesvoyagesdalexa.com:FR",
    "paulinaontheroad.com:DE",
    # Pays specifiques FR
    "japanfm.fr:JP","japon-infos.com:JP","leptitfute.com:FR","au-senegal.com:SN",
    "etudionsaletranger.fr:FR","unfrancaisalandres.com:GB","lefrancaisadublin.com:IE",
    "montrealaddicts.com:CA","lesfrancaisabarcelone.com:ES","jeveuxvivreencoree.com:KR",
    "australieenfamille.com:AU","voyagesenfamille.com:FR","nomadedigital.org:FR",
    # Afrique francophone
    "expat-dakar.com:SN","vivreamadagascar.com:MG","abidjan.net:CI","dakaractu.com:SN",
    "visa-maroc.com:MA","tunisie-voyage.com:TN",
    # Investissement expat FR
    "investir-a-bali.com:ID","investirauportugal.com:PT","frenchtouchproperties.com:FR",
    # Divers FR
    "easyvoyage.com:FR","liligo.fr:FR","linternaute.com:FR","bonjouridee.com:FR",
    "evasionsenimages.com:FR","french-icecream.com:FR","blogabroad.fr:FR","expat.org:FR",
    "nomadlist.fr:FR","au-pair.fr:FR","travelblog.fr:FR","blogvoyages.fr:FR",
    # Supplementaires FR
    "courrierinternational.com:FR","routard.com:FR","voyageforum.com:FR",
    "monnuage.fr:FR","petitfute.com:FR","cityzeum.com:FR","voyages-sncf.com:FR",
    "lonelyplanet.fr:FR","geo.fr:FR","detoursenfrance.fr:FR","guide-evasion.fr:FR",
    "lefigaro.fr:FR","lexpress.fr:FR","lemonde.fr:FR",
    # Blogs expat Afrique FR
    "seneweb.com:SN","leral.net:SN","camerpost.com:CM","abamako.com:ML",
    "guinee360.com:GN","congo-autrement.com:CD","gabonreview.com:GA","burkinaonline.com:BF",
    # Blogs expat DOM-TOM
    "reunionnaisdumonde.com:RE","martinique.org:MQ","guadeloupe-tourisme.com:GP",
    "tahiti-tourisme.com:PF","nouvellecaledonie-tourisme.com:NC",
    # Quebec/Canada FR
    "immigrer.com:CA","immigration.ca:CA","jeparsaucanada.com:CA","pvtcanada.com:CA",
    "expatries.org:FR","myfrenchlife.org:AU",
    # Maghreb/Moyen-Orient FR
    "maroc-voyages.com:MA","algerie-monde.com:DZ","tunisiebooking.com:TN",
    "liban-voyage.com:LB","dubaimadame.com:AE",
]

values = []
for b in blogs:
    parts = b.split(":")
    domain = parts[0]
    country = parts[1] if len(parts) > 1 else "FR"
    values.append(f"('{domain}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", 'fr', '{country}', NOW(), NOW())")

sql = 'INSERT INTO prospects (domain, source, status, language, country, "createdAt", "updatedAt") VALUES\n' + ",\n".join(values) + "\nON CONFLICT (domain) DO NOTHING;"

result = subprocess.run(
    ["docker", "exec", "-i", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine"],
    input=sql, capture_output=True, text=True
)
print(result.stdout.strip())
if result.returncode != 0:
    print("ERROR:", result.stderr[:500])

# Show stats
for query in [
    'SELECT count(*) as total FROM prospects;',
    "SELECT language, count(*) FROM prospects GROUP BY language ORDER BY count(*) DESC;",
    "SELECT count(*) as fr_prospects FROM prospects WHERE language = 'fr';",
]:
    r = subprocess.run(
        ["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", query],
        capture_output=True, text=True
    )
    print(r.stdout.strip())
