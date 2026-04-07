# 🎛️ Console d'Administration - API Complete

## 📋 Vue d'Ensemble

Ce guide documente **toutes les routes API** pour gérer :
1. ✅ **Contacts** (modifier, supprimer)
2. ✅ **Tags** (ajouter, modifier, supprimer, assigner)

---

## 📇 1. GESTION DES CONTACTS

### Liste des Contacts (avec pagination & filtres)

```http
GET /api/contacts?page=1&limit=20&emailStatus=verified&search=john
```

**Paramètres :**
| Param | Type | Description | Valeurs |
|-------|------|-------------|---------|
| `page` | integer | Numéro de page (défaut: 1) | 1, 2, 3... |
| `limit` | integer | Éléments par page (défaut: 20) | 1-100 |
| `emailStatus` | string | Filtrer par statut email | verified, invalid, risky, disposable, role, unverified |
| `search` | string | Recherche email/nom | "john", "gmail.com" |

**Réponse :**
```json
{
  "data": [
    {
      "id": 1,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailStatus": "verified",
      "role": "editor",
      "optedOut": false,
      "createdAt": "2026-02-15T10:00:00Z",
      "prospect": {
        "id": 123,
        "domain": "example.com",
        "status": "READY_TO_CONTACT",
        "score": 75,
        "tier": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### Détail d'un Contact

```http
GET /api/contacts/1
```

**Réponse :**
```json
{
  "id": 1,
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "emailStatus": "verified",
  "prospect": {
    "id": 123,
    "domain": "example.com",
    "category": "blogger",
    "country": "FR",
    "timezone": "Europe/Paris"
  },
  "events": [
    {
      "id": 456,
      "eventType": "EMAIL_SENT",
      "createdAt": "2026-02-14T15:30:00Z"
    }
  ]
}
```

---

### Modifier un Contact

```http
PATCH /api/contacts/1
Content-Type: application/json

{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean.dupont@example.fr",
  "role": "owner",
  "emailStatus": "verified",
  "optedOut": false
}
```

**Validation :**
- `email` : Format email valide, pas de doublon
- `emailStatus` : verified | invalid | risky | disposable | role | unverified
- `optedOut` : Si `true`, définit `optedOutAt` automatiquement

**Réponse :**
```json
{
  "id": 1,
  "email": "jean.dupont@example.fr",
  "firstName": "Jean",
  "lastName": "Dupont",
  "role": "owner",
  "emailStatus": "verified",
  "optedOut": false,
  "updatedAt": "2026-02-15T14:30:00Z"
}
```

**Erreur si doublon :**
```json
{
  "statusCode": 409,
  "error": "Duplicate",
  "message": "Cet email existe déjà pour un autre contact (ID: 42)"
}
```

---

### Supprimer un Contact

```http
DELETE /api/contacts/1
```

**Réponse :**
```
HTTP 204 No Content
```

**Note :** Suppression en cascade des événements et enrollments associés.

---

## 🏷️ 2. GESTION DES TAGS

### Liste des Tags

```http
GET /api/tags?category=sector
```

**Paramètres :**
| Param | Type | Description | Valeurs |
|-------|------|-------------|---------|
| `category` | string | Filtrer par catégorie | type, sector, quality, geography, source, other |
| `isAutoTag` | boolean | Filtrer auto/manuel | true, false |

**Réponse :**
```json
{
  "data": [
    {
      "id": 1,
      "name": "assurance",
      "label": "Assurance",
      "description": "Secteur de l'assurance et mutuelles",
      "color": "#10B981",
      "category": "sector",
      "isAutoTag": true,
      "prospectsCount": 42,
      "createdAt": "2026-02-15T10:00:00Z"
    }
  ]
}
```

---

### Créer un Tag

```http
POST /api/tags
Content-Type: application/json

{
  "name": "partenaire_vip",
  "label": "Partenaire VIP",
  "description": "Partenaires stratégiques VIP",
  "color": "#FF0000",
  "category": "quality"
}
```

**Validation :**
- `name` : Unique, snake_case (lettres minuscules + underscores)
- `label` : Requis
- `color` : Hexa valide (#RRGGBB)
- `category` : type | sector | quality | geography | source | other

**Réponse :**
```json
{
  "id": 18,
  "name": "partenaire_vip",
  "label": "Partenaire VIP",
  "color": "#FF0000",
  "category": "quality",
  "isAutoTag": false
}
```

---

### Modifier un Tag

```http
PATCH /api/tags/18
Content-Type: application/json

{
  "label": "Partenaire Premium",
  "description": "Partenaires stratégiques de haute qualité",
  "color": "#FFD700"
}
```

**Note :** Le champ `name` ne peut PAS être modifié (identifiant unique).

---

### Supprimer un Tag

```http
DELETE /api/tags/18
```

**Réponse :**
```
HTTP 204 No Content
```

**Note :** Supprime aussi toutes les associations `ProspectTag` en cascade.

---

## 🔗 3. ASSIGNER/RETIRER DES TAGS AUX PROSPECTS

### Assigner un Tag

```http
POST /api/prospects/123/tags
Content-Type: application/json

