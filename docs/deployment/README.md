# 📦 Deployment - Backlink Engine

Guides pour déployer Backlink Engine en production.

---

## 🚀 Guides Disponibles

### 1. [Production Guide](production-guide.md) ⭐ **GUIDE PRINCIPAL**

**Temps** : 30 minutes
**Pour** : DevOps, Développeurs

Guide complet étape par étape pour déployer en production.

**Contenu** :
- Préparation serveur (Hetzner CPX22)
- Installation PostgreSQL + Redis
- Configuration Nginx
- Déploiement Docker
- Configuration DNS
- SSL avec Certbot
- Cloudflare
- Tests de production

**Commencez par ce guide si vous déployez pour la première fois.**

---

### 2. [Checklist](checklist.md) ✅

**Temps** : 5 minutes
**Pour** : DevOps

Checklist rapide des vérifications pré-déploiement.

**Contenu** :
- ✅ DNS configuré
- ✅ SSL actif
- ✅ Cloudflare configuré
- ✅ Variables d'environnement
- ✅ Migrations DB
- ✅ Services démarrés
- ✅ Tests de fonctionnement

**Utilisez cette checklist avant chaque déploiement.**

---

### 3. [Migrations](migrations.md) 🔄

**Temps** : 10 minutes
**Pour** : Développeurs, DevOps

Exécution des migrations de base de données.

**Contenu** :
- 3 méthodes (Windows .bat, PowerShell, Bash)
- Migrations en local
- Migrations en production
- Rollback
- Troubleshooting

**À consulter avant chaque mise à jour de schéma.**

---

### 4. [CPX22 Setup](cpx22-setup.md) 🖥️

**Temps** : 15 minutes
**Pour** : DevOps

Configuration spécifique serveur Hetzner CPX22.

**Contenu** :
- Specs serveur (4 vCPU, 8 GB RAM)
- Verdict : CPX22 OK pour production
- 3 optimisations recommandées
- Monitoring ressources
- Décision domaine (life-expat.com)

**À consulter pour comprendre les choix d'infrastructure.**

---

## 📋 Workflow de Déploiement

### Premier déploiement (production vierge)

```bash
# 1. Lire la checklist
cat docs/deployment/checklist.md

# 2. Suivre le guide de production
cat docs/deployment/production-guide.md

# 3. Exécuter les migrations
npm run migrate:production

# 4. Démarrer les services
docker-compose up -d

# 5. Vérifier les logs
docker-compose logs -f
```

### Mise à jour (production existante)

```bash
# 1. Arrêter les services
docker-compose down

# 2. Pull dernières modifications
git pull origin main

# 3. Rebuild
docker-compose build

# 4. Exécuter migrations
npm run migrate:production

# 5. Redémarrer
docker-compose up -d

# 6. Vérifier
curl https://backlinks.life-expat.com/api/health
```

---

## 🎯 Déploiement par Environnement

### Local (dev)

```bash
npm run dev              # Backend :3000
cd frontend && npm run dev  # Frontend :5173
```

**Variables** : `.env` (copier de `.env.example`)

---

### Staging (optionnel)

Configuration identique à production mais avec :
- Base de données séparée
- Domaine staging.life-expat.com
- Variables `.env.staging`

---

### Production

```bash
docker-compose -f docker-compose.yml up -d
```

**Domaine** : https://backlinks.life-expat.com
**Variables** : `.env.production`

---

## ⚙️ Configuration Serveur

### Specs Recommandées

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disque | 40 GB SSD | 80 GB SSD |
| Bande passante | 10 TB | 20 TB |

**Serveur actuel** : Hetzner CPX22 (4 vCPU, 8 GB RAM, 80 GB SSD)

---

### Ports Requis

| Port | Service | Ouvert publiquement |
|------|---------|---------------------|
| 80 | HTTP (redirect) | ✅ Oui |
| 443 | HTTPS | ✅ Oui |
| 3000 | API Backend | ❌ Non (via Nginx) |
| 5432 | PostgreSQL | ❌ Non |
| 6379 | Redis | ❌ Non |

---

## 🔐 Sécurité

### Variables Sensibles

Ne JAMAIS commit :
- `.env`
- `.env.production`
- Clés API (OPENAI_API_KEY, MAILWIZZ_API_KEY)
- Mots de passe DB

**Utilisez** : Variables d'environnement serveur ou secrets manager

---

### SSL/TLS

- **Certificat** : Let's Encrypt (Certbot)
- **Renouvellement** : Automatique (cron)
- **Grade** : A+ (SSL Labs)

---

### Cloudflare

- **DNS** : Cloudflare nameservers
- **Proxy** : Orange cloud activé
- **SSL** : Full (strict)
- **Cache** : Désactivé pour API

---

## 📊 Monitoring

### Logs

```bash
# Logs Docker
docker-compose logs -f

# Logs Backend
docker-compose logs -f backend

# Logs Frontend
docker-compose logs -f frontend

# Logs Nginx
docker-compose logs -f nginx
```

---

### Healthcheck

```bash
curl https://backlinks.life-expat.com/api/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

---

### Notifications Telegram

Le système envoie des notifications automatiques :
- ✅ Déploiement réussi
- ❌ Erreurs critiques
- 📊 Statistiques journalières

---

## 🆘 Troubleshooting

### Erreur 502 Bad Gateway

**Cause** : Backend non démarré
**Solution** :
```bash
docker-compose restart backend
docker-compose logs -f backend
```

---

### Erreur 521 Cloudflare

**Cause** : Nginx non accessible
**Solution** : Voir [archives/guide-finalisation.md](../archives/guide-finalisation.md)

---

### Migration échouée

**Cause** : Schéma DB incompatible
**Solution** : Voir [migrations.md](migrations.md#rollback)

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Getting Started](../getting-started/)
- [Architecture](../architecture/)
- [Archives](../archives/)

---

**Dernière mise à jour** : 16 février 2026
**Serveur production** : Hetzner CPX22
**Domaine** : backlinks.life-expat.com
