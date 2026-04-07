# 🏷️ Système de Tags - Guide Complet

## 📋 Vue d'Ensemble

Le système de tags permet de **catégoriser finement** les prospects avec plusieurs tags simultanés. C'est plus flexible que le champ `category` (une seule valeur).

### Pourquoi dans Backlink Engine et pas MailWizz ?

| Critère | Backlink Engine | MailWizz |
|---------|-----------------|----------|
| **Filtrage avant envoi** | ✅ Sélectionner prospects par tags | ❌ Listes déjà envoyées |
| **Multi-tags** | ✅ Un prospect = plusieurs tags | ⚠️ Une liste à la fois |
| **Auto-détection** | ✅ Enrichissement automatique | ❌ Manuel uniquement |
| **Flexibilité** | ✅ Tags évolutifs, ajout facile | ⚠️ Listes fixes |
| **Granularité** | ✅ Très fine (`assurance` + `france` + `premium`) | ⚠️ Grossière |

---

## 🎯 Catégories de Tags

### 1. **TYPE** (Type de site)

| Tag | Label | Auto-détection |
|-----|-------|----------------|
| `presse_ecrite` | Presse Écrite | Domain contient: journal, presse, news, magazine |
| `blogueur` | Blogueur | Domain contient: blog, blogger |
| `influenceur` | Influenceur | Category = influencer OU contenu avec Instagram/YouTube/TikTok |
| `media` | Média | Category = media OU domain contient: tv, radio |

### 2. **SECTOR** (Secteur d'activité)

| Tag | Label | Auto-détection |
|-----|-------|----------------|
| `assurance` | Assurance | Domain/contenu: assurance, insurance, mutuelle |
| `finance` | Finance | Domain/contenu: banque, finance, crédit, investissement |
| `voyage` | Voyage | Domain/contenu: voyage, travel, tourisme, vacances |
| `tech` | Tech | Domain/contenu: tech, technologie, digital, software |
| `sante` | Santé | Domain/contenu: santé, health, médical, hopital |
| `immobilier` | Immobilier | Domain/contenu: immobilier, immo, real estate |
| `education` | Éducation | Domain/contenu: education, école, université, formation |

### 3. **QUALITY** (Qualité)

| Tag | Label | Auto-détection |
|-----|-------|----------------|
| `premium` | Premium | Tier = 1 |
| `high_authority` | Haute Autorité | Score ≥ 80 |
| `verified` | Vérifié | Email vérifié + Score ≥ 50 |

### 4. **GEOGRAPHY** (Géographie)

| Tag | Label | Auto-détection |
|-----|-------|----------------|
| `france` | France | Country = FR |
| `europe` | Europe | Country dans liste pays européens |
| `international` | International | Domain contient "international" OU multi-langues |

---

## 🔄 Auto-Détection (Enrichissement)

### Comment ça fonctionne ?

Lors de l'enrichissement automatique, le système analyse :
1. **Domain** : `blog-assurance.fr`
2. **Content** : Contenu de la page (si disponible)
3. **Metadata** : Category, tier, score, country, hasVerifiedEmail

Et applique les **règles de détection** :

```typescript
// Exemple : Détection "assurance"
{
  tagName: "assurance",
  category: "sector",
  detect: (domain, content) => {
    const keywords = ["assurance", "insurance", "mutuelle"];
    const domainMatch = keywords.some(k => domain.toLowerCase().includes(k));
    const contentMatch = content ? keywords.some(k => content.toLowerCase().includes(k)) : false;
    return domainMatch || contentMatch;
  }
}
```

### Exemple Concret

**Prospect :** `https://blog-assurance-voyage.fr`

**Auto-détection :**
1. ✅ `blogueur` (domain contient "blog")
2. ✅ `assurance` (domain contient "assurance")
3. ✅ `voyage` (domain contient "voyage")
4. ✅ `france` (country = "FR")
5. ✅ `premium` (tier = 1, si score élevé)

**Résultat :** 5 tags assignés automatiquement !

---

## 📊 Utilisation des Tags

### 1. Filtrage pour Campagne MailWizz

```typescript
// Récupérer prospects avec tags spécifiques
const prospects = await prisma.prospect.findMany({
  where: {
    AND: [
      // Tag "assurance" ET "france"
      { tags: { some: { tag: { name: "assurance" } } } },
      { tags: { some: { tag: { name: "france" } } } },
      // Exclusion "premium" (déjà contactés)
      { tags: { none: { tag: { name: "premium" } } } },
    ],
  },
  include: {
    contacts: true,
    tags: { include: { tag: true } },
  },
});

// Export vers MailWizz
for (const prospect of prospects) {
  await mailwizz.addSubscriber({
    EMAIL: prospect.contacts[0]?.email,
    TAGS: prospect.tags.map(t => t.tag.name).join(','),
    // ... autres champs
  });
}
```

### 2. Dashboard Statistiques

```sql
-- Prospects par tag (Top 10)
SELECT
  t.label,
  COUNT(pt."prospectId") AS total,
  AVG(p.score) AS score_moyen
FROM tags t
JOIN prospect_tags pt ON t.id = pt."tagId"
JOIN prospects p ON p.id = pt."prospectId"
GROUP BY t.id, t.label
ORDER BY total DESC
LIMIT 10;
```

### 3. Segmentation Avancée

```sql
-- Prospects premium français dans l'assurance
SELECT p.domain, p.score, p.tier
FROM prospects p
WHERE EXISTS (
  SELECT 1 FROM prospect_tags pt
  JOIN tags t ON t.id = pt."tagId"
  WHERE pt."prospectId" = p.id
    AND t.name IN ('assurance', 'france', 'premium')
);
```

---

## 🛠️ API (à venir)

