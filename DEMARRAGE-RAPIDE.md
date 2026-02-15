# 🚀 Backlink Engine - Démarrage Rapide SANS MailWizz

**Objectif** : Commencer à travailler MAINTENANT (saisir URLs, gérer prospects, préparer campagnes)
**MailWizz** : On branche plus tard (seulement pour envoi emails final)

---

## ✅ Prérequis

- Docker & Docker Compose installés
- Git configuré
- Port 3000 disponible (backend API)
- Port 5173 disponible (frontend dev)

---

## 🎯 Démarrage en 3 Commandes

### **Option 1 : Démarrage Local (Développement)**

```bash
# 1. Aller dans le projet
cd backlink-engine

# 2. Copier la config production
cp .env.production .env

# 3. Lancer Docker Compose
docker compose up -d

# 4. Appliquer migrations Prisma
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate

# 5. Créer un utilisateur admin
docker compose exec app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async () => {
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  const user = await prisma.user.create({
    data: {
      email: 'admin@life-expat.com',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      name: 'Admin'
    }
  });
  console.log('✅ Admin créé:', user.email);
  await prisma.\$disconnect();
})();
"
```

**Accès** :
- Backend API : http://localhost:3000
- Health check : http://localhost:3000/health
- Prisma Studio : `docker compose exec app npx prisma studio` → http://localhost:5555

---

### **Option 2 : Démarrage Serveur (Production Hetzner)**

```bash
# SSH vers serveur
ssh root@backlinks.life-expat.com

# Aller dans le dossier app (ou cloner si première fois)
cd /app || git clone https://github.com/VOTRE-REPO/backlink-engine.git /app && cd /app

# Pull dernières modifications
git pull origin main

# Copier .env.production
cp .env.production .env

# Rebuild + déployer
docker compose down
docker compose up -d --build

# Migrations Prisma
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate

# Créer admin (si première fois)
docker compose exec app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async () => {
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  const user = await prisma.user.create({
    data: {
      email: 'admin@life-expat.com',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      name: 'Admin'
    }
  });
  console.log('✅ Admin créé:', user.email);
  await prisma.\$disconnect();
})();
"

# Vérifier logs
docker compose logs -f app
```

**Accès** :
- Backend API : https://backlinks.life-expat.com
- Health check : https://backlinks.life-expat.com/health

---

## 📝 Utilisation (API Endpoints)

### **1. Login (Obtenir JWT Token)**

```bash
curl -X POST https://backlinks.life-expat.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@life-expat.com",
    "password": "Admin123!"
  }'

# Réponse :
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "email": "admin@life-expat.com", "role": "ADMIN" }
}
```

**Copier le token** pour les requêtes suivantes.

---

### **2. Ajouter un Prospect (URL) Manuellement**

```bash
# Remplacer YOUR_JWT_TOKEN par le token obtenu au login
curl -X POST https://backlinks.life-expat.com/api/prospects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://example.com/blog",
    "tier": 2,
    "source": "MANUAL",
    "notes": "Prospect intéressant pour backlink"
  }'

# Réponse :
{
  "id": 1,
  "url": "https://example.com/blog",
  "domain": "example.com",
  "status": "NEW",
  "tier": 2,
  "score": 0,
  "createdAt": "2026-02-15T..."
}
```

---

### **3. Importer Prospects en Masse (CSV)**

```bash
# Créer fichier prospects.csv :
url,tier,source,notes
https://site1.com,1,MANUAL,Blog tech
https://site2.com,2,MANUAL,Forum dev
https://site3.com,3,SCRAPER,Auto-détecté

# Uploader
curl -X POST https://backlinks.life-expat.com/api/prospects/import \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@prospects.csv"

# Réponse :
{
  "imported": 3,
  "duplicates": 0,
  "failed": 0
}
```

---

### **4. Lister Prospects**

