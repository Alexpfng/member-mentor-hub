## Espace coaché enrichi — plan de livraison

Objectif : donner au membre le contrôle (ordre libre, planning libre), le suivi (poids, douleurs), la motivation (carnet de bord hebdo, PR, streak) et un dashboard clair.

### Lot A — Fondations base de données

Migration unique avec GRANTs + RLS :

1. `planned_sessions` (member_id, program_id, week_number, day_label, planned_date, reminder_time, status, session_id) — RLS : membre gère les siens, coach lit.
2. `weekly_logbooks` (member_id, week_number, period_start/end, sessions_done/planned, total_volume_kg, total_duration_min, avg_rpe, weight_start/end, new_prs jsonb, feelings jsonb, pain_summary, coach_message, generated_at) — RLS : membre lit les siens, coach lit/écrit (pour `coach_message`).
3. `member_notification_prefs` (user_id PK, planned_session bool, weight_reminder bool, logbook bool, pr bool, new_week bool, coach_msg bool, streak bool, weight_reminder_dow int, weight_reminder_time time) — RLS : self.
4. Realtime sur `planned_sessions` et `weekly_logbooks`.

### Lot B — Server functions

Nouveau `src/lib/planning.functions.ts` :
- `listWeekPlan({weekNumber})` — séances de la semaine en cours (depuis programme assigné) + statut fait/planifié/libre, jointes avec `planned_sessions` et `sessions`.
- `upsertPlannedSession({weekNumber, dayLabel, plannedDate, reminderTime?})`.
- `movePlannedSession({id, plannedDate})`.
- `markDayRest({date})` / `clearPlannedDay({date})`.

Nouveau `src/lib/weight.functions.ts` :
- `logWeight({weightKg, date?, note?})`, `listWeights({weeks=8})`, `getWeightTrend()` (delta 7j, moyenne 8 sem).

Nouveau `src/lib/logbook.functions.ts` :
- `getLogbook({weekNumber})` — lit ou génère à la volée si semaine terminée.
- `generateLogbook({memberId, weekNumber})` — agrège sessions, set_logs, PR, feelings, pain_reports, weight_logs ; insère/UPSERT `weekly_logbooks`.
- `setCoachMessage({logbookId, message})` (coach).

Étendre `src/lib/coach-dashboard.functions.ts` ou créer `src/lib/member-stats.functions.ts` :
- `getMemberDashboard()` — séance du jour, streak (semaines consécutives ≥ N séances), adhérence semaine, poids actuel + delta, dernier PR, total semaine, mot du coach actif.
- `getMemberProgression()` — stats globales, courbe poids 8 sem, liste PR, progression par exercice.

Notif prefs : `getNotificationPrefs()`, `updateNotificationPrefs(patch)`.

### Lot C — Cron carnet de bord + rappels

Route publique `src/routes/api/public/hooks/generate-logbooks.ts` (POST, vérification via `apikey` anon) : itère membres actifs avec semaine terminée non encore générée, appelle `generateLogbook`.

Cron pg_cron (via supabase--insert après migration) : tous les dimanches 20h → POST `generate-logbooks`. Optionnel : rappel poids hebdo et rappel jour planifié (notification in-app via toast au prochain login + bell — pas de push natif dans ce lot).

### Lot D — UI membre (refonte)

**Dashboard (`Dashboard.jsx`)** — refonte :
- Header « Bon matin, {prénom} » + date/semaine.
- Bandeau streak 🔥 si > 1 semaine.
- Carte « Séance du jour » : si planifiée aujourd'hui → bouton COMMENCER, sinon liste « à faire cette semaine ».
- Mini planning hebdo (7 pastilles LUN→DIM avec statut).
- 4 indicateurs : adhérence semaine, poids + delta, dernier PR, volume/durée semaine.
- Mot du coach (dernier `coach_message` non lu).
- Boutons accès Carnet / Progression.

