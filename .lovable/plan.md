# Plan — Suite Dashboard Coach

Reprise après Lot A (DB + pain reports) et début Lot B (composants dashboard + SessionDetail).

## Lot B — Finalisation

### 1. Refonte `src/pages/coach/Dashboard.jsx`
Réécriture complète pour intégrer les composants déjà créés :
- 4 cards métriques en haut (coachés actifs, séances 7j, à traiter, RPE moyen 7j) via `getDashboardMetrics()`
- Section "À traiter en priorité" → `<PriorityFeed />`
- Section "Séances récentes" (10 dernières, temps réel) → `<RecentSessionsList />`
- Section "Mes coachés" (triés par alerte) → `<MembersTable />`
- Branchement Realtime sur `sessions`, `pain_reports`, `technique_videos`, `messages` pour rafraîchir le feed

### 2. Onglet SUIVI dans `src/pages/coach/Member.jsx`
Nouveau tab "Suivi" avec :
- KPIs 30j (séances faites/prévues, adhérence %, RPE moyen, douleurs ouvertes)
- Mini-historique des dernières douleurs (avec bouton "résoudre")
- Liste des exos à surveiller (RPE > cible récurrent, "trop dur" répété, "n'a pas pu faire")
- Bouton "marquer comme vu" sur les séances non revues

Server function : `getMemberFollowup(memberId)` dans `coach-dashboard.functions.ts`.

## Lot C — Insights & Notifications

### 3. Charts (Recharts déjà installé)
Dans l'onglet Suivi du membre :
- **Adhérence 8 semaines** : `<BarChart>` séances faites vs prévues par semaine
- **RPE 7 jours** : `<LineChart>` RPE moyen par séance avec ligne cible
- Server function : `getMemberCharts(memberId)`

### 4. Progression par exercice (vue coach)
Nouveau composant `<ExerciseProgressionChart />` dans Member :
- Sélecteur d'exercice (liste des exos joués par le membre)
- `<ComposedChart>` : poids (barres) + RPE (ligne) par séance
- Server function : `getExerciseProgression(memberId, exerciseName)`

### 5. Notifications coach
- Composant `<NotificationBell />` dans le header coach
- Abonnement Realtime aux 4 canaux (sessions complétées, pain_reports nouvelles, videos non revues, messages non lus)
- Compteur badge "à traiter" basé sur `getDashboardMetrics().toDo`
- Persistance localStorage des notifs déjà ouvertes (pour distinguer non lu)
- Décrémentation du badge quand un item est traité (résoudre douleur, marquer séance vue, etc.)

### 6. Helpers serveur additionnels
Ajouts à `src/lib/coach-dashboard.functions.ts` :
- `getMemberFollowup(memberId)` — KPIs 30j + douleurs ouvertes + exos à surveiller
- `getMemberCharts(memberId)` — séries adhérence 8s + RPE 7j
- `getExerciseProgression(memberId, exerciseName)` — séries poids/RPE par séance

## Fichiers touchés

**Créés :**
- `src/components/coach/AdherenceChart.tsx`
- `src/components/coach/RpeChart.tsx`
- `src/components/coach/ExerciseProgressionChart.tsx`
- `src/components/coach/MemberFollowupTab.tsx`
- `src/components/coach/NotificationBell.tsx`

**Modifiés :**
- `src/pages/coach/Dashboard.jsx` — refonte complète
- `src/pages/coach/Member.jsx` — nouvel onglet "Suivi"
- `src/lib/coach-dashboard.functions.ts` — 3 server functions ajoutées
- Header coach (à identifier) — intégration `<NotificationBell />`

## Critères de validation
- Dashboard charge en < 1s, 5s pour comprendre l'état des coachés
- Realtime : nouvelle douleur ou séance terminée apparaît sans reload
- Badge "à traiter" décrémente correctement
- Charts s'affichent même avec peu de données (états vides clairs)
- Aucune régression sur les patchs précédents (renommage exos, plyo, push/pull/legs, pain dialog)

Prêt à exécuter dès passage en build mode.
