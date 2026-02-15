# 🚀 Instructions de Migration - Backlink Engine

## ✅ 3 Méthodes pour Exécuter la Migration

### Méthode 1 : Script Automatique Windows (RECOMMANDÉ) ⭐

Double-cliquez sur le fichier :

```
migrate.bat
```

Le script va :
1. ✅ Vérifier que Docker est installé
2. ✅ Démarrer PostgreSQL si nécessaire
3. ✅ Exécuter la migration SQL
4. ✅ Vérifier les nouvelles colonnes
5. ✅ Redémarrer le worker d'enrichment

---

### Méthode 2 : PowerShell Manuel

Ouvrez PowerShell dans le dossier `backlink-engine`, puis :

```powershell
# 1. Démarrer PostgreSQL si nécessaire
docker compose up -d postgres

# 2. Attendre 10 secondes
Start-Sleep -Seconds 10

# 3. Exécuter la migration
Get-Content prisma\migrations\20260215_add_timezone_firstname_lastname\migration.sql | docker compose exec -T postgres psql -U backlink -d backlink_engine

# 4. Vérifier les colonnes
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('prospects', 'contacts') AND column_name IN ('timezone', 'firstName', 'lastName');"

# 5. Redémarrer worker
docker compose restart worker-enrichment
```

---

### Méthode 3 : Git Bash / WSL

Ouvrez Git Bash ou WSL dans le dossier `backlink-engine`, puis :

```bash
# Option A : Utiliser le script bash
chmod +x migrate.sh
./migrate.sh

# Option B : Commandes manuelles
docker compose up -d postgres
sleep 10
docker compose exec -T postgres psql -U backlink -d backlink_engine < prisma/migrations/20260215_add_timezone_firstname_lastname/migration.sql
docker compose restart worker-enrichment
```

---

## 🔍 Vérification Post-Migration

### 1. Vérifier les Colonnes Créées

```bash
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('prospects', 'contacts')
  AND column_name IN ('timezone', 'firstName', 'lastName')
ORDER BY table_name, column_name;
"
```

**Résultat attendu :**

```
 table_name | column_name | data_type | is_nullable
------------+-------------+-----------+-------------
 contacts   | firstName   | text      | YES
 contacts   | lastName    | text      | YES
 prospects  | timezone    | varchar   | YES
```

### 2. Vérifier l'Enum EmailStatus

```bash
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmailStatus')
ORDER BY enumlabel;
"
```

**Résultat attendu :**

```
 enumlabel
-----------
 disposable  ← NOUVEAU
 invalid
 risky       ← NOUVEAU
 role        ← NOUVEAU
 unverified
 verified
```

### 3. Tester Migration Données Existantes

```bash
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT name, \"firstName\", \"lastName\"
FROM contacts
WHERE name IS NOT NULL
LIMIT 5;
"
```

Si vous aviez des contacts avec `name` = "Jean Dupont", vous devriez voir :

```
     name     | firstName | lastName
--------------+-----------+----------
 Jean Dupont  | Jean      | Dupont
```

---

## 🧪 Tests Post-Migration

### Test 1 : Ajout Prospect avec firstName/lastName

```bash
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://test-migration.fr",
    "email": "contact@test-migration.fr",
    "firstName": "Marie",
    "lastName": "Curie"
  }'
```

**Résultat attendu :** 201 Created

### Test 2 : Email Disposable (doit être marqué "disposable")

```bash
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example-temp.com",
    "email": "test@10minutemail.com",
    "firstName": "Test"
  }'
```

Vérifier que `emailStatus = "disposable"` :

```bash
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT email, \"emailStatus\" FROM contacts WHERE email LIKE '%10minutemail%';
"
```

### Test 3 : Timezone Auto-détecté

```bash
# 1. Ajouter un prospect français
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://blog-france.fr",
    "email": "contact@blog-france.fr"
  }'

# 2. Attendre 30-60 secondes (enrichment worker)
sleep 60

# 3. Vérifier timezone
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT domain, country, timezone FROM prospects WHERE domain = 'blog-france.fr';
"
```

**Résultat attendu :**

```
     domain      | country |   timezone
-----------------+---------+--------------
 blog-france.fr  | FR      | Europe/Paris
```

### Test 4 : Message 409 en Français

```bash
# 1. Ajouter un prospect
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{"url": "https://duplicate-test.com", "email": "test@duplicate-test.com"}'

# 2. Réessayer le même domaine
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{"url": "https://duplicate-test.com/autre-page", "email": "autre@duplicate-test.com"}'
```

**Résultat attendu :**

```json
{
  "statusCode": 409,
  "error": "Duplicate",
  "message": "Ce domaine existe déjà : duplicate-test.com (ajouté le 15/02/2026, 1 contact)"
}
```

---

## ❌ En Cas d'Erreur

### Erreur : "relation already exists"

Si vous voyez :

```
ERROR:  relation "contacts_firstName_idx" already exists
```

C'est OK ! La migration utilise `IF NOT EXISTS`, donc les colonnes déjà créées sont ignorées.

### Erreur : "enum label already exists"

Si vous voyez :

```
ERROR:  enum label "risky" already exists
```

C'est OK ! La migration utilise `ADD VALUE IF NOT EXISTS`.

### PostgreSQL ne démarre pas

```bash
# Voir les logs
docker compose logs postgres

# Redémarrer complètement
docker compose down
docker compose up -d postgres
```

### Worker ne redémarre pas

```bash
# Vérifier si le worker existe
docker compose ps

# Si worker-enrichment n'existe pas, c'est normal
# Il démarrera lors du prochain "docker compose up -d"
```

---

## 📊 Statistiques Post-Migration

Après migration, exécutez ces requêtes pour voir les données :

```bash
# Nouveaux contacts des 7 derniers jours par type
docker compose exec -T postgres psql -U backlink -d backlink_engine -c "
SELECT
  DATE(\"createdAt\") AS date,
  COUNT(*) AS total,
  COUNT(CASE WHEN \"emailStatus\" = 'verified' THEN 1 END) AS verified,
  COUNT(CASE WHEN \"emailStatus\" = 'risky' THEN 1 END) AS risky,
  COUNT(CASE WHEN \"emailStatus\" = 'invalid' THEN 1 END) AS invalid,
  COUNT(CASE WHEN \"emailStatus\" = 'disposable' THEN 1 END) AS disposable,
  COUNT(CASE WHEN \"emailStatus\" = 'role' THEN 1 END) AS role
FROM contacts
WHERE \"createdAt\" >= NOW() - INTERVAL '7 days'
GROUP BY DATE(\"createdAt\")
ORDER BY date DESC;
"
```

---

## ✅ Checklist Finale

- [ ] Migration SQL exécutée sans erreur
- [ ] Colonnes `timezone`, `firstName`, `lastName` créées
- [ ] Enum `EmailStatus` étendu avec `risky`, `disposable`, `role`
- [ ] Données existantes migrées (name → firstName/lastName)
- [ ] Worker enrichment redémarré
- [ ] Test ajout prospect avec firstName/lastName → OK
- [ ] Test email disposable → status = "disposable"
- [ ] Test timezone auto-détecté → timezone = "Europe/Paris" pour .fr
- [ ] Test message 409 en français → "Ce domaine existe déjà..."

---

**Date :** 2026-02-15
**Version :** Backlink Engine v2.1.0
**Status :** Prêt pour production 🚀
