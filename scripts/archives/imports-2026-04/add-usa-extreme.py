#!/usr/bin/env python3
"""USA EXTREME COMPLETE — every single media, blog, influencer, niche site."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# US LOCAL TV STATIONS (ABC/NBC/CBS/FOX affiliates by city)
# ═══════════════════════════════════════════════════════════
for d in [
    # New York
    "abc7ny.com","nbcnewyork.com","cbsnewyork.com","fox5ny.com","pix11.com",
    # Los Angeles
    "abc7.com","nbclosangeles.com","cbsla.com","foxla.com","ktla.com",
    # Chicago
    "abc7chicago.com","nbcchicago.com","cbschicago.com","fox32chicago.com","wgntv.com",
    # Philadelphia
    "6abc.com","nbcphiladelphia.com","cbsphiladelphia.com","fox29.com",
    # Dallas
    "wfaa.com","nbcdfw.com","cbsdfw.com","fox4news.com",
    # San Francisco
    "abc7news.com","nbcbayarea.com","kpix.com","ktvu.com","kron4.com",
    # Houston
    "abc13.com","click2houston.com","khou.com","fox26houston.com",
    # Washington DC
    "wjla.com","nbcwashington.com","wusa9.com","fox5dc.com","wtop.com",
    # Boston
    "wcvb.com","nbcboston.com","cbsboston.com","boston25news.com",
    # Atlanta
    "wsbtv.com","11alive.com","cbsatlanta.com","fox5atlanta.com",
    # Miami
    "local10.com","nbcmiami.com","cbsmiami.com","wsvn.com",
    # Phoenix
    "abc15.com","12news.com","azfamily.com","fox10phoenix.com",
    # Seattle
    "king5.com","komonews.com","kiro7.com","q13fox.com",
    # Minneapolis
    "kstp.com","kare11.com","wcco.com","fox9.com",
    # Denver
    "thedenverchannel.com","9news.com","cbscolorado.com","fox31.com",
    # Orlando
    "wftv.com","clickorlando.com","wesh.com","fox35orlando.com",
    # San Diego
    "10news.com","nbcsandiego.com","cbs8.com","fox5sandiego.com",
    # Portland
    "katu.com","kgw.com","koin.com","kptv.com",
    # Las Vegas
    "ktnv.com","news3lv.com","8newsnow.com","fox5vegas.com",
    # Nashville
    "newschannel5.com","wkrn.com","wsmv.com","fox17.com",
    # Salt Lake City
    "abc4.com","kutv.com","fox13now.com",
    # Raleigh
    "abc11.com","wral.com","cbs17.com",
    # Austin
    "kvue.com","kxan.com","cbsaustin.com","fox7austin.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US RADIO STATIONS / PODCASTS (with websites)
# ═══════════════════════════════════════════════════════════
for d in [
    "npr.org","wnyc.org","kqed.org","wbur.org","whyy.org",
    "wgbh.org","kpbs.org","kuow.org","opb.org","wunc.org",
    "wamu.org","kcrw.com","wbez.org","stlpublicradio.org",
    "iheartradio.com","spotify.com","applepodcasts.com",
    "stitcher.com","podbean.com","buzzsprout.com","anchor.fm",
    "overcast.fm","pocketcasts.com","castbox.fm","podchaser.com",
    "listennotes.com","podcastaddict.com","podbay.fm",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US TECH / STARTUP MEDIA
# ═══════════════════════════════════════════════════════════
for d in [
    "techcrunch.com","theverge.com","wired.com","arstechnica.com",
    "engadget.com","gizmodo.com","mashable.com","recode.net",
    "venturebeat.com","thenextweb.com","protocol.com","semafor.com",
    "theinformation.com","crunchbase.com","pitchbook.com",
    "cbinsights.com","producthunt.com","hackernews.com",
    "dev.to","medium.com","substack.com","ghost.org",
    "vercel.com","netlify.com","cloudflare.com","digitalocean.com",
    "36kr.com","technode.com","techinasia.com","e27.co",
    "geekwire.com","siliconangle.com","zdnet.com","computerworld.com",
    "infoworld.com","pcmag.com","tomsguide.com","laptopmag.com",
    "howtogeek.com","makeuseof.com","lifehacker.com","wirecutter.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US FOOD / RESTAURANT / HOSPITALITY
# ═══════════════════════════════════════════════════════════
for d in [
    "eater.com","grubstreet.com","foodandwine.com","bonappetit.com",
    "epicurious.com","seriouseats.com","thekitchn.com","delish.com",
    "tastingtable.com","myfoodstory.com","cookstr.com",
    "allrecipes.com","foodnetwork.com","cookinglight.com",
    "chowhound.com","yelp.com","opentable.com","resy.com",
    "doordash.com","ubereats.com","grubhub.com","seamless.com",
    "zagat.com","michelin.com","jamesbeard.org","nraef.org",
    "restaurant.org","hospitalitynet.org","hotelnewsnow.com",
    "skift.com","phocuswire.com","travelweekly.com",
    "travelpulse.com","hotelmanagement.net","hotelieremag.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US REAL ESTATE / PROPERTY (major markets)
# ═══════════════════════════════════════════════════════════
for d in [
    "zillow.com","realtor.com","redfin.com","trulia.com",
    "apartments.com","rent.com","zumper.com","hotpads.com",
    "streeteasy.com","curbed.com","brownstoner.com","biggerpockets.com",
    "mashvisor.com","roofstock.com","fundrise.com","crowdstreet.com",
    "realtyshares.com","peerstreet.com","groundfloor.com",
    "compass.com","sothebysrealty.com","coldwellbanker.com",
    "kw.com","remax.com","century21.com","berkshirehathaway.com",
    "corcoran.com","elliman.com","halstead.com","stribling.com",
    "mansionglobal.com","luxuryportfolio.com","christiesrealestate.com",
    "jamesedition.com","luxuryestate.com","luxhabitat.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US LUXURY / HIGH NET WORTH
# ═══════════════════════════════════════════════════════════
for d in [
    "robbreport.com","bloomberg.com","barrons.com","worth.com",
    "wealthmanagement.com","fa-mag.com","investmentnews.com",
    "thinkadvisor.com","financial-planning.com","riaintel.com",
    "familywealthreport.com","wealthbriefing.com","citywealth.com",
    "hurun.net","spearswms.com","tatler.com","townandcountrymag.com",
    "departures.com","elitetraveler.com","therake.com","monocle.com",
    "privatejetcardcomparisons.com","executiveflyerclub.com",
    "boatinternational.com","yachtingmagazine.com","sailmagazine.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US WELLNESS / YOGA / MEDITATION / RETREATS
# ═══════════════════════════════════════════════════════════
for d in [
    "yogajournal.com","mindbodygreen.com","wellandgood.com",
    "gaia.com","headspace.com","calm.com","insighttimer.com",
    "tenpercent.com","yogaglo.com","wanderlust.com",
    "bookyogaretreats.com","bookretreats.com","retreatguru.com",
    "healingholidays.com","spafinder.com","zeel.com",
    "massageenvy.com","exhale.com","equinox.com","soulcycle.com",
    "barrysfitness.com","orangetheory.com","f45training.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US SUSTAINABILITY / ECO TRAVEL
# ═══════════════════════════════════════════════════════════
for d in [
    "responsibletravel.com","sustainabletravel.org","ecotourism.org",
    "greenmatters.com","treehugger.com","inhabitat.com",
    "grist.org","yaleclimateconnections.org","insideclimatenews.org",
    "carbonbrief.org","climaterealityproject.org","drawdown.org",
    "1percentfortheplanet.org","bfrancaiseco.com","ecotraveler.com",
    "greenpeace.org","wwf.org","nature.org","conservation.org",
    "worldwildlife.org","sierraclub.org","nrdc.org","edf.org",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US FAMILY / PARENTING / TRAVEL WITH KIDS
# ═══════════════════════════════════════════════════════════
for d in [
    "parents.com","whattoexpect.com","babycenter.com","motherly.com",
    "scarymommy.com","romper.com","fatherly.com","dadlabs.com",
    "familyvacationcritic.com","trekaroo.com","ytravelblog.com",
    "travelmamas.com","bfrancaisfamily.com","havebabywilltravel.com",
    "travelingmom.com","pitstopsforkids.com","globalmunchkins.com",
    "wanderluststorytellers.com","ourlittleadventures.com",
    "wildtalesof.com","bfrancaisfamilytravel.com","kidsworldtravel.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US SENIOR / RETIREMENT / 55+ TRAVEL
# ═══════════════════════════════════════════════════════════
for d in [
    "aarp.org","nextavenue.org","seniorliving.org","aplaceformom.com",
    "retiredbrains.com","theseniorlist.com","senior.com",
    "greatseniorliving.com","senioradvisor.com","caring.com",
    "agingcare.com","eldercare.com","seniorplanet.org",
    "roadscholar.org","oattravel.com","grandcircletravel.com",
    "gate1travel.com","globusfamily.com","collette.com",
    "travelerscenturyclub.org","vagabondtours.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US LGBTQ+ TRAVEL
# ═══════════════════════════════════════════════════════════
for d in [
    "gaytimes.co.uk","them.us","advocate.com","out.com",
    "queerty.com","lgbtqnation.com","damfrancaislgbt.com",
    "coupleofmen.com","twobadtourists.com","gaytravelblogs.com",
    "outadventures.com","iglta.org","gaytravel.com",
    "nomaddicgayblog.com","tfrancaislgbt.com","purpleroads.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US DISABILITY / ACCESSIBLE TRAVEL
# ═══════════════════════════════════════════════════════════
for d in [
    "wheelchairtraveling.com","accessibletravel.online","curbfreewithcorylee.com",
    "newmobility.com","abilitymag.com","disabilityafterdark.com",
    "spintheglobe.net","handfrancaisaccessible.com","accesstravel.com",
    "tfrancaisaccessible.com","tauck.com","accessiblejapan.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US PET TRAVEL
# ═══════════════════════════════════════════════════════════
for d in [
    "bringfido.com","gopetfriendly.com","dogfriendly.com",
    "pettravel.com","tfrancaispet.com","dogtipper.com",
    "myitchytravelfeet.com","petrelocation.com","ipata.org",
    "akc.org","catfriendly.com","cattravel.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US CRUISE / MARITIME
# ═══════════════════════════════════════════════════════════
for d in [
    "cruisecritic.com","cruiseline.com","cruise.com","vacationstogo.com",
    "royalcaribbean.com","carnival.com","ncl.com","princess.com",
    "hollandamerica.com","celebrity-cruises.com","vikingcruises.com",
    "oceania-cruises.com","regent-seven-seas.com","silversea.com",
    "seabourn.com","cunard.com","msc-cruises.com","windstarcruises.com",
    "hurtigruten.com","expeditions.com","ponant.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US AIRLINE / AVIATION / MILES & POINTS
# ═══════════════════════════════════════════════════════════
for d in [
    "thepointsguy.com","onemileatatime.com","viewfromthewing.com",
    "travelisfree.com","upgradedpoints.com","frequentmiler.com",
    "milestomemories.com","dansdeals.com","godsavethepoints.com",
    "flyertalk.com","milevalue.com","awardwallet.com",
    "nerdwallet.com","creditcards.com","wallethub.com",
    "united.com","aa.com","delta.com","southwest.com",
    "jetblue.com","alaskaair.com","spirit.com","frontier.com",
    "hawaiianair.com","seatguru.com","flightstats.com",
    "flightaware.com","googleflights.com","secretflying.com",
    "scottsfrancaisflights.com","thefrequentflyer.com.au",
]:
    prospects.append((d, "US"))

# Deduplicate
seen = set()
unique = []
for domain, country in prospects:
    d = domain.replace(" ", "")
    if d not in seen:
        seen.add(d)
        unique.append((d, country))

print(f"Total unique USA prospects to add: {len(unique)}")

values = []
for domain, country in unique:
    values.append(f"('{domain}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", 'en', '{country}', NOW(), NOW())")

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
    "SELECT count(*) as usa_total FROM prospects WHERE country = 'US';",
    "SELECT language, count(*) as nb FROM prospects GROUP BY language ORDER BY nb DESC;",
    "SELECT status, count(*) FROM prospects GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
