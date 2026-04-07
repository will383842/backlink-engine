# 🚀 Auto-Enrollment System - Guide Complet

**Date**: 2026-02-13
**Status**: ✅ PRODUCTION READY

---

## Vue d'ensemble

Le système d'auto-enrollment permet d'envoyer **automatiquement** des emails aux prospects dès qu'ils sont ajoutés au système, sans aucune intervention manuelle.

### Flux automatique complet

```
1. AJOUT PROSPECT
   ↓
2. ENRICHMENT (auto)
   • Détection langue/pays
   • Score SEO (DA, PageRank)
   • Tier assignment (1-4)
   ↓
3. AUTO-ENROLLMENT (auto)
   • Vérification éligibilité
   • Sélection campagne
   • Génération ligne personnalisée (Claude AI)
   • Ajout à MailWizz avec tags
   ↓
4. ENVOI EMAIL (auto via MailWizz)
   • Séquence d'emails programmée
   • Tracking (ouvertures, clics)
   ↓
5. SUIVI RÉPONSES (auto via IMAP)
   • Détection réponses positives/négatives
   • Mise à jour statut prospect
```

**Temps total**: 2-5 minutes entre ajout URL et premier email envoyé ⚡

---

## Configuration

### 1. Activer/Désactiver le système

Via API:
```bash
curl -X PUT https://backlink.yourdomain.com/api/settings/auto-enrollment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true
  }'
```

Via console admin:
- Navigate to `/settings`
- Toggle "Auto-Enrollment" switch
- Click "Save"

### 2. Configuration avancée

```json
{
  "enabled": true,                              // Master switch
  "maxPerHour": 50,                            // Throttle: max 50 enrollments/heure
  "maxPerDay": 500,                            // Throttle: max 500 enrollments/jour
  "minScore": 50,                              // Score minimum requis (0-100)
  "minTier": 3,                                // Tier maximum autorisé (1-3)
  "allowedCategories": [                       // Catégories éligibles
    "blogger",
    "influencer",
    "media"
  ],
  "allowedLanguages": ["fr", "en", "de", "es", "pt"],  // Langues supportées
  "requireVerifiedEmail": true                  // Exiger email vérifié
}
```

### 3. Règles d'éligibilité

Un prospect est **automatiquement enrollé** si TOUTES ces conditions sont remplies:

✅ Status = `READY_TO_CONTACT`
✅ Score ≥ `minScore` (défaut: 50)
✅ Tier ≤ `minTier` (défaut: 3, donc T1/T2/T3 OK, T4 non)
✅ Catégorie dans `allowedCategories`
✅ Langue dans `allowedLanguages`
✅ Email vérifié (si `requireVerifiedEmail` = true)
✅ Pas déjà enrollé dans une autre campagne
✅ Throttle limits OK (max per hour/day)

---

## Gestion des campagnes

### Sélection automatique de campagne

Le système sélectionne la **meilleure campagne** pour chaque prospect en fonction de:

1. **Match langue** (obligatoire)
2. **Match catégorie** (si campaign.categoryFilter défini)
3. **Match pays** (bonus +50 points)
4. **Match tier** (si campaign.minTier défini)
5. **Load balancing** (préfère campagnes moins chargées)
6. **Nouveauté** (légère préférence pour campagnes récentes)

### Créer une campagne auto-enrollment

```bash
POST /api/campaigns

{
  "name": "Bloggers FR 2026",
  "language": "fr",
  "categoryFilter": ["blogger", "media"],      // Optionnel
  "countryFilter": ["FR", "BE", "CH", "CA"],   // Optionnel
  "minTier": 3,                                 // Optionnel (1-4)
  "isActive": true,                             // IMPORTANT!
  "mailwizzListUid": "xx123abc"                 // MailWizz list ID
}
```

**Important**: Une campagne doit avoir `isActive: true` pour recevoir des enrollments automatiques!

---

## Kill Switches

Le système a **5 niveaux** de contrôle pour stopper les envois:

### Niveau 1: Auto-Enrollment Global

```bash
# ARRÊT TOTAL des enrollments automatiques
PUT /api/settings/auto-enrollment
{
  "enabled": false
}
```

→ Les prospects sont toujours enrichis mais plus jamais auto-enrollés.

### Niveau 2: MailWizz Global

```bash
# ARRÊT TOTAL de MailWizz (même enrollments manuels bloqués)
PUT /api/settings/mailwizz
{
  "enabled": false
}
```

→ Plus aucun email n'est envoyé, même si enrollment manuel.

### Niveau 3: Dry-Run Mode

```bash
# MODE TEST: simule les enrollments sans vraiment envoyer
PUT /api/settings/mailwizz
{
  "dryRun": true
}
```

→ Toute la logique tourne, events loggés, mais aucun subscriber créé dans MailWizz.

