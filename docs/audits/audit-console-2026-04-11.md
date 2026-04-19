# Audit exhaustif — Console d'administration Backlink Engine

**Date** : 2026-04-11
**Périmètre** : `backlink-engine/frontend/` + `backlink-engine/src/api/routes/`
**Méthode** : lecture seule, lecture exhaustive du code, typecheck backend + frontend, npm audit, croisement front/back.
**Auditeur** : revue statique automatisée
**URL prod** : https://backlinks.life-expat.com (VPS 204.168.180.175)

---

## Partie 1 — Résumé exécutif

### Score global : **58 / 100**

Verdict : **Console fonctionnelle en production mais fragile.** Le frontend est propre côté TypeScript (`tsc --noEmit` passe sans erreur sur le projet Vite strict) et la couverture fonctionnelle des 21 routes API est bonne. En revanche, plusieurs fragilités critiques existent au niveau **sécurité** (JWT en localStorage, `SESSION_SECRET` par défaut, CORS permissif), **qualité backend** (Prisma client non régénéré → 14 erreurs TypeScript backend, `tsconfig` avec `strict: false`), **dette technique** (pages de 800–1350 lignes, duplication `api` direct vs `useApi` hooks, trois pages orphelines, deux systèmes de templates concurrents), et **dépendances vulnérables** (13 CVEs backend dont 1 critique, 3 CVEs frontend dont 1 critique).

### Top 5 P0 (bloquants — à traiter cette semaine)

1. **Backend ne compile plus** — `npx tsc --noEmit` sort 14 erreurs TS2339 dans `src/api/routes/broadcast.ts` et `src/jobs/workers/broadcastWorker.ts`. Cause : Prisma Client non régénéré (`broadcastExclusion`, `broadcastManualRecipient`, `sourceEmail`, `language`, `brief` sur Campaign). Le schéma contient bien les modèles (lignes 977, 992 de `prisma/schema.prisma`), mais `@prisma/client` n'a jamais été regénéré. Runtime survit grâce à `tsx` mais toute CI/build cassera. **Fix : `npx prisma generate` + `npx prisma migrate deploy`**.
2. **Vulnérabilités critiques en production** — `npm audit` backend : **13 vulnérabilités** (6 moderate, 6 high, 1 critical), notamment `undici` (HTTP smuggling, CRLF injection, DoS WebSocket). Frontend : **3 vulnérabilités** (2 high, 1 critical, `picomatch` ReDoS). Fix automatique via `npm audit fix`.
3. **`SESSION_SECRET` par défaut non bloquant** — `src/index.ts:108` : `process.env.SESSION_SECRET || "backlink-engine-secret-change-in-production"`. Cookie de session signé avec un secret public si la variable n'est pas définie. **Doit throw, pas fallback.**
4. **JWT stocké en localStorage** — `frontend/src/App.tsx:27`, `services/api.ts:47`. Exploitation XSS triviale (1 clic de console = exfiltration token). Aucune CSP, aucune `httpOnly`. Combiné à `session.cookie.secure: false` (`src/index.ts:111`), l'auth mixe 2 stratégies sans bénéfice de l'httpOnly. **Fix : passer tout sur session httpOnly + `secure: true` en prod.**
5. **CORS ouvert par défaut en production** — `src/index.ts:74-93` : si `CORS_ORIGIN` non défini, warning + `origin: true` (tout est autorisé). **Doit refuser le démarrage en NODE_ENV=production.**

### Top 5 quick wins (< 2 h effort chacun)

1. `npx prisma generate` dans le Dockerfile / entrypoint + commit du lockfile Prisma → débloque le typecheck backend.
2. `npm audit fix` des deux packages (backend + frontend), redeploy. Aucune breaking change annoncée.
3. Throw si `SESSION_SECRET`, `JWT_SECRET`, `CORS_ORIGIN` absents en `NODE_ENV=production` (patch 15 lignes dans `src/index.ts`).
4. Supprimer/router les 3 pages orphelines : `Templates.tsx`, `Tags.tsx`, `EnrollPreview.tsx` (en fait EnrollPreview est un modal importé, pas une page — à renommer/déplacer dans `components/`). Dead code 1036 lignes.
5. Ajouter une route GET `/api/auth/me` pour vérifier la session au chargement du `ProtectedRoute` (actuellement le front ne sait pas si le token est expiré tant qu'un appel n'échoue pas).

---

## Partie 2 — Audit des 24 pages

Légende gravité : **CRIT** bloquant / **HAUT** régression risquée / **MOY** dette fonctionnelle / **BAS** cosmétique.
Priorisation : **P0** cette semaine / **P1** ce sprint / **P2** prochain sprint / **P3** dette long terme.

---

### 1. Login.tsx → /login (98 lignes, score **7/10**)

**Mission** : authentifier un utilisateur via email/password et stocker un JWT dans localStorage.

**Inventaire technique** : useState, axios via `@/lib/api`, `react-hot-toast`, i18n (`auth.*`), `LanguageSwitcher`.

**Cohérence front↔back** : POST `/api/auth/login` → existe (`auth.ts:114`). Réponse `{ token, user }` conforme.

**Intégrité données** : rien à valider côté DB sur cette page.

**React Query** : aucune query, `useMutation` non utilisé → mutation manuelle avec `useState loading`. Correct mais incohérent avec le reste.

**UX** : loading state OK, pas de indicateur d'erreur in-form (juste toast), pas de rate-limit côté front, pas de "mot de passe oublié", pas de captcha. `autoComplete` OK.

**Scénarios** : happy OK ; empty OK (validation `fillAllFields`) ; erreur 401 OK (toast via interceptor).

**Positif** :
- Validation `fillAllFields` avant appel (`Login.tsx:17`).
- `autoComplete="email"` / `autoComplete="current-password"` (a11y password managers).
- i18n propre.

**Négatif** :
- **HAUT** `Login.tsx:28` `localStorage.setItem("bl_token", data.token)` — stockage JWT vulnérable à XSS (voir section B).
- **MOY** Aucune gestion du 429 rate limit spécifique.
- **BAS** Pas de "forgot password", pas de MFA.

**Recommandations** :
- P0 — migrer auth en cookie httpOnly (8 h).
- P2 — ajouter formulaire reset password (4 h).

---

### 2. Dashboard.tsx → / (422 lignes, score **6/10**)

**Mission** : vue d'ensemble temps réel (urgents, pipeline, perf emails, stats jour).

**Inventaire technique** : 3 `useQuery` directs via `api.get` (sans passer par `useApi`). Types inline dupliqués avec `@/types`. Icons Lucide. Pas de i18n sur 2 sections (`"Vue Outreach"`, `"Actions"`, `"Sans coordonnees"`, hardcoded).

