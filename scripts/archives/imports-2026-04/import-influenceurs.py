#!/usr/bin/env python3
"""Import press_contacts and influenceurs from influenceurs-tracker into backlink-engine.
Categories: press = 'media', influenceurs = 'influencer'."""
import subprocess, csv, io

BL_CMD = ["docker", "exec", "-i", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine"]
INF_CMD_BASE = ["docker", "exec", "inf-postgres", "psql"]

def get_inf_creds():
    r = subprocess.run(["docker", "exec", "inf-app", "env"], capture_output=True, text=True)
    creds = {}
    for line in r.stdout.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            creds[k] = v
    return creds

def run_bl_sql(sql):
    result = subprocess.run(BL_CMD, input=sql, capture_output=True, text=True)
    return result.stdout.strip()

def export_csv(inf_cmd, query):
    result = subprocess.run(inf_cmd + ["--csv", "-c", query], capture_output=True, text=True)
    return result.stdout

COUNTRY_MAP = {
    "France":"FR","FR":"FR","US":"US","États-Unis":"US","USA":"US",
    "GB":"GB","UK":"GB","Royaume-Uni":"GB","CH":"CH","Suisse":"CH",
    "BE":"BE","Belgique":"BE","DE":"DE","Allemagne":"DE",
    "ES":"ES","Espagne":"ES","IT":"IT","Italie":"IT",
    "NL":"NL","Pays-Bas":"NL","PT":"PT","Portugal":"PT",
    "CA":"CA","Canada":"CA","AU":"AU","Australie":"AU",
    "INTL":"FR","International":"FR",
    "EE":"EE","LT":"LT","LV":"LV","NO":"NO","SE":"SE",
    "DK":"DK","FI":"FI","PL":"PL","CZ":"CZ","HU":"HU",
    "Serbie":"RS","Roumanie":"RO","Autriche":"AT","Croatia":"HR",
    "Cyprus":"CY","Biélorussie":"BY","Seychelles":"SC",
    "Maroc":"MA","Tunisie":"TN","Sénégal":"SN","Algérie":"DZ",
    "Liban":"LB","Turquie":"TR","Japon":"JP","Chine":"CN",
    "Corée du Sud":"KR","Thaïlande":"TH","Inde":"IN",
    "Brésil":"BR","Mexique":"MX","Argentine":"AR","Colombie":"CO",
    "Émirats arabes unis":"AE","Israël":"IL","Russie":"RU",
    "Madagascar":"MG","Côte d'Ivoire":"CI","Cameroun":"CM",
}

def cc(c):
    if not c: return "FR"
    if len(c) == 2: return c.upper()
    return COUNTRY_MAP.get(c, "FR")

def lang(l, country):
    if l and len(l) <= 5: return l
    c = cc(country)
    m = {"FR":"fr","US":"en","GB":"en","DE":"de","ES":"es","IT":"it",
         "NL":"nl","PT":"pt","BR":"pt","CA":"en","AU":"en","CH":"fr",
         "BE":"fr","SE":"sv","NO":"no","DK":"da","FI":"fi","PL":"pl",
         "RS":"fr","RO":"ro","AT":"de","HR":"en","CY":"en","BY":"ru"}
    return m.get(c, "en")

def domain_from_email(email):
    if not email or "@" not in email: return None
    return email.split("@")[1].lower().strip()

def safe(s):
    if not s: return ""
    return s.replace("'", "''").replace("\\", "")[:200]

# ═══ GET CREDENTIALS ═══
creds = get_inf_creds()
inf_cmd = ["docker", "exec", "inf-postgres", "psql", "-U", creds.get("DB_USERNAME","inf_user"), "-d", creds.get("DB_DATABASE","mission_control")]

# ═══ 1. EXPORT & IMPORT PRESSE ═══
print("=== 1. PRESSE (press_contacts) ===")
csv_data = export_csv(inf_cmd, "SELECT full_name, email, publication, role, country, language FROM press_contacts WHERE email IS NOT NULL AND email != '' AND email LIKE '%@%'")
reader = csv.DictReader(io.StringIO(csv_data))

press_domains = {}
press_contacts = []
for row in reader:
    email = (row.get("email") or "").strip().lower()
    if not email or "@" not in email: continue
    dom = domain_from_email(email)
    if not dom: continue
    c = cc(row.get("country",""))
    l = lang(row.get("language"), row.get("country"))
    name = safe(row.get("full_name",""))
    pub = safe(row.get("publication",""))

    if dom not in press_domains:
        press_domains[dom] = {"country": c, "lang": l, "pub": pub}
    press_contacts.append({"email": email, "name": name, "domain": dom})

print(f"  Unique press domains: {len(press_domains)}")
print(f"  Press emails: {len(press_contacts)}")

# Insert press prospects (category = media)
vals = []
for dom, info in press_domains.items():
    vals.append(f"('{safe(dom)}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", '{info['lang']}', '{info['country']}', 'media'::\"ProspectCategory\", NOW(), NOW())")

total_press_inserted = 0
for i in range(0, len(vals), 100):
    batch = vals[i:i+100]
    sql = 'INSERT INTO prospects (domain, source, status, language, country, category, "createdAt", "updatedAt") VALUES\n' + ",\n".join(batch) + "\nON CONFLICT (domain) DO NOTHING;"
    r = run_bl_sql(sql)
    try:
        total_press_inserted += int(r.replace("INSERT 0 ", ""))
    except: pass

print(f"  Press prospects inserted: {total_press_inserted}")

# ═══ 2. EXPORT & IMPORT INFLUENCEURS ═══
print("\n=== 2. INFLUENCEURS ===")
csv_data = export_csv(inf_cmd, "SELECT name, email, primary_platform, niche, country, language FROM influenceurs WHERE email IS NOT NULL AND email != '' AND email LIKE '%@%'")
reader = csv.DictReader(io.StringIO(csv_data))

inf_domains = {}
inf_contacts = []
for row in reader:
    email = (row.get("email") or "").strip().lower()
    if not email or "@" not in email: continue
    dom = domain_from_email(email)
    if not dom: continue
    c = cc(row.get("country",""))
    l = lang(row.get("language"), row.get("country"))
    name = safe(row.get("name",""))

    if dom not in inf_domains:
        inf_domains[dom] = {"country": c, "lang": l}
    inf_contacts.append({"email": email, "name": name, "domain": dom})

print(f"  Unique influencer domains: {len(inf_domains)}")
print(f"  Influencer emails: {len(inf_contacts)}")

# Insert influencer prospects (category = influencer)
vals = []
for dom, info in inf_domains.items():
    vals.append(f"('{safe(dom)}', 'manual'::\"ProspectSource\", 'NEW'::\"ProspectStatus\", '{info['lang']}', '{info['country']}', 'influencer'::\"ProspectCategory\", NOW(), NOW())")

total_inf_inserted = 0
for i in range(0, len(vals), 100):
    batch = vals[i:i+100]
    sql = 'INSERT INTO prospects (domain, source, status, language, country, category, "createdAt", "updatedAt") VALUES\n' + ",\n".join(batch) + "\nON CONFLICT (domain) DO NOTHING;"
    r = run_bl_sql(sql)
    try:
        total_inf_inserted += int(r.replace("INSERT 0 ", ""))
    except: pass

print(f"  Influencer prospects inserted: {total_inf_inserted}")

# ═══ 3. CREATE CONTACTS (emails linked to prospects) ═══
print("\n=== 3. Creating contacts ===")
all_contacts = [(c, "press") for c in press_contacts] + [(c, "influencer") for c in inf_contacts]
created = 0
skipped = 0

for contact, role in all_contacts:
    email = safe(contact["email"])
    email_norm = email.strip().lower()
    name = safe(contact["name"])
    dom = safe(contact["domain"])

    # Split name into first/last
    parts = name.split(" ", 1) if name else ["", ""]
    first = safe(parts[0]) if parts else ""
    last = safe(parts[1]) if len(parts) > 1 else ""

    sql = f"""INSERT INTO contacts ("prospectId", email, "emailNormalized", "firstName", "lastName", role, "emailStatus", "discoveredVia", "createdAt")
SELECT p.id, '{email}', '{email_norm}', '{first}', '{last}', '{role}', 'verified', 'influenceurs_import', NOW()
FROM prospects p WHERE p.domain = '{dom}' LIMIT 1
ON CONFLICT ("emailNormalized") DO NOTHING;"""

    r = run_bl_sql(sql)
    if "INSERT 0 1" in r:
        created += 1
    else:
        skipped += 1

    if (created + skipped) % 500 == 0:
        print(f"  Progress: {created} created, {skipped} skipped...")

print(f"  Total created: {created}")
print(f"  Total skipped: {skipped}")

# ═══ 4. FINAL STATS ═══
print("\n=== FINAL STATS ===")
for q in [
    "SELECT count(*) as total_prospects FROM prospects;",
    "SELECT count(*) as total_contacts FROM contacts;",
    "SELECT category, count(*) FROM prospects WHERE category IS NOT NULL GROUP BY category ORDER BY count(*) DESC;",
    "SELECT language, count(*) as nb FROM prospects GROUP BY language ORDER BY nb DESC LIMIT 15;",
    "SELECT status, count(*) FROM prospects GROUP BY status ORDER BY count(*) DESC;",
]:
    r = subprocess.run(["docker", "exec", "bl-postgres", "psql", "-U", "backlink", "-d", "backlink_engine", "-c", q], capture_output=True, text=True)
    print(r.stdout.strip())
