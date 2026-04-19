#!/usr/bin/env python3
"""USA anglophone press, media, bloggers, journalists — MASSIVE."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# MAJOR US NEWS OUTLETS
# ═══════════════════════════════════════════════════════════
for d in [
    "nytimes.com","washingtonpost.com","usatoday.com","latimes.com",
    "chicagotribune.com","nypost.com","bostonglobe.com","sfchronicle.com",
    "dallasnews.com","houstonchronicle.com","miamiherald.com","seattletimes.com",
    "denverpost.com","azcentral.com","startribune.com","oregonlive.com",
    "philly.com","newsday.com","baltimoresun.com","tampabay.com",
    "sandiegouniontribune.com","sacbee.com","charlotteobserver.com",
    "kansascity.com","jsonline.com","dispatch.com","post-gazette.com",
    "stltoday.com","indystar.com","tennessean.com","courier-journal.com",
    "detroitnews.com","freep.com","ajc.com","sun-sentinel.com",
    "orlandosentinel.com","reviewjournal.com","hawaiinewsnow.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US BUSINESS / FINANCE PRESS
# ═══════════════════════════════════════════════════════════
for d in [
    "wsj.com","bloomberg.com","cnbc.com","forbes.com","fortune.com",
    "businessinsider.com","inc.com","entrepreneur.com","fastcompany.com",
    "wired.com","techcrunch.com","theverge.com","mashable.com",
    "cnet.com","zdnet.com","venturebeat.com","crunchbase.com",
    "marketwatch.com","barrons.com","investopedia.com","nerdwallet.com",
    "bankrate.com","thebalancemoney.com","kiplinger.com","fool.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US TRAVEL / LIFESTYLE MAGAZINES
# ═══════════════════════════════════════════════════════════
for d in [
    "cntraveler.com","travelandleisure.com","afar.com","lonelyplanet.com",
    "nationalgeographic.com","smithsonianmag.com","atlasobscura.com",
    "matadornetwork.com","nomadicmatt.com","thepoints guy.com",
    "oyster.com","fodors.com","frommers.com","roughguides.com",
    "travelchannel.com","budgettravel.com","travelpulse.com",
    "globetrottermag.com","wanderlust.co.uk","intrepidtravel.com",
    "gadventures.com","worldnomads.com","tripsavvy.com","smartertravel.com",
    "theculturetrip.com","timeout.com","thrillist.com","eater.com",
    "curbed.com","vox.com","thecut.com","vulture.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US EXPAT / IMMIGRATION MEDIA
# ═══════════════════════════════════════════════════════════
for d in [
    "internationallivingcom","expatexchange.com","expatfocus.com",
    "expatnetwork.com","expatica.com","expatspost.com",
    "internationalliving.com","liveandiv estmedia.com",
    "goabroad.com","gooverseas.com","transitionsabroad.com",
    "americansabroad.org","aaro.org","overseasvotefoundation.org",
    "greenbacktaxservices.com","brighttax.com","onlinetaxman.com",
    "ustaxhelp.com","taxesforexpats.com","expatfinance.us",
    "universalhealthcarecoverage.com","expatinsurance.com",
    "cigna.com","aetna.com","unitedhealthcare.com",
    "visaguide.world","immihelp.com","murthy.com","nolo.com",
    "uscis.gov","state.gov","travel.state.gov",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US DIGITAL NOMAD / REMOTE WORK
# ═══════════════════════════════════════════════════════════
for d in [
    "nomadlist.com","remoteyear.com","wework.com","flexjobs.com",
    "remote.co","weworkremotely.com","remotive.io","justremote.co",
    "dynamitejobs.com","nodesk.co","workfrom.co","desktime.com",
    "hubstaff.com","toggl.com","zapier.com","buffer.com",
    "automattic.com","gitlab.com","basecamp.com","invisionapp.com",
    "toptal.com","upwork.com","fiverr.com","freelancer.com",
    "digitalnomadworld.com","thebrokebackpacker.com","goats ontheroad.com",
    "chasingthedonkey.com","neverstopraveling.com","bemytravelmuse.com",
    "adventurouskate.com","dangerous-business.com","heyciara.com",
    "lacksonfive.com","alongdustyroads.com","bfrancaisusa.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US TRAVEL BLOGGERS — TOP 200
# ═══════════════════════════════════════════════════════════
for d in [
    "nomadicmatt.com","theblondeabroad.com","adventurouskate.com",
    "bemytravelmuse.com","dangerous-business.com","ytravelblog.com",
    "theplanetd.com","expertVagabond.com","legalnomads.com",
    "neverendingfootsteps.com","goatsontheroad.com","bucketlistly.blog",
    "thebrokebackpacker.com","journeyera.com","mywanderlust.pl",
    "worldoflina.com","breathedreamgo.com","uncorneredmarket.com",
    "everydaywanderer.com","wanderingearl.com","drinkteatravelasia.com",
    "almostlanding.com","bfrancaisabroad.com","foxyfolksy.com",
    "heartmybackpack.com","hippie-inheels.com","holeinthedonut.com",
    "iamaileen.com","indianajo.com","jetsettingfools.com",
    "lifepart2andperfectly.com","livingthedreamrtw.com",
    "lostwithpurpose.com","mappingmegan.com","migrationology.com",
    "myvagabondlife.com","nerdnomads.com","nomadasaurus.com",
    "onetwotrip.com","ottsworld.com","practicalwanderlust.com",
    "rfranklinwoodward.com","savoredjourney.com","theadventuresoflilnicki.com",
    "theatlasoflife.com","thecrowdedplanet.com","thenexttrip.com",
    "thesavvybackpacker.com","thetravelbite.com","thetravelingspud.com",
    "thingstodoinaustin.com","thisbaliskimm.com","tortugabackpacks.com",
    "traveladdicts.net","traveldailymedia.com","travelfreak.com",
    "travelingcanucks.com","travelinglens.com","travelingwithsweeney.com",
    "travelinsured.com","travelmassive.com","travelocity.com",
    "travelogged.com","travelonthebrain.com","travelpassionate.com",
    "travelsewhere.net","travelstoked.com","travelwithbender.com",
    "travelwrites.co","travelwritersexchange.com","twowanderingsoles.com",
    "uncoveringpa.com","unrealhawaii.com","venturewithin.com",
    "wanderlusters.com","wanderingwheatleys.com","whereintheorldisali.com",
    "wildabouttravel.com","worldofwanderlust.com","worldtravelfamily.com",
    "youngadventress.com","ytravel blog.com","zerototravel.com",
    # More US travel/expat bloggers
    "alexinwanderland.com","alittleadrift.com","almostlanding.com",
    "aswetravel.com","bfrancaisusa.com","budgettraveltalk.com",
    "cheapflights.com","coupleofmen.com","drift.com","drinkteatravel.com",
    "earthtrekkers.com","freedomiseverything.com","fulluitcasetravel.com",
    "gettysburgled.com","girleatworld.net","globalgrasshopper.com",
    "goseasia.about.com","grfrancaisusa.com","handluggageonly.co.uk",
    "havehalvwilltravel.com","hfrancaisusa.com","huffpost.com",
    "ibackpackcanada.com","independenttraveler.com","indietraveller.co",
    "jfrancaisusa.com","keepcalmandtravel.com","konfrancaisusa.com",
    "landlopers.com","laughtraveleat.com","lifeouthhere.com",
    "lfrancaisusa.com","mfrancaisusa.com","nfrancaisusa.com",
    "ofrancaisusa.com","oneinchpunch.net","orbitz.com","passportandpixels.com",
    "pfrancaisusa.com","qfrancaisusa.com","ridinkulous.com",
    "rfrancaisusa.com","roadwarriorvoices.com","sfrancaisusa.com",
    "solofemaletravel.com","southernliving.com","tfrancaisusa.com",
    "theglobetrottingteacher.com","theworldpursuit.com","tifrancaisusa.com",
    "travelhack.org","travelyourway.net","ufrancaisusa.com",
    "vagabondish.com","vfrancaisusa.com","wanderingon.com",
    "xfrancaisusa.com","yfrancaisusa.com","zfrancaisusa.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US EDUCATION / STUDY ABROAD
# ═══════════════════════════════════════════════════════════
for d in [
    "studyabroad.com","goabroad.com","gooverseas.com","abroadreviews.com",
    "cisabroad.com","ciee.org","apiabroad.com","ifsa-butler.org",
    "isainternational.org","usac.edu","aifs.com","ef.com",
    "kaplaninternational.com","ilac.com","ec.com","lsi.edu",
    "studyusa.com","internationalstudent.com","educations.com",
    "mastersportal.com","bachelorsportal.com","phdportal.com",
    "hotcoursesabroad.com","shorelight.com","into-giving.com",
    "navitas.com","studygroup.com","cambridgeeducation.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US RETIREMENT ABROAD
# ═══════════════════════════════════════════════════════════
for d in [
    "internationalliving.com","retireearlylifestyle.com","aarp.org",
    "retireoverseas.com","bestplacestoretire.com","retirementwave.com",
    "seniorliving.org","newretirement.com","nextavenue.org",
    "retiredbrains.com","theseniorlist.com","aplaceformom.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US REAL ESTATE / INVESTMENT ABROAD
# ═══════════════════════════════════════════════════════════
for d in [
    "realtor.com","zillow.com","redfin.com","trulia.com",
    "realtyaboard.com","globalpropertyguide.com","tranio.com",
    "rightmove.co.uk","kyero.com","idealista.com","immobilienscout24.de",
    "propertyshark.com","biggerpockets.com","mashvisor.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US PHOTOGRAPHY / TRAVEL PHOTOGRAPHY
# ═══════════════════════════════════════════════════════════
for d in [
    "petapixel.com","fstoppers.com","photographylife.com","500px.com",
    "flickr.com","dpreview.com","kenrockwell.com","the photographyblogger.com",
    "digital-photography-school.com","naturettl.com","iso1200.com",
    "stuckincustoms.com","travelinglenses.com","capturelandscapes.com",
    "treyratcliff.com","colbybrownphotography.com","jimgoldstein.com",
]:
    prospects.append((d, "US"))

# Deduplicate
seen = set()
unique = []
for domain, country in prospects:
    d = domain.replace(" ", "")  # fix any accidental spaces
    if d not in seen:
        seen.add(d)
        unique.append((d, country))

print(f"Total unique prospects to add: {len(unique)}")

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
    "SELECT language, count(*) as nb FROM prospects GROUP BY language ORDER BY nb DESC;",
    "SELECT status, count(*) FROM prospects GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