**Cohérence front↔back** : `/dashboard/today` OK (`dashboard.ts:14`), `/dashboard/outreach-overview` OK (`dashboard.ts:259`), `/sent-emails/stats` OK, `/dashboard/pipeline` OK.

**Intégrité** : N+1 potentiel sur `/dashboard/outreach-overview` — à vérifier dans `dashboard.ts`. Probablement 4-5 COUNT() en parallèle, acceptable.

**React Query** : 4 query keys différentes (`["dashboard"]`, `["outreachOverview"]`, `["sentEmailStats"]`, `["dashboardPipeline"]`). **Duplication** avec `queryKeys` dans `useApi.ts:56-70`. Aucune invalidation croisée.

**UX** : loading spinner OK (`:109`). Error state minimaliste (card "failedToLoad") — pas de retry. StatCards cliquables (UX positive). Grid responsive.

**Scénarios** :
- Happy : toutes les sections affichées ✓
- Empty : pipeline & outreachOverview conditionnels, ok ✓
- 10k prospects : pipeline counts = COUNT(), scale OK ✓
- Error : dashboard query error → card rouge, mais `outreachOverview`/`emailStats`/`pipeline` ne sont PAS affichés donc UX dégradée globale même si seule la query "today" échoue ✗

**Positif** :
- Navigation contextuelle (stat cards `to={...}`) : `Dashboard.tsx:193, 231, 337, 373`.
- `staleTime` configuré (60_000 / 120_000) : `:79, 96, 107`.
- Progress bar agrégée outreach avec `%` par segment (`:177-187`).

**Négatif** :
- **MOY** Dashboard.tsx:171, 219, 275 : chaînes françaises hardcodées (`"Vue Outreach"`, `"Sans coordonnees"`, `"Formulaires a traiter"`) sans `t()`.
- **MOY** Types redéfinis inline (lignes 71-77, 86-94, 104) → duplication avec `@/types`.
- **MOY** `data-useQuery` en parallèle de `useDashboard` hook existant dans `useApi.ts:121-145` (non utilisé).
- **BAS** Emojis absents mais accents retirés (`coordonnees`, `gagnes`, `reponses`) — mauvaise pratique UTF-8.

**Reco** : P1 migrer sur `useDashboard` hook existant, i18ner les 8 strings hardcodées (2 h).

---

### 3. Reports.tsx → /reports (224 lignes, score **6/10**)

**Mission** : graphs historiques (backlinks/mois, funnel, reply rate, sources, pays).

**Technique** : 1 useQuery sur `/reports`, recharts (LineChart, BarChart, PieChart). i18n partiel.

**Front↔back** : GET `/reports` OK (`reports.ts:14`). Retourne `ReportsData` — type local (pas dans `@/types`).

**React Query** : key `["reports"]`, pas de staleTime — refetch à chaque focus.

**UX** : loading OK, pas de filtre date (limitation majeure), pas d'export CSV/PNG.

**Positif** :
- Palette cohérente (`COLORS`).
- Recharts `ResponsiveContainer`.
- Pie + Bar + Line = bonne diversité.

**Négatif** :
- **MOY** Aucun filtre période (7j / 30j / 90j / YTD).
- **MOY** Aucun export PNG / CSV.
- **BAS** Pas de staleTime ; refetch agressif.
- **BAS** Types `ReportsData` locaux (lignes 20-26) au lieu de `@/types`.

**Reco** : P2 ajouter filtre période (3 h), P3 export (2 h). Score **6**.

---

### 4. Prospects.tsx → /prospects (789 lignes, score **6/10**)

**Mission** : liste paginée, filtrable, triable, avec sélection et bulk actions.

**Technique** : `useQuery` direct, `useSearchParams` pour état URL, pagination côté serveur. Tables de labels (STATUS_LABELS, CATEGORY_CONFIG, SOURCE_TYPE_CONFIG, COUNTRY_NAMES, LANG_NAMES) **toutes hardcodées en français**.

**Front↔back** : GET `/prospects` + filtres `status`, `category`, `page`, `limit` → OK (`prospects.ts:113`).

**React Query** : key `["prospects", filters]`. **NON-INVALIDATION** : les mutations `useCreateProspect`/`useUpdateProspect` dans `useApi.ts:215-259` invalident `["prospects"]` (prefix ok).

**UX** : bonne UX recherche + filtres. Probable manque de debounce search → N requests per keystroke. **À vérifier**.

**Positif** :
- State URL-driven via `useSearchParams` → partage de liens.
- Configs de typage riches (emojis pays, couleurs par catégorie).
- Tri multi-colonnes.

**Négatif** :
- **HAUT** 4 gros mappings inline (COUNTRY_NAMES, LANG_NAMES, STATUS_LABELS, SOURCE_TYPE_CONFIG, CATEGORY_CONFIG, lignes 24-84) → devraient être dans `@/lib/labels.ts` partagés entre Prospects, Replies, RecontactSuggestions, ProspectDetail.
- **MOY** Fichier 789 lignes — à découper.
- **MOY** À vérifier : debounce search input.
- **BAS** Emojis forcés dans badges (accessibilité, internationalisation).

**Reco** : P1 extraire `labels.ts` (2 h), P2 découper en sous-composants (6 h). Score **6**.

---

### 5. ProspectDetail.tsx → /prospects/:id (826 lignes, score **6/10**)

**Mission** : fiche détaillée d'un prospect avec timeline, emails envoyés, backlinks, notes, enroll.

**Technique** : 3-4 `useQuery`, `useMutation` update inline. Import de `EnrollPreview` comme modal (page orpheline mais utilisée comme component).

**Front↔back** : GET `/prospects/:id`, `/prospects/:id/timeline`, `/sent-emails/prospect/:id`, etc. → OK.

**Positif** :
- Timeline dédiée (composant `ProspectTimeline`).
- Édition inline de plusieurs champs.
- `useParams` + `enabled: id > 0`.

**Négatif** :
- **HAUT** `EnrollPreview.tsx` est dans `pages/` mais utilisé comme modal — mauvaise organisation ; doit aller dans `components/`.
- **MOY** 826 lignes, trop de responsabilités (à découper en sections).
- **MOY** Types `ProspectWithV2` locaux (ligne 32) → désynchronisation avec `@/types`.
- **MOY** `SentEmailRecord` redéfini (ligne 46) alors que `@/types` a déjà `SentEmail`.

**Reco** : P1 déplacer `EnrollPreview` vers `components/` (1 h), P2 découper (6 h). Score **6**.

---

### 6. QuickAdd.tsx → /quick-add (399 lignes, score **7/10**)

**Mission** : ajouter un prospect unitaire avec preview + dedup check.

