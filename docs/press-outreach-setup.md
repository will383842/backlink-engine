# Press Outreach — Setup & Operations Guide

Module ajouté le 2026-04-22 (Vague 4.3 brand entity SEO).

## Quoi ça fait

- Envoie des pitches presse personnalisés en 9 langues à 130 journalistes ciblés
- Tracking automatique : SENT → RESPONDED → PUBLISHED
- Relances J+5 et J+10 automatiques (annulées si réponse détectée)
- Notifications Telegram temps réel via `@sosexpat_admin_bot`
- Le but business : obtenir 3-8 articles presse pour établir la
  notabilité Wikidata + l'autorité de marque

## Architecture

- **Queue** : `press-outreach` (BullMQ, 3 attempts max)
- **Worker** : `pressOutreachWorker.ts` (concurrency=3)
- **Service** : `services/press/sender.ts` (nodemailer SMTP vers 5 inboxes presse@*)
- **Service** : `services/press/pitchRenderer.ts` (charge les templates depuis
  `brand-entity-kit/presse/pitch-emails-9-langues.md`)
- **API** : `/api/press/*` (routes dans `api/routes/press.ts`)
- **Modèle** : `PressContact` (schema.prisma)

## Setup en 4 étapes

### Étape 1 — Migration Prisma

```bash
cd backlink-engine
npx prisma migrate dev --name add-press-contact
```

Ça crée la table `press_contacts` + les enums `PressContactStatus`,
`PressAngle`, `PressLang`.

### Étape 2 — Env vars SMTP

Ajoute dans `.env` de ton Backlink Engine VPS :

```bash
# Shared SMTP host (5 inboxes presse@* warmup infra)
PRESS_SMTP_HOST=mail.sos-expat.com
PRESS_SMTP_PORT=587
PRESS_SMTP_SECURE=false

# 9 inboxes by language (+ default) — mappe avec ta config Mailflow
# Si tu n'en as que 5, mappe 5 langues et utilise DEFAULT pour les autres
PRESS_INBOX_FR_USER=presse-fr@sos-expat.com
PRESS_INBOX_FR_PASS=xxx
PRESS_INBOX_EN_USER=presse-en@sos-expat.com
PRESS_INBOX_EN_PASS=xxx
PRESS_INBOX_ES_USER=presse-es@sos-expat.com
PRESS_INBOX_ES_PASS=xxx
PRESS_INBOX_DE_USER=presse-de@sos-expat.com
PRESS_INBOX_DE_PASS=xxx
PRESS_INBOX_DEFAULT_USER=presse@sos-expat.com
PRESS_INBOX_DEFAULT_PASS=xxx

# Where the PDF attachments are hosted
PRESS_PDF_BASE_URL=https://sos-expat.com

# Optional: path to the pitch templates file
# Default: ../brand-entity-kit/presse/pitch-emails-9-langues.md
PRESS_PITCH_TEMPLATES_PATH=/opt/backlink-engine/brand-entity-kit/presse/pitch-emails-9-langues.md

# Telegram chat where press reply notifications go
TELEGRAM_PRESS_CHAT_ID=7560535072
```

Puis redémarre l'app :

```bash
docker compose restart bl-app
```

### Étape 3 — Seed des 130 contacts

```bash
cd backlink-engine
npx tsx prisma/seed-press-contacts.ts
```

Sortie attendue :

```
Seeding 87 press contacts...
✓ Seed complete: 87 created, 0 updated.
```

(Note : le fichier de seed contient ~87 contacts prêts à l'emploi. Le
reste jusqu'à 130 peut être ajouté via l'API `/api/press/contacts/bulk`
ou modifié directement dans `seed-press-contacts.ts`.)

### Étape 4 — Vérifier les SMTP inboxes

```bash
curl -X POST https://backlink.sos-expat.com/api/press/verify-inboxes
```

Sortie attendue :

```json
{ "fr": true, "en": true, "es": true, ... }
```

Si un inbox échoue → vérifier credentials dans `.env`.

## Usage

### Lancer un premier batch dry-run

```bash
# Dry-run pour voir combien de contacts matchent
curl -X POST https://backlink.sos-expat.com/api/press/outreach/start \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "fr",
    "status": "PENDING",
    "limit": 10,
    "dryRun": true
  }'
```

Sortie :

```json
{
  "dryRun": true,
  "wouldEnqueue": 10,
  "sample": [
    {"id":"...", "media":"Le Monde Économie", "lang":"fr"},
    ...
  ]
}
```

### Lancer pour de vrai

```bash
curl -X POST https://backlink.sos-expat.com/api/press/outreach/start \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "fr",
    "status": "PENDING",
    "campaignTag": "2026-Q2-launch"
  }'
```

Sortie :

```json
{ "enqueued": 30, "totalMatched": 30 }
```

