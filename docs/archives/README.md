# 📁 Archives - Backlink Engine

Documents historiques conservés pour référence.

> ⚠️ **Attention** : Ces documents sont archivés car obsolètes ou remplacés par des versions plus récentes. Ils sont conservés uniquement pour référence historique.

---

## 📚 Documents Archivés

### [Audit Old](audit-old.md) 🗄️

**Date** : 13 février 2026
**Raison archivage** : Problèmes critiques résolus

Ancien audit de production-ready avec 3 problèmes critiques identifiés :
1. Routes Contacts manquantes ✅ Corrigé
2. API MessageTemplates non fonctionnelle ✅ Corrigé
3. Mutations ProspectDetail incorrectes ✅ Corrigé

**Remplacé par** : [Production Status](../architecture/production-status.md)

---

### [Guide Finalisation](guide-finalisation.md) 🗄️

**Date** : ~14 février 2026
**Raison archivage** : Problème Cloudflare 521 résolu

Guide pour résoudre l'erreur Cloudflare 521 lors du déploiement initial.

**Problème** : Backend non accessible depuis Cloudflare
**Solution** : Configuration Nginx + ports + SSL

Ce problème ne devrait plus se reproduire avec la configuration actuelle.

---

### [Synthèse 14 Fév](synthese-14-fev.md) 📝

**Date** : 14 février 2026
**Raison archivage** : Référence historique

Synthèse complète de l'état du déploiement au 14 février :
- État complet du projet
- Diagnostic des problèmes rencontrés
- Solutions appliquées
- Décisions prises

**Utile pour** : Comprendre l'historique des décisions

---

### [README Déploiement](readme-deploiement.md) 📝

**Date** : 14 février 2026
**Raison archivage** : Référence historique

Récapitulatif des modifications et fichiers créés/modifiés lors du déploiement initial.

**Contenu** :
- Liste des fichiers créés
- Modifications effectuées
- Scripts de déploiement
- Configuration serveur

---

### [Déploiement Life-Expat](deploiement-life-expat.md) 🗄️

**Date** : 14 février 2026
**Raison archivage** : Redondant avec Production Guide

Guide de déploiement spécifique au domaine life-expat.com.

**Remplacé par** : [Production Guide](../deployment/production-guide.md) (plus générique)

---

### [Deploy Migrations](deploy-migrations.md) 🗄️

**Date** : 15 février 2026
**Raison archivage** : Fusionné dans Migrations

Guide pour exécuter les 4 migrations lors du déploiement initial :
1. Add language/country/source
2. Add tags system
3. Add firstName/lastName
4. Add timezone

**Remplacé par** : [Migrations](../deployment/migrations.md) (guide complet)

---

## 📊 Statistique des Archives

| Document | Taille | Date | Utilité |
|----------|--------|------|---------|
| audit-old.md | ~11 KB | 13 fév 2026 | ⚠️ Faible (problèmes résolus) |
| guide-finalisation.md | ~9 KB | 14 fév 2026 | ⚠️ Faible (erreur résolue) |
| synthese-14-fev.md | ~8 KB | 14 fév 2026 | ✅ Moyenne (historique) |
| readme-deploiement.md | ~11 KB | 14 fév 2026 | ✅ Moyenne (historique) |
| deploiement-life-expat.md | ~9 KB | 14 fév 2026 | ⚠️ Faible (redondant) |
| deploy-migrations.md | ~7 KB | 15 fév 2026 | ⚠️ Faible (fusionné) |

**Total** : 6 documents archivés (~55 KB)

---

## 🔍 Quand Consulter les Archives ?

### Vous devriez consulter les archives si :

✅ Vous voulez comprendre l'historique des décisions techniques
✅ Vous rencontrez un problème similaire à un ancien problème
✅ Vous cherchez des informations sur les premières étapes du déploiement
✅ Vous voulez voir l'évolution du projet

### Vous NE devriez PAS consulter les archives si :

❌ Vous cherchez la documentation actuelle → Voir [docs/](../README.md)
❌ Vous voulez déployer → Voir [deployment/](../deployment/)
❌ Vous cherchez l'état actuel → Voir [architecture/production-status.md](../architecture/production-status.md)

---

## 🗑️ Politique de Suppression

**Les archives ne sont PAS supprimées** car :
- Elles documentent l'historique du projet
- Elles peuvent aider pour des problèmes futurs similaires
- Elles expliquent les décisions techniques

**Si un document archive devient inutile** :
1. Vérifier qu'aucune information unique n'est présente
2. Créer un commit expliquant la suppression
3. Supprimer le fichier

---

## 📅 Timeline Historique

```
13 fév 2026 : Premier audit production-ready
              ↓ 3 problèmes critiques identifiés
14 fév 2026 : Déploiement initial sur Hetzner CPX22
              ↓ Erreur Cloudflare 521 rencontrée
14 fév 2026 : Résolution erreur + optimisations
              ↓ Guide finalisation créé
15 fév 2026 : Migrations DB + support 195 pays
              ↓ Application production-ready
16 fév 2026 : Réorganisation documentation
              ↓ Archivage anciens docs
```

---

## 🔗 Liens Utiles

- [Retour à l'index](../README.md)
- [Documentation actuelle](../README.md)
- [Production Status](../architecture/production-status.md)
- [Deployment Guide](../deployment/production-guide.md)

---

**Dernière mise à jour** : 16 février 2026
**Prochaine révision** : Mars 2026
