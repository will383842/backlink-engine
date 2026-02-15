# 🚀 DÉPLOIEMENT PRODUCTION - GUIDE ÉTAPE PAR ÉTAPE
**Date** : 2026-02-15
**Objectif** : Mettre backlink-engine en production SUR https://backlinks.life-expat.com/
**Durée totale** : 30 minutes

---

## ✅ ÉTAPE 0 : PRÉREQUIS (2 min)

### Informations nécessaires :

```bash
# 1. IP Serveur Hetzner
IP_SERVEUR="VOTRE_IP_ICI"  # Ex: 95.217.123.456

# 2. Accès SSH
# User: root (par défaut Hetzner)
# Password ou clé SSH

# 3. Repo GitHub (optionnel)
# Si pas encore créé, on travaille en local
```

---

## 🔧 ÉTAPE 1 : CONNEXION SERVEUR (3 min)

### **1.1 Test connexion SSH**

```bash
# Remplacer IP_SERVEUR par votre IP
ssh root@IP_SERVEUR

# Si première connexion, accepter la clé SSH (yes)
```

**Si connexion OK** → Passez à l'étape 2
**Si erreur** → Vérifiez IP et credentials Hetzner

---

### **1.2 Vérifier système serveur**

```bash
# Une fois connecté en SSH
uname -a
# Attendu : Linux ... Debian/Ubuntu

cat /etc/os-release
# Attendu : Ubuntu 22.04 ou Debian 11+
```

---

## 🐳 ÉTAPE 2 : INSTALLER DOCKER (5 min)

### **2.1 Vérifier si Docker existe déjà**

```bash
docker --version
docker compose version

# Si les 2 commandes fonctionnent → Skip to ÉTAPE 3
# Sinon → Installer Docker ci-dessous
```

---

### **2.2 Installer Docker (si nécessaire)**

```bash
# Script d'installation automatique Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Vérifier installation
docker --version
# Attendu : Docker version 25.x.x

docker compose version
# Attendu : Docker Compose version v2.x.x
```

---

## 📦 ÉTAPE 3 : RÉCUPÉRER LE CODE (3 min)

### **Option A : Cloner depuis GitHub (Recommandé)**

```bash
# 1. Créer dossier app
mkdir -p /app
cd /app

# 2. Cloner repo
# Remplacer URL par votre repo GitHub
git clone https://github.com/VOTRE_USERNAME/backlink-engine.git .

# Si repo privé, authentifier :
git config --global credential.helper store
git clone https://github.com/VOTRE_USERNAME/backlink-engine.git .
# Entrer username + personal access token
```

---

### **Option B : Upload manuel depuis local (Alternatif)**

**Sur votre machine locale** :

```bash
# Compresser projet
cd C:/Users/willi/Documents/Projets/VS_CODE/sos-expat-project/backlink-engine
tar -czf backlink-engine.tar.gz .

# Upload vers serveur (remplacer IP_SERVEUR)
scp backlink-engine.tar.gz root@IP_SERVEUR:/root/
```

**Sur le serveur** :

```bash
# Décompresser
mkdir -p /app
cd /app
tar -xzf /root/backlink-engine.tar.gz
```

---

## 🔐 ÉTAPE 4 : CONFIGURATION PRODUCTION (2 min)

```bash
# Copier config production
cd /app
cp .env.production .env

# Vérifier que les secrets sont présents
cat .env | grep -E "(JWT_SECRET|POSTGRES_PASSWORD|REDIS_PASSWORD)"

# Attendu :
# JWT_SECRET=gcXTLQ57g49...
# POSTGRES_PASSWORD=WJullin1974/*%$
# REDIS_PASSWORD=KGJ0eDoPNNVfRj87...
```

---

## 🌐 ÉTAPE 5 : CERTIFICATS SSL CLOUDFLARE (10 min)

### **5.1 Générer certificat Cloudflare**

1. Aller sur https://dash.cloudflare.com
2. Sélectionner domaine **life-expat.com**
3. SSL/TLS → Origin Server
4. Cliquer **"Create Certificate"**
5. Hostname : `*.life-expat.com` + `life-expat.com`
6. Validity : **15 years**
7. Cliquer **"Create"**

**Résultat** : 2 fichiers texte générés

---

### **5.2 Installer certificats sur serveur**

**Sur serveur SSH** :

```bash
# Créer dossier SSL
mkdir -p /app/ssl

# Créer fichier certificat
nano /app/ssl/cloudflare-cert.pem
```

**Copier-coller le contenu** du certificat Cloudflare (commence par `-----BEGIN CERTIFICATE-----`)

