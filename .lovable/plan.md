# Vidéos technique & fil de commentaires par exercice

## Ce qu'on construit
Après chaque exercice, le coaché peut **filmer ou importer** une vidéo. Coach Léo la regarde côté membre, **commente**, et un **fil de discussion** par exercice permet aux deux d'échanger. La vidéo est liée à l'exercice (séance + nom d'exo).

## 1. Base de données (1 migration)

Table existante `technique_videos` (déjà liée à session + exercise_name + storage_path) → **conservée**. On supprime `coach_feedback` au profit d'un vrai fil.

Nouvelle table `exercise_comments` :
- `session_id` (uuid) — l'exercice est identifié par session + nom
- `exercise_name` (text)
- `video_id` (uuid, nullable) — commentaire attaché à une vidéo précise, sinon commentaire général d'exo
- `author_id` (uuid)
- `author_role` (text — `coach` | `member`)
- `content` (text)
- `created_at`

**RLS** :
- Membre : SELECT/INSERT sur les commentaires de **ses** séances (via `sessions.member_id = auth.uid()`).
- Coach : SELECT/INSERT sur **tout** (via `has_role`).

Ajout colonne `technique_videos.unread_for_member` (bool) — badge "nouvelle réponse coach".

**Storage** : bucket `technique-videos` (privé, déjà créé). Ajouter politiques :
- Membre : INSERT + SELECT sur ses fichiers (`{user_id}/...`).
- Coach : SELECT sur tout. Lecture via URL signée (côté serveur).

## 2. Server functions (`src/lib/coach.functions.ts` + nouveau `videos.functions.ts`)

- `getExerciseThread({ sessionId, exerciseName })` → vidéos + commentaires triés par date.
- `postExerciseComment({ sessionId, exerciseName, videoId?, content })` — rôle déduit côté serveur via `has_role`.
- `getSignedVideoUrl({ storagePath })` — URL signée 1h (clé service via admin server-only).
- `getCoachReviewQueue()` (coach) — liste des vidéos non encore commentées par le coach, groupées par membre.
- `markVideoReviewed({ videoId })` — bascule `coach_reviewed = true`.

## 3. UI Coaché

**`src/components/cst/session.tsx → ExerciseBlock`** (déjà rendu dans la séance) :
- Bloc « TECHNIQUE & ÉCHANGES COACH » sous les séries, contenant :
  - Bouton **🎬 Filmer** (capture caméra, existant) + bouton **📁 Importer** (file picker sans `capture`).
  - Galerie des vidéos déjà envoyées pour cet exo (vignette + lecteur inline via URL signée).
  - **Fil de commentaires** : bulles datées avec avatar/rôle, input « écris à Léo… » + bouton envoyer.
  - Pastille « réponse du coach » si `unread_for_member`.

**`src/pages/membre/Logger.jsx`** (actuellement sur MOCK_EXERCISES) : on branche le `ExerciseBlock` réel pour que la fonctionnalité soit accessible dans le vrai parcours de séance.

## 4. UI Coach

**`src/pages/coach/Member.jsx`** — nouvel onglet **« VIDÉOS À CORRIGER »** :
- Liste chronologique des vidéos du membre (groupées par séance) avec vignette, date, nom d'exo, badge « non revu ».
- Click → drawer/modal : lecteur vidéo, séries de l'exo en regard, fil complet, input commentaire, bouton « ✓ Marquer comme revu ».
- Compteur global non-revu dans l'en-tête du membre.

**Dashboard coach** (`src/pages/coach/Dashboard.jsx`) : ajout petit widget « N vidéos à corriger » qui pointe sur la file globale.

## 5. Hors scope (à signaler avant code)
- Notifications push/email lors d'une nouvelle vidéo ou réponse (à traiter plus tard).
- Édition / suppression des commentaires (V2).
- Annotations dessinées sur la vidéo (V2).

## Fichiers touchés
- **Migration** : nouvelle table `exercise_comments`, colonne sur `technique_videos`, policies storage.
- **Créés** : `src/lib/videos.functions.ts`, `src/components/cst/ExerciseThread.tsx`, `src/components/coach/VideoReviewDrawer.tsx`.
- **Modifiés** : `src/components/cst/session.tsx`, `src/pages/membre/Logger.jsx`, `src/pages/coach/Member.jsx`, `src/pages/coach/Dashboard.jsx`, `src/lib/coach.functions.ts`.

Valide le plan pour que je l'implémente.