### Niveau 4: Pause Campagne

```bash
# Désactiver une campagne spécifique
PUT /api/campaigns/123
{
  "isActive": false
}
```

→ Cette campagne ne recevra plus de nouveaux enrollments automatiques.

### Niveau 5: Block Prospect

```bash
# Mettre un prospect en DO_NOT_CONTACT
PUT /api/prospects/456
{
  "status": "DO_NOT_CONTACT"
}
```

→ Ce prospect ne sera jamais contacté (ni auto ni manuel).

---

## Throttling

### Pourquoi throttler?

1. **Éviter spam complaints** - Envoi progressif = meilleure délivrabilité
2. **IP warmup** - Email-engine limite les quotas par IP
3. **Respect quotas MailWizz** - Plans ont des limites mensuelles
4. **Meilleure conversion** - Permet review manuelle des tops prospects

### Configuration throttle

```json
{
  "maxPerHour": 50,    // Max 50 nouveaux enrollments par heure
  "maxPerDay": 500     // Max 500 nouveaux enrollments par jour
}
```

Si limite atteinte:
- Les nouveaux prospects sont quand même enrichis
- Ils restent en status `READY_TO_CONTACT`
- Ils seront auto-enrollés dès que les quotas se libèrent
- Logs: "Auto-enrollment blocked by throttle: hourly_limit_reached"

### Monitoring throttle

```bash
GET /api/settings/auto-enrollment

# Response:
{
  "config": { ... },
  "stats": {
    "enrolledLastHour": 42,    // Progression vers maxPerHour
    "enrolledToday": 287        // Progression vers maxPerDay
  }
}
```

---

## Intégration Scraper-Pro

Le scraper externe envoie automatiquement les prospects vers backlink-engine.

### Configuration scraper-pro

```env
# .env
BACKLINK_ENGINE_ENABLED=true
BACKLINK_ENGINE_API_URL=https://backlink.yourdomain.com/api/ingest
BACKLINK_ENGINE_API_KEY=your_api_key
BACKLINK_ENGINE_BATCH_SIZE=50
```

### Flux scraper → backlink-engine

```
1. Scraper trouve un blog + email
   ↓
2. Déduplication (email, URL, hash contenu)
   ↓
3. Validation (format email, etc.)
   ↓
4. Stockage PostgreSQL (scraper DB)
   ↓
5. Envoi à backlink-engine (batch 50)
   ↓
6. Backlink-engine: enrichment + auto-enrollment
   ↓
7. Email envoyé via MailWizz
```

### Activer le pipeline

Dans `scraper/settings.py`:

```python
ITEM_PIPELINES = {
    'scraper.utils.pipelines.UltraProDeduplicationPipeline': 100,
    'scraper.utils.pipelines.ValidationPipeline': 200,
    'scraper.utils.pipelines.PostgresPipeline': 300,
    'scraper.utils.backlink_pipeline.BacklinkEnginePipeline': 400,  # ← ADD THIS
    'scraper.utils.pipelines.ProgressTrackingPipeline': 500,
}
```

---

## Monitoring & Logs

### Events loggés

Tous les events sont stockés dans `events` table:

- `enrichment_completed` - Enrichment terminé avec succès
- `auto_enrollment_failed` - Auto-enrollment a échoué (voir data.error)
- `ENROLLED` - Prospect enrollé dans campagne
- `ENROLLMENT_BLOCKED` - Enrollment bloqué (voir data.reason)
- `ENROLLMENT_DRY_RUN` - Enrollment simulé en dry-run mode

### Consulter les events

```bash
GET /api/events?prospectId=123&limit=20

# Response:
[
  {
    "eventType": "enrichment_completed",
    "eventSource": "enrichment_worker",
    "data": { "finalScore": 73, "tier": 2 },
    "createdAt": "2026-02-13T10:30:00Z"
  },
  {
    "eventType": "ENROLLED",
    "eventSource": "enrichment_worker",
    "data": { "campaignId": 5, "campaignRef": "BL-5-123-1707820200" },
    "createdAt": "2026-02-13T10:32:00Z"
  }
]
```

### Logs worker

```bash
# Suivre les logs du worker enrichment
docker logs -f bl-app | grep enrichment-worker

# Suivre les auto-enrollments
docker logs -f bl-app | grep "Auto-enrolling prospect"
```

---

## Troubleshooting

### Prospect pas auto-enrollé?

Vérifier dans l'ordre:

1. **Auto-enrollment activé?**
   ```bash
   GET /api/settings/auto-enrollment
   # Vérifier config.enabled = true
   ```

2. **Prospect éligible?**
   ```bash
   GET /api/prospects/123
   # Vérifier:
   # - status = "READY_TO_CONTACT"
   # - score ≥ minScore
   # - tier ≤ minTier
   # - category dans allowedCategories
   ```

