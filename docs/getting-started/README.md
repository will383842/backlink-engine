# 🚀 Getting Started - Backlink Engine

Documentation pour démarrer rapidement avec Backlink Engine.

---

## 📚 Guides Disponibles

### 1. [Quick Start](quick-start.md) ⚡ **COMMENCEZ ICI**

**Temps** : 5 minutes
**Pour** : Développeurs voulant démarrer rapidement

Démarrez le projet en 3 commandes :
```bash
npm install && cd frontend && npm install && cd ..
cp .env.example .env
npm run dev
```

**Contenu** :
- Installation rapide
- Configuration minimale
- Démarrage sans MailWizz
- Premiers tests

---

### 2. [Complete Guide](complete-guide.md) 📖

**Temps** : 15 minutes
**Pour** : Développeurs voulant comprendre le système

Comprendre le système auto-enrollment complet :
- Workflow enrichissement → enrollment → email
- Services et workers BullMQ
- Configuration avancée
- Intégration MailWizz

**Contenu** :
- Architecture complète
- 4 services principaux
- Workers asynchrones
- Configuration MailWizz

---

### 3. [Auto-Enrollment Guide](auto-enrollment.md) 🤖

**Temps** : 10 minutes
**Pour** : Développeurs/PMs voulant configurer l'auto-enrollment

Configuration et personnalisation du système d'inscription automatique :
- Règles d'éligibilité
- Sélection de campagnes
- Throttling (limites horaires/journalières)
- Whitelist langues et catégories

**Contenu** :
- Configuration complète
- Algorithme de sélection
- Exemples de configuration
- Troubleshooting

---

## 🎯 Parcours Recommandés

### Pour un développeur backend

1. **[Quick Start](quick-start.md)** - Démarrer le projet
2. **[Complete Guide](complete-guide.md)** - Comprendre l'architecture
3. **[Auto-Enrollment](auto-enrollment.md)** - Maîtriser le système clé
4. **[Admin API Guide](../api/admin-api-guide.md)** - Utiliser l'API

### Pour un développeur frontend

1. **[Quick Start](quick-start.md)** - Démarrer le projet
2. **[Admin API Guide](../api/admin-api-guide.md)** - Comprendre l'API
3. **[Tags System](../features/tags-system.md)** - Système de tags
4. **[Complete Guide](complete-guide.md)** - Comprendre le backend

### Pour un Product Manager

1. **[Complete Guide](complete-guide.md)** - Vue d'ensemble
2. **[Auto-Enrollment](auto-enrollment.md)** - Système automatique
3. **[Production Status](../architecture/production-status.md)** - État du projet
4. **[Features](../features/)** - Fonctionnalités disponibles

### Pour DevOps

1. **[Quick Start](quick-start.md)** - Installation locale
2. **[Deployment](../deployment/)** - Déploiement production
3. **[CPX22 Setup](../deployment/cpx22-setup.md)** - Configuration serveur

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Node.js** 20+ installé
- **PostgreSQL** 15+ installé
- **Redis** 7+ installé
- **npm** ou **pnpm** installé
- **Git** pour cloner le repo

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Documentation API](../api/)
- [Guides de déploiement](../deployment/)
- [Architecture](../architecture/)

---

**Dernière mise à jour** : 16 février 2026