**Programme (`Programme.jsx`)** — refonte :
- Barre de progression globale du programme.
- Accordéons par semaine ; semaine en cours dépliée par défaut.
- Lignes séance : statut (✓ / ● aujourd'hui / ○ planifiée / ○ à planifier / 🔒 verrouillée), date+durée si faite, bouton [▶] ou [📅].
- Aucun verrou d'ordre sur la semaine courante publiée.

**Nouvelle page Planning (`Planning.jsx`)** + route `_authenticated.membre.planning.tsx` :
- Vue 7 jours en grille (desktop) / liste verticale (mobile).
- Drag & drop séance non planifiée → jour (via `@dnd-kit/core` déjà présent sinon `bun add @dnd-kit/core @dnd-kit/sortable`).
- Tap jour vide → modal « Planifier une séance » avec liste.
- Tap séance planifiée → déplacer / supprimer / marquer repos.
- Toggle « rappel » par séance.

**Suivi poids** :
- Carte dans Dashboard avec bouton « + Noter mon poids ».
- Modal `WeightLogDialog.tsx` (input numérique kg, date, note).
- Courbe 8 semaines dans Progression (recharts LineChart).

**Douleurs** : `PainReportDialog.tsx` existe déjà côté séance ; ajouter dans Profil (ou nouvel onglet Historique) une liste « Mes signalements » avec statut (active / vue / résolue).

**Carnet de bord** — nouvelle page `Carnet.jsx` + route `_authenticated.membre.carnet.tsx` (et `_authenticated.membre.carnet.$week.tsx`) :
- Layout éditorial : stats, évolution, PR, ressenti, à surveiller, mot du coach, CTA « Voir ma nouvelle semaine ».
- Ton motivant garanti (helper qui reformule selon adhérence).

**Progression (`Progression.jsx`)** — enrichir :
- Stats globales en haut, courbe poids, liste PR avec barres, sélecteur exercice → courbe charge+RPE (réutilise `ExerciseProgressionChart`).

**Records & streak** :
- À la fin d'une séance, détecter PR (charge ou reps max sur l'exo) → insertion `personal_records` + toast confettis (`canvas-confetti` à ajouter) « NOUVEAU RECORD 🏆 ».
- Streak calculé serveur : nombre de semaines consécutives avec ≥ 3 séances faites (paramétrable).

**Préférences notifications** : section dans `Profil.tsx` avec toggles.

**Navigation** : ajouter Planning + Carnet dans `MemberNav.jsx` (Accueil · Programme · Planning · Progrès · Messages · Profil — adapter sans casser).

### Lot E — Polissage & non-régression

- Vérifier que les patchs précédents tiennent (saisie poids fluide en séance, bouton retour, exos PDC, contraste, sommaire).
- Empty states encourageants partout (jamais culpabilisant).
- i18n FR confirmé.

### Détails techniques

- Couleurs/statuts via tokens existants (`--primary`, `--muted`, ajouter `--status-done`, `--status-today`, `--status-planned`, `--status-empty`, `--status-rest` dans `src/styles.css` si manquant).
- Drag & drop : `@dnd-kit/core` (vérifier présence sinon installer).
- Confettis : `canvas-confetti` (~1Ko) à ajouter.
- Cron : utilisé via `supabase--insert` après migration, URL stable `project--b874bc4b-f1bb-4a60-a4d8-9d9571de7494.lovable.app`.
- Détection PR : trigger SQL sur `set_logs` AFTER INSERT comparant au max précédent par (member_id, exercise_name) — insère dans `personal_records` si battu ; expose un flag pour que le client affiche les confettis (via realtime sur `personal_records`).

### Fichiers (estimation)

Créés : 1 migration, 4 server functions (`planning`, `weight`, `logbook`, `member-stats`), `WeightLogDialog.tsx`, `WeeklyPlannerGrid.tsx`, `MemberStreakBadge.tsx`, `LogbookView.tsx`, pages `Planning.jsx` / `Carnet.jsx` + 3 routes, `api/public/hooks/generate-logbooks.ts`.
Modifiés : `Dashboard.jsx`, `Programme.jsx`, `Progression.jsx`, `Profil.tsx` (prefs notifs), `MemberNav.jsx`, `LiveSession.tsx` (hook PR confetti), `styles.css`.

### Validation

Checklist complète du brief utilisateur (planning libre, drag & drop, poids+courbe+rappel, douleurs+statut, carnet hebdo généré + consultable, PR célébrés, streak, dashboard motivant, notifs toggleables, non-régression).
