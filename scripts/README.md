# Scripts - Backlink Engine

Scripts utilitaires pour le projet.

---

## 📁 Structure

```
scripts/
├── migrations/          # Scripts de migration DB
│   ├── migrate.sh
│   ├── migrate.bat
│   ├── migrate-production.sh
│   └── setup-db.sh
└── archives/            # Anciens scripts (référence)
    ├── deploy.sh
    ├── check-server.sh
    ├── APPLIQUER-OPTIMISATIONS.sh
    ├── FIX-CLOUDFLARE-521.sh
    ├── FIX-EXPOSE-PORT-443.sh
    ├── FIX-PORT-80-CONFLICT.sh
    └── test-telegram.js
```

---

## 🔄 Scripts de Migration

### migrate.sh (Linux/Mac)

```bash
# Exécuter migrations en local
./scripts/migrations/migrate.sh
```

### migrate.bat (Windows)

```batch
# Exécuter migrations sur Windows
scripts\migrations\migrate.bat
```

### migrate-production.sh (Production)

```bash
# Exécuter migrations en production
./scripts/migrations/migrate-production.sh
```

### setup-db.sh (Setup initial)

```bash
# Setup initial de la base de données
./scripts/migrations/setup-db.sh
```

---

## 📦 Scripts Archivés

Ces scripts sont conservés pour référence mais ne sont plus utilisés :

- **deploy.sh** - Ancien script de déploiement (remplacé par docker-compose)
- **check-server.sh** - Vérification serveur (info utile conservée)
- **APPLIQUER-OPTIMISATIONS.sh** - Optimisations déjà appliquées
- **FIX-CLOUDFLARE-521.sh** - Fix Cloudflare 521 (problème résolu)
- **FIX-EXPOSE-PORT-443.sh** - Fix port 443 (problème résolu)
- **FIX-PORT-80-CONFLICT.sh** - Fix conflit port 80 (problème résolu)
- **test-telegram.js** - Tests Telegram (déjà effectués, voir docs/tests/)

---

## 🗑️ Fichiers Supprimés

Les fichiers suivants ont été supprimés car obsolètes :

- `all-templates-final.sql` - Déjà migré en base de données
- `all-templates-fixed.sql` - Doublon
- `all-templates-fixed2.sql` - Doublon
- `fix-enums.sql` - Déjà migré
- `docker-compose.optimized.yml` - Doublon du docker-compose.yml

---

## 📝 Notes

- Les scripts de migration sont les seuls scripts actifs
- Les scripts archivés peuvent être consultés pour référence
- Ne pas exécuter les scripts archivés (problèmes déjà résolus)

---

**Dernière mise à jour** : 16 février 2026
