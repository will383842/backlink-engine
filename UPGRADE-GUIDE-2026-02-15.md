# 🚀 Backlink Engine - Upgrade Guide (2026-02-15)

## ✅ Améliorations Implémentées

### 1. ✅ Support de 195 Pays avec Timezones

**Fichier créé :** `src/data/countries.ts`

- 195 pays du monde avec codes ISO 3166-1 alpha-2
- Timezones IANA complètes (ex: `Europe/Paris`, `America/New_York`)
- UTC offsets pour chaque pays
- Noms en français et anglais
- Drapeaux emoji, codes téléphoniques, régions
- Helpers : `getCountryByCode()`, `getTimezoneForCountry()`, `getUtcOffsetForCountry()`

**Usage :**
```typescript
import { getTimezoneForCountry } from './data/countries.js';

const timezone = getTimezoneForCountry('FR'); // → "Europe/Paris"
```

---

### 2. ✅ Séparation firstName / lastName

**Modèle Contact mis à jour :**
- `firstName` : Prénom (ex: "Jean")
- `lastName` : Nom de famille (ex: "Dupont")
- `name` : **DEPRECATED** (conservé pour rétro-compatibilité)

**Migration automatique :**
- Le champ `name` existant est automatiquement splitté en `firstName` + `lastName`
- Exemple : `"Jean Dupont"` → `firstName: "Jean"`, `lastName: "Dupont"`

**API :**
```json
{
  "url": "https://example.fr",
  "email": "jean@example.fr",
  "firstName": "Jean",
  "lastName": "Dupont"
}
```

---

### 3. ✅ Auto-détection Timezone

**Enrichment Worker mis à jour :**
- Détection automatique du timezone basée sur le pays
- Synchronisation timezone ↔ country
- Logs enrichis avec timezone détecté

**Exemple :**
- Prospect avec `country: "FR"` → `timezone: "Europe/Paris"`
- Prospect avec `country: "US"` → `timezone: "America/New_York"`
- Utilisé pour : envoi d'emails à 9h heure locale, scheduling intelligent

---

### 4. ✅ Validation Email Avancée

**Service créé :** `src/services/email/emailValidator.ts`

**Validations implémentées :**
1. ✅ **Syntaxe** : Validation RFC 5322
2. ✅ **MX Records** : Vérification DNS pour délivrabilité
3. ✅ **Disposable** : Détection de 100+ services d'emails temporaires (10minutemail.com, guerrillamail.com, etc.)
4. ✅ **Role-based** : Détection emails génériques (info@, contact@, support@, etc.)
5. ✅ **Free Provider** : Détection fournisseurs gratuits (gmail.com, yahoo.com, etc.) → marqués "risky" pour outreach B2B

**Statuts EmailStatus :**
- `verified` : Email valide et livrable ✅
- `invalid` : Email invalide (syntaxe incorrecte, pas de MX) ❌
- `risky` : Suspect (free provider, catch-all) ⚠️
- `disposable` : Email temporaire (à bloquer) 🚫
- `role` : Email générique (basse priorité) 📧
- `unverified` : Pas encore validé

**Intégration automatique :**
- Validation lors de l'ajout de prospect (via `ingestService`)
- Events `EMAIL_VALIDATION_WARNING` pour emails problématiques
- Logs détaillés avec raison de validation

**IMPORTANT :** Pas de vérification SMTP (évite blacklisting). Pour production, utiliser service tiers (ZeroBounce, NeverBounce).

---

## 📋 Migration à Exécuter

### Option 1 : Migration SQL Manuelle

```bash
cd backlink-engine
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_timezone_firstname_lastname/migration.sql
```

### Option 2 : Migration via Prisma

```bash
cd backlink-engine
npx prisma migrate deploy
```

### Vérification

```sql
-- Vérifier les nouvelles colonnes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('prospects', 'contacts')
  AND column_name IN ('timezone', 'firstName', 'lastName');

-- Vérifier l'enum EmailStatus
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmailStatus');
```

---

## 🔄 Changements dans le Code

### Schema Prisma (`prisma/schema.prisma`)

```prisma
enum EmailStatus {
  unverified
  verified
  invalid
  risky        // NOUVEAU
  disposable   // NOUVEAU
  role         // NOUVEAU
}

model Prospect {
  // ... champs existants
  country   String?  @db.VarChar(2)
  timezone  String?  @db.VarChar(50) // NOUVEAU
  // ...
}

model Contact {
  // ... champs existants
  firstName   String?  // NOUVEAU
  lastName    String?  // NOUVEAU
  name        String?  // DEPRECATED (gardé pour compatibilité)
  // ...
}
```

### Enrichment Worker (`src/jobs/workers/enrichmentWorker.ts`)

```typescript
import { getTimezoneForCountry } from "../../data/countries.js";

// Dans enrichSingleProspect():
const detectedCountry = detectCountryFromDomain(domain);
const detectedTimezone = getTimezoneForCountry(detectedCountry);

updateData["country"] = detectedCountry;
updateData["timezone"] = detectedTimezone;
```

### Ingest Service (`src/services/ingestion/ingestService.ts`)

```typescript
import { validateEmail } from "../email/emailValidator.js";

export interface IngestInput {
  // ...
  firstName?: string;
  lastName?: string;
  name?: string; // DEPRECATED
  // ...
}

// Validation email automatique
const validation = await validateEmail(emailNormalized);
await tx.contact.create({
  data: {
    firstName,
    lastName,
    emailStatus: validation.status,
    // ...
  },
});
```

