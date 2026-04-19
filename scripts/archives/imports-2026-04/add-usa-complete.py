#!/usr/bin/env python3
"""USA COMPLETE — everything missing: state press, TV, radio, niche blogs, influencers."""
import subprocess

prospects = []

# ═══════════════════════════════════════════════════════════
# US STATE & CITY NEWSPAPERS (Top 100 by circulation)
# ═══════════════════════════════════════════════════════════
for d in [
    # Already have the top nationals, adding more city papers
    "star-telegram.com","mercurynews.com","ocregister.com","pe.com",
    "eastbaytimes.com","sun-sentinel.com","palmbeachpost.com","jacksonville.com",
    "heraldtribune.com","tcpalm.com","tallahassee.com","pensacolanewsjournal.com",
    "naplesnews.com","sarasotamagazine.com","bocaraton.com",
    "washingtontimes.com","washingtonian.com","dcist.com","patch.com",
    "providencejournal.com","courant.com","journalinquirer.com",
    "pressconnects.com","democratandchronicle.com","rochesterfirst.com",
    "buffalonews.com","syracuse.com","timesunion.com","silive.com",
    "nj.com","app.com","northjersey.com","cherryhill.com",
    "delawareonline.com","phillymag.com","post-gazette.com",
    "triblive.com","mcall.com","readingeagle.com","lancasteronline.com",
    "richmond.com","pilotonline.com","roanoke.com","dailypress.com",
    "charlottesville.com","fredericksburg.com","wvgazettemail.com",
    "citizen-times.com","greenvilleonline.com","postandcourier.com",
    "thestate.com","augustachronicle.com","ledger-enquirer.com",
    "birminghamal.com","al.com","clarionledger.com","commercialappeal.com",
    "knoxnews.com","tennessean.com","courier-journal.com","kentucky.com",
    "herald-leader.com","dispatch.com","cleveland.com","beaconjournal.com",
    "jsonline.com","madison.com","twincities.com","startribune.com",
    "desmoinesregister.com","press-citizen.com","omaha.com",
    "kansascity.com","stltoday.com","columbiamissourian.com",
    "tulsaworld.com","oklahoman.com","arkansasonline.com",
    "shreveporttimes.com","theadvocate.com","nola.com",
    "statesman.com","expressnews.com","caller.com","elpasotimes.com",
    "lcsun-news.com","abqjournal.com","santafenewmexican.com",
    "coloradoan.com","gazette.com","durangoherald.com",
    "sltrib.com","deseret.com","idahostatesman.com","spokesman.com",
    "oregonlive.com","statesmanjournal.com","registerguard.com",
    "seattletimes.com","thenewstribune.com","bellinghamherald.com",
    "anchoragedailynews.com","staradvertiser.com","civilbeat.org",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US TV NETWORKS & LOCAL TV STATIONS (websites)
# ═══════════════════════════════════════════════════════════
for d in [
    "cnn.com","foxnews.com","msnbc.com","cbsnews.com","abcnews.go.com",
    "nbcnews.com","pbs.org","npr.org","apnews.com","reuters.com",
    "c-span.org","newsmax.com","thehill.com","politico.com",
    "axios.com","thedailybeast.com","vox.com","vice.com",
    "buzzfeednews.com","theintercept.com","propublica.org",
    "motherjones.com","reason.com","nationalreview.com",
    "theatlantic.com","newyorker.com","vanityfair.com","rollingstone.com",
    "slate.com","salon.com","thedailywire.com","oann.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US LIFESTYLE / WOMEN / MEN MAGAZINES
# ═══════════════════════════════════════════════════════════
for d in [
    "cosmopolitan.com","elle.com","vogue.com","harpersbazaar.com",
    "instyle.com","glamour.com","allure.com","refinery29.com",
    "bustle.com","byrdie.com","popsugar.com","purewow.com",
    "wellandgood.com","mindbodygreen.com","self.com","shape.com",
    "womenshealthmag.com","menshealth.com","gq.com","esquire.com",
    "mensjournal.com","maxim.com","complex.com","highsnobiety.com",
    "hypebeast.com","dazeddigital.com","i-d.vice.com",
    "architecturaldigest.com","dwell.com","housebeautiful.com",
    "elledecor.com","marthastewart.com","realsimple.com",
    "goodhousekeeping.com","bhg.com","sunset.com","southernliving.com",
    "foodandwine.com","bonappetit.com","epicurious.com","seriouseats.com",
    "thekitchn.com","delish.com","tastingtable.com","eater.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US OUTDOOR / ADVENTURE / NATURE
# ═══════════════════════════════════════════════════════════
for d in [
    "outsideonline.com","backpacker.com","rei.com","adventure.com",
    "adventurejournal.com","gearjunkie.com","sierraclub.org",
    "nps.gov","recreation.gov","alltrails.com","hikingproject.com",
    "mountain-forecast.com","onxmaps.com","calypsofun.com",
    "fieldandstream.com","sportsmansguide.com","cabelas.com",
    "patagonia.com","thenorthface.com","arcteryx.com",
    "surfline.com","surfer.com","snowboardermag.com","powder.com",
    "climbingmagazine.com","trailrunnermag.com","runnersworld.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US IMMIGRATION LAW / VISA BLOGS
# ═══════════════════════════════════════════════════════════
for d in [
    "visajourney.com","trackitt.com","immihelp.com","murthy.com",
    "nolo.com","boundless.com","citizenpath.com","fileright.com",
    "rapidvisa.com","simplecitizen.com","stilt.com","remitly.com",
    "wise.com","xoom.com","worldremit.com","ofx.com",
    "xe.com","oanda.com","currencycloud.com","payoneer.com",
    "immigrationdirect.com","myattorney.com","alllaw.com",
    "findlaw.com","justia.com","avvo.com","martindale.com",
    "lawyers.com","lawinfo.com","superlawyers.com",
    "h1bdata.info","myvisajobs.com","h1bgrader.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US EDUCATION / UNIVERSITY BLOGS & MEDIA
# ═══════════════════════════════════════════════════════════
for d in [
    "edx.org","coursera.org","khanacademy.org","udemy.com",
    "skillshare.com","masterclass.com","linkedin.com",
    "usnews.com","niche.com","collegeconfidential.com",
    "princetonreview.com","cappex.com","collegevine.com",
    "unigo.com","petersons.com","fastweb.com","scholarships.com",
    "goabroad.com","gooverseas.com","abroadreviews.com",
    "abroad101.com","studyabroadassociation.org","nafsa.org",
    "iesabroad.org","studiesabroad.com","apiabroad.com",
    "cet-academic.com","sit.edu","arcadia.edu","usac.edu",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US PERSONAL FINANCE / EXPAT TAX
# ═══════════════════════════════════════════════════════════
for d in [
    "nerdwallet.com","bankrate.com","creditkarma.com","mint.com",
    "personalcapital.com","betterment.com","wealthfront.com",
    "vanguard.com","fidelity.com","schwab.com","tdameritrade.com",
    "investopedia.com","thebalancemoney.com","fool.com","kiplinger.com",
    "marketwatch.com","seekingalpha.com","gurufocus.com",
    "greenbacktaxservices.com","brighttax.com","onlinetaxman.com",
    "taxesforexpats.com","ustaxhelp.com","expatriatelaw.com",
    "protaxconsulting.com","htj.tax","americansabroad.org",
    "democracyabroad.org","votefromabroad.org","fbar.us",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US HEALTH / INSURANCE / EXPAT INSURANCE
# ═══════════════════════════════════════════════════════════
for d in [
    "cigna.com","aetna.com","unitedhealthcare.com","bluecross.com",
    "humana.com","kaiser.com","anthem.com","centene.com",
    "internationalinsurance.com","pacificprime.com","now-health.com",
    "allianzcare.com","bfrancaisinsurance.com","imglobal.com",
    "geobluetravelinsurance.com","worldnomads.com","safetywing.com",
    "travelguard.com","allianzassistance.com","generali.com",
    "webmd.com","healthline.com","mayoclinic.org","clevelandclinic.org",
    "hopkinsmedicine.org","medlineplus.gov","cdc.gov","who.int",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US MOVING / RELOCATION COMPANIES
# ═══════════════════════════════════════════════════════════
for d in [
    "internationalmovers.com","movehub.com","sirva.com","cartus.com",
    "crownrelo.com","santaferelo.com","allied.com","unitedvanlines.com",
    "atlasvanlines.com","northamerican.com","mayflower.com",
    "pods.com","uhaul.com","penske.com","budgettruck.com",
    "collegeboxes.com","movingapt.com","moving.com","updater.com",
    "yelp.com","angieslist.com","homeadvisor.com","thumbtack.com",
]:
    prospects.append((d, "US"))

# ═══════════════════════════════════════════════════════════
# US EXPAT COMMUNITIES / FORUMS
# ═══════════════════════════════════════════════════════════
for d in [
    "expatforum.com","reddit.com","quora.com","facebook.com",
    "meetup.com","couchsurfing.com","workaway.info","helpx.net",
    "worldpackers.com","trustedhousesitters.com","mindmyhouse.com",
    "housecarers.com","nomador.com","homeexchange.com",
    "intervac-homeexchange.com","lovehomeswap.com","thirdhome.com",
    "sabbaticalguide.com","flexjobs.com","remote.co",
    "weworkremotely.com","angel.co","glassdoor.com","indeed.com",
    "linkedin.com","ziprecruiter.com","monster.com","careerbuilder.com",
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
