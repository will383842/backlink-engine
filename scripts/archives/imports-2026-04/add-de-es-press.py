#!/usr/bin/env python3
"""German + Spanish press, media, bloggers — MASSIVE."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# 🇩🇪 GERMANY — PRESSE NATIONALE
# ═══════════════════════════════════════════════════════════
for d in [
    "spiegel.de","zeit.de","faz.net","sueddeutsche.de","welt.de",
    "bild.de","tagesspiegel.de","handelsblatt.com","wiwo.de",
    "stern.de","focus.de","n-tv.de","tagesschau.de","zdf.de",
    "deutschlandfunk.de","dw.com","berliner-zeitung.de",
    "stuttgarter-zeitung.de","merkur.de","hna.de","mopo.de",
    "ksta.de","rp-online.de","rheinpfalz.de","noz.de",
    "shz.de","svz.de","maz-online.de","lvz.de","saechsische.de",
    "freiepresse.de","thueringer-allgemeine.de","mdr.de","ndr.de",
    "wdr.de","br.de","swr.de","hr-online.de","rbb24.de",
]:
    prospects.append((d, "DE", "de"))

# 🇩🇪 GERMANY — TRAVEL / LIFESTYLE
for d in [
    "geo.de","merian.de","reisereporter.de","travelbook.de",
    "urlaubsguru.de","holidaycheck.de","trivago.de","check24.de",
    "ab-in-den-urlaub.de","sonnenklar.tv","weg.de","expedia.de",
    "booking.com","airbnb.de","hostelworld.com","skyscanner.de",
    "kayak.de","momondo.de","swoodoo.com","idealo.de",
    "lonely-planet.de","marco-polo.de","dumont-reise.de",
    "bruckmann.de","reise-know-how.de","iwanowski.de",
]:
    prospects.append((d, "DE", "de"))

# 🇩🇪 GERMANY — EXPAT / AUSWANDERN
for d in [
    "auswandern-handbuch.de","auswandern-heute.de","auswandertips.com",
    "auswandern.de","wohin-auswandern.de","auswanderer-blog.de",
    "deutscheimausland.org","auslandsentsendung.de","expatrio.com",
    "settle-in-berlin.com","allaboutberlin.com","toytowngermany.com",
    "internations.org","expatica.com","justlanded.de",
    "make-it-in-germany.com","young-germany.de","study-in-germany.de",
    "deutschland.de","tatsachen-ueber-deutschland.de","goethe.de",
    "daad.de","humboldt-foundation.de","dw.com",
]:
    prospects.append((d, "DE", "de"))

# 🇩🇪 GERMANY — TRAVEL BLOGGERS
for d in [
    "22places.de","bravebird.de","reiseblog-travelogue.de","komm-wir-machen-das-einfach.de",
    "pixelschmitt.de","reisedepeschen.de","reisewut.com","weltreiseforum.de",
    "offthepath.com","traveloptimizer.de","sommertage.com","littletravelsociety.de",
    "weltenbummler-magazin.de","woanderssein.com","taklyontour.de",
    "reiseblogger-werden.de","planetenreiter.de","fluegeguenstig.com",
    "vielweib.de","homeiswhereyourbagis.com","indojunkie.com",
    "faszination-suedostasien.de","australien-blogger.de","usa-reiseblogger.de",
    "fernwehge.com","travel-du.de","reiseblog-hinterindien.de",
    "travellers-insight.com","geh-mal-reisen.de","meehr-erleben.de",
    "travelsicht.de","reiselust-mag.de","backpackertrail.de",
    "journeyglimpse.com","wedesigntrips.com","reisespatz.de",
    "travelicia.de","barbaralicious.com","reisen-fotografie.de",
    "opjueck.de","flocblog.de","worthseeing.de","geckofootsteps.com",
    "weltwunderer.de","fraeulein-draussen.de","imprintmytravel.com",
]:
    prospects.append((d, "DE", "de"))

# 🇩🇪 GERMANY — DIGITAL NOMAD / REMOTE
for d in [
    "digitale-nomaden.com","wirelesslife.de","citizen-circle.com",
    "digitalenomadenwelt.de","ortsunabhaengig.de","fernarbeit.net",
    "remotejobs.de","freelance.de","gulp.de","twago.de",
]:
    prospects.append((d, "DE", "de"))

# 🇩🇪 AUSTRIA
for d in [
    "derstandard.at","diepresse.com","kurier.at","krone.at",
    "orf.at","salzburg.com","tt.com","kleinezeitung.at",
    "vienna.at","wien.info","austria.info","falter.at",
]:
    prospects.append((d, "AT", "de"))

# 🇨🇭 SWITZERLAND (German)
for d in [
    "nzz.ch","tagesanzeiger.ch","blick.ch","srf.ch",
    "luzernerzeitung.ch","bernerzeitung.ch","aargauerzeitung.ch",
    "20min.ch","watson.ch","bluewin.ch",
]:
    prospects.append((d, "CH", "de"))

# ═══════════════════════════════════════════════════════════
# 🇪🇸 SPAIN — PRESSE NATIONALE
# ═══════════════════════════════════════════════════════════
for d in [
    "elpais.com","elmundo.es","abc.es","lavanguardia.com",
    "elperiodico.com","larazon.es","elconfidencial.com","eldiario.es",
    "publico.es","20minutos.es","europapress.es","efe.com",
    "rtve.es","antena3.com","telecinco.es","lasexta.com",
    "cope.es","ondacero.es","cadanaser.com","elespanol.com",
    "okdiario.com","vozpopuli.com","huffpost.es","expansion.com",
    "cincodias.elpais.com","eleconomista.es","lainformacion.com",
]:
    prospects.append((d, "ES", "es"))

# 🇪🇸 SPAIN — TRAVEL / LIFESTYLE
for d in [
    "lonelyplanet.es","traveler.es","nationalgeographic.es","geo.es",
    "viajesng.com","elviajero.elpais.com","escapadarural.com",
    "minube.com","losviajeros.com","viajerosblog.com",
    "booking.com","airbnb.es","skyscanner.es","kayak.es",
    "edreams.es","rumbo.es","logitravel.com","muchoviaje.com",
    "atrápalo.com","viajes-el-corte-ingles.es","halconviajes.com",
    "nautalia.com","centraldereservas.com","vueling.com",
    "iberia.com","renfe.com","blablacar.es",
]:
    prospects.append((d, "ES", "es"))

# 🇪🇸 SPAIN — EXPAT / EMIGRAR
for d in [
    "expatspain.com","spaineasy.com","spainexpat.com","lifeincostadelsol.com",
    "justlanded.es","internations.org","expatica.com",
    "numbeo.com","livingcostadelsol.com","andalucia.com",
    "barcelona-metropolitan.com","madridmetropolitan.com",
    "thelocal.es","surinenglish.com","euroweeklynews.com",
    "majorcadailybulletin.com","ibizatimes.com","tenerife-news.com",
    "costadelsol-news.com","murciatoday.com","alicanteplaza.es",
    "spanishpropertyinsight.com","idealista.com","fotocasa.es",
]:
    prospects.append((d, "ES", "es"))

# 🇪🇸 SPAIN — TRAVEL BLOGGERS ES
for d in [
    "mochileros.org","viajablog.com","difrancaisespanol.com",
    "elpachinko.com","travelbloggersmeeting.com","mindthetrip.it",
    "saltaconmigo.com","intrfrancaisespanol.com","viajerospiratas.es",
    "101lugaresincreibles.com","dfrancaisespanol.com","elrincondesele.com",
    "milyunahistorias.com","elproximoviaje.com","lanfrancaisespanol.com",
    "lasbotas.net","mochilazo.es","viajandoconmami.com",
    "cafrancaisespanol.com","mochilerosenruta.com","viajejet.com",
    "viajesyrutas.es","planificatuviaje.es","viajesmochilero.com",
    "apfrancaisespanol.com","blogdeviajes.com","cosasdviajeros.com",
    "lacfrancaisespanol.com","losapuntesdelviajero.com",
    "miviajeporelmundo.com","pasaporteblog.com","tierrasinsolitas.com",
    "turismoytren.com","unaventuraencadaviaje.com","viajaporlibre.com",
    "viajaratope.com","viajeroselite.com",
]:
    prospects.append((d, "ES", "es"))

# 🇪🇸 SPAIN — DIGITAL NOMAD ES
for d in [
    "nomadadigital.com","trabajarporelmundo.org","sinoficina.com",
    "freelancermap.com","infojobs.net","domestika.org",
    "coworkingspain.es","workaway.info","helpx.net","worldpackers.com",
]:
    prospects.append((d, "ES", "es"))

# 🇲🇽 MEXICO
for d in [
    "eluniversal.com.mx","reforma.com","milenio.com","excelsior.com.mx",
    "jornada.com.mx","proceso.com.mx","sinembargo.mx","animalepolitico.com",
    "elfinanciero.com.mx","forbes.com.mx","expansion.mx",
    "mexicodesconocido.com.mx","travesiasdigital.com","foodandtravel.mx",
    "lonelyplanet.mx","visitmexico.com","mexicocity.gob.mx",
]:
    prospects.append((d, "MX", "es"))

# 🇦🇷 ARGENTINA
for d in [
    "lanacion.com.ar","clarin.com","infobae.com","pagina12.com.ar",
    "ambito.com","cronista.com","perfil.com","iprofesional.com",
    "buenosaires.gob.ar","turismo.buenosaires.gob.ar",
    "viajobien.com.ar","welcomeargentina.com",
]:
    prospects.append((d, "AR", "es"))

# 🇨🇴 COLOMBIA
for d in [
    "eltiempo.com","elespectador.com","semana.com","portafolio.co",
    "pulzo.com","colombia.com","colombia.travel","bogotadc.travel",
]:
    prospects.append((d, "CO", "es"))

# 🇨🇱 CHILE
for d in [
    "elmercurio.com","latercera.com","biobiochile.cl","emol.com",
    "chile.travel","thisischile.cl",
]:
    prospects.append((d, "CL", "es"))

# 🇵🇪 PERU
for d in [
    "elcomercio.pe","larepublica.pe","gestion.pe","peru.travel",
    "andina.pe","peru21.pe",
]:
    prospects.append((d, "PE", "es"))

# 🇪🇨 ECUADOR + others
for d in [
    "eluniverso.com","elcomercio.com","ecuadortravel.com",
    "elpanama-america.com.pa","visitpanama.com",
    "nacion.com","visitcostarica.com",
]:
    prospects.append((d, "EC", "es"))

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
