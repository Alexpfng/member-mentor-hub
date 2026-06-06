## Problème observé

Sur `/membre`, la carte « AUJOURD'HUI » affiche toujours le **nom du programme** ("RENFO SPÉ TRAIL + MUSCU HAUT DU CORPS"), et `COMMENCER` lance un Logger générique. Le membre ne peut donc pas :
- voir la séance qu'il a planifiée pour aujourd'hui dans `/membre/planning`,
- choisir, parmi les séances de la semaine du programme, laquelle il veut démarrer.

## Objectif

L'accueil membre doit se baser uniquement sur le réel : les `planned_sessions` du membre + les jours du programme assigné, exactement comme dans Planning. Aucune donnée inventée.

## Changements (uniquement `src/pages/membre/Dashboard.jsx`)

1. **Charger le planning de la semaine** via le server function existant `listWeekPlan` (`@/lib/planning.functions`). Il renvoie déjà `planned`, `sessions`, `dayDefs`, `assignment` pour la semaine courante. Aucun nouveau schéma, aucune nouvelle requête côté SQL.

2. **Carte héro « AUJOURD'HUI »** — logique en cascade, basée sur le réel uniquement :
   - `in_progress` aujourd'hui → `REPRENDRE` (déjà en place).
   - `completed` aujourd'hui → état terminé (déjà en place).
   - `planned` aujourd'hui (entrée `planned_sessions` avec `planned_date = today`) → afficher `day_label` de la séance planifiée + `COMMENCER →` qui ouvre le Logger pour cette séance.
   - Aucun `planned` pour aujourd'hui mais le programme a des `dayDefs` non encore utilisés cette semaine → afficher un petit **sélecteur** : titre `CHOISIR MA SÉANCE` + liste cliquable des `dayDefs` restants ; le clic appelle `upsertPlannedSession({ plannedDate: today, dayLabel })` puis lance le Logger sur cette séance.
   - Aucun programme et aucun planifié → fallback `SÉANCE LIBRE` (comportement actuel).

3. **Bande semaine** : pour chaque jour, en plus du point d'état, afficher le `day_label` de la séance planifiée ou complétée (texte court tronqué). Tap sur un jour :
   - si séance `in_progress` → `/membre/seance/:id`,
   - si `planned` → ouvre Logger pour ce `day_label`,
   - sinon → `/membre/planning` (pour planifier).

4. **Passage de la séance choisie au Logger** : `navigate("/membre/logger?day=<dayLabel>")`. Le Logger lit ce paramètre (via `useSearch` de TanStack Router) et l'utilise pour afficher le bon titre. Le contenu d'exercices du Logger reste tel quel (mock) tant qu'aucun changement de scope n'est demandé — seul le titre/affichage reflète la séance choisie. Pas d'invention de données.

5. **États** : ajout d'un état `loading` pour le bloc planning ; conservation de tous les autres comportements actuels (poids, PR, message coach, liens rapides).

## Hors scope

- Pas de modification du schéma DB ni des policies RLS.
- Pas de refonte du Logger (mock conservé), uniquement la lecture du paramètre `day` pour afficher le bon label.
- Pas de changement de `/membre/planning`.

## Fichiers modifiés

- `src/pages/membre/Dashboard.jsx` (logique héro + bande semaine + appel `listWeekPlan` + sélecteur).
- `src/pages/membre/Logger.jsx` (lecture du paramètre `day` pour le titre).