3. **Throttle OK?**
   ```bash
   GET /api/settings/auto-enrollment
   # Vérifier stats.enrolledLastHour < config.maxPerHour
   ```

4. **Campagne active?**
   ```bash
   GET /api/campaigns?language=fr&isActive=true
   # Au moins 1 campagne doit être active pour cette langue
   ```

5. **Déjà enrollé?**
   ```bash
   GET /api/enrollments?prospectId=123
   # Ne doit pas avoir d'enrollment actif/completed
   ```

6. **Logs?**
   ```bash
   GET /api/events?prospectId=123&eventType=auto_enrollment_failed
   # Checker data.error pour la raison
   ```

### Emails pas envoyés?

1. **MailWizz activé?**
   ```bash
   GET /api/settings/mailwizz
   # config.enabled = true, config.dryRun = false
   ```

2. **Enrollment créé?**
   ```bash
   GET /api/enrollments?prospectId=123
   # Doit avoir status = "active"
   ```

3. **MailWizz configured?**
   - Check list existe dans MailWizz
   - Check autoresponder/campaign actif dans MailWizz
   - Check quotas MailWizz pas dépassés

---

## Tests

### Test complet du flux

```bash
# 1. Activer dry-run mode
PUT /api/settings/mailwizz
{
  "enabled": true,
  "dryRun": true
}

# 2. Activer auto-enrollment
PUT /api/settings/auto-enrollment
{
  "enabled": true,
  "minScore": 40,
  "minTier": 3
}

# 3. Créer campagne test
POST /api/campaigns
{
  "name": "Test Campaign",
  "language": "fr",
  "isActive": true,
  "mailwizzListUid": "test123"
}

# 4. Ajouter prospect test
POST /api/ingest
{
  "prospects": [
    {
      "domain": "test-blog.fr",
      "category": "blogger",
      "language": "fr",
      "contact": {
        "email": "test@test-blog.fr",
        "name": "Jean Test"
      }
    }
  ]
}

# 5. Attendre 2-5 minutes (enrichment + auto-enrollment)

# 6. Vérifier enrollment créé
GET /api/enrollments?prospectId=XXX

# 7. Vérifier events
GET /api/events?prospectId=XXX
# Chercher: enrichment_completed, ENROLLMENT_DRY_RUN

# 8. Si OK, désactiver dry-run et tester pour de vrai
PUT /api/settings/mailwizz
{
  "dryRun": false
}
```

---

## Performance

### Capacité

- **Enrichment**: ~10 prospects/minute (limité par APIs externes)
- **Auto-enrollment**: ~100 prospects/minute (limité par throttle config)
- **MailWizz API**: ~30 req/minute (limité par policy)

### Optimisations

1. **BullMQ workers** - Parallélisation automatique (concurrency: 3)
2. **Batch processing** - Scraper envoie par lots de 50
3. **Rate limiting** - Respect des quotas APIs
4. **Redis caching** - Déduplication ultra-rapide
5. **Connection pooling** - Réutilisation connexions DB

---

## Sécurité

### API Key

Toutes les requêtes vers `/api/ingest` requièrent:

```bash
curl -H "X-Api-Key: YOUR_API_KEY" ...
```

Generate API key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```env
INGEST_API_KEY=generated_key_here
```

### JWT Auth

Les routes admin (`/api/settings`, `/api/campaigns`) requièrent JWT:

```bash
# 1. Login
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "your_password"
}
# → Retourne { "token": "eyJhbG..." }

# 2. Use token
curl -H "Authorization: Bearer eyJhbG..." ...
```

---

## Production Checklist

Avant d'activer en production:

- [ ] MailWizz configuré (listes, templates, autoresponders)
- [ ] Email-Engine configuré (IPs warmup, DNS, SPF/DKIM/DMARC)
- [ ] Auto-enrollment `enabled: false` au début
- [ ] Throttle conservateur (`maxPerHour: 20, maxPerDay: 200`)
- [ ] Test manuel avec 5-10 prospects en dry-run
- [ ] Test réel avec 5-10 prospects (dry-run OFF)
- [ ] Monitoring logs pendant 24h
- [ ] Activer auto-enrollment progressivement
- [ ] Augmenter throttle progressivement (warmup)

---

## Support

**Logs**:
```bash
docker logs -f bl-app
```

**Events API**:
```bash
GET /api/events?limit=100&sort=desc
```

**Stats dashboard**:
```bash
GET /api/dashboard/stats
```

---

## Changelog

### 2026-02-13 - v1.0.0 ✅
- ✅ Auto-enrollment system complet
- ✅ Kill switches multi-niveaux
- ✅ Throttling horaire/journalier
- ✅ Sélection intelligente de campagne
- ✅ Intégration scraper-pro
- ✅ Event logging complet
- ✅ Dry-run mode pour tests
- ✅ Documentation complète
