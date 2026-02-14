# 📊 SYNTHÈSE DÉPLOIEMENT BACKLINK-ENGINE
## 14 février 2026 - État des lieux

---

## ✅ CE QUI EST FAIT

### 1. Configuration serveur CPX22 (Hetzner Helsinki)
- ✅ **IP** : 89.167.26.169
- ✅ **OS** : Ubuntu 24.04 LTS
- ✅ **Docker** : Installé et fonctionnel
- ✅ **Firewall UFW** : Ports 22, 80, 443 ouverts
- ✅ **Nginx système** : Désactivé (utilise uniquement bl-nginx dans Docker)

### 2. Configuration Docker
- ✅ **4 containers opérationnels** :
  - `bl-app` : Node.js Fastify (healthy)
  - `bl-postgres` : PostgreSQL 16 (healthy)
  - `bl-redis` : Redis 7 (healthy)
  - `bl-nginx` : Reverse proxy (Up)

- ✅ **Optimisations CPX22** :
  - PostgreSQL : 1GB RAM max
  - Redis : 256MB RAM max
  - App : 768MB RAM max
  - Total : ~1.2-1.4GB / 4GB disponibles

### 3. Configuration domaine
- ✅ **Domaine** : `backlinks.life-expat.com`
- ✅ **DNS Cloudflare** : Record A configuré
  - Type : A
  - Name : backlinks
  - IPv4 : 89.167.26.169
  - Proxy : ☁️ Orange (Proxied)

- ✅ **SSL/TLS Cloudflare** : Mode "Full"

### 4. Fichiers mis à jour
- ✅ `deploy/nginx.conf` → `server_name backlinks.life-expat.com`
- ✅ `deploy/setup-server.sh` → `DOMAIN="backlinks.life-expat.com"`
- ✅ `.env` → Ajout `HOST=0.0.0.0`, `CORS_ORIGIN="https://backlinks.life-expat.com"`
- ✅ `.env.example` → `MAILWIZZ_API_URL="https://mail.life-expat.com/api"`
- ✅ `docker-compose.optimized.yml` → Limites ressources CPX22
- ✅ `db/postgresql.conf` → PostgreSQL optimisé 1GB RAM

### 5. Tests fonctionnels
- ✅ **API locale fonctionnelle** :
  ```bash
  curl http://localhost/api/health
  # {"status":"ok","db":"connected","redis":"connected","timestamp":"2026-02-14T14:11:57.375Z"}
  ```

- ✅ **Serveur accessible depuis internet** :
  ```bash
  curl http://89.167.26.169/api/health
  # 200 OK (confirmé depuis Windows)
  ```

### 6. Projet SOS Expat
- ✅ **AdminToolbox.tsx** mis à jour :
  - Ancienne URL : `https://backlinks.sos-expat.com`
  - Nouvelle URL : `https://backlinks.life-expat.com`

---

## ⚠️ PROBLÈME EN COURS

### Cloudflare Error 521 (Web server is down)

**Symptômes** :
- ❌ `https://backlinks.life-expat.com` → Error 521
- ✅ `http://89.167.26.169` → 200 OK

**Diagnostic** :
- ✅ Serveur opérationnel (accessible directement)
- ✅ DNS Cloudflare résolu correctement
- ✅ Pas de firewall bloquant
- ✅ SSL/TLS en mode "Full"
- ✅ Domaine activé (plus en "pending")

**Cause probable** :
L'erreur 521 signifie que Cloudflare ne peut pas se connecter au serveur origin. Malgré tous les tests positifs, il semble y avoir un problème de communication entre Cloudflare et le serveur.

**Étapes de résolution** :

#### Option 1 : Test avec proxy désactivé (DNS-only)
1. Aller sur Cloudflare Dashboard → life-expat.com → DNS
2. Cliquer sur le nuage ORANGE à côté de "backlinks" pour le passer en GRIS
3. Attendre 2 minutes (propagation DNS)
4. Tester : `curl https://backlinks.life-expat.com/api/health`
   - ✅ Si ça marche → Le problème est avec le proxy Cloudflare
   - ❌ Si ça ne marche pas → Le problème est avec DNS ou SSL

#### Option 2 : Vérifier les logs Cloudflare
1. Cloudflare Dashboard → Analytics → Traffic
2. Chercher les requêtes vers `backlinks.life-expat.com`
3. Voir le code erreur exact et le message

#### Option 3 : Vider le cache Cloudflare
1. Cloudflare Dashboard → Caching
2. "Purge Everything"
3. Attendre 1-2 minutes
4. Re-tester

#### Option 4 : Vérifier le port 443
Le serveur n'écoute que sur le port 80. Cloudflare en mode "Full" essaie peut-être de se connecter en HTTPS (port 443) au serveur origin.

