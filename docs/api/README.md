# 🔌 API Documentation - Backlink Engine

Documentation complète de l'API REST.

---

## 📚 Guide Principal

### [Admin API Guide](admin-api-guide.md) ⭐

Documentation complète de tous les endpoints API.

**Contenu** :
- **87 endpoints** documentés
- Exemples de requêtes
- Réponses types
- Codes d'erreur
- Authentication

---

## 🔗 Endpoints par Ressource

### Prospects

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/prospects` | Liste prospects avec filtres |
| `GET` | `/api/prospects/:id` | Détail d'un prospect |
| `POST` | `/api/prospects` | Créer un prospect |
| `PUT` | `/api/prospects/:id` | Modifier un prospect |

**Filtres disponibles** : status, country, language, tier, source, scoreMin/Max, tagId, search

---

### Contacts

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/contacts` | Liste contacts avec filtres |
| `GET` | `/api/contacts/:id` | Détail d'un contact |
| `PUT` | `/api/contacts/:id` | Modifier un contact |
| `PATCH` | `/api/contacts/:id` | Modification partielle |
| `DELETE` | `/api/contacts/:id` | Supprimer un contact |

**Champs modifiables** : email, firstName, lastName, name, role, emailStatus, optedOut

---

### Campaigns

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/campaigns` | Liste campagnes |
| `GET` | `/api/campaigns/:id` | Détail campagne |
| `POST` | `/api/campaigns` | Créer campagne |

**Champs** : name, language, targetTier, targetCountry, mailwizzListUid

---

### Tags

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/tags` | Liste tags avec stats |
| `GET` | `/api/tags/:id` | Détail d'un tag |
| `POST` | `/api/tags` | Créer un tag |
| `PATCH` | `/api/tags/:id` | Modifier un tag |
| `DELETE` | `/api/tags/:id` | Supprimer un tag |
| `POST` | `/api/tags/prospects/:prospectId` | Assigner tags à prospect |
| `POST` | `/api/tags/campaigns/:campaignId` | Assigner tags à campagne |

**Catégories** : industry, priority, status, geo, quality, other

---

### Backlinks

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/backlinks` | Liste backlinks |
| `POST` | `/api/backlinks` | Créer un backlink |
| `POST` | `/api/backlinks/verify-all` | Vérifier tous les backlinks |

**Filtres** : prospectId, status, type, verified

---

### Templates

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/templates` | Liste templates outreach |
| `POST` | `/api/templates` | Créer template |
| `PUT` | `/api/templates/:id` | Modifier template |
| `DELETE` | `/api/templates/:id` | Supprimer template |

**Champs** : name, language, purpose, formality, subject, body

---

### Message Templates

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/message-templates` | Liste tous templates |
| `GET` | `/api/message-templates/:language` | Template par langue |
| `PUT` | `/api/message-templates/:language` | Créer/modifier template |
| `POST` | `/api/message-templates/render` | Rendre avec variables |
| `POST` | `/api/message-templates/select` | Sélection intelligente |

**Langues** : fr, en, es, de, pt, ru, ar, zh, hi

---

### Settings

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/settings` | Récupérer config |
| `PUT` | `/api/settings` | Mettre à jour config |

**Sections** : MailWizz, IMAP, Scoring, Recontact, Telegram

---

### Dashboard & Reports

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/dashboard/today` | Statistiques du jour |
| `GET` | `/api/reports/pipeline` | Pipeline funnel |
| `GET` | `/api/reports/top-sources` | Top sources prospects |
| `GET` | `/api/reports/reply-rate` | Taux de réponse |

---

### Autres

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/replies` | Liste réponses reçues |
| `GET` | `/api/recontact/suggestions` | Suggestions recontact |
| `GET` | `/api/suppression` | Liste suppression |
| `POST` | `/api/suppression` | Ajouter à suppression |
| `DELETE` | `/api/suppression/:id` | Retirer de suppression |
| `POST` | `/api/ingest/csv` | Import CSV |
| `POST` | `/api/auth/login` | Connexion |

---

## 🔐 Authentication

**Méthode** : JWT Bearer Token

```bash
# Login
curl -X POST https://backlinks.life-expat.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "..."}'

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Utilisation
curl https://backlinks.life-expat.com/api/prospects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📝 Exemples Complets

### Créer un prospect

```bash
curl -X POST https://backlinks.life-expat.com/api/prospects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "domain": "example-blog.com",
    "source": "manual",
    "language": "fr",
    "country": "FR"
  }'
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "id": 123,
    "domain": "example-blog.com",
    "status": "NEW",
    "score": null,
    "createdAt": "2026-02-16T00:00:00Z"
  }
}
```

---

### Filtrer prospects par tag

```bash
curl "https://backlinks.life-expat.com/api/prospects?tagId=5&status=READY_TO_CONTACT" \
  -H "Authorization: Bearer TOKEN"
```

---

### Sélection intelligente template

```bash
curl -X POST https://backlinks.life-expat.com/api/message-templates/select \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "language": "fr",
    "prospectCategory": "blogger",
    "prospectTags": [1, 5, 12]
  }'
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "subject": "Partenariat {siteName}",
    "body": "Bonjour,\n\nJe suis {yourName}...",
    "language": "fr",
    "category": "blogger"
  }
}
```

---

## ⚠️ Codes d'Erreur

| Code | Message | Description |
|------|---------|-------------|
| `400` | Bad Request | Validation failed |
| `401` | Unauthorized | Token missing/invalid |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Duplicate (e.g. email exists) |
| `500` | Internal Error | Server error |

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Getting Started](../getting-started/)
- [Features](../features/)

---

**Base URL Production** : https://backlinks.life-expat.com
**Base URL Locale** : http://localhost:3000
**Dernière mise à jour** : 16 février 2026
