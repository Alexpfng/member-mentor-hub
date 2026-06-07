## Phase 2 — Séance libre côté coach

Objectif : le coach voit clairement les séances libres (différentes du programme), avec photos/vidéos et activités libres en ligne, et l'adhérence au programme n'est plus faussée.

### 1. Backend — server functions

**`src/lib/coach-dashboard.functions.ts` — étendre `getSessionDetail`**
- Charger en parallèle :
  - `free_activities` (où `session_id = …`, ordonnés par `order_index`)
  - `session_media` (mêmes critères) + générer une URL signée par item via `supabaseAdmin.storage.from('session-media').createSignedUrl(path, 3600)` (et pareil pour `thumbnail_path`)
- Inclure dans le retour : `session_type`, `free_title`, `free_category` (déjà dans le select à compléter), `freeActivities`, `media: [{ id, type, url, thumbnailUrl, caption }]`.

**Adhérence — exclure les séances libres**
- Dans `getDashboardMetrics`, `getMembersOverview`, `getMemberFollowup`, `getMemberCharts` : ajouter `.eq("session_type", "program")` sur toutes les requêtes `sessions` qui servent au calcul d'adhérence (done/total/recent7/sessions7By/adhR). Les requêtes de volume, RPE, durée, "récentes" gardent toutes les séances.
- `getRecentSessions` : garder toutes les séances mais exposer `sessionType`, `freeTitle`, `freeCategory` dans le retour.
- `getPriorityFeed` : pas de changement (RPE/douleur/vidéos restent pertinents même pour libres).

**`getMemberFollowup`** : ajouter dans `kpis` un `freeSessions30` (compte des séances `session_type='free'` terminées sur 30j) ; `recentSessions` doit inclure `sessionType`.

### 2. UI Coach

**`src/components/coach/RecentSessionsList.tsx`**
- Si `s.sessionType === 'free'` : afficher un badge `LIBRE` (vert/cyan, style `cst-mono`) à côté du nom, et utiliser `s.freeTitle` (+ icône catégorie) comme libellé au lieu de `s.label` + semaine/jour.

**`src/pages/coach/SessionDetail.tsx`**
- En tête : si `session_type='free'`, sous-titre = `freeTitle` + chip catégorie, masquer la grille "détail par exercice prévu vs réalisé".
- Nouvelle section "ACTIVITÉS LIBRES" rendant `freeActivities` (carte par activité : nom, catégorie, série/reps/charge OU distance/durée/D+ OU durée/intensité + note + RPE).
- Nouvelle section "PHOTOS & VIDÉOS" : galerie 3-col (réutiliser `src/components/cst/MediaGallery.tsx`) avec les URLs signées du backend ; clic = lightbox plein écran (image native ou `<video controls>`).
- Si séance programme : comportement actuel inchangé.

**`src/components/coach/PriorityFeed.tsx`** : non modifié (les notifs "séance libre terminée" arrivent déjà via le message auto envoyé par `finishFreeSession` en Phase 1).

### 3. UI Membre — finitions

**`src/pages/membre/Carnet.tsx`**
- Sous le chiffre `sessions_done / sessions_planned` (programme), afficher une ligne secondaire `+ N séance(s) libre(s)` si applicable. Nécessite ajout d'un champ `freeSessions` retourné par la query du carnet (à brancher sur la query déjà utilisée — soit `member-stats.functions.ts`, soit count direct côté composant).

**`src/lib/member-stats.functions.ts`**
- Vérifier `getMemberDashboard` : exclure `session_type='free'` du calcul d'adhérence, garder dans le compte de volume/durée/PR. Ajouter `freeSessionsThisWeek` au retour si la donnée est utilisée par le dashboard.

### 4. Critères d'acceptation

- [ ] Sur la fiche coach d'une séance libre : titre + catégorie + activités listées + médias affichés (signed URLs).
- [ ] Badge `LIBRE` visible dans la liste des séances récentes coach.
- [ ] L'adhérence (dashboard coach, fiche membre coach, carnet membre) n'est plus impactée par les séances libres terminées.
- [ ] Le volume total et le nombre total de séances (vue "activité") incluent les libres.
- [ ] Compteur "+ N séances libres" affiché dans le carnet hebdo membre quand > 0.
- [ ] Rien n'a régressé sur l'affichage des séances de programme.

### Détails techniques

- Bucket `session-media` privé → toutes les URLs côté coach passent par `createSignedUrl` (TTL 1h) générées dans `getSessionDetail`.
- Pas de nouvelle migration nécessaire (tables `free_activities` et `session_media` créées en Phase 1, colonnes `session_type/free_title/free_category` déjà présentes sur `sessions`).
- Pas de modification des RLS (les policies coach existantes couvrent déjà la lecture).
