## Constat

Ton app existe déjà avec un schéma différent du prompt. On ne casse rien : on garde `profiles` + `user_roles` + RLS coach/membre + messagerie + sessions + vidéos, et on enrichit ce qui manque pour faire vivre la bibliothèque d'exercices décrite dans le prompt.

Table `exercises` actuelle a déjà : `name`, `category`, `color`, `youtube_url`, `youtube_id`, `default_tempo`, `coach_notes`, `description`, `muscles[]`, `is_global`. Il manque : `muscle_group` (texte simple), `equipement`, `is_archived`, et une notion d'intensité reliée au code couleur officiel.

## Lot 1 (ce plan) — Bibliothèque /coach/exercices

### 1. Migration DB

- Ajouter à `exercises` : `muscle_group text`, `equipement text`, `is_archived boolean default false`, `intensity_code text` (FK vers nouvelle table). On garde `category`, `color`, `muscles` existants pour ne rien casser.
- Créer `intensity_codes (code pk, label, description, color_hex)` + seed des 5 codes (`epuisant` rouge, `semi_epuisant` vert, `isolation` jaune, `prevention` bleu, `non_classe` gris).
- Créer `glossary (cle pk, titre, contenu)` + seed des 4 entrées (tempo, EMOM, RPE, code_lettre).
- GRANT + RLS : lecture pour `authenticated` sur `intensity_codes` et `glossary` (référence publique côté app), écriture réservée au coach.
- Index sur `exercises(muscle_group, equipement, intensity_code, is_archived)`.

### 2. Import des 512 exercices

- Server function `seedExerciseLibrary` (coach uniquement, idempotent) qui lit `src/data/seed-exercises-v2.json` et upsert sur la clé naturelle `name` :
  - mappe `categorie` → `intensity_code`
  - mappe `muscle_group`, `equipement`, `tempo_defaut` → `default_tempo`, `consignes` → `coach_notes`, `youtube_url` → extrait aussi `youtube_id`.
  - `is_global = true`, `created_by = coachId`.
- Bouton « Importer la bibliothèque (512 exos) » sur la page Bibliothèque, visible uniquement si la table contient moins de 100 exos globaux (sinon caché).
- Le JSON est copié depuis `user-uploads://exercices.json` vers `src/data/seed-exercises-v2.json`.

### 3. Écran `/coach/exercices`

Nouvelle route `_authenticated.coach.exercices.tsx` + page `src/pages/coach/Exercices.tsx`.

- Header : titre, recherche live, bouton « + Ajouter », bouton « Importer la bibliothèque » (conditionnel).
- Barre de filtres combinables (chips multi-select, filtrage client après chargement) :
  - groupe musculaire (valeurs distinctes calculées depuis les données)
  - équipement (idem)
  - intensité (pastille couleur depuis `intensity_codes.color_hex`)
  - toggle « afficher archivés »
- Liste/tableau : pastille intensité, nom, groupe musculaire, équipement, tempo défaut, bouton ▶ vidéo (ouvre YouTube dans modale embed comme `ProgramBlocks`), bouton « consignes » qui déplie une ligne avec `coach_notes`.
- Ajout / édition inline via panneau latéral (drawer) : champs nom, intensité (select pastilles), groupe musculaire, équipement, tempo, URL YouTube, consignes. À la sauvegarde, recalcule `youtube_id` depuis l'URL.
- Archivage : toggle `is_archived` (pas de suppression dure pour ne pas casser les programmes existants qui référencent l'exo par nom).
- Toutes les écritures passent par des server functions protégées (`requireSupabaseAuth` + check rôle coach) dans `src/lib/exercises.functions.ts`.

### 4. Page Aide intégrée

- Drawer « Aide / Légende » accessible depuis la page Bibliothèque (icône ?) : liste les 4 entrées `glossary` + la légende des 5 `intensity_codes` avec leurs couleurs.
- Pas de route dédiée pour ce lot (évite d'ajouter de la nav).

### 5. Tokens / design

- Pastilles d'intensité utilisent directement `color_hex` venu de la BDD (pas de tokens), c'est la convention « légende coach ».
- Le reste de l'écran utilise les tokens `--cst-*` existants (mode clair/sombre OK out-of-the-box).

## Hors périmètre de ce lot

- Le nouveau Builder onglets S1-S8 / supersets A1-A2 / sélecteur biblio relié → **Lot 2**.
- Import des 19 programmes depuis `programmes.json` (les programmes vivront toujours dans `programs.structure jsonb`, on adapte le format) → **Lot 3**.
- Page `/coach/membres` du prompt : déjà couverte par les écrans coach existants, à harmoniser plus tard si besoin.

## Détails techniques

```text
Migration:
  - alter table exercises add muscle_group, equipement, is_archived, intensity_code
  - create table intensity_codes + grants + RLS read-all-auth
  - create table glossary + grants + RLS read-all-auth
  - seed 5 intensity_codes + 4 glossary entries

Files créés:
  src/data/seed-exercises-v2.json            (copié depuis user-uploads)
  src/lib/exercises.functions.ts             (list/create/update/archive/seed)
  src/pages/coach/Exercices.tsx              (écran principal)
  src/components/coach/ExerciseDrawer.tsx    (formulaire add/edit)
  src/components/coach/GlossaryDrawer.tsx    (aide)
  src/routes/_authenticated.coach.exercices.tsx

Files modifiés:
  src/components/CoachSidebar.jsx            (lien "Bibliothèque")
  src/integrations/supabase/types.ts         (auto-régénéré)
```

Validation après lot 1 : la page liste les 512 exos, filtres et recherche instantanés, ajout/édition fonctionnels, vidéos s'ouvrent, mode clair/sombre OK. Tu valides puis on enchaîne sur le Builder.