### Endpoints Prévus

```typescript
// Lister tous les tags
GET /api/tags
→ [ { id: 1, name: "assurance", label: "Assurance", category: "sector", ... } ]

// Assigner un tag manuellement
POST /api/prospects/:id/tags
Body: { tagId: 5 }

// Retirer un tag
DELETE /api/prospects/:id/tags/:tagId

// Créer un tag personnalisé
POST /api/tags
Body: { name: "partenaire_vip", label: "Partenaire VIP", category: "quality", color: "#FF0000" }
```

---

## 🎨 Couleurs par Catégorie

| Catégorie | Couleur | Hexa |
|-----------|---------|------|
| **TYPE** | Bleu | `#3B82F6` |
| **SECTOR** | Vert | `#10B981` |
| **QUALITY** | Ambre | `#F59E0B` |
| **GEOGRAPHY** | Violet | `#8B5CF6` |
| **SOURCE** | Gris | `#6B7280` |
| **OTHER** | Gris | `#6B7280` |

---

## 📝 Ajouter un Nouveau Tag (Développeur)

### 1. Ajouter la règle dans `tagDetector.ts`

```typescript
{
  tagName: "startup",
  category: "type",
  detect: (domain, content) => {
    const keywords = ["startup", "start-up", "entrepreneur"];
    return keywords.some(k => domain.toLowerCase().includes(k));
  },
}
```

### 2. Insérer en base (migration ou SQL direct)

```sql
INSERT INTO tags (name, label, description, color, category, "isAutoTag")
VALUES ('startup', 'Startup', 'Startups et entrepreneurs', '#3B82F6', 'type', true);
```

### 3. Redémarrer le worker d'enrichissement

```bash
docker compose restart worker-enrichment
```

---

## 🔍 Vérifications

### Voir les tags d'un prospect

```sql
SELECT
  p.domain,
  t.label AS tag,
  t.category,
  pt."assignedBy"
FROM prospects p
JOIN prospect_tags pt ON p.id = pt."prospectId"
JOIN tags t ON t.id = pt."tagId"
WHERE p.id = 123
ORDER BY t.category, t.label;
```

### Compter les tags auto vs manuels

```sql
SELECT
  "assignedBy",
  COUNT(*) AS total
FROM prospect_tags
GROUP BY "assignedBy"
ORDER BY total DESC;
```

---

## 📈 Cas d'Usage Avancés

### 1. Campagne Ciblée "Assurance France Premium"

```typescript
// Filtrer prospects pour campagne spécifique
const targets = await prisma.prospect.findMany({
  where: {
    tags: {
      some: {
        tag: {
          name: { in: ['assurance', 'france', 'premium'] }
        }
      }
    },
    status: 'READY_TO_CONTACT',
  },
});

// Envoyer à MailWizz liste "Assurance_FR_Premium"
```

### 2. Exclusion des Déjà Contactés

```typescript
// Exclure prospects avec tag "contacted_2026"
const prospects = await prisma.prospect.findMany({
  where: {
    tags: {
      none: { tag: { name: 'contacted_2026' } }
    }
  },
});
```

### 3. Scoring Pondéré par Tags

```typescript
// Bonus de score si tag "premium" + "verified"
const hasPremiumTag = prospect.tags.some(t => t.tag.name === 'premium');
const hasVerifiedTag = prospect.tags.some(t => t.tag.name === 'verified');

let bonusScore = 0;
if (hasPremiumTag) bonusScore += 10;
if (hasVerifiedTag) bonusScore += 5;

const finalScore = prospect.score + bonusScore;
```

---

## 🚀 Prochaines Étapes

### Phase 1 : Auto-Détection (✅ FAIT)
- ✅ Modèles Prisma Tag + ProspectTag
- ✅ Service `tagDetector.ts`
- ✅ Intégration dans `enrichmentWorker.ts`
- ✅ 17 tags par défaut
- ✅ Migration SQL

### Phase 2 : API Manuel (À FAIRE)
- [ ] Routes CRUD pour tags
- [ ] Endpoints pour assigner/retirer tags
- [ ] Validation et permissions

### Phase 3 : UI Frontend (À FAIRE)
- [ ] Composant Tag Badge avec couleurs
- [ ] Multi-select tags dans formulaire d'ajout
- [ ] Filtres par tags dans liste prospects
- [ ] Dashboard stats par tags

### Phase 4 : MailWizz Integration (À FAIRE)
- [ ] Export tags vers custom field TAGS
- [ ] Import tags depuis MailWizz (optionnel)
- [ ] Sync bidirectionnelle

---

## 📋 Checklist Migration

- [ ] Exécuter `prisma/migrations/20260215_add_tags_system/migration.sql`
- [ ] Vérifier création tables `tags` et `prospect_tags`
- [ ] Vérifier insertion 17 tags par défaut
- [ ] Redémarrer worker enrichment
- [ ] Tester auto-détection sur nouveau prospect
- [ ] Vérifier logs `Auto-assigned X tags`

---

## 🎯 Résumé

| Aspect | Détail |
|--------|--------|
| **Tables** | `tags`, `prospect_tags` (many-to-many) |
| **Tags par défaut** | 17 (4 types, 7 sectors, 3 quality, 3 geography) |
| **Auto-détection** | Lors de l'enrichissement automatique |
| **Assignation manuelle** | Via API (à venir) |
| **Usage principal** | Filtrage avancé pour campagnes MailWizz |
| **Avantage clé** | Multi-tagging (plusieurs tags par prospect) |

---

**Date :** 2026-02-15
**Version :** Backlink Engine v2.2.0 (avec Tags)
**Status :** Auto-détection ✅ | API manuel ⏳ | UI ⏳