```bash
curl -X GET "https://backlinks.life-expat.com/api/prospects?status=NEW&tier=1&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Réponse :
{
  "data": [
    {
      "id": 1,
      "url": "https://example.com/blog",
      "domain": "example.com",
      "status": "NEW",
      "tier": 2,
      "score": 0,
      "language": null,
      "category": null
    },
    ...
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

**Filtres disponibles** :
- `status` : NEW, READY_TO_CONTACT, CONTACTED, etc.
- `tier` : 1, 2, 3
- `category` : BLOG, FORUM, NEWS, etc.
- `language` : FR, EN, ES, etc.
- `minScore` : 0-100

---

### **5. Enrichir un Prospect (Scoring Automatique)**

```bash
# Lancer enrichissement auto (scoring, détection langue, catégorie)
curl -X POST https://backlinks.life-expat.com/api/prospects/1/enrich \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Réponse immédiate (job lancé en background via BullMQ)
{
  "message": "Enrichment job queued",
  "jobId": "job_123"
}

# Après quelques secondes, re-fetch le prospect :
curl -X GET https://backlinks.life-expat.com/api/prospects/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Le prospect est maintenant enrichi :
{
  "id": 1,
  "url": "https://example.com/blog",
  "domain": "example.com",
  "status": "READY_TO_CONTACT",
  "tier": 2,
  "score": 75,              # ← Score calculé
  "language": "EN",         # ← Détecté
  "category": "BLOG",       # ← Détecté
  "countryCode": "US"       # ← Détecté
}
```

---

### **6. Dashboard (Stats)**

```bash
# Dashboard du jour (avec cache Redis !)
curl -X GET https://backlinks.life-expat.com/api/dashboard/today \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Réponse :
{
  "urgent": {
    "repliesToHandle": 0,
    "bounces": 0,
    "lostBacklinks": 0
  },
  "todo": {
    "prospectsReady": 150,
    "formsToFill": 12
  },
  "opportunities": {
    "lostRecontactable": 8
  },
  "stats": {
    "sentToMailwizz": 0,    # ← 0 car MailWizz désactivé
    "repliesReceived": 0,
    "backlinksWon": 0,
    "prospectsAddedBySource": { "manual": 3 }
  }
}
```

---

## 🎨 Frontend (Interface Admin)

### **Développement Local**

```bash
cd backlink-engine/frontend

# Installer dépendances (Vite 7.3.1)
npm install

# Démarrer dev server
npm run dev

# Accès : http://localhost:5173
```

### **Build Production**

```bash
cd backlink-engine/frontend

# Build optimisé
npm run build

# Preview
npm run preview
```

**Déploiement** : Le frontend est servi par Nginx (voir `deploy/nginx.conf`)

---

## 🗄️ Prisma Studio (Interface DB Visuelle)

```bash
# Ouvrir Prisma Studio
docker compose exec app npx prisma studio

# Accès : http://localhost:5555
```

**Fonctionnalités** :
- Visualiser tous les prospects
- Filtrer, trier, éditer manuellement
- Créer contacts, campagnes, etc.
- Vérifier enrichissement

---

## 📊 Workflow Recommandé SANS MailWizz

### **Phase 1 : Collecte (Vous êtes ici)**

1. **Ajouter prospects** (manuel ou CSV import)
   ```bash
   POST /api/prospects
   POST /api/prospects/import
   ```

2. **Enrichir automatiquement** (scoring, catégorisation)
   ```bash
   POST /api/prospects/batch-enrich
   ```

3. **Trier et filtrer** via Dashboard ou Prisma Studio
   ```bash
   GET /api/prospects?status=READY_TO_CONTACT&minScore=50
   ```

4. **Créer contacts** pour chaque prospect
   ```bash
   POST /api/contacts
   ```

5. **Créer campagnes** (templates, stratégie)
   ```bash
   POST /api/campaigns
   ```

6. **Enrôler prospects dans campagnes**
   ```bash
   POST /api/campaigns/{id}/enroll
   ```

---

### **Phase 2 : Envoi (Plus tard avec MailWizz)**

Une fois MailWizz configuré :

1. Activer dans `.env` :
   ```bash
   MAILWIZZ_ENABLED=true
   MAILWIZZ_DRY_RUN=false
   MAILWIZZ_API_KEY="votre-clé"
   MAILWIZZ_LIST_FR="uid-liste-fr"
   # etc.
   ```

2. Restart Docker Compose :
   ```bash
   docker compose restart app
   ```

3. Lancer campagne :
   ```bash
   POST /api/campaigns/{id}/start
   ```

4. Les emails partiront automatiquement via MailWizz !

---

## ✅ Vérifications de Santé

### **Backend OK**

```bash
curl https://backlinks.life-expat.com/health

