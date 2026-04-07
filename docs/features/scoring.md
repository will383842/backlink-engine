# 📊 Backlink Engine - Scoring, Anti-Doublon & Statistiques

## 🎯 1. Calcul du Score d'Autorité (0-100)

### Formule Complète

Le **score composite** (0-100) est calculé avec 6 composantes :

```
Score Total = PageRank + MozDA + Neighborhood + Relevance + Tier + Social
```

### Détail des Composantes

| Composante | Poids Max | Source | Calcul |
|------------|-----------|--------|--------|
| **Open PageRank** | 40 pts | API Open PageRank (échelle 0-10) | `(PageRank / 10) × 40` |
| **Moz DA** | 10 pts | API Moz (échelle 0-100) | `(DA / 100) × 10` |
| **Neighborhood** | 20 pts | Analyse liens sortants | `(Cleanliness / 100) × 20` |
| **Relevance** | 15 pts | Analyse contenu/keywords | `(Relevance / 100) × 15` |
| **Tier Bonus** | 10 pts | Tier du prospect | T1=10, T2=5, T3=2, T4=0 |
| **Social** | 5 pts | Présence réseaux sociaux | 5 si présent, 0 sinon |
| **TOTAL** | **100 pts** | | Cap à 100 maximum |

### Exemples Réels

#### Exemple 1 : Site Premium (Score 85)
```
Open PageRank    : 8.5/10  → (8.5/10) × 40 = 34 pts
Moz DA           : 65/100  → (65/100) × 10 = 6.5 pts
Neighborhood     : 90/100  → (90/100) × 20 = 18 pts
Relevance        : 80/100  → (80/100) × 15 = 12 pts
Tier             : 1       → 10 pts
Social           : Oui     → 5 pts
────────────────────────────────────────────────
TOTAL                      → 85.5 pts (arrondi 85)
```

#### Exemple 2 : Site Moyen (Score 45)
```
Open PageRank    : 3.0/10  → (3.0/10) × 40 = 12 pts
Moz DA           : 35/100  → (35/100) × 10 = 3.5 pts
Neighborhood     : 70/100  → (70/100) × 20 = 14 pts
Relevance        : 60/100  → (60/100) × 15 = 9 pts
Tier             : 2       → 5 pts
Social           : Non     → 0 pts
────────────────────────────────────────────────
TOTAL                      → 43.5 pts (arrondi 44)
```

#### Exemple 3 : Site Faible (Score 18)
```
Open PageRank    : 0.5/10  → (0.5/10) × 40 = 2 pts
Moz DA           : 15/100  → (15/100) × 10 = 1.5 pts
Neighborhood     : 50/100  → (50/100) × 20 = 10 pts
Relevance        : 40/100  → (40/100) × 15 = 6 pts
Tier             : 4       → 0 pts
Social           : Non     → 0 pts
────────────────────────────────────────────────
TOTAL                      → 19.5 pts (arrondi 20)
```

### Attribution du Tier (Niveau)

Le **tier** est calculé AVANT le score final, basé sur un score préliminaire :

```typescript
// Calcul tier (dans enrichmentWorker.ts)
let preliminaryScore = 0;

// PageRank contribue jusqu'à 40 pts
if (openPageRank !== null) {
  preliminaryScore += Math.min(openPageRank, 10) * 4;
}

// Moz DA contribue jusqu'à 40 pts
if (mozDa !== null) {
  preliminaryScore += (mozDa / 100) * 40;
}

// Fallback si pas de données
if (preliminaryScore === 0) {
  preliminaryScore = 25; // Score par défaut
}

// Bonus formulaire de contact
if (contactFormUrl) {
  preliminaryScore += 10;
}

// Pénalité spam
preliminaryScore -= spamScore;

// Attribution tier
if (preliminaryScore >= 70)      tier = 1; // Premium
else if (preliminaryScore >= 40) tier = 2; // Bon
else if (preliminaryScore >= 20) tier = 3; // Moyen
else                             tier = 4; // Faible
```

### Pénalité Spam

La **pénalité spam** est soustraite du score final :

| Source | Pénalité |
|--------|----------|
| Google Safe Browsing (flagged) | -100 pts (invalide le prospect) |
| Pas de flagging | 0 pts |

---

## 🛡️ 2. Anti-Doublon de Domaine

### Comment ça fonctionne ?

1. **Extraction du domaine** : `https://blog.example.com/page` → `example.com`
2. **Normalisation** : Suppression `www.`, `http://`, trailing slashes
3. **Vérification unicité** : Colonne `domain` avec contrainte `UNIQUE` en base
4. **Réponse 409** si domaine existe déjà

### Code Anti-Doublon

```typescript
// Dans ingestService.ts
const domain = extractDomain(data.url); // "example.com"

// Vérification existence
const existing = await prisma.prospect.findUnique({
  where: { domain },
});

if (existing) {
  // DOUBLON DÉTECTÉ
  // Mais on ajoute quand même la source URL si nouvelle
  const existingUrl = await prisma.sourceUrl.findUnique({
    where: { urlNormalized: normalized },
  });

  if (!existingUrl) {
    await prisma.sourceUrl.create({
      data: {
        prospectId: existing.id,
        url: data.url,
        urlNormalized: normalized,
      },
    });
  }

  return { status: "duplicate", prospectId: existing.id };
}
```

