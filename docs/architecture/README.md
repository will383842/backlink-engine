# 🏗️ Architecture - Backlink Engine

Documentation technique de l'architecture et des décisions d'implémentation.

---

## 📚 Documents Disponibles

### 1. [Implementation Complete](implementation.md) 📖

**Pour** : Développeurs backend, Architectes

Détails complets de l'implémentation du système auto-enrollment.

**Contenu** :
- **4 services principaux** :
  - `autoEnrollment/config.ts` - Configuration et éligibilité
  - `autoEnrollment/campaignSelector.ts` - Sélection intelligente
  - `enrichmentService.ts` - Enrichissement Moz/Traffic
  - `mailwizzService.ts` - Intégration MailWizz
- **6 workers BullMQ** :
  - `enrichmentWorker` - Enrichissement asynchrone
  - `autoEnrollmentWorker` - Enrollment asynchrone
  - `outreachWorker` - Envoi emails
  - `replyWorker` - Traitement réponses
  - `verificationWorker` - Vérification backlinks
  - `telegramWorker` - Notifications
- **Workflow complet** : URL → Enrichissement → Enrollment → Email

**Date** : 13 février 2026

---

### 2. [Production Status](production-status.md) ⭐

**Pour** : Tous

Audit complet de l'état production-ready du projet.

**Contenu** :
- **Score global** : 98/100 ⭐⭐⭐⭐⭐
- **Backend** : 5/5 (API complète, 87 endpoints)
- **Frontend** : 5/5 (18 pages, navigation cohérente)
- **Infrastructure** : A+ (Hetzner CPX22)
- **Problèmes mineurs** : ~50% textes hard-codés (non bloquant)

**Verdict** : 100% Production Ready ✅

**Date** : 14 février 2026

---

### 3. [CPX22 Audit](cpx22-audit.md) 🖥️

**Pour** : DevOps, Architectes

Audit technique du serveur Hetzner CPX22 et optimisations.

**Contenu** :
- **Specs** : 4 vCPU, 8 GB RAM, 80 GB SSD
- **Verdict** : ✅ CPX22 OK pour production
- **3 optimisations recommandées** :
  1. Limiter workers BullMQ (concurrency 2→1)
  2. Désactiver enrichissement auto temporairement
  3. Monitoring RAM/CPU
- **Décision domaine** : life-expat.com (au lieu de backlinks.life)

**Date** : 14 février 2026

---

### 4. [Upgrade Feb 2026](upgrade-2026-02.md) 📈

**Pour** : Développeurs

Détails de la mise à jour majeure de février 2026.

**Contenu** :
- **Support 195 pays** : Liste complète avec codes ISO
- **Timezones** : Détection automatique par pays
- **firstName/lastName** : Champs séparés pour contacts
- **Migrations** : 4 migrations DB exécutées
- **Breaking changes** : Aucun (rétrocompatible)

**Date** : 15 février 2026

---

## 🏗️ Architecture Technique

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + TypeScript + Vite + TanStack Query v5          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP REST
┌─────────────────────▼───────────────────────────────────────┐
│                     API BACKEND                             │
│        Fastify 5.0 + TypeScript + Prisma ORM               │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐       │
│  │   Routes    │  │   Services   │  │   Workers   │       │
│  │ 87 endpoints│  │  28 services │  │  6 workers  │       │
│  └─────────────┘  └──────────────┘  └─────────────┘       │
└───────┬─────────────────┬─────────────────┬────────────────┘
        │                 │                 │
        │                 │                 │
   ┌────▼─────┐     ┌─────▼──────┐    ┌────▼─────┐
   │PostgreSQL│     │   Redis    │    │ BullMQ   │
   │    15    │     │     7      │    │  Jobs    │
   └──────────┘     └────────────┘    └──────────┘
        │                                   │
        │                                   │
   ┌────▼────────────────────────────────────▼──────┐
   │           EXTERNAL SERVICES                    │
   │  MailWizz │ OpenAI │ Moz │ Telegram │ IMAP    │
   └────────────────────────────────────────────────┘