{
  "tagId": 5,
  "assignedBy": "user:1"
}
```

**Réponse :**
```json
{
  "prospectId": 123,
  "tagId": 5,
  "assignedBy": "user:1",
  "createdAt": "2026-02-15T15:00:00Z",
  "tag": {
    "id": 5,
    "name": "assurance",
    "label": "Assurance",
    "color": "#10B981"
  }
}
```

---

### Retirer un Tag

```http
DELETE /api/prospects/123/tags/5
```

**Réponse :**
```
HTTP 204 No Content
```

---

### Liste des Tags d'un Prospect

```http
GET /api/prospects/123/tags
```

**Réponse :**
```json
{
  "data": [
    {
      "tag": {
        "id": 5,
        "name": "assurance",
        "label": "Assurance",
        "color": "#10B981",
        "category": "sector"
      },
      "assignedBy": "auto",
      "createdAt": "2026-02-15T10:30:00Z"
    },
    {
      "tag": {
        "id": 12,
        "name": "premium",
        "label": "Premium",
        "color": "#F59E0B",
        "category": "quality"
      },
      "assignedBy": "enrichment",
      "createdAt": "2026-02-15T10:31:00Z"
    }
  ]
}
```

---

## 🎨 4. INTERFACE FRONTEND (REACT)

### Composant Liste des Contacts

```tsx
// src/pages/admin/Contacts.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Fetch contacts
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search],
    queryFn: () => api.get(`/contacts?page=${page}&limit=20&search=${search}`).then(r => r.data)
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      toast.success('Contact supprimé');
    }
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestion des Contacts</h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Rechercher email ou nom..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 px-4 py-2 border rounded"
      />

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nom</th>
            <th>Status</th>
            <th>Domaine</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((contact) => (
            <tr key={contact.id}>
              <td>{contact.email}</td>
              <td>{contact.firstName} {contact.lastName}</td>
              <td>
                <span className={`badge ${contact.emailStatus}`}>
                  {contact.emailStatus}
                </span>
              </td>
              <td>{contact.prospect.domain}</td>
              <td>
                <button onClick={() => editContact(contact)}>✏️ Modifier</button>
                <button onClick={() => deleteMutation.mutate(contact.id)}>🗑️ Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))}>Précédent</button>
        <span>Page {page} / {data?.pagination.pages}</span>
        <button onClick={() => setPage(p => p + 1)}>Suivant</button>
      </div>
    </div>
  );
}
```

---

### Composant Édition Contact (Modal)

```tsx
// src/components/EditContactModal.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function EditContactModal({ contact, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email,
    role: contact.role,
    emailStatus: contact.emailStatus,
    optedOut: contact.optedOut,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/contacts/${contact.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      toast.success('Contact mis à jour');
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Modifier le Contact</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Prénom</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Nom</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Statut Email</label>
            <select
              value={formData.emailStatus}
              onChange={(e) => setFormData({ ...formData, emailStatus: e.target.value })}
            >
              <option value="unverified">Non Vérifié</option>
              <option value="verified">Vérifié</option>
              <option value="invalid">Invalide</option>
              <option value="risky">Risqué</option>
              <option value="disposable">Temporaire</option>
              <option value="role">Générique</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.optedOut}
                onChange={(e) => setFormData({ ...formData, optedOut: e.target.checked })}
              />
              Désinscrit (opted out)
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### Composant Gestion des Tags

```tsx
// src/pages/admin/Tags.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then(r => r.data.data)
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tags']);
      setIsCreating(false);
      toast.success('Tag créé');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['tags']);
      toast.success('Tag supprimé');
    }
  });

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Gestion des Tags</h1>
        <button onClick={() => setIsCreating(true)}>➕ Créer un Tag</button>
      </div>

      {/* Liste des tags groupés par catégorie */}
      {['type', 'sector', 'quality', 'geography'].map(category => (
        <div key={category} className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{category.toUpperCase()}</h2>
          <div className="flex flex-wrap gap-2">
            {tags?.filter(t => t.category === category).map(tag => (
              <div
                key={tag.id}
                className="tag-badge"
                style={{ backgroundColor: tag.color }}
              >
                {tag.label}
                <span className="ml-2 text-sm">({tag.prospectsCount})</span>
                <button
                  className="ml-2 text-red-500"
                  onClick={() => deleteMutation.mutate(tag.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal création tag */}
      {isCreating && <CreateTagModal onClose={() => setIsCreating(false)} />}
    </div>
  );
}
```

---

## 📋 Résumé des Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| **CONTACTS** |
| GET | `/api/contacts` | Liste des contacts (pagination, filtres) |
| GET | `/api/contacts/:id` | Détail d'un contact |
| PATCH | `/api/contacts/:id` | Modifier un contact |
| DELETE | `/api/contacts/:id` | Supprimer un contact |
| **TAGS** |
| GET | `/api/tags` | Liste des tags |
| POST | `/api/tags` | Créer un tag |
| PATCH | `/api/tags/:id` | Modifier un tag |
| DELETE | `/api/tags/:id` | Supprimer un tag |
| **PROSPECT-TAGS** |
| GET | `/api/prospects/:id/tags` | Tags d'un prospect |
| POST | `/api/prospects/:id/tags` | Assigner un tag |
| DELETE | `/api/prospects/:id/tags/:tagId` | Retirer un tag |

---

## 🚀 Prochaines Étapes

1. **Implémenter les routes API** (fichiers déjà créés)
2. **Créer les composants React** (copier exemples ci-dessus)
3. **Ajouter les permissions** (admin only)
4. **Tester avec Postman** ou curl

---

**Date :** 2026-02-15
**Version :** Backlink Engine v2.2.0
**Status :** Documentation ✅ | API ⏳ | Frontend ⏳