### Comportement Intelligent

| Scénario | Résultat | Action |
|----------|----------|--------|
| Nouveau domaine | ✅ 201 Created | Crée prospect + source URL |
| Domaine existant, URL identique | ⚠️ 409 Conflict | Retourne prospect existant |
| Domaine existant, **URL différente** | ⚠️ 409 Conflict + **Ajout SourceUrl** | Ajoute nouvelle URL au prospect |

**Exemple :**
```
1. POST /api/prospects { url: "https://example.com/blog" }
   → 201 Created (prospect ID 123)

2. POST /api/prospects { url: "https://example.com/about" }
   → 409 Conflict (prospect ID 123)
   → Mais SourceUrl "https://example.com/about" est ajoutée !

3. POST /api/prospects { url: "https://example.com/blog" }
   → 409 Conflict (prospect ID 123)
   → Aucune action (URL déjà existe)
```

### Erreur 409 - C'est NORMAL ! ✅

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Prospect already exists for this domain",
  "data": {
    "id": 123,
    "domain": "example.com",
    "status": "READY_TO_CONTACT",
    "contacts": [...],
    "sourceUrls": [...]
  }
}
```

**Signification :** Le domaine existe déjà. Ce n'est **PAS une erreur**, c'est la protection anti-doublon qui fonctionne !

---

## 📈 3. Statistiques - Nouveaux Contacts

### Requêtes SQL Prêtes à l'Emploi

#### 📅 Par Jour (7 derniers jours)

```sql
-- Nouveaux contacts par jour
SELECT
  DATE("createdAt") AS date,
  COUNT(*) AS total,
  COUNT(CASE WHEN "emailStatus" = 'verified' THEN 1 END) AS verified,
  COUNT(CASE WHEN "emailStatus" = 'risky' THEN 1 END) AS risky,
  COUNT(CASE WHEN "emailStatus" = 'invalid' THEN 1 END) AS invalid,
  COUNT(CASE WHEN "emailStatus" = 'disposable' THEN 1 END) AS disposable,
  COUNT(CASE WHEN "emailStatus" = 'role' THEN 1 END) AS role,
  COUNT(CASE WHEN "emailStatus" = 'unverified' THEN 1 END) AS unverified
FROM contacts
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("createdAt")
ORDER BY date DESC;
```

#### 📊 Par Semaine (4 dernières semaines)

```sql
-- Nouveaux contacts par semaine
SELECT
  DATE_TRUNC('week', "createdAt") AS semaine,
  COUNT(*) AS total,
  COUNT(CASE WHEN "emailStatus" = 'verified' THEN 1 END) AS verified,
  COUNT(CASE WHEN "emailStatus" = 'risky' THEN 1 END) AS risky,
  COUNT(CASE WHEN "emailStatus" = 'invalid' THEN 1 END) AS invalid
FROM contacts
WHERE "createdAt" >= NOW() - INTERVAL '4 weeks'
GROUP BY DATE_TRUNC('week', "createdAt")
ORDER BY semaine DESC;
```

#### 📆 Par Mois (6 derniers mois)

```sql
-- Nouveaux contacts par mois
SELECT
  TO_CHAR("createdAt", 'YYYY-MM') AS mois,
  COUNT(*) AS total,
  COUNT(CASE WHEN "emailStatus" = 'verified' THEN 1 END) AS verified,
  COUNT(CASE WHEN "emailStatus" = 'risky' THEN 1 END) AS risky,
  COUNT(CASE WHEN "emailStatus" = 'invalid' THEN 1 END) AS invalid,
  COUNT(CASE WHEN "emailStatus" = 'disposable' THEN 1 END) AS disposable,
  COUNT(CASE WHEN "emailStatus" = 'role' THEN 1 END) AS role
FROM contacts
WHERE "createdAt" >= NOW() - INTERVAL '6 months'
GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
ORDER BY mois DESC;
```

#### 🏷️ Par Type d'Email (Tous)

```sql
-- Répartition par type d'email
SELECT
  "emailStatus",
  COUNT(*) AS total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pourcentage
FROM contacts
GROUP BY "emailStatus"
ORDER BY total DESC;
```

#### 📍 Par Pays (Top 10)

```sql
-- Nouveaux prospects par pays (7 derniers jours)
SELECT
  p.country,
  COUNT(DISTINCT p.id) AS prospects,
  COUNT(c.id) AS contacts,
  ROUND(AVG(p.score), 1) AS score_moyen
FROM prospects p
LEFT JOIN contacts c ON p.id = c."prospectId"
WHERE p."createdAt" >= NOW() - INTERVAL '7 days'
  AND p.country IS NOT NULL
