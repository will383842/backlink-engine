# 🚀 DÉPLOIEMENT BACKLINK-ENGINE SUR CPX22

**Domaine** : `backlinks.life-expat.com`
**Serveur** : Hetzner CPX22 (89.167.26.169, Helsinki)
**Date** : 14 février 2026

---

## ✅ FICHIERS MODIFIÉS

Tous les fichiers ont été mis à jour avec `backlinks.life-expat.com` :

- ✅ `deploy/nginx.conf` → `server_name backlinks.life-expat.com`
- ✅ `deploy/setup-server.sh` → `DOMAIN="backlinks.life-expat.com"`
- ✅ `.env.example` → `MAILWIZZ_API_URL="https://mail.life-expat.com/api"`
- ✅ `.env` → `CORS_ORIGIN="https://backlinks.life-expat.com"`
- ✅ `docker-compose.optimized.yml` → Limites ressources CPX22
- ✅ `db/postgresql.conf` → PostgreSQL optimisé 1GB RAM

---

## 📋 CHECKLIST AVANT DÉPLOIEMENT

### 1. Configuration Cloudflare (5 min)

**Domaine** : `life-expat.com`

1. Aller sur **Cloudflare Dashboard**
2. Sélectionner `life-expat.com`
3. **DNS** → Add record :
   - **Type** : `A`
   - **Name** : `backlinks`
   - **IPv4 address** : `89.167.26.169`
   - **Proxy status** : ☁️ **Orange** (proxied)
   - TTL : Auto

4. **SSL/TLS** :
   - Mode : **Full** (pas Full Strict)
   - Edge Certificates : Always Use HTTPS ✅