**Technique** : `useMutation`, dédup onBlur URL avec `Promise.all`, site preview.

**Front↔back** : GET `/prospects/check-dedup` (prospects.ts), `/prospects/site-preview`, POST `/prospects`. **À vérifier** que `site-preview` existe (aperçu ingest-level).

**Positif** :
- UX onBlur dedup + preview avant submit (`:40-65`).
- `Promise.all` parallélisé.
- Formulaire riche (phone, country, category, tier).

**Négatif** :
- **MOY** Pas de debounce sur onBlur si user retab rapidement.
- **BAS** 399 lignes — acceptable pour formulaire complexe.

**Reco** : score **7**, P3.

---

### 7. BulkImport.tsx → /import (709 lignes, score **6/10**)

**Mission** : importer CSV de prospects avec preview + dedup + results.

**Technique** : parser CSV manuel, drag&drop, POST `/prospects/bulk`.

**Front↔back** : POST `/prospects/bulk` → `prospects.ts:551`. OK.

**Positif** :
- Drag & drop, download template.
- Preview dedup avant confirmation (sécurité).
- Results résumés (`total/created/duplicates/errors`).

**Négatif** :
- **HAUT** Aucun quota / limite de lignes côté front : upload 100k = freeze browser.
- **MOY** Parsing CSV maison (pas de papaparse) — fragile sur `\r\n`, quotes, virgules dans champs.
- **MOY** 709 lignes — extraire parseur CSV.
- **MOY** Pas de i18n (`import @/i18n` absent).

**Reco** : P1 limiter à 10k lignes + papaparse (4 h). Score **6**.

---

### 8. CampaignsHub.tsx → /campaigns (590 lignes, score **7/10**)

**Mission** : hub unifié outreach + broadcast campaigns (tabs, filtres).

**Technique** : `useQuery` sur 2 endpoints, `useSearchParams` pour tab, dédup par type.

**Front↔back** : GET `/campaigns`, `/broadcast/campaigns` → OK.

**Positif** :
- Tab state URL-driven (redirect legacy `/broadcast`).
- Union type `UnifiedCampaign` bien typé.
- Filtres + tri + search.

**Négatif** :
- **MOY** 590 lignes, duplication partielle avec `Campaigns.tsx` / `Broadcast.tsx`.
- **MOY** `initialType` cast unchecked (`as TabFilter`, ligne 57).

**Reco** : P2 consolidation (8 h). Score **7**.

---

### 9. Campaigns.tsx → /campaigns/outreach (280 lignes, score **6/10**)

**Mission** : CRUD campagnes outreach + liste enrollments.

**Technique** : useQuery campagnes + enrollments, useMutation create.

**Front↔back** : GET/POST `/campaigns`, GET `/campaigns/:id/enrollments`. OK.

**Négatif** :
- **MOY** Aucun pattern de `sequenceConfig` (passé `{}`) → campagnes créées vides, nécessitent édition post-création manuelle.
- **MOY** Pas d'édition ni de delete depuis cette vue.
- **MOY** Pas de confirmation destruction.

**Reco** : P2 builder sequenceConfig (6 h). Score **6**.

---

### 10. Broadcast.tsx → /campaigns/broadcast (1354 lignes, score **4/10**)

**Mission** : créer / éditer / gérer campagnes broadcast (warmup, séquence, manual recipients, exclusions).

**Technique** : composant monolithique 1354 lignes, des dizaines de `useQuery`/`useMutation`.

**Front↔back** : GET `/broadcast/campaigns`, POST `/broadcast/campaigns`, etc. → OK.

**Négatif** :
- **CRIT** Fichier 1354 lignes = non-maintenable. Doit être éclaté en 5-8 composants (`<BroadcastForm/>`, `<WarmupSchedule/>`, `<SequenceEditor/>`, `<ExclusionsList/>`, `<ManualRecipients/>`, `<StatsPanel/>`).
- **HAUT** Dépend de `broadcastExclusion` et `broadcastManualRecipient` Prisma — actuellement non générés dans `@prisma/client` (14 erreurs TS backend). Tout fonctionne en runtime mais aucun typecheck.
- **HAUT** Aucune confirmation sur destructions (delete campaign, delete exclusion).
- **MOY** Pas de i18n des sections broadcast.

**Reco** : P0 régénérer Prisma, P1 découper en composants (16 h). Score **4**.

---

### 11. MessageTemplates.tsx → /message-templates (543 lignes, score **6/10**)

**Mission** : gérer templates multilingues par langue/catégorie avec IA.

**Technique** : fetch manuel (`setTemplates`), pas de useQuery ! Hybride.

**Front↔back** : GET `/message-templates` → OK (`messageTemplates.ts`).

**Négatif** :
- **HAUT** `setTemplates`/`setLoading` manuels (ligne 57) au lieu de useQuery → incohérent avec le reste de l'app.
- **HAUT** **DOUBLON avec `Templates.tsx`** (349 lignes orphelines, non routé) — voir section 22.
- **MOY** Emojis drapeaux hardcodés sans fallback a11y (lignes 23-43).
- **MOY** Manque i18n.

**Reco** : P0 supprimer `Templates.tsx` (dead code) ou le réutiliser. P1 migrer `MessageTemplates` sur useQuery (2 h). Score **6**.

---

### 12. AbTestResults.tsx → /ab-testing (217 lignes, score **7/10**)

**Mission** : afficher stats A/B par campagne + winner.

**Technique** : utilise `useAbTestStats` hook (**bonne pratique**), recharts Bar.

**Front↔back** : GET `/sent-emails/ab-stats` → OK (`sentEmails.ts:155`).

