# 🎯 GUIDE DE FINALISATION - BACKLINK-ENGINE
## Dernières étapes pour mettre en production

---

## 📋 RÉSUMÉ DE L'ÉTAT ACTUEL

### ✅ Ce qui fonctionne
- Serveur CPX22 opérationnel (89.167.26.169)
- 4 containers Docker en bonne santé
- API accessible localement : `http://localhost/api/health` → 200 OK
- Serveur accessible depuis internet : `http://89.167.26.169/api/health` → 200 OK

### ⚠️ Problème à résoudre
- **Cloudflare Error 521** : `https://backlinks.life-expat.com` → Web server is down
- **Cause probable** : Nginx n'écoute que sur port 80, mais Cloudflare (mode Full) tente de se connecter en HTTPS (port 443)

---

## 🚀 ÉTAPES DE FINALISATION

### ÉTAPE 1 : Fixer le problème Cloudflare 521 (5 min)

**Sur le serveur CPX22** (SSH) :

```bash
# Se connecter au serveur
ssh root@89.167.26.169

# Aller dans le répertoire backlink-engine
cd /opt/backlink-engine

# Télécharger le script de fix depuis GitHub (après push)
git pull origin main

# Rendre le script exécutable
chmod +x FIX-CLOUDFLARE-521.sh

# Exécuter le script
bash FIX-CLOUDFLARE-521.sh
```

**Ce que fait le script** :
1. ✅ Crée un certificat SSL auto-signé (pour Cloudflare Full mode)
2. ✅ Configure Nginx pour écouter sur port 443 (HTTPS)
3. ✅ Ouvre le port 443 dans le firewall UFW
4. ✅ Redémarre Nginx
5. ✅ Teste l'API en HTTP et HTTPS

**Résultat attendu** :
```
[1/3] Test local HTTP (http://localhost/api/health): ✅ OK
[2/3] Test local HTTPS (https://localhost/api/health): ✅ OK
[3/3] Test externe (https://backlinks.life-expat.com/api/health): ✅ OK
```

---

### ÉTAPE 2 : Vider le cache Cloudflare (2 min)

**Si l'erreur 521 persiste après le script** :

1. Aller sur **Cloudflare Dashboard** : https://dash.cloudflare.com
2. Sélectionner le domaine **life-expat.com**
3. Menu **Caching** (dans la barre latérale)
4. Cliquer sur **Purge Everything**
5. Confirmer l'action
6. Attendre 1-2 minutes
7. Re-tester : `curl https://backlinks.life-expat.com/api/health`

---

### ÉTAPE 3 : Commit et Push les changements (5 min)

**Sur Windows** (dans le terminal) :

```bash
# Aller dans le projet backlink-engine
cd C:\Users\willi\Documents\Projets\VS_CODE\sos-expat-project\backlink-engine

# Vérifier les fichiers modifiés
git status

# Ajouter tous les fichiers
git add .

# Commit avec message descriptif
git commit -m "fix: resolve Cloudflare 521 by adding HTTPS support on port 443

- Add FIX-CLOUDFLARE-521.sh script to auto-configure SSL
- Update nginx.conf to listen on both 80 and 443
- Generate self-signed certificate for Cloudflare Full mode
- Add comprehensive deployment documentation
- Migrate all URLs from sos-expat.com to life-expat.com

Fixes: Cloudflare Error 521 (Web server is down)
Tested: Local HTTP/HTTPS working, awaiting Cloudflare propagation"

# Push vers GitHub
git push origin main
```

---

### ÉTAPE 4 : Commit les changements du projet SOS (2 min)

**Sur Windows** :

```bash
# Aller dans le projet SOS
cd C:\Users\willi\Documents\Projets\VS_CODE\sos-expat-project\sos

# Vérifier les changements
git status

# Ajouter AdminToolbox.tsx
git add src/pages/admin/AdminToolbox.tsx

# Commit
git commit -m "fix: update Backlink Engine URL to backlinks.life-expat.com

- Change BACKLINK_ENGINE_URL from backlinks.sos-expat.com to backlinks.life-expat.com
- Aligns with new domain structure (life-expat.com)

File: src/pages/admin/AdminToolbox.tsx"

# Push vers GitHub
git push origin main
```

**Note** : Le frontend SOS sur Cloudflare Pages se déploiera automatiquement via GitHub webhook.

---

### ÉTAPE 5 : Déployer sur le serveur (3 min)

**Sur le serveur CPX22** (SSH) :

```bash
# Se connecter
ssh root@89.167.26.169

# Aller dans backlink-engine
cd /opt/backlink-engine

# Pull les derniers changements
git pull origin main

# Reconstruire et redémarrer les containers
docker compose down
docker compose up -d --build

# Attendre 10 secondes
sleep 10

# Vérifier que tout fonctionne
docker ps
curl http://localhost/api/health
curl -k https://localhost/api/health
```

**Résultat attendu** :
```
CONTAINER ID   IMAGE                    STATUS
abc123...      backlink-engine-app      Up 10 seconds (healthy)
def456...      postgres:16-alpine       Up 10 seconds (healthy)
ghi789...      redis:7-alpine           Up 10 seconds (healthy)
jkl012...      nginx:alpine             Up 10 seconds
```

---

### ÉTAPE 6 : Vérifications finales (5 min)

**Tests complets** :

