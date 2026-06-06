## Problème

Quand on clique « COMMENCER » sur la séance planifiée, le launcher (`src/routes/_authenticated.membre.logger.tsx`) :

1. **Reprend systématiquement** la dernière séance `in_progress` du membre, **sans tenir compte** du paramètre `?day=…` qu'on vient de passer. Donc si une vieille séance traîne en `in_progress`, on est redirigé dessus au lieu de lancer celle choisie dans le planning.
2. Quand il crée bien une nouvelle séance, il n'écrit **pas** le `day_number` correspondant au `day_label`. Or `src/routes/_authenticated.membre.seance.$sessionId.tsx` cherche les exercices via `structure.weeks[week_number-1].days[day_number-1]` ; sans `day_number`, il retombe sur le jour 0, puis sur `DEFAULT_EXERCISES` (Tractions / Row barre / Face pull / Curl) — qui n'a rien à voir avec la séance du programme.

## Correctif (uniquement `src/routes/_authenticated.membre.logger.tsx`)

1. **Résoudre la séance demandée à partir du programme assigné** : lire l'`assignment` actif du membre + `programs.structure`, retrouver dans `structure.weeks[search.week ?? currentWeek].days` l'index dont `label === search.day`. Cet index (1-based) sert de `day_number`. Si rien ne matche, on garde `day_number = null` et `session_label = search.day`.

2. **Gérer la séance `in_progress` existante** :
   - Si `search.day` est fourni :
     - S'il existe une `in_progress`, **la mettre à jour** (`session_label`, `program_id`, `week_number`, `day_number`) puis naviguer dessus — pas de doublon, et on lance bien la séance choisie.
     - Sinon, INSERT avec les bons champs (`program_id`, `week_number`, `day_number`, `session_label`).
   - Si `search.day` n'est **pas** fourni : conserver le comportement actuel (reprise de l'`in_progress` si présente, sinon création « Séance libre »).

3. Ne pas toucher au reste du code (Dashboard, Planning, page séance, Logger.jsx mock).

## Hors scope

- Pas de changement de schéma DB ni de RLS.
- Pas de modification de la page `seance/$sessionId.tsx` : une fois `program_id`, `week_number` et `day_number` correctement renseignés, elle charge déjà les bons exercices.

## Fichiers modifiés

- `src/routes/_authenticated.membre.logger.tsx`