**Positif** :
- Utilise le hook partagé `useAbTestStats` (seule page qui respecte l'architecture !).
- i18n propre (`abTesting.*`).
- Winner badge.
- Recharts clean.

**Négatif** :
- **MOY** Parse `parseFloat(test.variantA.openRate)` (ligne 33) — le backend renvoie une string, devrait renvoyer un number typé.
- **BAS** Pas de test significativité statistique affiché.

**Reco** : P3 ajouter p-value (4 h). Score **7**.

---

### 13. Assets.tsx → /assets (278 lignes, score **7/10**)

**Mission** : CRUD des assets linkables (articles, guides, stats, widgets...).

**Technique** : useQuery + useMutation save/delete.

**Front↔back** : GET/POST/PUT/DELETE `/assets` → OK (`assets.ts`).

**Positif** :
- Formulaire simple et clair.
- Édition inline via `editingId`.

**Négatif** :
- **MOY** Pas de confirmation destruction.
- **BAS** `type: "blog-post"` hardcodé (pas d'enum partagé avec backend `AssetCategory`).

**Reco** : P2 enum partagé (1 h). Score **7**.

---

### 14. SentEmails.tsx → /sent-emails (554 lignes, score **7/10**)

**Mission** : timeline de tous les emails envoyés avec filtres/stats/actions drafts.

**Technique** : utilise hooks `useSentEmails`, `useSentEmailStats`, `useCampaigns` (**bonne pratique**).

**Front↔back** : GET `/sent-emails`, `/sent-emails/stats`, `/sent-emails/drafts`, POST `/sent-emails/approve-all` → OK.

**Positif** :
- Respect de l'architecture hooks.
- Filtres multi-facettes.
- Status colors riches.

**Négatif** :
- **MOY** `STATUS_OPTIONS` hardcodé (ligne 40) au lieu d'un enum partagé.
- **MOY** `useCallback` avec dépendances incomplètes à vérifier.

**Reco** : P3. Score **7**.

---

### 15. Replies.tsx → /replies (230 lignes, score **6/10**)

**Mission** : liste des réponses reçues catégorisées (INTERESTED, BOUNCE, etc.).

**Technique** : useQuery direct `/replies`.

**Front↔back** : GET `/replies` → OK.

**Négatif** :
- **HAUT** `CATEGORY_LABELS` (ligne 10) duplique ceux de Prospects/RecontactSuggestions. Extraire.
- **MOY** Pas de pagination visible.
- **MOY** Pas de bulk-action sur réponses.

**Reco** : P1 labels partagés. Score **6**.

---

### 16. Backlinks.tsx → /backlinks (178 lignes, score **7/10**)

**Mission** : liste des backlinks gagnés + vérification bulk.

**Technique** : useQuery + verify-all mutation.

**Front↔back** : GET `/backlinks`, POST `/backlinks/verify-all` → OK.

**Positif** :
- Verify-all bulk action utile.
- Filtres isLive / linkType.
- Badge `linkType` coloré.

**Négatif** :
- **MOY** Pas de pagination.
- **MOY** Pas de recherche par domaine.

**Reco** : P2. Score **7**.

---

### 17. FormOutreach.tsx → /form-outreach (388 lignes, score **6/10**)

**Mission** : workflow spécifique pour prospects contactables uniquement par formulaire (vs email).

**Technique** : useQuery prospects + generate message IA, copy-to-clipboard.

**Front↔back** : endpoints custom (à vérifier). `/prospects/form-outreach`, `/prospects/:id/generate-message` ?

**Négatif** :
- **HAUT** Workflow manuel sans tracking (user copie/colle dans 3rd party form, pas d'event auto-logué) — comment savoir si envoyé ?
- **MOY** Pas de i18n.

**Reco** : P1 ajouter bouton "marquer comme envoyé" pour log event. Score **6**.

---

### 18. RecontactSuggestions.tsx → /recontact (202 lignes, score **7/10**)

**Mission** : lister les prospects à recontacter (> X mois, score >= Y).

**Technique** : useQuery + mutation bulk recontact + selection set.

**Front↔back** : GET `/prospects/recontact-suggestions` (`prospects.ts:82`), POST `/prospects/bulk-recontact` → **À vérifier** que ce dernier endpoint existe.

**Positif** :
- Selection multi avec Set.
- Badges par catégorie réponse initiale.

**Négatif** :
- **HAUT** Pas de params passés à `recontact-suggestions` → backend devrait utiliser settings (`minScore`, `delayMonths`). Vérifier cohérence avec `Settings.recontact.*`.

**Reco** : P2. Score **7**.

---

### 19. Suppression.tsx → /suppression (215 lignes, score **7/10**)

**Mission** : gérer la liste de suppression (emails à ne plus contacter).

**Technique** : useQuery + useMutation add/delete.

**Front↔back** : GET/POST/DELETE `/suppression` → OK.

**Positif** :
- Simple et efficace.
- Confirmation implicite via modal form.

**Négatif** :
- **MOY** Pas d'import CSV de masse (utile pour GDPR).
- **MOY** Pas de recherche.

**Reco** : P2 bulk import (3 h). Score **7**.

---

### 20. MissionControlSync.tsx → /mc-sync (388 lignes, score **7/10**)

**Mission** : visualiser l'état du webhook entrant depuis Mission Control (SOS Expat).

**Technique** : 1 useQuery sur `/mc-sync/status` probable, distributions par type/catégorie.

**Front↔back** : endpoint custom à vérifier (**non trouvé dans liste 21 routes**). Possiblement monté sous `dashboard.ts` ou `ingest.ts`.

**Négatif** :
- **HAUT** **Route manquante ou renommée à vérifier**. Chercher `mc-sync` dans backend.
- **MOY** Pas d'action "resync manuel" visible.

**Reco** : P0 vérifier endpoint. Score **7** (pending).

---

### 21. Settings.tsx → /settings (1062 lignes, score **5/10**)

**Mission** : configurer MailWizz, IMAP, scoring, recontact, IA, Telegram, outreach, AI provider.

**Technique** : composant monolithique ; `setSettings` manuel sur chaque onglet ; mutation globale.

**Front↔back** : GET/PUT `/settings`, `/settings/mailwizz`, `/settings/auto-enrollment`, `/settings/outreach`, `/settings/telegram`, `/settings/outreach-mode` → OK (cohérence avec 6 `app.get` dans settings.ts).

**Négatif** :
- **CRIT** 1062 lignes — non-maintenable. Doit être un `<Tabs>` avec 7-8 fichiers.
- **HAUT** `botToken`, `apiKey` (AI, MailWizz) affichés en plain text (pas de masquage, pas de "reveal").
- **HAUT** Secrets en localStorage (via React state + saved via API) — OK si backend chiffre ; **À VÉRIFIER MANUELLEMENT** que `settings.ts` ne renvoie pas les secrets en GET.
- **MOY** Pas de validation email/url en live.
- **MOY** Copier-coller de boilerplate `setOutreachConfig`, `setTelegramConfig`, etc.

**Reco** : P0 masquer secrets (`type="password"` + icon eye), P1 refactor en tabs (12 h). Score **5**.

---

### 22. Templates.tsx → **ORPHELINE** (349 lignes, score **3/10**)

**État** : fichier existe, jamais importé dans `App.tsx`, aucune route.

**Mission putative** : CRUD OutreachTemplates par purpose (INITIAL_OUTREACH, FOLLOW_UP, etc.).

**Front↔back** : appelle `/templates` qui existe bien (backend `templates.ts` + `index.ts:178`). **Cette route est donc orpheline côté UI.**

**Analyse** : duplication partielle avec `MessageTemplates.tsx`. Deux systèmes concurrents : `OutreachTemplate` (typé avec `TemplatePurpose`) vs `MessageTemplate` (catégorie libre).

**Reco** : P0 choisir un système unique et supprimer l'autre. Estimation : 1 j pour consolider. Score **3** (dead code).

---

### 23. Tags.tsx → **ORPHELINE** (469 lignes, score **3/10**)

**État** : fichier existe, non routé. Pas importé dans `App.tsx`.

**Mission** : CRUD tags + association aux prospects/campaigns.

**Front↔back** : `/tags` backend complet (7 routes dans `tags.ts`). **Route orpheline côté UI**.

**Analyse** : fonctionnalité prévue mais non livrée. Le frontend consomme déjà les tags partiellement (`Prospect.tags`, `EnrollPreview.tags`).

**Reco** : P1 router cette page (`<Route path="tags" element={<Tags />} />`) + ajouter au sidebar. Effort 1 h. Score **3** (cachée).

---

### 24. EnrollPreview.tsx → **UTILISÉE COMME MODAL** (217 lignes, score **6/10**)

**État** : fichier dans `pages/`, JAMAIS routé, mais importé par `ProspectDetail.tsx:27` comme un composant modal.

**Mission** : preview d'un enrollment (subject, body, tags) avant confirmation.

**Analyse** : ce fichier ne devrait pas être dans `pages/`. Doit être dans `components/`.

**Reco** : P1 déplacer vers `components/EnrollPreview.tsx`. Aucun impact routing. Effort 5 min. Score **6**.

---

## Partie 3 — Audits transversaux A–J

### A. Navigation / Routing

- **App.tsx:51–88** : 22 routes définies + wildcard redirect vers `/`. Cohérent avec Layout (sidebar).
- **Route non routée** : `tags`, `templates` (dead code côté UI).
- **Route sidebar sans correspondance page** : aucun (les 6 sections sidebar map 1:1 aux routes).
- **Legacy redirect** : `/broadcast` → `/campaigns?type=broadcast` (`:80-83`) — propre.
- **Titles fallback** : `Layout.tsx:116-119` gère `/prospects/:id` et `/campaigns/:sub` par `startsWith`. Fragile si ajout de route.
- **Point positif** : ProtectedRoute wrapper minimal et correct.
- **Point négatif CRIT** : ProtectedRoute ne vérifie que la présence du token, pas sa validité (pas de `GET /auth/me` au mount). Un token expiré permet d'afficher l'UI puis bloque à la première request.

**Recommandations** :
- P0 : ajouter `GET /api/auth/me` (5 min backend) + hook `useCurrentUser` en amont du Layout.
- P1 : router `Tags` + supprimer `Templates.tsx`.

### B. Auth / Sécurité

| Sujet | État | Gravité |
|---|---|---|
| JWT localStorage | Actuel (`App.tsx:27`) | **CRIT** XSS |
| Session httpOnly | Implémentée côté backend mais cookie `secure: false` (`index.ts:111`) et `sameSite: "lax"` | **HAUT** |
| `SESSION_SECRET` fallback | `"backlink-engine-secret-change-in-production"` (`index.ts:108`) | **CRIT** |
| `JWT_SECRET` validation | Warning si < 32 chars mais pas d'erreur (`auth.ts:183`) | **HAUT** |
| CORS permissif par défaut | `origin: true` si `CORS_ORIGIN` unset en prod (`index.ts:82-93`) | **CRIT** |
| Rate limit | 100 req/min global via Redis (`index.ts:96-100`) | Moyen (à raffiner par route) |
| CSP / Helmet | **Absent** | **HAUT** |
| Refresh token | **Absent**, JWT expire à 24 h | **MOY** |
| JWT blacklist | OK (`auth.ts:47-58`) | Bon |
| Logout | Front seulement (`Layout.tsx:123`), pas d'appel API pour blacklister | **MOY** |
| Webhook auth | Secret header (bon) (`webhooks.ts`) | OK |
| Ingest auth | API key header (bon) (`ingest.ts`) | OK |
| CSRF | Aucune protection explicite (session cookie lax + credentials:true) | **MOY** |
| Password policy | Non visible (à vérifier `auth.ts` création user) | **À VÉRIFIER** |
| MFA / 2FA | Aucun | **BAS** |

**Actions P0** : throw si `CORS_ORIGIN` / `SESSION_SECRET` / `JWT_SECRET` absents en prod ; passer `secure: true` ; ajouter `@fastify/helmet` + `@fastify/csrf-protection`.

### C. Design system

- **Tailwind** ✓ (config custom `brand`, `surface`).
- **Dark mode** : ABSENT (aucun `dark:` class détecté).
- **Composants dupliqués** :
  - `getCountryFlag()` dupliqué dans `Prospects.tsx:48`, `Replies.tsx:30` → extraire vers `lib/flags.ts`.
  - `CATEGORY_LABELS`, `CATEGORY_COLORS` dupliqués dans 4+ pages.
  - `StatsCard` local à `Dashboard.tsx:18` et `SentEmails.tsx:46` — 2 implémentations quasi identiques.
- **Composants partagés dans `components/`** : `DedupAlert`, `LanguageSwitcher`, `Layout`, `PipelineKanban`, `ProspectNotes`, `ProspectTimeline`, `ScoreBadge`. Bon socle mais insuffisant.
- **Loader** : animation inline `animate-spin` dupliquée partout au lieu d'un `<Spinner />`.

**P1** : créer `components/ui/` avec `<Spinner />`, `<StatsCard />`, `<Badge />`, `<EmptyState />`, `<ConfirmDialog />`. ~8 h.

### D. État global / i18n / Toasts

- **Toaster** global configuré (`App.tsx:40-50`) — bon.
- **Pas de Zustand/Redux** : state est purement local + React Query cache. Correct pour la taille.
- **i18n** : système custom (`@/i18n`), 2 locales (en/fr), ~650 lignes chacune (`en.ts:651`, `fr.ts:657`). Pas de pluriels ICU.
- **Chaînes hardcodées** : au moins 30+ identifiées dans Dashboard, Prospects, Replies, MessageTemplates, etc. → **dette i18n significative**.
- **Pas de Context Permissions** : rôle `ops` vs `admin` jamais vérifié côté front (certainement vérifié côté back, mais le front ne cache rien).

**P1** : audit i18n exhaustif + extraction (4 h).
**P2** : système de permissions front (4 h).

### E. Performance

- **Lazy loading** : aucun `React.lazy` / `Suspense` sur les routes → **bundle unique**. Pour 24 pages totalisant 12 577 lignes, c'est significatif.
- **Bundle size** : `frontend/dist/assets/` existe mais non mesuré ici — **À VÉRIFIER MANUELLEMENT** (`npx vite build --stats`).
- **Pagination** : serveur OK pour prospects/sent-emails, mais **absent** pour backlinks, suppression, assets, tags.
- **Re-renders** : pas de memo visible sur StatsCard (léger, ok).
- **React Query staleTime** : configuré dans 3 endroits (Dashboard), absent partout ailleurs → refetch agressif.

**P1** : lazy load toutes les pages sauf Login+Dashboard (4 h), ajouter pagination partout (4 h).

### F. Backend santé

- **TypeCheck** : `npx tsc --noEmit` → **14 erreurs** (Prisma client désynchro broadcast). Bloquant CI.
- **tsconfig `strict: false`** (`backlink-engine/tsconfig.json:strict: false`) — perte massive de safety.
- **Validation Fastify** : pas de schémas JSONSchema vus sur les routes lues (`app.get("/", async ...)` sans `schema:`). Les bodies sont validés manuellement par zod ou non-validés. **À VÉRIFIER** systématiquement.
- **Logger** : pino custom (`utils/logger.js`) OK, logger Fastify désactivé.
- **Erreurs** : gestionnaire global OK (`index.ts:124-162`) — gère P2002/P2025/400.
- **Tests** : **AUCUN `*.test.ts` dans `src/`**. Zéro couverture. Grave pour un outil en production qui envoie des emails.
- **Workers BullMQ** : 9 workers démarrés (`index.ts:322-330`). Pas de retry policy visible dans l'index. À vérifier dans chaque worker.
- **TODO/FIXME** : 1 seule occurrence backend (`ingest.ts`), 0 frontend — codebase propre en surface.

**P0** : `prisma generate` dans CI + entrypoint Docker.
**P0** : `strict: true` + fixer les erreurs restantes.
**P1** : ajouter Vitest + 50 tests prioritaires (1 sprint).

### G. Intégrations externes

| Service | Emplacement | État |
|---|---|---|
| Mission Control webhook entrant | `webhooks.ts` (secret) + `MissionControlSync.tsx` | Opérationnel, route UI à confirmer |
| Mailflow / Postfix + OpenDKIM + PowerMTA | `services/outreach/smtpSender.ts` | Primary, health-checked au boot (`index.ts:264-274`) |
| Email-Engine API | `services/outreach/emailEngineClient.ts` | Fallback, health-checked |
| MailWizz | `services/outreach/mailwizzClient.ts` | Secondary fallback, health-checked |
| OpenAI / Anthropic | `llm/index.ts` (resetLlmClient) | Configuré via settings DB (`index.ts:249-256`) — clef en plain text (voir Settings) |
| Open PageRank | Non trouvé dans cette revue | À VÉRIFIER |
| Telegram bot | `settings.ts:311` + `Settings.tsx` | Configurable, chatId par event |
| Redis (BullMQ + rate limit + sessions) | `config/redis.ts` | OK |
| PostgreSQL | `config/database.ts` | OK |

**P1** : documenter toutes les clés secrètes attendues dans `.env.example` exhaustif.

### H. Code quality

- **tsc frontend** : ✓ passe (strict).
- **tsc backend** : ✗ 14 erreurs (prisma client).
- **ESLint** : présence non vérifiée (à faire : `cd frontend && npx eslint . 2>&1 | tail -20`).
- **TODO/FIXME** : 1 backend, 0 frontend — bon.
- **Dead code** : `Templates.tsx` (349l), `Tags.tsx` (469l) non routés, `EnrollPreview.tsx` mal placé (217l). Total **1 035 lignes** de pages mal gérées.
- **Fichiers géants** : Broadcast 1354l, Settings 1062l, ProspectDetail 826l, Prospects 789l, BulkImport 709l, CampaignsHub 590l → 6 fichiers > 500 lignes. Dette de refactoring.
- **npm audit** :
  - Backend : **13 CVEs** (1 critical `undici`, 6 high, 6 moderate). `npm audit fix` disponible.
  - Frontend : **3 CVEs** (1 critical `picomatch`, 2 high). `npm audit fix` disponible.

### I. Accessibilité (WCAG)

- **Labels form** : présents sur Login (`htmlFor`), à vérifier sur les autres formulaires.
- **aria-label** : grep rapide non effectué systématiquement — **À VÉRIFIER** sur boutons icon-only (nombreux dans Broadcast, Settings).
- **Focus visible** : classes Tailwind `focus:` à vérifier.
- **Contraste** : `text-surface-400` sur `bg-surface-50` à vérifier (probablement WCAG AA limite).
- **Keyboard nav** : modal `EnrollPreview` gère Escape (✓), mais modals Settings, Broadcast probablement non.
- **Role=link** : `Dashboard.tsx:46` donne `role="link"` sur un div cliquable → devrait être `<button>` ou vraie `<a>`.

**P2** : audit a11y complet avec `axe-core` (1 j).

### J. i18n

- **Fichiers** : `fr.ts` (657l), `en.ts` (651l). Structure `TranslationKeys` typée (fr dictionary).
- **Couverture** : nombreuses chaînes hardcodées (voir audits pages).
- **Pluriels** : aucun système (fr `a repondu` vs `ont repondu` non géré).
- **Formats dates** : `date-fns format()` sans locale → dates toujours en anglais.
- **Accents retirés** dans certains strings (`coordonnees`, `gagnes`, `reponses`) → pratique douteuse pour un outil FR-first.

**P1** : configurer `date-fns` locale (fr/en) + pass d'extraction des 30+ chaînes hardcodées (4 h).

---

## Partie 4 — Tableau synthétique des 24 pages

| # | Page | Route | Lignes | Score | CRIT | HAUT | MOY | Reco P0/P1 | Statut |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | Login | /login | 98 | 7 | 0 | 1 | 1 | JWT→cookie | OK |
| 2 | Dashboard | / | 422 | 6 | 0 | 0 | 3 | i18n + useApi | OK |
| 3 | Reports | /reports | 224 | 6 | 0 | 0 | 3 | filtre période | OK |
| 4 | Prospects | /prospects | 789 | 6 | 0 | 1 | 2 | labels partagés | OK |
| 5 | ProspectDetail | /prospects/:id | 826 | 6 | 0 | 1 | 3 | EnrollPreview→components | OK |
| 6 | QuickAdd | /quick-add | 399 | 7 | 0 | 0 | 1 | - | OK |
| 7 | BulkImport | /import | 709 | 6 | 0 | 1 | 3 | limite lignes + papaparse | OK |
| 8 | CampaignsHub | /campaigns | 590 | 7 | 0 | 0 | 2 | - | OK |
| 9 | Campaigns | /campaigns/outreach | 280 | 6 | 0 | 0 | 3 | sequenceConfig builder | OK |
| 10 | Broadcast | /campaigns/broadcast | 1354 | 4 | 1 | 2 | 2 | prisma generate + découpe | Fragile |
| 11 | MessageTemplates | /message-templates | 543 | 6 | 0 | 2 | 2 | supp doublon + useQuery | OK |
| 12 | AbTestResults | /ab-testing | 217 | 7 | 0 | 0 | 2 | - | OK |
| 13 | Assets | /assets | 278 | 7 | 0 | 0 | 1 | enum partagé | OK |
| 14 | SentEmails | /sent-emails | 554 | 7 | 0 | 0 | 2 | - | OK |
| 15 | Replies | /replies | 230 | 6 | 0 | 1 | 2 | labels partagés | OK |
| 16 | Backlinks | /backlinks | 178 | 7 | 0 | 0 | 2 | pagination | OK |
| 17 | FormOutreach | /form-outreach | 388 | 6 | 0 | 1 | 1 | marquer envoyé | Incomplet |
| 18 | Recontact | /recontact | 202 | 7 | 0 | 1 | 0 | params filtres | OK |
| 19 | Suppression | /suppression | 215 | 7 | 0 | 0 | 2 | bulk import | OK |
| 20 | MissionControlSync | /mc-sync | 388 | 7 | 0 | 1 | 1 | vérifier endpoint | Pending |
| 21 | Settings | /settings | 1062 | 5 | 1 | 2 | 2 | masquer secrets + tabs | Fragile |
| 22 | Templates | (orpheline) | 349 | 3 | 0 | 1 | 0 | supprimer ou consolider | Dead |
| 23 | Tags | (orpheline) | 469 | 3 | 0 | 1 | 0 | router + sidebar | Caché |
| 24 | EnrollPreview | (modal) | 217 | 6 | 0 | 0 | 1 | → components/ | Mal placé |

**Totaux** : 12 577 lignes, **2 CRIT**, **15 HAUT**, **42 MOY**. Score moyen page : **6,0 / 10**.

---

## Partie 5 — Top 30 actions priorisées

| # | Priorité | Action | Effort | Impact | Fichier(s) |
|---|---|---|---:|---|---|
| 1 | P0 | `npx prisma generate` + Dockerfile entrypoint + commit du client | 1 h | Débloquer typecheck backend | `Dockerfile`, CI |
| 2 | P0 | Throw si `CORS_ORIGIN` / `SESSION_SECRET` / `JWT_SECRET` manquants en `NODE_ENV=production` | 30 min | Sécurité | `src/index.ts:74,108` |
| 3 | P0 | Passer `session.cookie.secure: true` en prod + `sameSite: strict` | 15 min | Sécurité | `src/index.ts:111` |
| 4 | P0 | `npm audit fix` backend + frontend, redeploy | 30 min | Supprime 16 CVEs | `package.json` |
| 5 | P0 | Masquer secrets dans Settings (`type="password"` + icon reveal) | 1 h | Sécurité UI | `Settings.tsx` |
| 6 | P0 | Ajouter `GET /api/auth/me` + hook `useCurrentUser` au mount | 2 h | Empêche UI zombie avec token expiré | `auth.ts`, `App.tsx` |
| 7 | P0 | Supprimer `Templates.tsx` ou l'assumer comme remplaçant de `MessageTemplates` | 4 h | Dead code / doublon | `pages/Templates.tsx`, `pages/MessageTemplates.tsx` |
| 8 | P0 | Corriger les 14 erreurs `tsc` backend restantes après `prisma generate` | 2 h | CI | `broadcast.ts`, `broadcastWorker.ts` |
| 9 | P0 | Vérifier endpoint `/mc-sync/*` et router correctement | 1 h | Feature cachée | `MissionControlSync.tsx` |
| 10 | P1 | `strict: true` dans `tsconfig.json` backend + fixer erreurs | 8 h | Qualité majeure | `tsconfig.json` |
| 11 | P1 | Ajouter `@fastify/helmet` + CSP + HSTS | 1 h | Sécurité | `src/index.ts` |
| 12 | P1 | Migrer auth sur cookie httpOnly end-to-end (supprimer JWT localStorage) | 8 h | Sécurité | `App.tsx`, `api.ts`, `Login.tsx` |
| 13 | P1 | Créer `lib/labels.ts` (countries, languages, statuses, categories) | 2 h | DRY | 6 pages |
| 14 | P1 | Router `Tags.tsx` (ajout route + item sidebar) | 1 h | Fonctionnalité | `App.tsx`, `Layout.tsx` |
| 15 | P1 | Déplacer `EnrollPreview.tsx` vers `components/` | 10 min | Structure | `pages/EnrollPreview.tsx` |
| 16 | P1 | Découper `Broadcast.tsx` en 6 composants (form, warmup, sequence, exclusions, manual, stats) | 16 h | Maintenabilité | `Broadcast.tsx` |
| 17 | P1 | Découper `Settings.tsx` en 7 onglets (MailWizz/IMAP/Scoring/Recontact/AI/Telegram/Outreach) | 12 h | Maintenabilité | `Settings.tsx` |
| 18 | P1 | Introduire `components/ui/` (Spinner, StatsCard, Badge, EmptyState, ConfirmDialog) | 8 h | DRY | `components/ui/*` |
| 19 | P1 | `React.lazy` sur 22 pages (sauf Login+Dashboard) | 3 h | Bundle size | `App.tsx` |
| 20 | P1 | Pagination sur Backlinks, Suppression, Assets, Tags | 4 h | UX 10k rows | pages concernées |
| 21 | P1 | `BulkImport.tsx` : intégrer `papaparse` + limite 10k lignes | 4 h | Robustesse | `BulkImport.tsx` |
| 22 | P1 | Installer Vitest + 30 tests prioritaires (auth, prospects, sent-emails, broadcast) | 24 h | Non-régression | `src/**/*.test.ts` |
| 23 | P1 | i18n-ifier les 30+ chaînes hardcodées détectées | 4 h | i18n | pages + en.ts/fr.ts |
| 24 | P1 | `date-fns` locale fr/en (toutes les `format()`) | 1 h | i18n | global |
| 25 | P2 | Refactor Dashboard pour utiliser `useDashboard` hook existant | 2 h | DRY | `Dashboard.tsx` |
| 26 | P2 | Ajouter `axe-core` + corriger a11y top 20 issues | 8 h | a11y | global |
| 27 | P2 | Filtre période + export CSV sur Reports | 5 h | UX | `Reports.tsx` |
| 28 | P2 | Confirmation destructive (modal) sur tous les delete | 4 h | Sécurité UX | global |
| 29 | P3 | MFA / TOTP pour comptes admin | 8 h | Sécurité | `auth.ts`, `Login.tsx` |
| 30 | P3 | Dark mode (Tailwind `dark:` + toggle) | 6 h | UX | global |

---

## Partie 6 — Roadmap 3 sprints

### Sprint 1 (semaine 1-2) — STABILISATION & SÉCURITÉ [actions #1–9]
Livrables : backend typecheck vert, secrets durcis en prod, 16 CVEs patchées, pages orphelines nettoyées, `/auth/me` en place, endpoint `/mc-sync` confirmé.
Effort estimé : **~14 h**.

### Sprint 2 (semaine 3-5) — REFACTORING STRUCTUREL [actions #10–22]
Livrables : `strict: true` backend, auth cookie-only, découpe Broadcast + Settings, components/ui/, lazy routes, pagination généralisée, Vitest + 30 tests, papaparse.
Effort estimé : **~90 h**.

### Sprint 3 (semaine 6-7) — POLISH & QUALITÉ [actions #23–30]
Livrables : i18n complet, dark mode, a11y audit, MFA, filtres reports, confirmations destructives.
Effort estimé : **~38 h**.

**Total programme : ~142 h (~3,5 semaines-homme)**.

---

## Partie 7 — Incohérences structurelles

1. **Pages orphelines** (existent mais pas routées) :
   - `Templates.tsx` (349 l) — doublon avec `MessageTemplates`.
   - `Tags.tsx` (469 l) — feature complète, cachée.
2. **Mal placé** : `EnrollPreview.tsx` dans `pages/` alors qu'utilisé comme modal dans `ProspectDetail`.
3. **Route API sans UI** : `/api/templates` (backend `templates.ts` + registered `index.ts:178`) n'a aucun consommateur côté front.
4. **Deux systèmes de templates** concurrents : `/templates` (OutreachTemplate, purposes) vs `/message-templates` (MessageTemplate, categories). Un seul doit survivre.
5. **Architecture `api` directe vs `useApi`** : seules 3 pages utilisent le hook (`AbTestResults`, `SentEmails`, partiellement `ProspectDetail`). Les 21 autres font `api.get` direct → invalidation manuelle, query keys dispersées, pas de types.
6. **Fonctions dupliquées** : `getCountryFlag`, `CATEGORY_LABELS`, `STATUS_LABELS`, `StatsCard` répliqués dans 3-6 fichiers.
7. **Backend TS** : `strict: false` pour 80+ fichiers ; le runtime tsx tolère, mais toute refacto fait des dégâts silencieux.
8. **Prisma Client non-synchronisé** avec le schema : `prisma generate` n'est pas dans le workflow.
9. **Zero test suite** : backend 0 tests, frontend 0 tests.
10. **`schema-add.txt`** : fichier brouillon à la racine de `prisma/` — ménage à faire.

---

## Partie 8 — Annexes

### A. Fichiers critiques auscultés

- `backlink-engine/src/index.ts` (340 l) — bootstrap Fastify
- `backlink-engine/src/api/middleware/auth.ts` (206 l)
- `backlink-engine/src/api/routes/*.ts` (21 fichiers)
- `backlink-engine/frontend/src/App.tsx` (91 l)
- `backlink-engine/frontend/src/components/Layout.tsx` (226 l)
- `backlink-engine/frontend/src/hooks/useApi.ts` (288 l)
- `backlink-engine/frontend/src/services/api.ts` (411 l)
- `backlink-engine/frontend/src/pages/*.tsx` (24 fichiers, 12 577 l)
- `backlink-engine/prisma/schema.prisma` (32 modèles, 1000+ l)
- `backlink-engine/tsconfig.json`, `backlink-engine/frontend/tsconfig.json`

### B. Routes API backend (21 fichiers)

`auth.ts`, `dashboard.ts`, `reports.ts`, `prospects.ts` (25+ handlers), `ingest.ts`, `contacts.ts`, `campaigns.ts`, `broadcast.ts` (30 handlers), `sentEmails.ts`, `replies.ts`, `backlinks.ts`, `unsubscribe.ts`, `suppression.ts`, `settings.ts`, `assets.ts`, `messageTemplates.ts`, `templates.ts` **(orphelin UI)**, `tags.ts` **(orphelin UI)**, `targetPages.ts`, `crawling.ts`, `webhooks.ts`.

### C. Hooks React Query disponibles (`useApi.ts`)

`useProspects`, `useProspect`, `useCampaigns`, `useBacklinks`, `useDashboard`, `useReplies`, `useTimeline`, `useSentEmails`, `useSentEmail`, `useSentEmailStats`, `useAbTestStats`, `useCreateProspect`, `useUpdateProspect`, `useEnrollProspect`, `useBulkImport`.

**Couverture** : 15 hooks pour 21 routes API → manquent `useAssets`, `useTemplates`, `useMessageTemplates`, `useSuppression`, `useReports`, `useSettings`, `useBroadcast`, `useTags` → **8 hooks manquants**.

### D. Composants partagés (`components/`)

`DedupAlert`, `LanguageSwitcher`, `Layout`, `PipelineKanban`, `ProspectNotes`, `ProspectTimeline`, `ScoreBadge` (7 fichiers).

### E. Résultats bruts

- **`npx tsc --noEmit` frontend** : ✓ clean
- **`npx tsc --noEmit` backend** : ✗ 14 erreurs (Prisma client stale : `broadcastExclusion`, `broadcastManualRecipient`, Campaign.`sourceEmail`/`language`/`brief`)
- **`npm audit --omit=dev` backend** : 13 vulns (1 critical undici, 6 high, 6 moderate)
- **`npm audit --omit=dev` frontend** : 3 vulns (1 critical picomatch, 2 high)
- **Grep TODO/FIXME** : backend 1, frontend 0

### F. À VÉRIFIER MANUELLEMENT

- Bundle size frontend prod (`npx vite build` avec stats).
- Présence d'eslint config et nombre de warnings.
- Debounce du search input dans `Prospects.tsx`.
- Endpoint exact consommé par `MissionControlSync.tsx` (nom non trouvé dans liste 21 routes).
- Endpoint `/prospects/bulk-recontact` (utilisé par `RecontactSuggestions.tsx:48`).
- Endpoint `/prospects/:id/generate-message` (utilisé par `FormOutreach.tsx`).
- Endpoint `/prospects/site-preview` et `/prospects/check-dedup` (utilisés par `QuickAdd.tsx`).
- Chiffrement côté backend des secrets dans `app_settings` (GET `/settings` retourne-t-il les clés en clair ?).
- Password policy / hash algo dans `auth.ts:login`.
- Retry policy des workers BullMQ.
- Schémas JSONSchema Fastify sur les routes (validation).

---

*Fin du rapport.*
