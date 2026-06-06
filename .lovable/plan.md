# Finalisation espace membre — Dashboard, Programme, Progression + cron

Objectif : brancher l'UI restante sur les server functions déjà créées (Lot B), corriger les bugs visibles, et activer la génération hebdo automatique des carnets.

## 1. Dashboard membre (`src/pages/membre/Dashboard.jsx`)

Refonte du chargement pour s'appuyer sur `getMemberDashboard` (déjà côté serveur) :

- Remplacer les requêtes Supabase directes dispersées par un appel unique à `getMemberDashboard` via `useServerFn`.
- Corriger les bugs présents :
  - `setProfile/setAssignment/...` dupliqués (lignes 67–80).
  - Lecture de `lastPR.value_kg` / `lastPR.achieved_at` (colonnes inexistantes) → utiliser `weight_kg`, `reps`, `date`.
- Ajouter les éléments encore manquants demandés dans le brief espace coaché :
  - Badge **streak 🔥** (issu de `streak`) à côté du salut.
  - Carte **poids actuel + delta** branchée sur `currentWeight` / `deltaWeight`, bouton « + Noter mon poids » qui ouvre `WeightLogDialog` (déjà existant), refresh au close.
  - Message coach (depuis `coachMessage`) rendu dans un encart discret avec lien vers `/membre/messages`.
  - Lien « Voir mon carnet » (semaine en cours) → `/membre/carnet`.
- Conserver le strip semaine et la carte « séance du jour » existants, mais nourrir la grille à partir de `plannedThisWeek` quand disponible (fallback : `weekSessions`).
- Garder `usePRConfetti(userId)` (déjà branché).

## 2. Programme (`src/pages/membre/Programme.jsx`)

Objectif brief : « faire ses séances dans l'ordre qu'il veut », visualiser le statut de chaque séance.

- Récupérer en parallèle de `getMyAssignedProgram` :
  - `sessions` du membre (status, week_number, day_number) pour marquer ✓ / ⏱ / ○.
  - `planned_sessions` pour afficher la date planifiée par jour.
- Barre de progression globale (séances faites / total semaines × jours).
- Sur chaque jour : pastille de statut (✓ terminé, ⏱ en cours, ◐ planifié, ○ à faire, 🛌 repos), date planifiée si présente.
- Bouton « DÉMARRER → » actif sur **n'importe quel jour** de la semaine courante (plus de verrou d'ordre). Le bouton ouvre `/membre/logger` en passant `week`+`day` (query string) pour pré-remplir la séance.
- Lien « Planifier ma semaine » → `/membre/planning`.

## 3. Progression (`src/pages/membre/Progression.jsx`)

Page actuellement 100 % maquette statique → la brancher sur `getMemberProgression` + `getExerciseProgression` (déjà existante côté coach, on l'expose côté membre ou on la duplique).

- Stats globales réelles : `totalSessions`, `totalVolume` (en tonnes), nombre de PR, adhérence (calculée à partir des sessions vs planned).
- Courbe **poids du corps** sur 8 semaines à partir de `weights` (rechart `LineChart`, déjà utilisé ailleurs).
- Liste des PR réels (mapper sur `exercise_name`, `weight_kg`/`reps`, `date`).
- Sélecteur d'exercice (à partir des `exercise_name` distincts dans `set_logs` du membre) qui déclenche `getExerciseProgression(member_id, exercise_name)` → graphique charge max + RPE moyen (réutiliser `ExerciseProgressionChart.tsx` créé côté coach).

## 4. Server function complémentaire

Ajouter dans `src/lib/member-stats.functions.ts` :

- `listMyExercises` (GET, auth) → liste distincte des `exercise_name` des `set_logs` du membre courant.
- `getMyExerciseProgression(exerciseName)` (GET, auth, validator Zod) → même logique que la version coach mais scopée à `context.userId`.

## 5. Cron hebdo carnet

La route `/api/public/hooks/generate-logbooks` existe déjà. Reste à programmer le `pg_cron` :

- Activer `pg_cron` + `pg_net` si nécessaire (via migration).
- Insertion (via tool `supabase--insert` ou SQL direct) :
  ```sql
  select cron.schedule(
    'generate-weekly-logbooks',
    '0 20 * * 0',  -- dimanche 20h UTC
    $$ select net.http_post(
         url := 'https://project--b874bc4b-f1bb-4a60-a4d8-9d9571de7494.lovable.app/api/public/hooks/generate-logbooks',
         headers := '{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
         body := '{}'::jsonb
       ); $$
  );
  ```
- Sécuriser la route : vérifier l'`apikey` (anon) dans le handler avant d'appeler `generateLogbooksForAll`.

## 6. Fichiers touchés

- `src/pages/membre/Dashboard.jsx` (refonte chargement + UI poids/streak/coach msg)
- `src/pages/membre/Programme.jsx` (statuts + ordre libre)
- `src/pages/membre/Progression.jsx` (données réelles + graphiques)
- `src/lib/member-stats.functions.ts` (2 nouvelles fonctions)
- `src/routes/api/public/hooks/generate-logbooks.ts` (vérif apikey)
- Migration / insert : planification `pg_cron`

## 7. Validation

- Dashboard charge sans doublons, affiche poids/streak/PR/message coach.
- Programme : on peut démarrer n'importe quel jour de la semaine en cours, statuts visibles.
- Progression : chiffres et courbes réels, sélecteur d'exercice fonctionnel.
- `select * from cron.job` montre `generate-weekly-logbooks`.
- Rien n'a régressé (Planning, Carnet, Profil restent OK).
