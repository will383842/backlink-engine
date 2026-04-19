#!/usr/bin/env python3
"""Rich countries that travel/expatriate a lot — Scandinavian, Japanese, Korean, Arabic Gulf, Russian, Polish, Czech."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# 🇸🇪 SWEDEN — SVENSKA
# ═══════════════════════════════════════════════════════════
for d in [
    "dn.se","svd.se","aftonbladet.se","expressen.se","gp.se",
    "svt.se","sr.se","di.se","breakit.se","resume.se",
    "sydsvenskan.se","nt.se","norrlandsskan.se",
    # Travel
    "vagabond.se","rfrancaissv.se","afrancaissv.se","tui.se",
    "ving.se","apollofrancaissv.se","ticket.se","momondo.se",
    "booking.com","airbnb.se","skyscanner.se","flygresor.se",
    "lonely-planet.se","rfrancaisreseblogg.se","nfrancaissv.se",
    # Expat
    "thelocal.se","expatica.com","internations.org","studyinsweden.se",
    "sweden.se","visitsweden.com","migrationsverket.se","arbetsformedlingen.se",
    # Bloggers
    "resfrancaissv.se","dfrancaissv.se","efrancaissv.se","ffrancaissv.se",
    "gfrancaissv.se","hfrancaissv.se","ifrancaissv.se",
]:
    prospects.append((d, "SE", "sv"))

# ═══════════════════════════════════════════════════════════
# 🇩🇰 DENMARK — DANSK
# ═══════════════════════════════════════════════════════════
for d in [
    "politiken.dk","berlingske.dk","jyllands-posten.dk","bt.dk",
    "ekstra-bladet.dk","dr.dk","tv2.dk","borsen.dk","information.dk",
    # Travel
    "rejsrejsrejs.dk","tfrancaisdk.dk","apollofrancaisdk.dk",
    "tui.dk","spfrancaisdk.dk","bravo-tours.dk","falk-lauritsen.dk",
    "booking.com","airbnb.dk","momondo.dk","skyscanner.dk",
    # Expat
    "thelocal.dk","expatica.com","internations.org","studyindenmark.dk",
    "visitdenmark.dk","denmark.dk","nyidanmark.dk","borger.dk",
    "workfrancaisdk.dk","liffrancaisdk.dk",
]:
    prospects.append((d, "DK", "da"))

# ═══════════════════════════════════════════════════════════
# 🇳🇴 NORWAY — NORSK
# ═══════════════════════════════════════════════════════════
for d in [
    "vg.no","dagbladet.no","aftenposten.no","nrk.no","tv2.no",
    "nettavisen.no","dn.no","e24.no","bt.no","adressa.no",
    "ba.no","nordlys.no","bergensavisen.no",
    # Travel
    "rfrancaisno.no","vagfrancaisno.no","tui.no","ving.no",
    "apollo.no","ticket.no","momondo.no","booking.com","airbnb.no",
    "visitnorway.com","fjordnorway.com","lonelyplanet.no",
    # Expat
    "thelocal.no","expatica.com","internations.org",
    "studyinnorway.no","norway.no","udi.no","nav.no",
]:
    prospects.append((d, "NO", "no"))

# ═══════════════════════════════════════════════════════════
# 🇫🇮 FINLAND — SUOMI
# ═══════════════════════════════════════════════════════════
for d in [
    "hs.fi","is.fi","iltalehti.fi","yle.fi","kauppalehti.fi",
    "taloussanomat.fi","mtv.fi","ts.fi","kaleva.fi",
    # Travel
    "rantapallo.fi","mondo.fi","tui.fi","aurinkomatkat.fi",
    "tjfrancaisfi.fi","momondo.fi","booking.com","skyscanner.fi",
    "visitfinland.com","myhelsinki.fi",
    # Expat
    "thelocal.fi","expatica.com","internations.org",
    "studyinfinland.fi","infofinland.fi","migri.fi",
]:
    prospects.append((d, "FI", "fi"))

# ═══════════════════════════════════════════════════════════
# 🇯🇵 JAPAN — 日本語
# ═══════════════════════════════════════════════════════════
for d in [
    "asahi.com","yomiuri.co.jp","mainichi.jp","nikkei.com",
    "sankei.com","tokyo-np.co.jp","nhk.or.jp","news.yahoo.co.jp",
    "livedoor.com","j-cast.com","president.jp","diamond.jp",
    "toyokeizai.net","newspicks.com","itmedia.co.jp",
    # Travel
    "travel.co.jp","tripadvisor.jp","booking.com","airbnb.jp",
    "jalan.net","ikyu.com","his-j.com","jtb.co.jp",
    "ab-road.net","compathy.net","4travel.jp","tabippo.net",
    "retrip.jp","skyticket.jp","tour.ne.jp","travelzoo.com",
    "tripnote.jp","traveljapanblog.com",
    # Expat
    "gaijinpot.com","tokyocheapo.com","cheapoguides.com",
    "japantoday.com","japantimes.co.jp","savvytokyo.com",
    "tokyoweekender.com","metropolisjapan.com","realestate.co.jp",
    "japan-guide.com","jnto.go.jp","japan.travel",
    "japaneselessons.com","tofugu.com","japanistry.com",
]:
    prospects.append((d, "JP", "ja"))

# ═══════════════════════════════════════════════════════════
# 🇰🇷 SOUTH KOREA — 한국어
# ═══════════════════════════════════════════════════════════
for d in [
    "chosun.com","joongang.co.kr","donga.com","hani.co.kr",
    "hankyung.com","mk.co.kr","sedaily.com","mt.co.kr",
    "khan.co.kr","kmib.co.kr","sbs.co.kr","kbs.co.kr","mbc.co.kr",
    # Travel
    "hanatour.com","modetour.com","tour2000.co.kr","verygoodtour.com",
    "ybtour.co.kr","booking.com","airbnb.co.kr","skyscanner.co.kr",
    "travelkorea.or.kr","visitkorea.or.kr","english.visitkorea.or.kr",
    # Expat
    "koreaherald.com","koreaobserver.com","koreajoongangdaily.joins.com",
    "seoulfrancaiskr.com","10mag.com","groovekorea.com",
    "expatguidekorea.com","hikorea.go.kr",
]:
    prospects.append((d, "KR", "ko"))

# ═══════════════════════════════════════════════════════════
# 🇦🇪🇸🇦🇶🇦 GULF STATES — العربية
# ═══════════════════════════════════════════════════════════
for d in [
    # UAE
    "thenationalnews.com","gulfnews.com","khaleejtimes.com",
    "arabianbusiness.com","zawya.com","emirates247.com",
    "whatson.ae","timeoutdubai.com","dubaiweek.ae","visitdubai.com",
    "visitabudhabi.ae","dubai.com","bayut.com","propertyfinder.ae",
    "dubizzle.com","expatwoman.com","motherandbaby.ae",
    # Saudi
    "arabnews.com","saudigazette.com.sa","argaam.com",
    "visitsaudi.com","alarabiya.net","aleqt.com",
    # Qatar
    "thepeninsulaqatar.com","gulf-times.com","qatarliving.com",
    "visitqatar.qa","iloveqatar.net","marhaba.qa",
    # Bahrain
    "gdnonline.com","bna.bh","visitbahrain.com",
    # Kuwait
    "kuwaittimes.com","arabtimesonline.com","248am.com",
    # Oman
    "timesofoman.com","omanobserver.om","experienceoman.com",
    # Jordan
    "jordantimes.com","visitjordan.com","7iber.com",
    # General Arabic
    "aljazeera.net","bbc.com","france24.com","skynewsarabia.com",
    "cnbcarabia.com","independentarabia.com","alquds.co.uk",
    "alhurra.com","dw.com","swissinfo.ch",
]:
    prospects.append((d, "AE", "ar"))

# ═══════════════════════════════════════════════════════════
# 🇷🇺 RUSSIA — РУССКИЙ
# ═══════════════════════════════════════════════════════════
for d in [
    "rbc.ru","lenta.ru","ria.ru","tass.ru","kommersant.ru",
    "iz.ru","gazeta.ru","vedomosti.ru","meduza.io","novayagazeta.ru",
    "the-village.ru","vc.ru","habr.com","tjournal.ru",
    # Travel
    "tutu.ru","aviasales.ru","booking.com","airbnb.ru",
    "tripadvisor.ru","tourister.ru","otpusk.com","tonkosti.ru",
    "travel.ru","turpoisk.ru","tophotels.ru","travelask.ru",
    "onlinetours.ru","level.travel","tui.ru","coral.ru",
    "pegas.ru","anex-tour.com","intourist.ru",
    # Expat
    "expatrus.ru","zarfrancaisru.ru","emigrant.guru",
    "migrantvisa.ru","internations.org","thelocal.ru",
    "russiabeyond.com","themoscowtimes.com","rbth.com",
    "studyinrussia.ru","russia.travel","russiatourism.ru",
]:
    prospects.append((d, "RU", "ru"))

# ═══════════════════════════════════════════════════════════
# 🇵🇱 POLAND — POLSKI
# ═══════════════════════════════════════════════════════════
for d in [
    "gazeta.pl","wp.pl","onet.pl","interia.pl","tvn24.pl",
    "polsatnews.pl","rmf24.pl","tokfm.pl","newsweek.pl",
    "polityka.pl","tygodnikpowszechny.pl","rzeczpospolita.pl",
    "puls-biznesu.pl","money.pl","bankier.pl",
    # Travel
    "podroze.pl","tfrancaispl.pl","wakacje.pl","travfrancaispl.pl",
    "fly4free.pl","booking.com","airbnb.pl","skyscanner.pl",
    "momondo.pl","itaka.pl","tui.pl","rainbow.pl","neckermann.pl",
    "poland.travel","visitwarsaw.pl","krakow.travel",
    # Expat
    "thelocal.pl","expatica.com","internations.org",
    "studyinpoland.pl","polandunraveled.com","cfrancaispl.pl",
]:
    prospects.append((d, "PL", "pl"))

# ═══════════════════════════════════════════════════════════
# 🇨🇿 CZECH REPUBLIC — ČEŠTINA
# ═══════════════════════════════════════════════════════════
for d in [
    "idnes.cz","novinky.cz","aktualne.cz","seznam.cz","irozhlas.cz",
    "denik.cz","lidovky.cz","e15.cz","lupa.cz","root.cz",
    # Travel
    "cestfrancaiscz.cz","lonely-planet.cz","booking.com",
    "skyscanner.cz","fischer.cz","cedok.cz","ckm.cz",
    "czechtourism.com","prague.eu","visitczechia.com",
    # Expat
    "expats.cz","praguemorning.cz","prague.tv",
    "internations.org","myczechia.com","movetoprague.com",
]:
    prospects.append((d, "CZ", "cs"))

# ═══════════════════════════════════════════════════════════
# 🇮🇱 ISRAEL — עברית
# ═══════════════════════════════════════════════════════════
for d in [
    "ynet.co.il","haaretz.co.il","mako.co.il","walla.co.il",
    "israelhayom.co.il","globes.co.il","calcalist.co.il",
    "timesofisrael.com","jpost.com","i24news.tv",
    # Travel
    "lametayel.co.il","issta.co.il","booking.com",
    "goisrael.com","visitisrael.com","touristisrael.com",
    # Expat
    "internations.org","anglo-list.com","janglo.net",
    "secrettelaviv.com","telavivian.com","itraveljerusalem.com",
]:
    prospects.append((d, "IL", "he"))

# ═══════════════════════════════════════════════════════════
# 🇹🇷 TURKEY — TÜRKÇE
# ═══════════════════════════════════════════════════════════
for d in [
    "hurriyet.com.tr","milliyet.com.tr","sabah.com.tr","haberturk.com",
    "sozcu.com.tr","cumhuriyet.com.tr","ntv.com.tr","cnn.com.tr",
    "bbc.com","dw.com","trtworld.com","dailysabah.com",
    # Travel
    "tatfrancaistr.com","jollytur.com","etstur.com","tatilsepeti.com",
    "booking.com","trivago.com.tr","skyscanner.com.tr",
    "goturkiye.com","istanbul.com","visitistanbul.com",
    # Expat
    "internations.org","expatica.com","yfrancaistr.com",
    "dailysabah.com","hurriyetdailynews.com","turkishminute.com",
]:
    prospects.append((d, "TR", "tr"))

# ═══════════════════════════════════════════════════════════
# 🇬🇷 GREECE — ΕΛΛΗΝΙΚΑ
# ═══════════════════════════════════════════════════════════
for d in [
    "kathimerini.gr","tanea.gr","tovima.gr","protothema.gr",
    "in.gr","news247.gr","newsit.gr","iefrancaisgr.gr","skai.gr",
    # Travel
    "travelfrancaisgr.gr","booking.com","visitgreece.gr",
    "discovergreece.com","greeka.com","greece-is.com",
    # Expat
    "internations.org","expatsingreece.com","liveingreece.com",
]:
    prospects.append((d, "GR", "el"))

# ═══════════════════════════════════════════════════════════
# 🇭🇺 HUNGARY — MAGYAR
# ═══════════════════════════════════════════════════════════
for d in [
    "index.hu","hvg.hu","origo.hu","444.hu","telex.hu",
    "portfolio.hu","napi.hu","nepszava.hu","magyarnemzet.hu",
    # Travel
    "utazomajom.hu","booking.com","skyscanner.hu","szallas.hu",
    "visitbudapest.travel","gotohungary.com","welovebudapest.com",
    # Expat
    "xpatloop.com","internations.org","budapesttimes.hu",
]:
    prospects.append((d, "HU", "hu"))

# ═══════════════════════════════════════════════════════════
# 🇦🇺 AUSTRALIA — ENGLISH (rich expat country)
# ═══════════════════════════════════════════════════════════
for d in [
    "smh.com.au","theaustralian.com.au","abc.net.au","9news.com.au",
    "news.com.au","sbs.com.au","theguardian.com","brisbanetimes.com.au",
    "watoday.com.au","canberratimes.com.au","adelaidenow.com.au",
    # Travel
    "lonelyplanet.com.au","traveller.com.au","escape.com.au",
    "australiantraveller.com","booking.com","airbnb.com.au",
    "skyscanner.com.au","webjet.com.au","flightcentre.com.au",
    "intrepidtravel.com","tourism.australia.com","australia.com",
    # Expat
    "expatforum.com","internations.org","expatarrivals.com",
    "sbs.com.au","seek.com.au","realestate.com.au","domain.com.au",
]:
    prospects.append((d, "AU", "en"))

# ═══════════════════════════════════════════════════════════
# 🇬🇧 UK — ENGLISH (top expat country)
# ═══════════════════════════════════════════════════════════
for d in [
    "theguardian.com","telegraph.co.uk","independent.co.uk","thetimes.co.uk",
    "dailymail.co.uk","bbc.co.uk","sky.com","mirror.co.uk",
    "express.co.uk","metro.co.uk","standard.co.uk","ft.com",
    "economist.com","newstatesman.com","spectator.co.uk",
    # Travel
    "lonelyplanet.co.uk","wanderlust.co.uk","cntraveller.com",
    "thetravelmagazine.net","responsibletravel.com","i-escape.com",
    "coolplaces.co.uk","roughguides.com","trailfinders.com",
    "kuoni.co.uk","sta-travel.co.uk","exodus.co.uk",
    # Expat
    "expatforum.com","expatica.com","internations.org",
    "expatnetwork.com","britishexpats.com","expatinfodesk.com",
    "thelocal.com","propertyguides.com","rightmove.co.uk",
    "zoopla.co.uk","onthemarket.com",
]:
    prospects.append((d, "GB", "en"))

# 🇸🇬 SINGAPORE
for d in [
    "straitstimes.com","channelnewsasia.com","todayonline.com",
    "businesstimes.com.sg","mothership.sg","asiaone.com",
    "visitsingapore.com","timeout.com","expatliving.sg",
    "internations.org","honeycombers.com","thesmartlocal.com",
]:
    prospects.append((d, "SG", "en"))

# 🇭🇰 HONG KONG
for d in [
    "scmp.com","hongkongfp.com","thestandard.com.hk",
    "timeout.com","sassy-hk.com","discoverhongkong.com",
    "expatliving.hk","internations.org","geoexpat.com",
]:
    prospects.append((d, "HK", "en"))

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