Puis **Ctrl+X**, **Y**, **Enter** pour sauvegarder.

```bash
# Créer fichier clé privée
nano /app/ssl/cloudflare-key.pem
```

**Copier-coller le contenu** de la clé privée Cloudflare (commence par `-----BEGIN PRIVATE KEY-----`)

Puis **Ctrl+X**, **Y**, **Enter** pour sauvegarder.

```bash
# Sécuriser permissions
chmod 600 /app/ssl/*.pem

# Vérifier fichiers
ls -la /app/ssl/
# Attendu :
# -rw------- cloudflare-cert.pem
# -rw------- cloudflare-key.pem
```

---

### **5.3 Si pas de certificats SSL maintenant**

**Pas grave !** On peut déployer quand même :

```bash
# Modifier nginx.conf pour désactiver HTTPS temporairement
nano /app/deploy/nginx.conf

# Commenter les lignes SSL (lignes 25-96)
# Ou laisser tel quel, ça marchera en HTTP sur port 80
```

---

## 🚀 ÉTAPE 6 : DÉPLOIEMENT ! (5 min)

```bash
cd /app

# Rendre script exécutable
chmod +x deploy.sh

# LANCER LE DÉPLOIEMENT
./deploy.sh
```

**Le script va automatiquement** :
1. ✅ Vérifier prérequis
2. ✅ Build frontend (npm run build)
3. ✅ Build backend (tsc)
4. ✅ Docker Compose up -d --build
5. ✅ Migrations Prisma
6. ✅ Health checks
7. ✅ Afficher résultat

**Durée** : ~5 minutes

**Sortie attendue** :

```
🚀 Démarrage déploiement Backlink Engine...
📋 [1/8] Vérifications pré-déploiement...
✅ Vérifications OK

📦 [2/8] Mise à jour du code (git pull)...
✅ Code mis à jour

🎨 [3/8] Build frontend (Vite)...
✅ Frontend build réussi (dist/)

⚙️  [4/8] Build backend (TypeScript)...
✅ Backend build réussi (dist/)

🛑 [5/8] Arrêt containers actuels...
✅ Containers arrêtés

🐳 [6/8] Rebuild et démarrage Docker Compose...
✅ Containers démarrés

🗄️  [7/8] Application migrations Prisma...
✅ Migrations Prisma appliquées

🏥 [8/8] Vérifications de santé...
✅ Backend health check OK
✅ PostgreSQL OK
✅ Redis OK

🎉 ════════════════════════════════════════════════════════════════
🎉  DÉPLOIEMENT RÉUSSI !
🎉 ════════════════════════════════════════════════════════════════
```

---

## 👤 ÉTAPE 7 : CRÉER UTILISATEUR ADMIN (1 min)

```bash
# Créer compte admin
docker compose exec -T app node -e "
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

**Credentials Admin** :
- Email : `admin@life-expat.com`
- Password : `Admin123!`

---

## ✅ ÉTAPE 8 : TESTS DE VALIDATION (3 min)

### **8.1 Test Health Check**

```bash
curl https://backlinks.life-expat.com/api/health

# Attendu :
# {"status":"ok","timestamp":"2026-02-15T...","uptime":123}
```

**Si erreur 521** → Les containers ne sont pas démarrés, vérifier logs :

```bash
docker compose ps
docker compose logs app | tail -50
```

---

### **8.2 Test Login API**

```bash
curl -X POST https://backlinks.life-expat.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@life-expat.com",
    "password": "Admin123!"
  }'

# Attendu :
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{...}}
```

**Copier le token** pour le test suivant.

---

### **8.3 Test Ajouter Prospect**

```bash
# Remplacer YOUR_TOKEN par le token obtenu ci-dessus
curl -X POST https://backlinks.life-expat.com/api/prospects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "https://example.com/blog",
    "tier": 2,
    "source": "MANUAL",
    "notes": "Premier test production"
  }'

# Attendu :
# {"id":1,"url":"https://example.com/blog","status":"NEW",...}
```

---

### **8.4 Test Dashboard (Cache Redis)**

```bash
# 1er appel (MISS)
time curl https://backlinks.life-expat.com/api/dashboard/today \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2e appel (HIT - devrait être plus rapide)
time curl https://backlinks.life-expat.com/api/dashboard/today \
  -H "Authorization: Bearer YOUR_TOKEN"