### API Routes (`src/api/routes/prospects.ts`)

```typescript
interface CreateProspectBody {
  firstName?: string;  // NOUVEAU
  lastName?: string;   // NOUVEAU
  name?: string;       // DEPRECATED
  // ...
}
```

---

## 📊 Impact sur MailWizz

### Champs Custom MailWizz Recommandés

```
FNAME           → Contact.firstName
LNAME           → Contact.lastName
BLOG_NAME       → Prospect.domain
BLOG_URL        → SourceUrl.url
COUNTRY         → Prospect.country (ISO alpha-2)
LANGUAGE        → Prospect.language
TIMEZONE        → Prospect.timezone (IANA)
EMAIL_STATUS    → Contact.emailStatus
TIER            → Prospect.tier
SCORE           → Prospect.score
```

### Smart Scheduling avec Timezone

Utiliser `timezone` pour envoyer les emails à **9h heure locale** :

```typescript
// Exemple : Calculer l'heure d'envoi optimale
const localHour = 9; // 9h du matin
const recipientTimezone = prospect.timezone; // "Europe/Paris"

// Utiliser date-fns-tz pour calculer l'heure d'envoi
import { zonedTimeToUtc } from 'date-fns-tz';
const sendAt = zonedTimeToUtc(
  new Date().setHours(localHour, 0, 0, 0),
  recipientTimezone
);
```

---

## ✅ Checklist de Déploiement

- [ ] Exécuter migration SQL (voir ci-dessus)
- [ ] Vérifier les colonnes créées dans PostgreSQL
- [ ] Redémarrer les workers BullMQ :
  ```bash
  docker compose restart worker-enrichment
  ```
- [ ] Tester l'ajout d'un nouveau prospect avec firstName/lastName
- [ ] Vérifier que le timezone est bien auto-détecté lors de l'enrichment
- [ ] Vérifier qu'un email disposable est marqué `disposable`
- [ ] Vérifier qu'un email role (info@) est marqué `role`
- [ ] Vérifier qu'un email gmail est marqué `risky` (free provider)

---

## 🧪 Tests Recommandés

### Test 1 : Validation Email

```bash
# Ajouter prospect avec email disposable
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "email": "test@10minutemail.com",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Vérifier que emailStatus = "disposable"
psql -U backlink -d backlink_engine -c "SELECT email, \"emailStatus\" FROM contacts WHERE email LIKE '%10minutemail%';"
```

### Test 2 : Auto-détection Timezone

```bash
# Ajouter prospect français
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.fr",
    "email": "contact@example.fr",
    "firstName": "Jean",
    "lastName": "Dupont"
  }'

# Attendre enrichment (~30 secondes)
# Vérifier que country="FR" et timezone="Europe/Paris"
psql -U backlink -d backlink_engine -c "SELECT domain, country, timezone FROM prospects WHERE domain = 'example.fr';"
```

### Test 3 : firstName/lastName

```bash
# Ajouter avec name complet (legacy)
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://test.com",
    "email": "test@test.com",
    "name": "Marie Curie"
  }'

# Vérifier que firstName="Marie", lastName="Curie"
psql -U backlink -d backlink_engine -c "SELECT \"firstName\", \"lastName\", name FROM contacts WHERE email = 'test@test.com';"
```

---

## 📈 Prochaines Améliorations (Priority 2)

### MailWizz Webhooks Complets

1. **email.open** → Incrémenter engagement score
2. **email.click** → Incrémenter engagement score
3. **email.bounce.hard** → Marquer invalid, arrêter enrollment
4. **email.bounce.soft** → Retry plus tard
5. **email.unsubscribe** → Set optedOut, ajouter à suppression list
6. **email.complaint** → Blacklist

### Enrichissement Contact

- `company` : Nom de l'entreprise
- `jobTitle` : Poste/rôle
- `companySize` : Taille entreprise
- `industry` : Secteur d'activité

### Engagement Tracking

- `lastOpenedAt` : Dernière ouverture email
- `lastClickedAt` : Dernier clic
- `totalOpens` : Nombre d'ouvertures
- `totalClicks` : Nombre de clics

---

## 🎯 Avantages Opérationnels

### 1. Timezone Smart Scheduling
- Envoi emails à 9h heure locale (meilleur taux d'ouverture)
- Respect des fuseaux horaires (pas d'email à 3h du matin)

### 2. Email Validation
- ✅ Économie coûts MailWizz (pas d'envoi vers emails invalides)
- ✅ Protection réputation (évite bounces)
- ✅ Meilleure délivrabilité (bounce rate < 2%)

### 3. Personnalisation
- Prénom/nom séparés → templates MailWizz : `Bonjour [FNAME],`
- Meilleur taux de réponse (personnalisation accrue)

### 4. Segmentation MailWizz
- Listes par pays : `country = "FR"` → Liste France
- Listes par langue : `language = "fr"` → Campagne française
- Listes par tier : `tier = 1` → Prospects premium
- Listes par timezone : `timezone LIKE "Europe/%"` → Zone Europe

---

## 📞 Support

En cas de problème :
1. Vérifier logs Docker : `docker compose logs worker-enrichment`
2. Vérifier migrations : `npx prisma migrate status`
3. Tester validation email : `node -e "import('./src/services/email/emailValidator.js').then(m => m.validateEmail('test@example.com').then(console.log))"`

---

**Date de déploiement :** 2026-02-15
**Version :** Backlink Engine v2.1.0
**Status :** ✅ Prêt pour déploiement
