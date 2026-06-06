# Patch Coach — Léo · corrections + suivi semaine par semaine

Gros chantier. Je propose de le découper en **4 phases livrables** pour que tu puisses tester au fur et à mesure. Tu me dis si tu veux que je lance tout d'un bloc, ou phase par phase.

---

## Phase 1 — Corrections rapides (Bugs A1–A4)

### A1 · Renommer un exercice

- **Bibliothèque** (`src/pages/coach/Exercices.tsx`) : champ nom déjà éditable dans la fiche → vérifier qu'il sauve bien et ajouter un toast « Renommé ✓ ».
- **Builder** (`src/pages/coach/BuilderNew.tsx`) : rendre le `name` éditable inline (clic sur le titre → input). Auto-save sur blur.
- **Modale « propager ? »** : quand le nom diffère du nom canonique de l'exercice référencé (lookup par `exercise_id`), proposer :
  - « Uniquement dans ce programme » → stocké dans `programs.structure` uniquement.
  - « Aussi dans la bibliothèque » → `UPDATE exercises SET name = ...` via une server fn.
- Pas de migration DB nécessaire (les noms vivent déjà dans `programs.structure` et `exercises.name`).

### A2 · Filtres Push/Pull/Legs fonctionnels

- **Migration** : ajouter `exercises.movement_patterns text[]` (nullable, default `{}`). GRANTs idem table `exercises`.
- **Auto-classification** : script de migration SQL qui remplit `movement_patterns` à partir de `name` (ILIKE sur les mots-clés listés). Lancé une fois dans la migration.
- **UI bibliothèque** : ligne de chips « Schéma moteur » au-dessus des chips « Groupe musculaire » ; filtres combinables (AND entre catégories de filtres, OR à l'intérieur).
- **Fiche exercice** : multi-sélect chips push/pull/legs/hinge/core/cardio/mobility, sauvegardé dans `movement_patterns`.

### A3 · Édition d'exercice directement depuis le programme

- Dans `BuilderNew.tsx`, sur chaque ligne d'exercice : icône `[✎]` ouvrant une modale d'édition complète (réutilise le composant de fiche existant de la bibliothèque, extrait en `ExerciseEditDialog`).
- En haut de la modale, un tag clair :
  - `[Pour ce programme uniquement]` (sauve dans `programs.structure`)
  - bascule `[Aussi dans la bibliothèque]` (sauve aussi `exercises`).
- Page bibliothèque (`Exercices.tsx`) : ajouter le sous-titre « Gère ici tes exercices de référence… »

### A4 · Pliométrie en intensité

- **Migration data only** : `UPDATE exercises SET intensity_code = 'plyo'` pour les exos déjà tagués pliométrie en `category`/`muscle_group`. Insert `intensity_codes ('plyo', 'Pliométrie', '#E07B39', '...définition...')`.
- **Palette UI** : étendre `colorHex` et types `ExerciseColor` dans `src/components/cst/pedagogy.tsx` pour ajouter `"orange"` mappé à `#E07B39`. Ajouter dans la légende membre + filtres bibliothèque + sélecteur builder (5 boutons au lieu de 4).
- Retirer « pliométrie » de la liste des groupes musculaires côté UI (mais ne pas effacer la donnée — juste ne plus l'afficher comme groupe musculaire).
- Reclassement des exos pliométriques (box jump, depth jump, lateral jumps, single leg pogo, split squat jump…) par ILIKE dans la même migration.

---

## Phase 2 — Signalement de douleur (côté membre)

### Migration

```sql
CREATE TABLE public.pain_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  session_id uuid,
  exercise_name text,
  zone text,
  intensity integer CHECK (intensity BETWEEN 1 AND 5),
  comment text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
-- GRANTs + RLS : member CRUD sur les siens, coach SELECT all.
```

### UI membre

- Dans `src/components/cst/LiveSession.tsx`, sur l'écran d'un set : petit bouton discret `😣 Signaler une douleur`.
- Ouvre un overlay : sélecteur de zone (suggestions courantes + champ libre), slider intensité 1-5, commentaire optionnel. Save → insert dans `pain_reports`.
- Toast « Signalement envoyé au coach ».

### UI coach (rapide ici, vrai dashboard en phase 3)

- Badge rouge sur la card membre du dashboard si `pain_reports.resolved = false` existe.

---

## Phase 3 — Suivi membre + adaptation S→S+1 (cœur métier)

### B1 · Onglet « Suivi » dans la fiche membre

Nouvelle page `src/routes/_authenticated.coach.membre.$memberId.tsx` avec un onglet « SUIVI » (les onglets existants restent).

Bloc affiché (semaine courante du programme assigné) :
- **Adhérence** : count `sessions.status='completed'` cette semaine / `frequency_per_week`.
- **Douleurs ouvertes** : `pain_reports` non résolus. Liste cliquable « [Voir] [Adapter cet exo] ».
- **RPE par exercice** : pour chaque exercice de la semaine du programme, comparer `avg(set_logs.rpe)` vs `rpe_target` issu de `programs.structure`. Flèche ↑/↓/= + texte d'interprétation.

### B2 · Moteur de suggestions

Helper pur `src/lib/coach-suggestions.ts` :
```ts
function suggestAdjustment({ rpeDone, rpeTarget, hasPain, lastWeight }): Suggestion
// → { type: 'reduce_load' | 'increase_load' | 'replace' | 'reduce_rom' | 'keep', delta, label }
```
Règles :
- `rpeDone > rpeTarget + 1` → réduire charge de 5% (10% si > +2).
- `rpeDone < rpeTarget - 1` → +2.5kg ou +2 reps.
- `hasPain` → remplacer / réduire amplitude.
- Sinon → garder.

### B3 · « Préparer la semaine suivante »

Bouton en haut du suivi → server fn `createNextWeek` :
- Lit `programs.structure.weeks[currentWeek]`, deep-clone vers `weeks[currentWeek+1]`.
- Applique les suggestions par défaut **sans modifier** les données (juste annotations `_suggestion` par exo).
- Persiste, navigue vers `/_authenticated/coach/builder/$id?week=N+1`.

### B4 · Builder « adaptation »

Dans `BuilderNew.tsx`, quand un exo porte `_suggestion`, afficher une bannière inline sous la ligne :
- `💡 RPE 9 en S3 (prévu 8) → -5% = 16,5kg` avec boutons `[Appliquer]` `[Garder]` `[Autre]`.
- `[Appliquer]` mute la valeur (charge, reps…), supprime l'annotation, sauve.
- `[Garder]` supprime juste l'annotation.

### B5 · Remplacer un exercice

Bouton « Remplacer » sur chaque ligne du builder :
- Modale avec recherche dans `exercises`, filtrée par `movement_patterns` commun avec l'exo courant.
- Sélection → l'exercice change (`exercise_id`, `name`, `youtube_*`), séries/reps/RPE/récup conservés.

---

## Phase 4 — Vue globale coach

### B5 · Dashboard `MES MEMBRES — CETTE SEMAINE`

Réécrire la section principale de `src/pages/coach/Dashboard.jsx` :
- Server fn `getMembersWeeklyStatus` qui agrège pour chaque membre assigné :
  - Programme, semaine actuelle, adhérence (sessions complétées vs prévues).
  - Nombre de `pain_reports` ouverts.
  - Max(RPE - RPE_target) de la semaine.
- Tableau triable (défaut : alertes en haut). Clic ligne → `/coach/membre/$id`.

### B6 · Mini-graphes de progression

Sur la fiche membre, pour chaque exercice apparaissant dans `set_logs` du membre :
- Mini-graphe Recharts (charge max par semaine, dot coloré par RPE moyen).
- Affiché sur demande (accordéon) pour pas surcharger.

---

## Sécurité & non-régression

- Toutes les écritures passent par des `createServerFn` avec `requireSupabaseAuth` (jamais d'admin client côté membre).
- RLS sur `pain_reports` : member = own, coach = all (via `has_role`).
- Aucun changement aux corrections précédentes (focus input, contraste, 1-clic démarrage, navigation libre, parser Excel).
- Palette : ajout d'une seule couleur (`#E07B39`) — pas de refonte.

---

## Question avant de lancer

Vu la taille, je préfère te confirmer le découpage avant de coder. Tu veux :

- **(A)** Tout en une seule passe (gros patch, ~2h de génération, plus dur à tester).
- **(B)** Phase par phase, je m'arrête après chaque phase pour que tu testes.
- **(C)** D'abord juste la Phase 1 (les 4 bugs A1–A4), on voit le résultat, puis on attaque B.

Mon avis : **(C)** — les 4 bugs A débloquent Léo immédiatement, et la Partie B mérite qu'on valide le schéma DB et l'UX du suivi avant de tout construire.
