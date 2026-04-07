# 🚀 Guide de Déploiement - Migrations 2026-02-15

## ✅ Migrations Créées

4 migrations ont été créées pour ajouter :

1. **Timezone + firstName/lastName** - Détection automatique du fuseau horaire et extraction des noms
2. **Tags System** - Système de tags hiérarchique pour catégoriser les prospects
3. **Contact Forms + Message Templates** - Détection de formulaires de contact + templates de messages
4. **Impactful Templates** - Templates personnalisés par catégorie (blogger, media, influencer, etc.) avec modèle de commission **10$/appel + 5$ sur tous les appels des partenaires référés**

## 📦 Fichiers à Commiter

Avant de déployer, assurez-vous que ces fichiers sont commités :

```bash
git status
git add prisma/migrations/
git add prisma/schema.prisma
git add src/services/scraping/emailScraper.ts
git add src/services/scraping/contactFormDetector.ts
git add src/services/messaging/templateRenderer.ts
git add src/api/routes/messageTemplates.ts
git add src/jobs/workers/enrichmentWorker.ts
git add frontend/src/pages/MessageTemplates.tsx
git add frontend/src/App.tsx
git add migrate-production.sh
git commit -m "feat: add message templates system + contact form detection + impactful templates"
git push origin main
```

## 🌍 Déploiement en Production

### Option 1 : Déploiement Complet (Recommandé)

Sur le serveur de production Hetzner :

```bash
# Se connecter au serveur
ssh root@backlinks.life-expat.com

# Aller dans le dossier du projet
cd /opt/backlink-engine

# Exécuter le script de déploiement complet
./deploy.sh
```

Le script `deploy.sh` va :
- Faire un `git pull` pour récupérer les derniers changements
- Builder le frontend et le backend
- Redémarrer les containers Docker
- **Appliquer automatiquement les migrations** (ligne 159 : `prisma migrate deploy`)

### Option 2 : Migration Uniquement (Plus Rapide)

Si l'application est déjà déployée et que vous voulez **uniquement appliquer les migrations** :

```bash
# Se connecter au serveur
ssh root@backlinks.life-expat.com

# Aller dans le dossier du projet
cd /opt/backlink-engine

# Faire un git pull pour récupérer les migrations
git pull origin main

# Exécuter uniquement les migrations
./migrate-production.sh
```

### Option 3 : Déploiement Automatique via GitHub Actions

Simplement pusher sur la branche `main` :

```bash
git push origin main
```

Le workflow GitHub Actions (`.github/workflows/deploy.yml`) déploiera automatiquement sur le serveur Hetzner.

⚠️ **ATTENTION** : Le workflow actuel ne lance pas les migrations. Il faut ensuite se connecter en SSH et exécuter :

```bash
ssh root@backlinks.life-expat.com
cd /opt/backlink-engine
./migrate-production.sh
```

## 🔍 Vérification Post-Déploiement

Après le déploiement, vérifiez que tout fonctionne :

### 1. Vérifier l'API

```bash
curl https://backlinks.life-expat.com/api/health
# Devrait retourner : {"status":"ok"}
```

### 2. Vérifier les Templates

```bash
curl https://backlinks.life-expat.com/api/message-templates
```

Vous devriez voir 9+ templates incluant :
- Templates généraux (fr, en)
- Templates blogger (fr, en)
- Templates media (fr)
- Templates influencer (fr, en)
- Templates association (fr)
- Templates corporate (fr)

### 3. Vérifier la Base de Données

```bash
# Sur le serveur
docker compose exec postgres psql -U backlink -d backlink_engine

# Dans psql
\dt                          -- Lister les tables
\d prospects                 -- Voir la structure de la table prospects
SELECT * FROM message_templates;
\q
```

### 4. Tester l'Interface Admin

Accédez à : **https://backlinks.life-expat.com/message-templates**

Vous devriez pouvoir :
- ✅ Sélectionner une langue (9 langues disponibles)
- ✅ Sélectionner une catégorie (8 catégories)
- ✅ Éditer le sujet et le corps du message
- ✅ Insérer des variables ({siteName}, {yourName}, etc.)
- ✅ Voir l'aperçu en temps réel
- ✅ Sauvegarder les modifications

### 5. Tester la Détection de Formulaires

Ajoutez un prospect avec une URL et vérifiez que :
- ✅ Le formulaire de contact est détecté automatiquement
- ✅ Les champs du formulaire sont extraits
- ✅ La présence de CAPTCHA est détectée
- ✅ Le template approprié est sélectionné selon la langue et la catégorie

## 🐛 Troubleshooting

### Erreur : "Migration already applied"

Normal ! Cela signifie que la migration a déjà été exécutée. Ignorez cette erreur.

### Erreur : "Docker not found"

Assurez-vous que Docker est installé et que le service tourne :

```bash
docker --version
docker compose version
docker compose ps
```

### Les containers ne démarrent pas

Vérifiez les logs :

```bash
docker compose logs -f postgres
docker compose logs -f app
```

### L'interface admin ne charge pas

1. Vérifiez que le frontend a été buildé :
   ```bash
   ls -la frontend/dist/
   ```

2. Vérifiez les logs Nginx :
   ```bash
   docker compose logs -f nginx
   ```

3. Vérifiez que l'API répond :
   ```bash
   curl http://localhost:3000/api/health
   ```

## 📊 Impact des Changements

### Base de Données

- ✅ 3 nouvelles colonnes dans `prospects` (timezone, contactFormFields, hasCaptcha)
- ✅ 3 nouvelles colonnes dans `contacts` (firstName, lastName, timezone)
- ✅ 1 nouvelle table `message_templates` avec 9+ templates
- ✅ 2 nouvelles tables pour le système de tags

### API

- ✅ Nouveaux endpoints : `/api/message-templates`
- ✅ Extraction automatique de firstName/lastName lors du scraping
- ✅ Détection automatique de formulaires de contact
- ✅ Sélection intelligente de templates (catégorie + langue + fallback)

### Frontend

- ✅ Nouvelle page : `/message-templates`
- ✅ Interface complète pour éditer les templates
- ✅ Prévisualisation en temps réel

### Worker d'Enrichissement

- ✅ Extraction de noms optimisée (plus de double fetch)
- ✅ Détection de formulaires de contact automatique
- ✅ Calcul de score corrigé (+10 points si formulaire de contact)

## 📝 Notes Importantes

1. **Commission Model** : Les templates utilisent le bon modèle (10$/appel + 5$ sur tous les appels des partenaires référés), PAS l'ancien modèle de subscription

2. **Vocabulaire Correct** : Les templates utilisent "référer des partenaires" (pas "recruter") et "avocats OU expatriés aidants" (pas "avocats expat")

3. **Production Ready** : Toutes les migrations sont conçues pour la production avec :
   - Gestion d'erreurs
   - Vérifications de santé
   - Rollback possible si nécessaire
   - Pas d'impact sur les données existantes

## ✅ Checklist Finale

Avant de marquer cette tâche comme terminée :

- [ ] Code commité et pushé sur `main`
- [ ] Déploiement exécuté sur le serveur de production
- [ ] Migrations appliquées avec succès
- [ ] Health checks passent (API, PostgreSQL, Redis)
- [ ] Interface admin accessible et fonctionnelle
- [ ] Templates de messages créés et éditables
- [ ] Détection de formulaires de contact testée
- [ ] Worker d'enrichissement redémarré

---

**Pour toute question ou problème lors du déploiement, vérifiez les logs et consultez ce guide.**