GROUP BY p.country
ORDER BY prospects DESC
LIMIT 10;
```

#### 🎯 Par Catégorie (Blogger, Influencer, etc.)

```sql
-- Nouveaux prospects par catégorie (30 derniers jours)
SELECT
  category,
  COUNT(*) AS total,
  COUNT(CASE WHEN tier = 1 THEN 1 END) AS tier1,
  COUNT(CASE WHEN tier = 2 THEN 1 END) AS tier2,
  COUNT(CASE WHEN tier = 3 THEN 1 END) AS tier3,
  COUNT(CASE WHEN tier = 4 THEN 1 END) AS tier4,
  ROUND(AVG(score), 1) AS score_moyen
FROM prospects
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY total DESC;
```

#### 📊 Dashboard Complet (Aujourd'hui vs Hier)

```sql
-- Comparaison aujourd'hui vs hier
WITH today AS (
  SELECT COUNT(*) AS contacts FROM contacts WHERE DATE("createdAt") = CURRENT_DATE
),
yesterday AS (
  SELECT COUNT(*) AS contacts FROM contacts WHERE DATE("createdAt") = CURRENT_DATE - 1
)
SELECT
  today.contacts AS aujourdhui,
  yesterday.contacts AS hier,
  today.contacts - yesterday.contacts AS difference,
  ROUND((today.contacts - yesterday.contacts) * 100.0 / NULLIF(yesterday.contacts, 0), 1) AS evolution_pct
FROM today, yesterday;
```

### Commande Docker pour Exécuter

```bash
# Connexion PostgreSQL
docker compose exec postgres psql -U backlink -d backlink_engine

# Ou directement depuis le terminal
docker compose exec -T postgres psql -U backlink -d backlink_engine << 'EOF'
-- Collez votre requête SQL ici
SELECT
  DATE("createdAt") AS date,
  COUNT(*) AS total
FROM contacts
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("createdAt")
ORDER BY date DESC;
EOF
```

---

## 📅 4. Date de Rajout (createdAt)

Tous les modèles ont automatiquement un champ **`createdAt`** :

```typescript
// Prisma Schema
model Prospect {
  createdAt  DateTime  @default(now())  // Date d'ajout automatique
  updatedAt  DateTime  @updatedAt       // Date de dernière MAJ
}

model Contact {
  createdAt  DateTime  @default(now())
}

model Event {
  createdAt  DateTime  @default(now())
}
```

### Requête pour voir les dates

```sql
-- Voir les 20 derniers prospects ajoutés avec date
SELECT
  id,
  domain,
  category,
  score,
  tier,
  "createdAt",
  status
FROM prospects
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## 🔍 5. Vérification Anti-Doublon

### Test Manuel

```bash
# Test 1 : Ajouter un nouveau prospect
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://test-unique-2026.com/blog",
    "email": "contact@test-unique-2026.com",
    "firstName": "Test",
    "lastName": "User"
  }'

# Résultat attendu : 201 Created

# Test 2 : Réessayer le même domaine
curl -X POST http://localhost:4000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://test-unique-2026.com/autre-page",
    "email": "contact@test-unique-2026.com"
  }'

# Résultat attendu : 409 Conflict
# Mais SourceUrl "https://test-unique-2026.com/autre-page" sera ajoutée !
```

### Vérification en Base

```sql
-- Vérifier qu'il n'y a pas de doublons
SELECT
  domain,
  COUNT(*) AS count
FROM prospects
GROUP BY domain
HAVING COUNT(*) > 1;

-- Si vide → Pas de doublons ✅
```

---

## 📌 Résumé Rapide

| Question | Réponse |
|----------|---------|
| **Comment est calculé le score ?** | Score = PageRank (40pts) + MozDA (10pts) + Neighborhood (20pts) + Relevance (15pts) + Tier (10pts) + Social (5pts) |
| **Qu'est-ce que le tier ?** | Niveau qualité : T1=Premium (≥70), T2=Bon (≥40), T3=Moyen (≥20), T4=Faible (<20) |
| **L'anti-doublon fonctionne ?** | ✅ OUI ! Erreur 409 = domaine existe déjà (c'est normal) |
| **Doublons possibles ?** | ❌ NON ! Contrainte UNIQUE sur `domain` en base |
| **Statistiques contacts ?** | Voir requêtes SQL ci-dessus (par jour/semaine/mois/type) |
| **Date d'ajout ?** | Champ `createdAt` automatique sur tous les modèles |
| **Que faire si 409 ?** | Normal ! Le domaine existe. Frontend peut afficher les données existantes |

---

## 🎯 Recommandations Frontend

Pour gérer le 409 Conflict côté React :

```typescript
// Dans votre mutation React Query
const addProspect = useMutation({
  mutationFn: async (data) => {
    const response = await fetch('/api/prospects', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.status === 409) {
      const conflict = await response.json();
      // Afficher message : "Ce domaine existe déjà (ajouté le XX/XX/XXXX)"
      // Proposer d'ouvrir la fiche existante
      toast.warning(`Domaine déjà existant : ${conflict.data.domain}`);
      return conflict.data; // Retourner les données existantes
    }

    if (!response.ok) throw new Error('Erreur ajout');
    return response.json();
  },
});
```

---

**Date :** 2026-02-15
**Version :** Backlink Engine v2.1.0
