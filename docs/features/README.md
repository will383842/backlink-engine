# 🏷️ Features - Backlink Engine

Documentation des fonctionnalités spécifiques de Backlink Engine.

---

## 📚 Guides Disponibles

### 1. [Tags System](tags-system.md) 🏷️

**Pour** : Développeurs, Product Managers

Système de tags hiérarchique pour classifier les prospects.

**Contenu** :
- **4 hiérarchies** : TYPE, SECTOR, QUALITY, GEOGRAPHY
- **API complète** : GET/POST/PATCH/DELETE
- **Assignation** : À prospects et campagnes
- **Filtrage** : Par tags dans toutes les listes
- **Protection** : Empêche suppression tags utilisés

**Exemples de tags** :
```typescript
// TYPE (rôle du site)
blogger, media, directory, forum, ecommerce

// SECTOR (industrie)
tech, health, finance, travel, education

// QUALITY (qualité du prospect)
tier_1, tier_2, tier_3, high_authority, spam_risk

// GEOGRAPHY (localisation)
fr, en, es, de, europe, north_america
```

---

### 2. [Scoring Algorithm](scoring.md) 📊

**Pour** : Développeurs, Product Managers

Algorithme de calcul du score d'autorité (0-100).

**Contenu** :
- **Formule complète** : Moz DA, spam score, traffic, etc.
- **Pondération** : Poids de chaque métrique
- **Tiers automatiques** : Tier 1 (80+), Tier 2 (60-79), Tier 3 (<60)
- **Enrichissement** : Sources de données utilisées

**Formule** :
```typescript
Score = (
  mozDA * 0.35 +
  organicTraffic * 0.25 +
  linkNeighborhood * 0.20 +
  trustFlow * 0.15 +
  (100 - spamScore) * 0.05
)
```

---

### 3. [SOS Expat Integration](sos-expat-integration.md) 🔗

**Pour** : Développeurs backend

Webhook pour bloquer la prospection des utilisateurs SOS Expat.

**Contenu** :
- **Endpoint** : `POST /api/webhooks/sos-expat/block-domain`
- **Authentification** : API Key partagée
- **Logique** : Ajout automatique à suppression list
- **Notifications** : Telegram quand domaine bloqué

**Cas d'usage** :
Quand un utilisateur s'inscrit sur SOS Expat (providers-expat.com), son domaine est automatiquement bloqué pour éviter qu'il reçoive des emails de prospection.

---

## 🎯 Fonctionnalités par Catégorie

### Gestion des Prospects

| Fonctionnalité | Description | Doc |
|----------------|-------------|-----|
| **Auto-enrichissement** | Score, DA, PageRank automatique | [Complete Guide](../getting-started/complete-guide.md) |
| **Tags** | Classification hiérarchique | [Tags System](tags-system.md) |
| **Scoring** | Calcul autorité 0-100 | [Scoring](scoring.md) |
| **Import CSV** | Import en masse avec dedup | [Quick Start](../getting-started/quick-start.md) |

### Outreach

| Fonctionnalité | Description | Doc |
|----------------|-------------|-----|
| **Auto-enrollment** | Inscription auto campagnes | [Auto-Enrollment](../getting-started/auto-enrollment.md) |
| **Templates multi-langue** | 9 langues supportées | [Complete Guide](../getting-started/complete-guide.md) |
| **MailWizz Integration** | Envoi automatique emails | [Complete Guide](../getting-started/complete-guide.md) |

### Backlinks

| Fonctionnalité | Description | Doc |
|----------------|-------------|-----|
| **Vérification auto** | Détection type/status | [Production Status](../architecture/production-status.md) |
| **Monitoring** | Alertes backlinks perdus | [Telegram Report](../tests/telegram-report.md) |

### Intégrations

| Fonctionnalité | Description | Doc |
|----------------|-------------|-----|
| **SOS Expat** | Blocage domaines utilisateurs | [SOS Expat Integration](sos-expat-integration.md) |
| **Telegram** | Notifications temps réel | [Telegram Report](../tests/telegram-report.md) |
| **OpenAI** | Classification réponses | [Admin API](../api/admin-api-guide.md) |

---

## 🚀 Roadmap

### Implémenté ✅

- [x] Tags hiérarchiques
- [x] Scoring automatique
- [x] Auto-enrollment
- [x] SOS Expat integration
- [x] Multi-langue (9 langues)
- [x] Vérification backlinks
- [x] Notifications Telegram
- [x] Classification IA

### En cours 🚧

- [ ] Dashboard analytics avancé
- [ ] A/B testing templates
- [ ] Machine Learning scoring

### Planifié 📅

- [ ] Export/Import templates
- [ ] Multi-workspace
- [ ] API publique

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Getting Started](../getting-started/)
- [API Documentation](../api/)
- [Architecture](../architecture/)

---

**Dernière mise à jour** : 16 février 2026