**Solution** : Configurer Nginx pour écouter sur 443 avec un certificat auto-signé :
```bash
# Sur le serveur
cd /opt/backlink-engine
nano deploy/nginx.conf

# Ajouter :
server {
    listen 443 ssl;
    server_name backlinks.life-expat.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location /api/ {
        proxy_pass http://bl-app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Générer certificat auto-signé
docker exec bl-nginx mkdir -p /etc/nginx/ssl
docker exec bl-nginx openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/key.pem \
  -out /etc/nginx/ssl/cert.pem \
  -subj "/CN=backlinks.life-expat.com"

# Redémarrer Nginx
docker compose restart nginx
```

#### Option 5 : Passer en mode "Flexible" (temporaire)
Si le problème vient du SSL origin :
1. Cloudflare Dashboard → SSL/TLS
2. Changer de "Full" → "Flexible"
3. Tester (mais c'est moins sécurisé, juste pour diagnostiquer)

---

## ⏳ ACTIONS À FAIRE

### Priorité 1 : Résoudre Cloudflare 521
- [ ] Tester avec proxy désactivé (DNS-only)
- [ ] Vérifier logs Cloudflare
- [ ] Vider cache Cloudflare
- [ ] Si besoin : configurer HTTPS sur Nginx (port 443)

### Priorité 2 : Déployer les changements
```bash
# 1. Commit et push (local Windows)
cd C:\Users\willi\Documents\Projets\VS_CODE\sos-expat-project

# Backlink-engine
cd backlink-engine
git add .
git commit -m "config: migrate to life-expat.com domain + fix Cloudflare 521"
git push origin main

# SOS projet
cd ../sos
git add src/pages/admin/AdminToolbox.tsx
git commit -m "fix: update Backlink Engine URL to backlinks.life-expat.com"
git push origin main

# 2. Déployer sur serveur
ssh root@89.167.26.169
cd /opt/backlink-engine
git pull origin main
docker compose down
docker compose up -d --build

# 3. Vérifier
docker ps
curl http://localhost/api/health
```

### Priorité 3 : Configuration post-déploiement
- [ ] Configurer MailWizz (optionnel)
  - Créer listes par langue
  - Mettre à jour `.env` avec les List UIDs
  - Tester en dry-run

- [ ] Monitoring (optionnel)
  - Créer cron job pour health check
  - Configurer alertes email

---

## 📊 RESSOURCES ACTUELLES

### Utilisation serveur CPX22
```
Container      RAM Usage    CPU Usage
───────────────────────────────────────
bl-postgres    ~500 MB      ~30%
bl-redis       ~100 MB      ~5%
bl-app         ~400 MB      ~15%
bl-nginx       ~30 MB       ~2%
───────────────────────────────────────
TOTAL          ~1.0 GB      ~52%
DISPONIBLE     4.0 GB       200% (2 vCPU)
───────────────────────────────────────
MARGE          75% RAM OK   74% CPU OK
```

### Espace disque
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        38G  8.2G   28G  23%  /
```

---

## 🎯 PROCHAINES ÉTAPES (après résolution 521)

1. **Tester API complète** :
   - Créer compte admin
   - Créer campagne test
   - Vérifier auto-enrollment

2. **Documentation** :
   - Guide d'utilisation API
   - Exemples cURL
   - Postman collection

3. **Scraper-Pro** (projet séparé) :
   - Déployer sur CPX31 (8GB RAM)
   - Domaine : `providers-expat.com`
   - Serveur dédié (séparé de Backlink-Engine)

---

## 📞 SUPPORT

### Commandes utiles

```bash
# Logs en temps réel
docker logs -f bl-app
docker logs -f bl-nginx

# Vérifier santé
curl http://localhost/api/health

# Stats containers
docker stats --no-stream

# Redémarrer service
docker restart bl-app

# Tout redémarrer
cd /opt/backlink-engine && docker compose restart

# Vérifier port 80
sudo lsof -i :80

# Vérifier processus nginx
ps aux | grep nginx
```

### Logs importants

```bash
# Application
docker logs bl-app --tail 100

# Nginx
docker logs bl-nginx --tail 50

# PostgreSQL
docker logs bl-postgres --tail 30

# Redis
docker logs bl-redis --tail 20
```

---

## ✅ CHECKLIST FINALE (après résolution 521)

- [ ] Cloudflare 521 résolu
- [ ] `https://backlinks.life-expat.com/api/health` retourne 200 OK
- [ ] Code commité et pushé sur GitHub (backlink-engine + sos)
- [ ] Déploiement serveur fait (`git pull` + `docker compose up -d`)
- [ ] 4 containers "Up" et "healthy"
- [ ] RAM < 2GB
- [ ] Compte admin créé
- [ ] Campagne test créée
- [ ] (Optionnel) MailWizz configuré
- [ ] (Optionnel) Monitoring configuré

---

**Backlink-Engine v0.1.0**
Déploiement sur `backlinks.life-expat.com` 🚀
Serveur : Hetzner CPX22 (89.167.26.169, Helsinki)