```bash
# 1. Health check HTTP
curl http://localhost/api/health

# Résultat attendu:
# {"status":"ok","db":"connected","redis":"connected","timestamp":"2026-02-14T..."}

# 2. Health check HTTPS (local)
curl -k https://localhost/api/health

# Résultat attendu:
# {"status":"ok","db":"connected","redis":"connected","timestamp":"2026-02-14T..."}

# 3. Health check HTTPS (externe via Cloudflare)
curl https://backlinks.life-expat.com/api/health

# Résultat attendu:
# {"status":"ok","db":"connected","redis":"connected","timestamp":"2026-02-14T..."}

# 4. Vérifier les ports
sudo lsof -i :80
sudo lsof -i :443

# Résultat attendu:
# docker-pr... écoute sur *:80
# docker-pr... écoute sur *:443

# 5. Logs Nginx
docker logs bl-nginx --tail 50

# Chercher:
# ✅ Pas d'erreurs SSL
# ✅ Pas de "connection refused"

# 6. Stats containers
docker stats --no-stream

# Résultat attendu:
# bl-postgres: ~500 MB RAM
# bl-redis:    ~100 MB RAM
# bl-app:      ~400 MB RAM
# bl-nginx:    ~30 MB RAM
# ──────────────────────────
# TOTAL:       ~1.0 GB / 4 GB (25% utilisation)
```

---

## ✅ CHECKLIST FINALE

### Avant de déclarer "PRODUCTION READY"

- [ ] **Script FIX-CLOUDFLARE-521.sh exécuté** (sur le serveur)
- [ ] **Tests locaux HTTP/HTTPS passent** (200 OK)
- [ ] **Cache Cloudflare vidé** (Purge Everything)
- [ ] **Test externe HTTPS passe** (`https://backlinks.life-expat.com/api/health`)
- [ ] **Code commité et pushé** (backlink-engine + sos)
- [ ] **Déploiement serveur fait** (`git pull` + `docker compose up -d`)
- [ ] **4 containers "Up" et "healthy"**
- [ ] **RAM < 1.5 GB** (marge confortable)
- [ ] **Logs Nginx sans erreurs**
- [ ] **Ports 80 et 443 ouverts et écoutés**

---

## 🔧 DÉPANNAGE

### Si l'erreur 521 persiste après toutes les étapes

#### Option A : Vérifier les logs Cloudflare
1. Cloudflare Dashboard → **Analytics** → **Traffic**
2. Chercher les requêtes vers `backlinks.life-expat.com`
3. Cliquer sur une requête avec erreur 521
4. Lire le message d'erreur détaillé

#### Option B : Tester avec Cloudflare désactivé (DNS-only)
1. Cloudflare Dashboard → **DNS**
2. Cliquer sur le **nuage ORANGE** à côté de "backlinks" → passer en **GRIS**
3. Attendre 2 minutes
4. Tester : `curl https://backlinks.life-expat.com/api/health`
   - ✅ Si ça marche → Le problème est avec le proxy Cloudflare
   - ❌ Si ça ne marche pas → Le problème est avec DNS ou SSL

#### Option C : Passer temporairement en mode "Flexible"
1. Cloudflare Dashboard → **SSL/TLS**
2. Changer de "Full" → "Flexible"
3. Tester (moins sécurisé, juste pour diagnostiquer)
4. Si ça marche → Le problème vient du certificat origin

#### Option D : Vérifier les IP Cloudflare autorisées
Cloudflare utilise des IP spécifiques pour se connecter au serveur origin.

```bash
# Vérifier qu'il n'y a pas de restriction IP dans Nginx
docker exec bl-nginx cat /etc/nginx/nginx.conf | grep allow
docker exec bl-nginx cat /etc/nginx/nginx.conf | grep deny

# Résultat attendu: aucune restriction (ou allow all)
```

---

## 🎉 APRÈS LA MISE EN PRODUCTION

### Créer un compte admin

```bash
curl -X POST https://backlinks.life-expat.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@life-expat.com",
    "password": "VotreMotDePasseSecure123!",
    "name": "Admin Life Expat"
  }'

# Sauvegarder le token JWT retourné !
```

### Créer une campagne test

```bash
# Récupérer le token JWT depuis la réponse précédente
TOKEN="votre_token_jwt_ici"

curl -X POST https://backlinks.life-expat.com/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign FR",
    "language": "fr",
    "isActive": true
  }'
```

### Configurer MailWizz (optionnel)

Voir : `DEPLOIEMENT-LIFE-EXPAT.md` section "Configuration MailWizz"

---

## 📞 SUPPORT

### Commandes de monitoring

```bash
# Voir les logs en temps réel
docker logs -f bl-app

# Stats en temps réel
watch -n 2 'docker stats --no-stream'

# Espace disque
df -h

# RAM disponible
free -h

# Processus
htop
```

### Backup manuel PostgreSQL

```bash
docker exec bl-postgres pg_dump -U backlink backlink_engine > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🚀 PROCHAINES ÉTAPES (après déploiement)

1. **Configurer MailWizz** :
   - Créer listes par langue
   - Mettre à jour `.env` avec List UIDs
   - Tester auto-enrollment en dry-run

2. **Ajouter monitoring** :
   - Cron job pour health check
   - Alertes email si down

3. **Déployer Scraper-Pro** (projet séparé) :
   - Serveur CPX31 dédié (8GB RAM)
   - Domaine : `providers-expat.com`

4. **Documentation utilisateur** :
   - Guide API
   - Exemples cURL
   - Collection Postman

---

**Backlink-Engine v0.1.0**
Mise en production : `backlinks.life-expat.com` 🚀
