# Importer les 16 programmes de Léo + bibliothèque d'exercices

Objectif : au premier login de Léo, ses 16 programmes et 436 exercices sont déjà là, prêts à être assignés à Teddy. Zéro ressaisie.

## 1. Données seed bundlées côté serveur

Copier les 2 fichiers JSON fournis dans `src/data/` (lus uniquement par des server functions, donc jamais envoyés au client) :
- `src/data/seed-exercises.json` (436 exos, ~100 KB)
- `src/data/seed-programs.json` (16 programmes, ~3 MB)

## 2. Migration BDD

Ajouter 2 colonnes manquantes à `exercises` pour matcher le format fourni :
- `default_tempo TEXT`
- `coach_notes TEXT`

(Le reste — `color`, `category`, `youtube_url`, `youtube_id`, `is_global`, `created_by` — existe déjà.)

## 3. Server function de seed idempotent

Nouveau fichier `src/lib/seed.functions.ts` exposant `seedColosmartData` :
- Protégé par `requireSupabaseAuth` + check rôle coach.
- Si `exercises` (du coach) vide → insère les 436 exos avec `is_global=true`, `created_by=coachId`.
- Si `programs` (du coach) vide → insère les 16 programmes :
  - `name = title`, `objective`, `duration_weeks`, `frequency_per_week = weeks[0].days.length`, `level = 'intermediate'`
  - `description = "objective · split"`
  - `structure = { weeks: p.weeks }` (JSONB complet, codes/colors/youtube_id/block_type/coach_notes préservés tels quels)
- Retourne `{ exercisesInserted, programsInserted }`.

Appel automatique au montage du dashboard coach (`src/pages/coach/Dashboard.jsx`) via `useServerFn` — silencieux, idempotent.

## 4. Page `/coach/programmes` (grille)

Nouvelle route `src/routes/_authenticated.coach.programmes.tsx` + page `src/pages/coach/Programmes.tsx` :
- Grille de cards : titre, objectif, durée (X sem.), nb séances/semaine.
- 3 actions par card : **Voir** → `/coach/programmes/$id` · **Dupliquer** (server fn `duplicateProgram`) · **Assigner** (modale sélecteur membre, réutilise `assignProgram` existant).
- Mettre à jour `CoachSidebar.jsx` : l'item "Programmes" pointe sur `/coach/programmes` (le builder reste accessible via "Nouveau programme" depuis cette page → `/coach/builder`).

## 5. Page détail `/coach/programmes/$id`

Nouvelle route `src/routes/_authenticated.coach.programmes.$id.tsx` : affichage en lecture seule de toute la structure (semaines → jours → blocs d'exercices) avec :
- Pastille `color` (red/green/yellow/blue), code (`A1`, `B2`…), nom.
- Lignes : `series` × `reps` × `charge` × `tempo` × `recup` × `RPE` (strings affichés bruts — "EMOM3'", "pdc", "100 - 80", "8 / côté" passent sans plantage).
- Notes coach + bouton "Voir la démo" → embed YouTube via `youtube_id`.
- Bouton "Éditer dans le builder" → ouvre le builder pré-rempli.

## 6. Composant `ExerciseBlocks` partagé

Nouveau `src/components/cst/ProgramBlocks.tsx` qui :
- Groupe les exos par lettre de `code` (A1/A2 = superset, B seul = isolé) via la fonction `groupBlocks` fournie.
- Branche le rendu selon `block_type` : `standard` (table), `superset` (groupé), `emom` (badge timer), `ladder` (badge schéma), `amrap`, `dropset`, `iso`, `circuit` — chacun avec un en-tête visuel distinct mais affichage tolérant aux strings libres.

Utilisé par la page détail coach **et** par la séance interactive du membre.

## 7. Séance interactive du membre

Mettre à jour `src/routes/_authenticated.membre.seance.$sessionId.tsx` pour utiliser `<ProgramBlocks>` au lieu de l'`ExerciseBlock` actuel basique : Teddy voit pastilles couleur + codes + supersets groupés + vidéos YouTube exactement comme Léo les a pensés.

## 8. Builder pré-rempli (édition)

Étendre `BuilderNew.tsx` pour charger une structure existante via `?id=...` (lit le programme, hydrate les states `weeks`). Pas de refonte du builder — juste l'hydratation initiale.

---

## Vérifications après build

- [ ] Premier login Léo → 16 programmes visibles dans `/coach/programmes`
- [ ] Bibliothèque contient 436 exos (vérifié côté builder & DB)
- [ ] Cliquer "Voir" sur "Prépa Physique Boxe" affiche toutes les semaines/jours/exos avec couleurs et vidéos
- [ ] "Assigner" en 2 clics crée une assignment pour Teddy
- [ ] Teddy ouvre une séance → exos affichés avec couleur, code, supersets groupés, vidéo cliquable
- [ ] Aucune valeur texte exotique (EMOM3', pdc, 100-80, 8/côté) ne fait planter
- [ ] Aucun import de `seed-programs.json` côté client (server-only via `.functions.ts`)

## Fichiers touchés

- **Nouveaux** : `src/data/seed-exercises.json`, `src/data/seed-programs.json`, `src/lib/seed.functions.ts`, `src/pages/coach/Programmes.tsx`, `src/pages/coach/ProgramDetail.tsx`, `src/routes/_authenticated.coach.programmes.tsx`, `src/routes/_authenticated.coach.programmes.$id.tsx`, `src/components/cst/ProgramBlocks.tsx`
- **Modifiés** : `src/components/CoachSidebar.jsx` (lien), `src/pages/coach/Dashboard.jsx` (appel seed), `src/pages/coach/BuilderNew.tsx` (hydratation via `?id=`), `src/lib/coach.functions.ts` (ajout `duplicateProgram`, `getProgram`), `src/routes/_authenticated.membre.seance.$sessionId.tsx` (rendu via ProgramBlocks)
- **Migration** : ajout colonnes `default_tempo` + `coach_notes` sur `exercises`