# Réponse attendue :
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "uptime": 3600
}
```

### **PostgreSQL OK**

```bash
docker compose exec postgres psql -U backlink -d backlink_engine -c "SELECT COUNT(*) FROM prospects;"

# Réponse attendue :
 count
-------
   150
```

### **Redis OK (Cache)**

```bash
docker compose exec app node -e "
const {redis} = require('./dist/config/redis.js');
redis.ping().then(r => console.log('Redis PONG:', r));
"

# Réponse attendue :
Redis PONG: PONG
```

### **Cache Redis Fonctionnel**

```bash
# 1er appel (MISS - lent ~250ms)
time curl https://backlinks.life-expat.com/api/dashboard/today -H "Authorization: Bearer TOKEN"

# 2e appel (HIT - rapide ~5ms)
time curl https://backlinks.life-expat.com/api/dashboard/today -H "Authorization: Bearer TOKEN"

# Logs (vérifier)
docker compose logs app | grep "Cache"
# Attendu :
# Cache MISS - computing... { key: 'dashboard:today' }
# Cache SET { key: 'dashboard:today', ttl: 60 }
# Cache HIT { key: 'dashboard:today' }
```

---

## 🔧 Troubleshooting

### **Erreur : "Cannot connect to PostgreSQL"**

```bash
# Vérifier que PostgreSQL est démarré
docker compose ps

# Restart PostgreSQL
docker compose restart postgres

# Vérifier logs
docker compose logs postgres
```

### **Erreur : "Redis connection refused"**

```bash
# Vérifier que Redis est démarré
docker compose ps

# Restart Redis
docker compose restart redis

# Vérifier logs
docker compose logs redis
```

### **Erreur : "Prisma schema not generated"**

```bash
docker compose exec app npx prisma generate
docker compose restart app
```

### **Frontend ne compile pas**

```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

---

## 🎯 Résumé

### **Vous pouvez MAINTENANT :**

✅ Ajouter des prospects (URLs) manuellement ou en masse
✅ Enrichir automatiquement (score, langue, catégorie)
✅ Filtrer et trier via API ou Prisma Studio
✅ Créer contacts et campagnes
✅ Préparer tout le workflow

### **Ce qui est DÉSACTIVÉ (temporairement) :**

⏸️ Envoi d'emails (MailWizz)
⏸️ Ingestion de réponses (IMAP)
⏸️ Enrichissement avancé (OpenAI, Moz, Google)

**Ces fonctionnalités seront activées plus tard quand vous configurerez les API keys !**

---

## 📞 Commandes Rapides

```bash
# Démarrer
docker compose up -d

# Logs en temps réel
docker compose logs -f app

# Restart
docker compose restart app

# Arrêter
docker compose down

# Rebuild complet
docker compose down && docker compose up -d --build

# Prisma Studio
docker compose exec app npx prisma studio

# Shell dans container
docker compose exec app sh
```

---

**Prêt à travailler !** 🚀

Le backlink-engine est **100% fonctionnel** pour la gestion de prospects SANS MailWizz.
Vous pouvez commencer à saisir des URLs et préparer vos campagnes dès maintenant ! 🎯
