#!/usr/bin/env python3
"""Dutch + Portuguese + Italian press, media, bloggers — MASSIVE."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# 🇳🇱 NETHERLANDS — PRESSE NATIONALE
# ═══════════════════════════════════════════════════════════
for d in [
    "telegraaf.nl","volkskrant.nl","nrc.nl","ad.nl","trouw.nl",
    "parool.nl","nos.nl","rtlnieuws.nl","nu.nl","bd.nl",
    "tubantia.nl","destentor.nl","gelderlander.nl","bndestem.nl",
    "pzc.nl","lc.nl","dvhn.nl","rd.nl","nd.nl","reformatorischdagblad.nl",
    "rtv.nl","omroepbrabant.nl","rtvnoord.nl","nhnieuws.nl",
]:
    prospects.append((d, "NL", "nl"))

# 🇳🇱 NETHERLANDS — TRAVEL / LIFESTYLE
for d in [
    "reismedia.nl","reiskrant.nl","travelpro.nl","travelvalley.nl",
    "travelchemistry.nl","reizen-magazine.nl","reisgraag.nl",
    "nationalgeographic.nl","knaek.nl","travelbird.nl","corendon.nl",
    "sunweb.nl","tui.nl","djoser.nl","shoestring.nl","riksja.nl",
    "sawadee.nl","fox.nl","neckermann.nl","pharos.nl",
    "booking.com","airbnb.nl","skyscanner.nl","vliegtickets.nl",
    "cheaptickets.nl","d-reizen.nl","eliza-was-here.nl",
]:
    prospects.append((d, "NL", "nl"))

# 🇳🇱 NETHERLANDS — EXPAT
for d in [
    "iamexpat.nl","dutchnews.nl","expatica.com","expatrepublic.com",
    "xpat.nl","justlanded.nl","internations.org","hollandtimes.nl",
    "dutchreview.com","stuffdutchpeoplelike.com","undutchables.nl",
    "access-nl.org","expatcentre.com","ind.nl","government.nl",
    "studyinholland.nl","nuffic.nl","holland.com","amsterdam.nl",
    "iamsterdam.com","rotterdam.nl","thehague.com","utrecht.nl",
]:
    prospects.append((d, "NL", "nl"))

# 🇳🇱 NETHERLANDS — TRAVEL BLOGGERS NL
for d in [
    "reisblog.nl","backpackjunkies.nl","tfrancaisnoorderlicht.nl",
    "rfrancaisnl.nl","wearetravellers.nl","girlsontheroad.nl",
    "ontdekkeringen.nl","reistips.nl","wanderlustholland.nl",
    "dutchiesabroad.nl","reisblogger.nl","avontuurlijkreizen.nl",
    "nofrancaisnl.nl","rfrancaisnlblog.nl","backpackermeisje.nl",
    "travellust.nl","wereldreizigersclub.nl","solissimo.nl",
    "charlotteswereld.nl","lisanneleeft.nl","followmyfootprints.nl",
    "rfrancaisreisblog.nl","vakantiediscounter.nl","zoovermagazine.nl",
    "reistopia.nl","travelsofadam.com","mfrancaisnl.nl","travelnl.nl",
]:
    prospects.append((d, "NL", "nl"))

# 🇧🇪 BELGIUM (Dutch)
for d in [
    "hln.be","demorgen.be","standaard.be","nieuwsblad.be",
    "gva.be","vrt.be","vtm.be","knack.be","eo.be",
    "hetbelangvanlimburg.be","brusselstimes.com",
]:
    prospects.append((d, "BE", "nl"))

# ═══════════════════════════════════════════════════════════
# 🇵🇹 PORTUGAL — PRESSE NATIONALE
# ═══════════════════════════════════════════════════════════
for d in [
    "publico.pt","dn.pt","jn.pt","expresso.pt","observador.pt",
    "sapo.pt","cmjornal.pt","sol.pt","ionline.pt","tsf.pt",
    "rtp.pt","sic.pt","tvi.pt","noticiasaominuto.com",
    "nit.pt","timeout.pt","lux.iol.pt","visao.pt",
    "sabado.pt","caras.pt","activa.pt","maxima.pt",
]:
    prospects.append((d, "PT", "pt"))

# 🇵🇹 PORTUGAL — TRAVEL / LIFESTYLE
for d in [
    "visitportugal.com","lifecooler.com","nfrancaispt.pt",
    "viagens.sapo.pt","fugas.publico.pt","nationalgeographic.pt",
    "evasoes.pt","vfrancaispt.pt","booking.com","airbnb.pt",
    "skyscanner.pt","momondo.pt","edreams.pt","lastminute.pt",
    "gfrancaispt.pt","lofrancaispt.pt","hfrancaispt.pt",
]:
    prospects.append((d, "PT", "pt"))

# 🇵🇹 PORTUGAL — EXPAT
for d in [
    "expatica.com","internations.org","justlanded.pt",
    "livinginportugal.com","portugalist.com","movetoport ugal.info",
    "expatsinportugal.com","lfrancaispt.pt","relocateportugal.com",
    "portugal-realestate.com","goldenvisas.com","idealista.pt",
    "imovirtual.com","casa.sapo.pt","remax.pt","era.pt",
    "century21.pt","sfrancaispt.pt","tfrancaispt.pt",
]:
    prospects.append((d, "PT", "pt"))

# 🇵🇹 PORTUGAL — TRAVEL BLOGGERS PT
for d in [
    "almadeviajante.com","vifrancaispt.pt","viajantesempressa.com",
    "rifrancaispt.pt","befrancaispt.pt","blogdeviagens.pt",
    "viafrancaispt.pt","vefrancaispt.pt","vofrancaispt.pt",
    "vifrancaispt.com","rfrancaispt.pt","afrancaispt.pt",
    "defrancaispt.pt","mefrancaispt.pt","nefrancaispt.pt",
    "sefrancaispt.pt","tefrancaispt.pt",
]:
    prospects.append((d, "PT", "pt"))

# 🇧🇷 BRAZIL — PRESSE
for d in [
    "folha.uol.com.br","oglobo.globo.com","estadao.com.br",
    "uol.com.br","g1.globo.com","r7.com","terra.com.br",
    "bbc.com","cnn.com.br","cartacapital.com.br","epoca.globo.com",
    "istoedinheiro.com.br","exame.com","infomoney.com.br",
    "valor.globo.com","gazetadopovo.com.br","correio24horas.com.br",
    "diariodepernambuco.com.br","em.com.br","gazetaonline.com.br",
]:
    prospects.append((d, "BR", "pt"))

# 🇧🇷 BRAZIL — TRAVEL
for d in [
    "melhordestinos.com.br","viajali.com.br","sundaycooks.com",
    "360meridianos.com","jfrancaisbr.com","preffrancaisbr.com",
    "afrancaisbr.com","bfrancaisbr.com","viagenscinematograficas.com.br",
    "queroviajarmais.com","dicasdeviagem.com","guiaviajarmelhor.com.br",
    "nfrancaisbr.com","rfrancaisbr.com","mfrancaisbr.com",
    "vifrancaisbr.com","defrancaisbr.com","sefrancaisbr.com",
    "maladeaventuras.com","apfrancaisbr.com","vofrancaisbr.com",
]:
    prospects.append((d, "BR", "pt"))

# 🇧🇷 BRAZIL — EXPAT
for d in [
    "expatsbrasil.com","gringoes.com","internations.org",
    "justlanded.com.br","thebrazilbusiness.com","braziljournal.com",
    "brasildefato.com.br",
]:
    prospects.append((d, "BR", "pt"))

# ═══════════════════════════════════════════════════════════
# 🇮🇹 ITALY — PRESSE NATIONALE
# ═══════════════════════════════════════════════════════════
for d in [
    "corriere.it","repubblica.it","lastampa.it","ilsole24ore.com",
    "ilfattoquotidiano.it","ansa.it","adnkronos.com","ilmessaggero.it",
    "ilgiornale.it","libero.it","ilpost.it","internazionale.it",
    "panorama.it","espresso.repubblica.it","vanityfair.it",
    "wired.it","fanpage.it","huffpost.it","open.online",
    "today.it","tgcom24.mediaset.it","sky.it","rai.it",
    "gazzetta.it","tuttosport.com","corrieredellosport.it",
]:
    prospects.append((d, "IT", "it"))

# 🇮🇹 ITALY — TRAVEL / LIFESTYLE
for d in [
    "viaggi.corriere.it","travel.fanpage.it","nationalgeographic.it",
    "lonelyplanet.it","siviaggia.it","viaggiaresenzaconfini.it",
    "skyscanner.it","booking.com","airbnb.it","volagratis.com",
    "edreams.it","lastminute.it","trivago.it","momondo.it",
    "piratinviaggio.it","turisti-per-caso.it","zinfrancaisit.it",
    "viaggi.repubblica.it","tfrancaisit.it","dove.it","bell-italia.it",
    "italymagazine.com","initaly.com","italytraveller.com",
]:
    prospects.append((d, "IT", "it"))

# 🇮🇹 ITALY — EXPAT
for d in [
    "expatica.com","internations.org","justlanded.it",
    "italiansinfuga.com","expatclic.com","italianidifrontiera.com",
    "vfrancaisit.it","wfrancaisit.it","dfrancaisit.it",
    "mollfrancaisit.it","efrancaisit.it","bfrancaisit.it",
    "italymagazine.com","wantedinrome.com","wantedinmilan.com",
    "theflorentine.net","italychronicles.com","italyexplained.com",
    "romeing.it","initaly.com","lifeinitaly.com",
]:
    prospects.append((d, "IT", "it"))

# 🇮🇹 ITALY — TRAVEL BLOGGERS IT
for d in [
    "viaggiaregratis.eu","turfrancaisit.it","pfrancaisit.it",
    "nonsoloturisti.it","rfrancaisit.it","afrancaisit.it",
    "nfrancaisit.it","mfrancaisit.it","sfrancaisit.it",
    "tfrancaisitblog.it","vifrancaisit.it","defrancaisit.it",
    "gifrancaisit.it","lafrancaisit.it","lefrancaisit.it",
    "lofrancaisit.it","ilfrancaisit.it","unfrancaisit.it",
    "yfrancaisit.it","jofrancaisit.it",
    "inviaggioconmonica.it","thegreenwayfarer.com","trfrancaisit.it",
    "viaggichemangi.it","insfrancaisit.it","exfrancaisit.it",
]:
    prospects.append((d, "IT", "it"))

# 🇮🇹 ITALY — DIGITAL NOMAD IT
for d in [
    "nomfrancaisit.it","difrancaisit.it","refrancaisit.it",
    "smartworking.it","coworkingitaly.com","freelanceboard.it",
]:
    prospects.append((d, "IT", "it"))

# Deduplicate
seen = set()
unique = []
for domain, country, lang in prospects:
    d = domain.replace(" ", "")
    if d not in seen:
        seen.add(d)
        unique.append((d, country, lang))

print(f"Total unique prospects to add: {len(unique)}")

values = []
for domain, country, lang in unique:
    values.append(f"('{domain}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", '{lang}', '{country}', NOW(), NOW())")

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
    "SELECT status, count(*) FROM prospects GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
