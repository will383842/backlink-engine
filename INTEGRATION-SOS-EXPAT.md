# 🔗 INTÉGRATION SOS EXPAT - WEBHOOK BACKLINK ENGINE

## 📋 Vue d'ensemble

Quand **quelqu'un s'inscrit sur SOS Expat** (client, blogueur, prestataire, influenceur, chatter, etc.), il faut **arrêter immédiatement toutes les campagnes de prospection Backlink Engine** pour cet email.

**Pourquoi ?** On ne prospecte pas notre propre écosystème ! 🎯

---

## 🔧 Configuration

### 1. Ajouter la variable d'environnement

Dans **SOS Expat** (Firebase Functions), ajouter :

```bash
# .env ou Firebase config
BACKLINK_ENGINE_WEBHOOK_URL=https://backlinks.life-expat.com/api/webhooks/sos-expat/user-registered
BACKLINK_ENGINE_WEBHOOK_SECRET=votre_secret_partage_ici
```

**Générer un secret fort** :
```bash
openssl rand -base64 48
```

### 2. Ajouter le même secret dans Backlink Engine

Sur le serveur Backlink Engine, dans `/opt/backlink-engine/.env` :

```bash
# Webhook secret pour SOS Expat
MAILWIZZ_WEBHOOK_SECRET=le_meme_secret_que_sos_expat
```

**Note** : Actuellement, Backlink Engine utilise `MAILWIZZ_WEBHOOK_SECRET` pour tous les webhooks. Si vous voulez un secret séparé pour SOS Expat, il faudra modifier `authenticateWebhook` dans `auth.ts`.

---

## 📡 Appeler le webhook depuis SOS Expat

### Option 1 : Cloud Function déclenchée sur inscription

**Fichier** : `sos/firebase/functions/src/webhooks/notifyBacklinkEngine.ts`

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const BACKLINK_ENGINE_WEBHOOK_URL = functions.config().backlink?.webhook_url ||
  "https://backlinks.life-expat.com/api/webhooks/sos-expat/user-registered";

const BACKLINK_ENGINE_WEBHOOK_SECRET = functions.config().backlink?.webhook_secret ||
  process.env.BACKLINK_ENGINE_WEBHOOK_SECRET;

/**
 * Notify Backlink Engine when a user registers on SOS Expat
 * to stop all prospecting campaigns for this email
 */
export async function notifyBacklinkEngineUserRegistered(params: {
  email: string;
  userId: string;
  userType: "client" | "blogger" | "provider" | "influencer" | "chatter" | "group_admin" | "other";
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { email, userId, userType, firstName, lastName, phone, metadata } = params;

  if (!BACKLINK_ENGINE_WEBHOOK_SECRET) {
    console.warn("BACKLINK_ENGINE_WEBHOOK_SECRET not configured, skipping webhook");
    return;
  }

  try {
    const response = await fetch(BACKLINK_ENGINE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": BACKLINK_ENGINE_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        email,
        userId,
        userType,
        firstName,
        lastName,
        phone,
        registeredAt: new Date().toISOString(),
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Backlink Engine webhook failed:", {
        status: response.status,
        error,
        email,
        userType,
      });
      throw new Error(`Webhook failed: ${response.status}`);
    }

    const result = await response.json();
    console.log("Backlink Engine webhook success:", {
      email,
      userType,
      actionsPerformed: result.actionsPerformed,
    });
  } catch (error) {
    console.error("Failed to notify Backlink Engine:", error);
    // Don't throw - user registration should succeed even if webhook fails
  }
}
```

### Option 2 : Callable Function

**Fichier** : `sos/firebase/functions/src/callables/registerUser.ts`

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { notifyBacklinkEngineUserRegistered } from "../webhooks/notifyBacklinkEngine";

export const registerClient = functions.https.onCall(async (data, context) => {
  // ... Logique d'inscription existante ...

  const { email, firstName, lastName, phone } = data;
  const userId = context.auth?.uid;

  // Créer l'utilisateur dans Firestore
  await admin.firestore().collection("users").doc(userId).set({
    email,
    firstName,
    lastName,
    phone,
    role: "client",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ✅ NOUVEAU : Notifier Backlink Engine
  await notifyBacklinkEngineUserRegistered({
    email,
    userId,
    userType: "client",
    firstName,
    lastName,
    phone,
    metadata: {
      source: "sos_expat_registration",
      role: "client",
    },
  });

  return { success: true, userId };
});

export const registerBlogger = functions.https.onCall(async (data, context) => {
  // ... Logique similaire pour blogger ...

  await notifyBacklinkEngineUserRegistered({
    email: data.email,
    userId: context.auth?.uid,
    userType: "blogger",
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    metadata: {
      source: "sos_expat_registration",
      role: "blogger",
      blogUrl: data.blogUrl,
    },
  });
});

export const registerProvider = functions.https.onCall(async (data, context) => {
  // ... Logique similaire pour provider ...

  await notifyBacklinkEngineUserRegistered({
    email: data.email,
    userId: context.auth?.uid,
    userType: "provider",
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    metadata: {
      source: "sos_expat_registration",
      role: "provider",
      specialty: data.specialty,
    },
  });
});
```