```

---

### Stack Détaillé

#### Backend

| Composant | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Runtime** | Node.js | 20+ | Exécution JavaScript |
| **Framework** | Fastify | 5.0 | API REST haute performance |
| **Langage** | TypeScript | 5.0 | Type safety |
| **ORM** | Prisma | 5.22 | Accès base de données |
| **Validation** | Zod | 3.x | Validation schémas |
| **Logging** | Pino | 9.x | Structured logging |
| **Jobs** | BullMQ | 5.x | Workers asynchrones |

#### Frontend

| Composant | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Framework** | React | 18 | UI library |
| **Langage** | TypeScript | 5.0 | Type safety |
| **Build** | Vite | 5.4 | Bundler ultra-rapide |
| **État** | TanStack Query | 5.x | Server state management |
| **Routing** | React Router | 6.x | Navigation |
| **UI** | Tailwind CSS | 3.x | Styling |
| **i18n** | Custom | - | FR/EN support |

#### Infrastructure

| Composant | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Base de données** | PostgreSQL | 15 | Données relationnelles |
| **Cache** | Redis | 7 | Cache + jobs queue |
| **Proxy** | Nginx | 1.24 | Reverse proxy |
| **Container** | Docker | 24.x | Containerisation |
| **Serveur** | Hetzner CPX22 | - | 4 vCPU, 8 GB RAM |
| **DNS/CDN** | Cloudflare | - | DNS + SSL + Cache |

---

### Patterns & Conventions

#### Backend

**Routing** :
```typescript
// Pattern : /api/{resource}[/{id}][/{action}]
GET    /api/prospects          // Liste
GET    /api/prospects/:id      // Détail
POST   /api/prospects          // Créer
PUT    /api/prospects/:id      // Modifier
DELETE /api/prospects/:id      // Supprimer
```

**Services** :
```typescript
// Pattern : src/services/{domain}/{serviceName}.ts
src/services/enrichment/enrichmentService.ts
src/services/autoEnrollment/config.ts
src/services/mailwizz/mailwizzService.ts
```

**Workers** :
```typescript
// Pattern : src/jobs/workers/{workerName}Worker.ts
src/jobs/workers/enrichmentWorker.ts
src/jobs/workers/autoEnrollmentWorker.ts
```

#### Frontend

**Pages** :
```typescript
// Pattern : src/pages/{PageName}.tsx
src/pages/Dashboard.tsx
src/pages/Prospects.tsx
src/pages/ProspectDetail.tsx
```

**Hooks** :
```typescript
// Pattern : src/hooks/use{ResourceName}.ts
src/hooks/useProspects.ts
src/hooks/useCampaigns.ts
```

---

## 📊 Métriques

### Code

| Métrique | Valeur |
|----------|--------|
| **Fichiers TypeScript** | 55+ |
| **Lignes de code** | ~15,000 |
| **API Endpoints** | 87 |
| **Services** | 28 |
| **Workers** | 6 |
| **Pages React** | 18 |
| **Composants** | 30+ |

### Performance

| Métrique | Cible | Actuel |
|----------|-------|--------|
| **API Response Time** | <100ms | ~50ms |
| **Frontend Load** | <2s | ~1.5s |
| **Enrichment Time** | <5min | ~2min |
| **Auto-enrollment** | <1min | ~30s |

### Infrastructure

| Métrique | Limite | Actuel |
|----------|--------|--------|
| **CPU Usage** | <80% | ~40% |
| **RAM Usage** | <6GB | ~3GB |
| **DB Size** | <20GB | ~2GB |
| **Requests/day** | 100k | ~10k |

---

## 🔐 Sécurité

### Authentification

- **Méthode** : JWT avec fast-jwt
- **Expiration** : 24h
- **Refresh** : Non implémenté (single-user app)

### API Keys

- MailWizz : Stockée dans `.env`
- OpenAI : Stockée dans `.env`
- Moz : Non utilisée (compte gratuit)

### Database

- **Connexion** : SSL en production
- **Backups** : Quotidien automatique
- **Migrations** : Versionnées avec Prisma

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Getting Started](../getting-started/)
- [Features](../features/)
- [Deployment](../deployment/)

---

**Dernière mise à jour** : 16 février 2026
**Score production** : 98/100 ⭐⭐⭐⭐⭐
