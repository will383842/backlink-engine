# Scripts de Migration - Backlink Engine

Scripts pour exécuter les migrations de base de données.

---

## 📋 Scripts Disponibles

### migrate.sh (Linux/Mac/WSL)

**Usage** :
```bash
cd backlink-engine
./scripts/migrations/migrate.sh
```

**Description** :
- Exécute les migrations Prisma en développement
- Vérifie que PostgreSQL est accessible
- Applique toutes les migrations pending

---

### migrate.bat (Windows)

**Usage** :
```batch
cd backlink-engine
scripts\migrations\migrate.bat
```

**Description** :
- Version Windows du script de migration
- Même fonctionnalité que migrate.sh
- Utilise les commandes Windows natives

---

### migrate-production.sh (Production)

**Usage** :
```bash
cd backlink-engine
./scripts/migrations/migrate-production.sh
```

**Description** :
- Exécute les migrations en production
- Utilise DATABASE_URL depuis .env.production
- Arrête les services avant migration
- Redémarre les services après migration

**⚠️ Attention** : À utiliser uniquement sur le serveur de production

---

### setup-db.sh (Setup Initial)

**Usage** :
```bash
cd backlink-engine
./scripts/migrations/setup-db.sh
```

**Description** :
- Setup initial de la base de données PostgreSQL
- Crée la base de données si elle n'existe pas
- Applique toutes les migrations
- Génère le client Prisma

**Utilisé pour** : Premier déploiement ou reset complet

---

## 🔄 Workflow de Migration

### En développement

```bash
# 1. Créer une migration
npm run db:migrate:dev

# OU utiliser le script
./scripts/migrations/migrate.sh
```

### En production

```bash
# 1. SSH sur le serveur
ssh root@backlinks.life-expat.com

# 2. Aller dans le dossier
cd /root/backlink-engine

# 3. Exécuter les migrations
./scripts/migrations/migrate-production.sh
```

---

## 📝 Migrations Existantes

| # | Migration | Date | Description |
|---|-----------|------|-------------|
| 1 | init | 2026-02-13 | Schema initial |
| 2 | add_language_country | 2026-02-14 | Ajout language/country/source |
| 3 | add_tags_system | 2026-02-14 | Système de tags complet |
| 4 | add_firstName_lastName | 2026-02-15 | firstName/lastName séparés |
| 5 | add_timezone | 2026-02-15 | Support 195 pays + timezones |

---

## 🆘 Troubleshooting

### "Cannot connect to database"

```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps

# Vérifier la DATABASE_URL dans .env
cat .env | grep DATABASE_URL
```

### "Migration failed"

```bash
# Voir les logs détaillés
npm run db:migrate:dev -- --create-only

# Reset complet (⚠️ PERTE DE DONNÉES)
npm run db:push -- --force-reset
```

### Permission denied

```bash
# Rendre le script exécutable
chmod +x scripts/migrations/migrate.sh
chmod +x scripts/migrations/migrate-production.sh
chmod +x scripts/migrations/setup-db.sh
```

---

**Dernière mise à jour** : 16 février 2026