5. **Vérifier le DNS** (5 min d'attente propagation) :
```bash
nslookup backlinks.life-expat.com
# Doit pointer vers une IP Cloudflare (pas 89.167.26.169 directement)
```

---

### 2. Commit & Push (2 min)

```bash
cd C:\Users\willi\Documents\Projets\VS_CODE\sos-expat-project\backlink-engine

# Vérifier les changements
git status

# Commit
git add .
git commit -m "config: migrate to life-expat.com domain + CPX22 optimizations"

# Push
git push origin main
```

---

### 3. Déploiement sur le serveur (10 min)

```bash
# Se connecter au CPX22
ssh root@89.167.26.169

# Vérifier que le serveur est prêt
uname -a
# Ubuntu 24.04 LTS

df -h
# Disk space disponible

free -h
# RAM disponible

# Lancer l'installation automatique
curl -fsSL https://raw.githubusercontent.com/will383842/backlink-engine/main/deploy/setup-server.sh | bash
```

**Le script va** :
1. ✅ Update Ubuntu + install essentials
2. ✅ Configurer firewall UFW (ports 22, 80)
3. ✅ Installer Docker + Docker Compose
4. ✅ Cloner le repo depuis GitHub
5. ✅ Générer `.env` avec secrets forts :
   - PostgreSQL password (32 chars)
   - JWT secret (64 chars)
   - Webhook secret (32 chars)
   - Ingest API key (32 chars)
6. ✅ Lancer `docker compose up -d`
7. ✅ Exécuter migrations Prisma

**Durée** : ~5-8 minutes

---

### 4. Vérification (5 min)

```bash
# 1. Vérifier les containers
docker ps

# Résultat attendu (4 containers "Up"):
# bl-postgres   (PostgreSQL 16)
# bl-redis      (Redis 7)
# bl-app        (Node.js Fastify)
# bl-nginx      (Nginx reverse proxy)

# 2. Vérifier les ressources
docker stats --no-stream

# Résultat attendu:
# bl-postgres: 400-600 MB RAM, 20-40% CPU
# bl-redis:    100-150 MB RAM, 2-5% CPU
# bl-app:      400-600 MB RAM, 10-30% CPU
# bl-nginx:    20-40 MB RAM, 1-3% CPU
# ──────────────────────────────────────────
# TOTAL:       ~1.0-1.4 GB / 4 GB = ✅ EXCELLENT

# 3. Health check local
curl http://localhost/api/health

# Résultat attendu:
# {"status":"ok","service":"backlink-engine","version":"0.1.0"}

# 4. Health check externe (depuis Cloudflare)
curl https://backlinks.life-expat.com/api/health

# Résultat attendu:
# {"status":"ok","service":"backlink-engine","version":"0.1.0"}

# 5. Vérifier les logs
docker logs bl-app --tail 50

# Chercher:
# ✅ "Server listening at http://0.0.0.0:3000"
# ✅ "Database connected"
# ✅ "Redis connected"
# ❌ Pas d'erreurs

# 6. Vérifier PostgreSQL
docker logs bl-postgres --tail 30

# Chercher:
# ✅ "database system is ready to accept connections"
```

---

### 5. Créer compte admin (2 min)

```bash
# Sur le serveur
curl -X POST https://backlinks.life-expat.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@life-expat.com",
    "password": "VotreMotDePasseSecure123!",
    "name": "Admin Life Expat"
  }'

# Résultat attendu:
# {
#   "user": {
#     "id": "...",
#     "email": "admin@life-expat.com",
#     "name": "Admin Life Expat"
#   },
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }

# Sauvegarder le token JWT quelque part !
```

---

### 6. Test complet (5 min)

```bash
# 1. Login
curl -X POST https://backlinks.life-expat.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@life-expat.com",
    "password": "VotreMotDePasseSecure123!"
  }'

# Récupérer le token dans la réponse

# 2. Créer une campagne test
TOKEN="votre_token_jwt_ici"

curl -X POST https://backlinks.life-expat.com/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign FR",
    "language": "fr",
    "isActive": true
  }'

# 3. Lister les campagnes
curl https://backlinks.life-expat.com/api/campaigns \
  -H "Authorization: Bearer $TOKEN"

# Résultat attendu: liste avec ta campagne créée

# 4. Vérifier les settings
curl https://backlinks.life-expat.com/api/settings/auto-enrollment \
  -H "Authorization: Bearer $TOKEN"

# Résultat attendu: config auto-enrollment + stats
```

---

## 🎯 CONFIGURATION POST-DÉPLOIEMENT

### 1. Configurer MailWizz (OPTIONNEL - 30 min)

**Prérequis** : Instance MailWizz sur `mail.life-expat.com`

1. **Créer les listes** (une par langue) :
   - Liste FR : Bloggers/Influencers français
   - Liste EN : Bloggers/Influencers anglais
   - Liste DE : Bloggers/Influencers allemands
   - Liste ES : Bloggers/Influencers espagnols
   - Liste PT : Bloggers/Influencers portugais

2. **Noter les List UIDs** (format : `xx123xxx`)

3. **Mettre à jour .env sur le serveur** :
```bash
ssh root@89.167.26.169
cd /opt/backlink-engine
nano .env

# Modifier:
MAILWIZZ_API_KEY="votre_vraie_api_key"
MAILWIZZ_LIST_FR="list_uid_french"
MAILWIZZ_LIST_EN="list_uid_english"
# ... etc

# Sauvegarder (Ctrl+O, Enter, Ctrl+X)

# Redémarrer l'app
docker compose restart app
```

4. **Tester en dry-run** (voir `00-LIRE-MOI-COMPLET.md`)

---

### 2. Configurer le monitoring (OPTIONNEL - 10 min)

```bash
# Créer un cron job pour vérifier la santé
crontab -e

# Ajouter:
*/5 * * * * curl -sf https://backlinks.life-expat.com/api/health > /dev/null || echo "Backlink-Engine DOWN!" | mail -s "ALERT" admin@life-expat.com

# Installer mailutils si nécessaire
apt install -y mailutils
```

---

## 🔧 COMMANDES UTILES

### Sur le serveur

```bash
# Voir les logs en temps réel
docker logs -f bl-app

# Redémarrer un service
docker restart bl-app

# Redémarrer tout
cd /opt/backlink-engine && docker compose restart

# Mettre à jour le code
cd /opt/backlink-engine
git pull origin main
docker compose up -d --build

# Vérifier l'espace disque
df -h

# Vérifier la RAM
free -h

# Vérifier les processus
htop

# Backup PostgreSQL manuel
docker exec bl-postgres pg_dump -U backlink backlink_engine > backup_$(date +%Y%m%d).sql
```

---

## 🆘 TROUBLESHOOTING

### Problème : Container ne démarre pas

```bash
# Voir les logs
docker logs bl-app

# Causes courantes:
# 1. Mauvais mot de passe dans .env
# 2. Port déjà utilisé
# 3. PostgreSQL pas prêt

# Solution: Recréer
docker compose down
docker compose up -d
```

### Problème : API répond 502 Bad Gateway

```bash
# Vérifier Nginx
docker logs bl-nginx

# Vérifier que l'app écoute
docker exec bl-app wget -qO- http://localhost:3000/api/health

# Redémarrer Nginx
docker restart bl-nginx
```

### Problème : RAM > 80%

```bash
# Vérifier consommation
docker stats

# Si PostgreSQL trop gourmand:
docker restart bl-postgres

# Si problème persiste: upgrade CPX22 → CPX31
```

---

## ✅ CHECKLIST FINALE

- [ ] **DNS Cloudflare configuré** (backlinks → 89.167.26.169)
- [ ] **SSL/TLS en mode Full**
- [ ] **Code commité et pushé sur GitHub**
- [ ] **Script setup-server.sh exécuté**
- [ ] **4 containers en "Up"** (`docker ps`)
- [ ] **Health check OK** (`curl https://backlinks.life-expat.com/api/health`)
- [ ] **Compte admin créé**
- [ ] **Campagne test créée**
- [ ] **RAM < 2GB** (`docker stats`)
- [ ] *(Optionnel)* MailWizz configuré

---

## 🎉 C'EST EN LIGNE !

**Backlink-Engine tourne maintenant sur** :
- 🌐 **URL** : https://backlinks.life-expat.com
- 🖥️ **Serveur** : Hetzner CPX22 (Helsinki)
- 🔒 **SSL** : Cloudflare Full
- 💾 **RAM utilisée** : ~1.2-1.4 GB / 4 GB
- ⚡ **CPU** : 30-50% (normal)

**Prochaines étapes** :
1. Configurer MailWizz (optionnel)
2. Ajouter prospects via API `/api/ingest`
3. Tester auto-enrollment en dry-run
4. GO LIVE 🚀

---

## 📞 DOCUMENTATION

- **Guide complet** : `00-LIRE-MOI-COMPLET.md`
- **Auto-enrollment** : `AUTO_ENROLLMENT_GUIDE.md`
- **Audit technique** : `AUDIT-CPX22-STANDALONE.md`
- **Guide rapide** : `GUIDE-RAPIDE-CPX22.md`

---

**Backlink-Engine v0.1.0**
Déployé sur `backlinks.life-expat.com` 🚀
