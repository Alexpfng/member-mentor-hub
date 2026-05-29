## Objectif

Intégrer la totalité du fichier `Programme Teddy 18.xlsx` dans le dossier de Teddy (member_id `4299c484-…`) — chaque ligne, chaque colonne, chaque lien YouTube — pour que Léo (coach) et Teddy (membre) retrouvent l'historique complet S1→S7 et la semaine S8 qui démarre **lundi 1 juin 2026**.

## Contenu du fichier (résumé)

- **8 onglets hebdo S1 → S8**, structure identique :
  - En-tête : NOM, OBJECTIF (`Hypertrophie / prépa MMA`), SPLIT (`3x full-body + 3x MMA`), Jours de repos (1), Cardio
  - 4 séances par semaine : `Full-body 1`, `Full-body 2`, `Full-body 3`, `Mobilité Golfer's elbow`
  - Pour chaque exercice : nom, séries, reps, charge, tempo, récup, RPE, notes coach, URL YouTube
  - Sections additionnelles : échauffement musculation, code couleur, légende tempo
- **Onglet `Poids`** : pesée du 09/07/2025 = 80 kg
- S1→S7 ont les RPE remplis (séances effectuées). S8 = prescription seule (à venir).
- Les charges/reps évoluent semaine après semaine (ex. back squat S1 90-100-110 → S8 90-107,5-117,5).

## Plan d'implémentation

### 1. Catalogue d'exercices (`exercises`)
Insérer (ou retrouver) chaque exercice unique du fichier avec :
- `name`, `youtube_url`, `coach_notes` (la consigne récurrente), `default_tempo`, `is_global=true`, `created_by` = coach Léo.
~25 exercices uniques (CARs, Développé couché, Squat, Tractions, Dips, Landmine, etc.).

### 2. Programme (`programs`)
Un seul programme : `"Hypertrophie / prépa MMA – Teddy"`
- `coach_id` = Léo, `objective` = Hypertrophie / prépa MMA, `level`, `frequency_per_week` = 4, `duration_weeks` = 8
- `structure` (jsonb) = arbre complet semaine par semaine :
  ```
  weeks: [
    { week: 1, sessions: [
        { label: "Full-body 1", blocks: [ { name, series, reps, charge, tempo, recup, rpe_prescrit, notes, youtube_url }, … ] },
        { label: "Full-body 2", … },
        { label: "Full-body 3", … },
        { label: "Mobilité Golfer's elbow", … }
    ]},
    … jusqu'à week 8
  ]
  ```
  + section warmup + code couleur + légende tempo (recopiés tel quel depuis l'Excel).

### 3. Assignation (`assignments`)
Lier le programme à Teddy avec `start_date = 2026-04-13` (lundi), `end_date = 2026-06-07` (dimanche fin S8), `active=true`. Ainsi S8 = semaine du 1er juin 2026 comme demandé.

### 4. Historique S1 → S7 (séances réalisées)
Pour chaque semaine 1..7 et chaque séance Full-body 1/2/3 + Mobilité :
- 1 ligne dans `sessions` :
  - `member_id` = Teddy, `program_id`, `week_number`, `day_number` (1,3,5 pour FB1/2/3, 7 mobilité), `session_label`, `date` (calculée selon start_date), `status='done'`, `started_at`/`ended_at` cohérents
- 1 ligne `set_logs` par exercice avec ce qui est inscrit dans l'Excel (`reps`, `weight_kg`, `rpe`, `note` = consigne, `exercise_name`)
  - Les charges multiples (ex `90 - 100 - 110`) sont éclatées en plusieurs sets numérotés 1,2,3
- 1 ligne `exercise_feedbacks` quand un RPE / commentaire est présent dans la colonne RPE de l'Excel.

### 5. Semaine S8 (à venir – planifiée)
4 lignes `sessions` avec dates :
- `2026-06-01` Full-body 1, `2026-06-03` Full-body 2, `2026-06-05` Full-body 3, `2026-06-07` Mobilité
- `status='planned'`, pas de `set_logs` (Teddy les remplira), mais la prescription est lisible via `programs.structure[week=8]`.

### 6. Poids (`weight_logs`)
Insérer la pesée existante : `2026-04-13` ? Non — date réelle de l'Excel `2025-07-09`, poids `80 kg`. On respecte la donnée telle quelle.

### 7. Vérifications côté UI
- **Coach** (`/coach/membre/<teddy>`) : onglet Historique liste les 28 séances S1→S7 (cliquables avec détail des séries) ; onglet Programme affiche les 8 semaines avec exercices + liens YouTube ; onglet Poids affiche la pesée.
- **Membre** (`/membre`) : tableau de bord montre la prochaine séance (Full-body 1 du 1er juin 2026) ; historique liste toutes les séances passées ; chaque exercice ouvre la vidéo YouTube.

## Détails techniques

- Toutes les insertions se font en SQL via `supabase--insert` (pas de migration : aucun changement de schéma).
- L'extraction Excel → SQL se fait via un script Python local (openpyxl) qui génère un fichier SQL avec ~30 INSERT pour exercises, 1 pour programs, 1 assignment, ~28 sessions, ~250 set_logs, ~150 exercise_feedbacks, 1 weight_log.
- `programs.structure` (jsonb) sera l'objet complet : c'est là que sont stockés les liens YouTube, tempos, consignes, code couleur, échauffement.
- Le composant `ProgramBlocks.tsx` qui rend la structure côté coach/membre est déjà en place ; on ne touche pas au front sauf bug d'affichage révélé par les données réelles.

## Hors-scope (à confirmer si besoin)
- Pas de recalcul automatique des `total_volume_kg` / `average_rpe` (peut être ajouté par trigger plus tard).
- Pas de génération des vignettes vidéo YouTube (les URLs suffisent, le front peut les embed).