### Option 3 : Firestore Trigger (recommandé pour robustesse)

**Fichier** : `sos/firebase/functions/src/triggers/onUserCreated.ts`

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { notifyBacklinkEngineUserRegistered } from "../webhooks/notifyBacklinkEngine";

export const onUserCreated = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;

    // Déterminer le userType en fonction du role
    const roleToUserTypeMap: Record<string, string> = {
      client: "client",
      blogger: "blogger",
      provider: "provider",
      influencer: "influencer",
      chatter: "chatter",
      group_admin: "group_admin",
    };

    const userType = roleToUserTypeMap[userData.role] || "other";

    // Notifier Backlink Engine
    await notifyBacklinkEngineUserRegistered({
      email: userData.email,
      userId,
      userType,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      metadata: {
        source: "firestore_trigger",
        role: userData.role,
        createdAt: userData.createdAt?.toDate().toISOString(),
      },
    });
  });
```

---

## 🧪 Test du webhook

### 1. Depuis la ligne de commande

```bash
curl -X POST https://backlinks.life-expat.com/api/webhooks/sos-expat/user-registered \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: VOTRE_SECRET_ICI" \
  -d '{
    "email": "test@example.com",
    "userId": "test-user-123",
    "userType": "client",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+33612345678",
    "registeredAt": "2026-02-15T10:00:00Z",
    "metadata": {
      "source": "test"
    }
  }'
```

**Réponse attendue si l'email n'existe pas** :
```json
{
  "status": "ok",
  "message": "Email added to suppression list",
  "actionsPerformed": {
    "suppressionAdded": true,
    "enrollmentsStopped": 0,
    "prospectUpdated": false
  }
}
```

**Réponse attendue si l'email existe** :
```json
{
  "status": "ok",
  "message": "SOS Expat user registration processed successfully (client)",
  "actionsPerformed": {
    "suppressionAdded": true,
    "enrollmentsStopped": 2,
    "prospectUpdated": true,
    "prospectStatus": "DO_NOT_CONTACT",
    "userType": "client"
  }
}
```

### 2. Depuis Firebase Functions Emulator

```bash
# Dans sos/firebase/functions/
npm run build
firebase emulators:start

# Dans un autre terminal
node -e "
const functions = require('./lib/index');
functions.registerClient.call({
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+33612345678'
}, { auth: { uid: 'test-123' } });
"
```

---

## 🔍 Ce qui se passe dans Backlink Engine

Quand le webhook est appelé, Backlink Engine :

### 1. **Cherche le contact par email**
```sql
SELECT * FROM contacts WHERE email_normalized = 'test@example.com';
```

### 2. **Si le contact existe** :
- ✅ **Arrête tous les enrollments actifs**
  ```sql
  UPDATE enrollments
  SET status = 'stopped',
      stopped_reason = 'sos_expat_user_registered',
      completed_at = NOW()
  WHERE contact_id = X AND status = 'active';
  ```

- ✅ **Marque le contact comme opted out**
  ```sql
  UPDATE contacts
  SET opted_out = true,
      opted_out_at = NOW(),
      first_name = 'John',
      last_name = 'Doe',
      phone = '+33612345678'
  WHERE id = X;
  ```

- ✅ **Met à jour le statut du prospect**
  ```sql
  UPDATE prospects
  SET status = 'DO_NOT_CONTACT'
  WHERE id = Y;
  ```

### 3. **Dans tous les cas** :
- ✅ **Ajoute l'email à la suppression list**
  ```sql
  INSERT INTO suppression_entries (email_normalized, reason, source, metadata)
  VALUES ('test@example.com', 'sos_expat_user', 'sos_expat_webhook', '{"userId": "...", "userType": "client"}');
  ```

- ✅ **Crée un event log**
  ```sql
  INSERT INTO events (prospect_id, contact_id, event_type, event_source, data)
  VALUES (Y, X, 'sos_expat_user_registered', 'sos_expat_webhook', '{"userId": "...", "userType": "client", ...}');
  ```

---

## 📊 Monitoring

### Vérifier les logs dans Backlink Engine

```bash
ssh root@89.167.26.169 "docker logs bl-app --tail 50 | grep sos_expat"
```

### Vérifier qu'un email a été ajouté à la suppression list

```sql
SELECT * FROM suppression_entries WHERE email_normalized = 'test@example.com';
```

### Vérifier les enrollments arrêtés

```sql
SELECT * FROM enrollments
WHERE stopped_reason = 'sos_expat_user_registered'
ORDER BY completed_at DESC
LIMIT 10;
```

### Vérifier les événements

```sql
SELECT * FROM events
WHERE event_type = 'sos_expat_user_registered'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔐 Sécurité