# Vérifier logs cache
docker compose logs app | grep "Cache"
# Attendu :
# Cache MISS - computing... { key: 'dashboard:today' }
# Cache HIT { key: 'dashboard:today' }
```

---

### **8.5 Test Frontend Interface**

1. Ouvrir navigateur : https://backlinks.life-expat.com
2. Voir page de login
3. Se connecter : `admin@life-expat.com` / `Admin123!`
4. Vérifier dashboard s'affiche
5. Tester : Ajouter un prospect via interface

---

## 🎉 SUCCÈS ! PRODUCTION OPÉRATIONNELLE

Si tous les tests passent :

✅ **Backend API** : Opérationnel
✅ **Base de données** : Opérationnelle
✅ **Cache Redis** : Opérationnel
✅ **Frontend** : Opérationnel
✅ **HTTPS** : Opérationnel
✅ **Dashboard** : Opérationnel

**L'outil est 100% utilisable en production !** 🎯

---

## 🔧 TROUBLESHOOTING

### **Problème : "502 Bad Gateway"**

```bash
# Vérifier containers
docker compose ps

# Si app n'est pas "healthy"
docker compose logs app | tail -100

# Restart
docker compose restart app

# Si ça ne marche pas
docker compose down
docker compose up -d --build
```

---

### **Problème : "Prisma Client Not Generated"**

```bash
docker compose exec app npx prisma generate
docker compose restart app
```

---

### **Problème : "Cannot connect to database"**

```bash
# Vérifier PostgreSQL
docker compose logs postgres | tail -50

# Restart PostgreSQL
docker compose restart postgres

# Attendre 10s puis restart app
sleep 10
docker compose restart app
```

---

### **Problème : "Redis connection refused"**

```bash
# Vérifier Redis
docker compose logs redis | tail -50

# Restart Redis
docker compose restart redis
docker compose restart app
```

---

### **Problème : Frontend ne charge pas**

```bash
# Vérifier que dist/ existe dans container nginx
docker compose exec nginx ls -la /usr/share/nginx/html/

# Si vide, rebuild frontend
cd /app/frontend
npm run build
docker compose restart nginx
```

---

### **Problème : Certificat SSL invalide**

```bash
# Vérifier certificats
ls -la /app/ssl/

# Si manquants, voir ÉTAPE 5
# Ou désactiver temporairement HTTPS dans nginx.conf
```

---

## 📞 COMMANDES UTILES POST-DÉPLOIEMENT

```bash
# Logs temps réel
docker compose logs -f app

# Restart services
docker compose restart app

# Rebuild complet
docker compose down
docker compose up -d --build

# Prisma Studio (interface DB visuelle)
docker compose exec app npx prisma studio
# Accès : http://IP_SERVEUR:5555

# Shell dans container
docker compose exec app sh

# Vérifier ressources serveur
docker stats

# Nettoyer logs
docker system prune -f
```

---

## 🎯 CHECKLIST FINALE

Avant de déclarer "PRODUCTION READY" :

- [ ] Serveur Hetzner accessible (SSH OK)
- [ ] Docker + Docker Compose installés
- [ ] Code récupéré (/app existe)
- [ ] .env configuré avec secrets
- [ ] Certificats SSL installés (ou HTTP fonctionne)
- [ ] `./deploy.sh` exécuté sans erreur
- [ ] Containers démarrés (4 healthy)
- [ ] Utilisateur admin créé
- [ ] Health check répond 200
- [ ] Login API fonctionne
- [ ] Ajout prospect fonctionne
- [ ] Dashboard API fonctionne
- [ ] Cache Redis logs "HIT/MISS"
- [ ] Frontend accessible en HTTPS
- [ ] Login frontend OK
- [ ] Interface fonctionne

**Si toutes les cases cochées → 🎉 PRODUCTION OPÉRATIONNELLE !**

---

## 🚀 NEXT STEPS (Optionnel)

### **Activer MailWizz plus tard**

1. Créer 9 listes dans MailWizz (FR, EN, ES, DE, PT, RU, AR, ZH, HI)
2. Copier UIDs dans `.env`
3. Ajouter `MAILWIZZ_API_KEY`
4. Changer `MAILWIZZ_ENABLED=true`
5. Restart : `docker compose restart app`

### **Monitoring (Recommandé)**

```bash
# Installer Netdata (monitoring gratuit)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Accès : http://IP_SERVEUR:19999
```

### **Backups Automatiques**

```bash
# Créer script backup PostgreSQL
nano /root/backup.sh
```

Contenu :

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U backlink backlink_engine > /root/backups/db_$DATE.sql
```

```bash
chmod +x /root/backup.sh

# Cron quotidien 3h du matin
crontab -e
# Ajouter : 0 3 * * * /root/backup.sh
```

---

**DATE** : 2026-02-15
**STATUT** : ✅ GUIDE COMPLET PRODUCTION READY
**TEMPS ESTIMÉ** : 30 minutes total