Les 30 emails sont enqueued avec un délai de 2-6s entre chaque pour ne
pas flagger comme spam. Les 9 workers traitent à concurrency=3 chacun,
donc ~27 emails/minute max. Les 30 emails FR sont tous envoyés en
~1-2 minutes.

Les relances J+5 et J+10 sont automatiquement enqueued par le worker.

### Lancer toutes les langues en rafale

```bash
for lang in fr en es de pt ru zh hi ar et; do
  curl -X POST https://backlink.sos-expat.com/api/press/outreach/start \
    -H "Content-Type: application/json" \
    -d "{\"lang\":\"$lang\",\"status\":\"PENDING\",\"campaignTag\":\"2026-Q2-launch\"}"
  sleep 30   # Pause entre langues pour étaler la charge
done
```

~130 emails envoyés sur ~15 minutes total.

### Suivre les stats

```bash
curl https://backlink.sos-expat.com/api/press/stats
```

```json
{
  "byStatus": { "PENDING": 0, "SENT": 127, "RESPONDED": 3, "PUBLISHED": 1 },
  "byLang":   { "fr": 30, "en": 15, "es": 10, ... },
  "byAngle":  { "launch": 45, "ymyl": 20, "expat": 35, ... },
  "totalArticles": 1
}
```

### Enregistrer un article publié (manuel ou via Google Alerts → Telegram → API)

```bash
curl -X PATCH https://backlink.sos-expat.com/api/press/contacts/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PUBLISHED",
    "articleUrl": "https://lemonde.fr/economie/2026/04/30/sos-expat-xxx",
    "publishedAt": "2026-04-30T10:00:00Z"
  }'
```

Une fois que tu as 3+ articles → **tu peux soumettre Wikidata** (voir
`brand-entity-kit/wikidata/procedure.md`).

## Webhook Mailflow → reply tracking

Le webhook `/api/press/reply-received` attend du JSON de ce format :

```json
{
  "from": "journaliste@lemonde.fr",
  "subject": "Re: [LAUNCH] SOS-Expat ...",
  "body": "Bonjour, je suis intéressé...",
  "contactId": "cl8xxxx...", // optionnel, si X-Press-Contact-Id header relayé
  "messageHeaders": { "X-Press-Contact-Id": "cl8xxxx..." }
}
```

Configure ton Mailflow (`/opt/mail-forwarder/config.yaml` ou équivalent
sur ton VPS Hetzner) pour POST ce JSON quand un reply arrive dans
un inbox `presse-*@sos-expat.com`. Voir
`brand-entity-kit/integration-google-alerts-telegram.md` pour la
configuration complète Mailflow.

Effets du webhook :
1. `PressContact.status` → `RESPONDED`
2. Les follow-ups J+5 et J+10 **pending** sont supprimés de BullMQ
3. Notification Telegram envoyée dans le chat configuré (par défaut
   `7560535072`) via le bot déjà configuré dans `app_settings` →
   `telegram_notifications`

## KPIs cibles (J+60 post-lancement)

| Métrique | Cible |
|---|---|
| SENT | 130 |
| RESPONDED | 10-15 (~8-12%) |
| PUBLISHED | 3-8 articles |
| Backlinks nouveaux DR 50+ | 3-8 |

## Dépannage

### Worker ne traite aucun job
```bash
# Vérifie que le worker tourne
docker logs bl-app | grep "press-outreach"
# Devrait afficher: "Press outreach worker started (concurrency=3)"
```

### Les emails partent mais atterrissent en spam
- Vérifie SPF / DKIM / DMARC sur `sos-expat.com` (via mxtoolbox.com)
- Vérifie que les 5 inboxes `presse@*` sont bien warmed up (Mailflow setup)
- Teste chaque inbox sur mail-tester.com → score > 9/10 requis

### Un contact reçoit la relance J+5 alors qu'il a répondu
- Vérifie que le webhook `/api/press/reply-received` est bien configuré
  côté Mailflow. Logs Backlink Engine :
```bash
docker logs bl-app | grep "Removed pending follow-up"
```
Si zéro match → webhook pas appelé. Vérifier config Mailflow.

### Aucune notification Telegram
- Vérifie que `app_settings` → `telegram_notifications` contient
  `{ enabled: true, botToken: "xxx", chatId: "7560535072" }`
- Ou ajoute `TELEGRAM_PRESS_CHAT_ID` dans `.env`

## Extensions futures (si besoin)

- Pixel de tracking d'ouverture (aujourd'hui : pas tracké, on ne compte
  que les réponses)
- A/B test de subjects (random.choice() entre 2-3 variantes)
- Lookup auto-enrichi des prénoms journalistes via LinkedIn Sales
  Navigator (API payante)
- Auto-bouncer detection → marquer `BOUNCED` et ne plus retenter
- Cross-référence avec Google Alerts Telegram : quand article détecté,
  auto-match avec contact qui a répondu → PATCH article_url
