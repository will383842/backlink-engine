# 📚 Documentation Backlink Engine

> Index complet de toute la documentation technique et fonctionnelle

**Dernière mise à jour** : 16 février 2026

---

## 🎯 Navigation Rapide

| Vous êtes... | Consultez... |
|--------------|--------------|
| 👨‍💻 **Nouveau développeur** | [Getting Started](#-getting-started) |
| 🚀 **DevOps/Déploiement** | [Deployment](#-deployment) |
| 🔌 **Intégration API** | [API Documentation](#-api-documentation) |
| 🏗️ **Architecte technique** | [Architecture](#-architecture) |
| 🧪 **QA/Tests** | [Tests & Reports](#-tests--reports) |

---

## 📂 Structure de la Documentation

```
docs/
├── getting-started/     # Pour démarrer rapidement
├── api/                 # Documentation API complète
├── features/            # Fonctionnalités spécifiques
├── deployment/          # Guides de déploiement
├── architecture/        # Architecture et implémentation
└── archives/            # Documents historiques (référence)
```

---

## 🚀 Getting Started

Documentation pour démarrer avec Backlink Engine.

| Document | Description | Temps lecture |
|----------|-------------|---------------|
| **[Quick Start](getting-started/quick-start.md)** | Démarrage en 3 commandes | 5 min |
| **[Complete Guide](getting-started/complete-guide.md)** | Guide complet du système auto-enrollment | 15 min |
| **[Auto-Enrollment](getting-started/auto-enrollment.md)** | Configuration et utilisation de l'auto-enrollment | 10 min |

**Commencez par** : [Quick Start](getting-started/quick-start.md)

---

## 🔌 API Documentation

Documentation complète de l'API REST.

| Document | Description | Endpoints |
|----------|-------------|-----------|
| **[Admin API Guide](api/admin-api-guide.md)** | Routes admin, contacts, tags, settings | 87 endpoints |

**Sommaire des endpoints** :
- **Prospects** : `GET/POST/PUT /api/prospects`
- **Contacts** : `GET/POST/PUT/DELETE /api/contacts`
- **Campaigns** : `GET/POST /api/campaigns`
- **Tags** : `GET/POST/PATCH/DELETE /api/tags`
- **Backlinks** : `GET/POST /api/backlinks`
- **Settings** : `GET/PUT /api/settings`

---

## 🏷️ Features

Documentation des fonctionnalités spécifiques.

| Document | Description | Mise à jour |
|----------|-------------|-------------|
| **[Tags System](features/tags-system.md)** | Système de tags hiérarchique (TYPE, SECTOR, QUALITY, GEOGRAPHY) | ✅ À jour |
| **[Scoring Algorithm](features/scoring.md)** | Formule de calcul du score d'autorité (0-100) | ✅ À jour |
| **[SOS Expat Integration](features/sos-expat-integration.md)** | Webhook pour blocage prospection utilisateurs SOS | ✅ À jour |

---

## 📦 Deployment

Guides pour déployer en production.

| Document | Description | Temps |
|----------|-------------|-------|
| **[Production Guide](deployment/production-guide.md)** | Guide étape par étape complet | 30 min |
| **[Checklist](deployment/checklist.md)** | Vérifications pré-déploiement (DNS, SSL, Cloudflare) | 5 min |
| **[Migrations](deployment/migrations.md)** | Exécution des migrations de base de données | 10 min |
| **[CPX22 Setup](deployment/cpx22-setup.md)** | Configuration serveur Hetzner CPX22 | 15 min |

**Workflow recommandé** :
1. Lire [Checklist](deployment/checklist.md)
2. Suivre [Production Guide](deployment/production-guide.md)
3. Exécuter [Migrations](deployment/migrations.md)
4. Vérifier les logs

---

## 🏗️ Architecture

Documentation technique de l'architecture.

| Document | Description | Mise à jour |
|----------|-------------|-------------|
| **[Implementation Complete](architecture/implementation.md)** | Détails implémentation auto-enrollment (4 services) | 13 fév 2026 |
| **[Production Status](architecture/production-status.md)** | Audit détaillé 98/100, infra A+ | 14 fév 2026 |
| **[CPX22 Audit](architecture/cpx22-audit.md)** | Audit technique serveur, optimisations ressources | 14 fév 2026 |
| **[Upgrade Feb 2026](architecture/upgrade-2026-02.md)** | Support 195 pays, timezones, firstName/lastName | 15 fév 2026 |

**Diagrammes** :
- Workflow auto-enrollment : Voir [Implementation](architecture/implementation.md#workflow)
- Architecture services : Voir [Production Status](architecture/production-status.md#architecture)

---

## 🧪 Tests & Reports

Rapports de tests et vérifications.

| Document | Description | Date |
|----------|-------------|------|
| **[Telegram Report](tests/telegram-report.md)** | Tests notifications Telegram 100% opérationnel | 15 fév 2026 |

---

## 📁 Archives

Documents historiques conservés pour référence.

| Document | Description | Raison archivage |
|----------|-------------|------------------|
| **[Audit Old](archives/audit-old.md)** | Ancien audit avec 3 problèmes critiques | Problèmes résolus |
| **[Guide Finalisation](archives/guide-finalisation.md)** | Anciennes étapes Cloudflare 521 | Erreur résolue |
| **[Synthèse 14 Fév](archives/synthese-14-fev.md)** | État complet + diagnostic problèmes | Référence historique |
| **[README Déploiement](archives/readme-deploiement.md)** | Récap modifications fichiers créés/modifiés | Référence historique |

---

## 🔍 Recherche Rapide

### Par sujet

- **Installation** → [Quick Start](getting-started/quick-start.md)
- **API Endpoints** → [Admin API Guide](api/admin-api-guide.md)
- **Tags** → [Tags System](features/tags-system.md)
- **Scoring** → [Scoring Algorithm](features/scoring.md)
- **Déploiement** → [Production Guide](deployment/production-guide.md)
- **Migrations** → [Migrations](deployment/migrations.md)
- **Serveur** → [CPX22 Setup](deployment/cpx22-setup.md)
- **Architecture** → [Implementation Complete](architecture/implementation.md)
- **Tests** → [Telegram Report](tests/telegram-report.md)

### Par rôle

**Développeur Backend** :
1. [Complete Guide](getting-started/complete-guide.md)
2. [Admin API Guide](api/admin-api-guide.md)
3. [Implementation Complete](architecture/implementation.md)

**Développeur Frontend** :
1. [Quick Start](getting-started/quick-start.md)
2. [Admin API Guide](api/admin-api-guide.md)
3. [Tags System](features/tags-system.md)

**DevOps** :
1. [Checklist](deployment/checklist.md)
2. [Production Guide](deployment/production-guide.md)
3. [Migrations](deployment/migrations.md)
4. [CPX22 Audit](architecture/cpx22-audit.md)

**Product Manager** :
1. [Production Status](architecture/production-status.md)
2. [Features Overview](features/)
3. [Telegram Report](tests/telegram-report.md)

---

## 📊 État de la Documentation

| Catégorie | Documents | État | Dernière MAJ |
|-----------|-----------|------|--------------|
| Getting Started | 3 docs | ✅ À jour | 13 fév 2026 |
| API | 1 doc | ✅ À jour | - |
| Features | 3 docs | ✅ À jour | - |
| Deployment | 4 docs | ✅ À jour | 15 fév 2026 |
| Architecture | 4 docs | ✅ À jour | 15 fév 2026 |
| Tests | 1 doc | ✅ À jour | 15 fév 2026 |
| Archives | 4 docs | 📦 Archivé | - |

**Total** : 20 documents actifs + 4 archives

---

## 🚀 Maintenance de la Documentation

### Quand mettre à jour ?

- **Nouvelle fonctionnalité** → Mettre à jour [Features](features/)
- **Changement API** → Mettre à jour [Admin API Guide](api/admin-api-guide.md)
- **Nouveau déploiement** → Archiver anciens guides, créer nouveau dans [Deployment](deployment/)
- **Changement architecture** → Mettre à jour [Architecture](architecture/)

### Comment archiver un document ?

```bash
# Déplacer vers archives/
mv docs/category/old-doc.md docs/archives/

# Ajouter mention dans README.md archives
# Mettre à jour ce fichier (docs/README.md)
```

---

## 📞 Support

Pour toute question sur la documentation :

1. **Vérifier l'index ci-dessus** - Tous les docs sont listés
2. **Consulter les archives** - Parfois les anciennes décisions sont utiles
3. **Chercher par mot-clé** - Utiliser Ctrl+F dans ce fichier

---

**Maintenu par** : Équipe technique SOS Expat
**Dernière révision** : 16 février 2026
**Version documentation** : 1.0.0
