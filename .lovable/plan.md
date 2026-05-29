# Compte + programme Pierre W.

## 1. Compte Pierre
- Mettre à jour son profil existant (`Pierre W`, id `3c9a3987-…`) : email `test@test.fr` → **`pierre-0214@outlook.fr`**
- Mettre à jour `auth.users` (même id) : email + mot de passe temporaire **`Pierre2026!`** (à changer après 1ère connexion)
- Rôle déjà = `member` ✅

## 2. Programme « Prépa trail — Pierre W. (S1→S6) »
Structure identique à celle de Teddy (`programs.structure = { weeks: [...] }`), même format d'exercice (`code`, `name`, `series`, `reps`, `charge`, `tempo`, `recup`, `rpe_target`, `coach_notes`, `youtube_url`, `youtube_id`).

Parsing du `.xlsx` envoyé :
- **6 semaines** (onglets S1 → S6)
- Pour chaque semaine, **toutes les séances** sont incluses, sans rien omettre :
  - Full-body 1 / 2 / 3 (S1-S3 et S4 réduit)
  - Séance mobilité maison
  - Séance course endurance fondamentale
  - Séance type trail
  - Séance côtes
  - Séance Stairmaster (S6)
- Pour les séances "course/trail/côtes/stairmaster/mobilité maison" qui contiennent des consignes texte (objectifs, échauffement, blocs en côte…) plutôt que des lignes A1/B1 classiques : je les capture comme **exercices sans code**, avec le texte complet rangé dans `name` + `coach_notes`, pour que **rien du Excel ne soit perdu** (au-delà des onglets purement informatifs « Code couleur », « RPE », « CARs », « EMOM », « Tempo » qui sont des définitions générales).
- Métadonnées programme : `name`, `objective="Prépa trail"`, `description="3x Full-body + 4 sorties / sem."`, `level=null`, `duration_weeks=6`, `frequency_per_week=7`, `coach_id` = le coach existant.

## 3. Assignation
- `assignments` : `member_id` = Pierre, `program_id` = nouveau, `start_date=2026-04-27` (lundi → S6 démarre lundi **01/06/2026**), `end_date=2026-06-07` (dimanche fin S6), `active=true`.
- Désactiver toute assignation `active` antérieure de Pierre (il n'y en a pas pour l'instant).

## Détails techniques
- 1 migration SQL : `UPDATE profiles`, `UPDATE auth.users` (email + crypt(password)), `INSERT programs`, `INSERT assignments`. Structure JSON construite côté script Python puis inlinée dans la migration.
- Aucun changement de code applicatif : Pierre verra son programme via les mêmes écrans `/membre` que Teddy.
- Vérification post-migration : `SELECT` sur `programs` + `assignments` + comptage des exercices par semaine pour confirmer parité avec le Excel.