### Authentification

Le webhook utilise un **secret partagé** envoyé dans le header `x-webhook-secret`.

**Middleware** : `authenticateWebhook` dans `src/api/middleware/auth.ts`

Si le secret ne correspond pas → **401 Unauthorized**

### Rate Limiting

- **Max 100 requêtes par minute** par IP
- Configuré dans le schema de la route

### Validation

- Email **requis** et **format email valide**
- UserType **optionnel** mais validé si fourni
- Tous les autres champs optionnels

---

## 🎯 Types d'utilisateurs supportés

| userType      | Description                        | Source SOS Expat                |
|---------------|------------------------------------|---------------------------------|
| `client`      | Client du service SOS Expat        | Inscription client              |
| `blogger`     | Blogueur inscrit                   | Inscription blogueur            |
| `provider`    | Prestataire du service             | Inscription provider            |
| `influencer`  | Influenceur partenaire             | Inscription influenceur         |
| `chatter`     | Chatter (agent conversationnel)    | Inscription chatter             |
| `group_admin` | Admin de groupe Telegram           | Inscription group admin         |
| `other`       | Autre type d'utilisateur           | Fallback                        |

---

## 🚀 Déploiement

### 1. Backlink Engine (déjà fait ✅)

Le webhook est déjà déployé sur le serveur.

### 2. SOS Expat (à faire)

1. **Ajouter le fichier `notifyBacklinkEngine.ts`**
2. **Ajouter l'appel dans les callable functions**
3. **Configurer les variables d'environnement** :
   ```bash
   firebase functions:config:set \
     backlink.webhook_url="https://backlinks.life-expat.com/api/webhooks/sos-expat/user-registered" \
     backlink.webhook_secret="VOTRE_SECRET_ICI"
   ```
4. **Déployer** :
   ```bash
   cd sos/firebase/functions
   npm run build
   firebase deploy --only functions
   ```

---

## ✅ Checklist d'intégration

- [ ] Secret partagé généré et configuré des deux côtés
- [ ] Fichier `notifyBacklinkEngine.ts` créé dans SOS Expat
- [ ] Appels ajoutés dans `registerClient`, `registerBlogger`, `registerProvider`, etc.
- [ ] Variables d'environnement configurées dans Firebase
- [ ] Tests effectués avec un email de test
- [ ] Logs vérifiés dans Backlink Engine
- [ ] Suppression list vérifiée dans la base de données
- [ ] Documentation mise à jour

---

## 🐛 Dépannage

### Le webhook retourne 401

- ✅ Vérifier que `x-webhook-secret` est envoyé dans le header
- ✅ Vérifier que le secret correspond à `MAILWIZZ_WEBHOOK_SECRET` dans Backlink Engine

### Le webhook retourne 400

- ✅ Vérifier que le body contient au minimum `{ "email": "..." }`
- ✅ Vérifier que l'email est valide
- ✅ Vérifier le format JSON

### Le webhook retourne 500

- ✅ Consulter les logs : `docker logs bl-app`
- ✅ Vérifier la connexion à la base de données
- ✅ Vérifier que le schema Prisma est à jour

### L'enrollment n'est pas arrêté

- ✅ Vérifier que le contact existe avec cet email
- ✅ Vérifier que l'enrollment est bien en statut "active"
- ✅ Consulter les logs pour voir les actions effectuées

---

## 📞 Support

Pour toute question ou problème :
- Consulter les logs Backlink Engine : `docker logs bl-app`
- Consulter les logs SOS Expat : Firebase Console
- Tester manuellement avec `curl`

---

**Document créé le** : 15 février 2026
**Version** : 1.0.0
**Status** : ✅ Production-ready
