## Objectif

Ajouter le **choix de séance** au lancement et la **séance libre** (avec photos / vidéos / notes) que le membre documente pour le coach. Le reste de l'app existante reste intact.

## Architecture

### Base de données (migration)

1. Étendre `sessions` :
   - `session_type` `text` `default 'program'` `check in ('program','free')`
   - `free_title` `text`
   - `free_category` `text` (`muscu` / `course` / `cardio` / `sport` / `mobilite` / `autre`)
2. Nouvelle table `free_activities` (RLS : membre gère les siennes, coach lit) :
   - `session_id`, `name`, `category`, `series`, `reps`, `charge`, `distance_km`, `duration_min`, `elevation_m`, `rpe`, `note`, `order_index`
3. Nouvelle table `session_media` (RLS : membre gère les siens, coach lit) :
   - `session_id`, `member_id`, `type` (`photo|video`), `storage_path`, `public_url`, `thumbnail_url`, `caption`
4. Bucket Storage privé `session-media` avec policies (membre upload/lit ses propres fichiers `{member_id}/{session_id}/…`, coach lit tout).

### Server functions (`src/lib/free-session.functions.ts`)

- `createFreeSession({ category?, title? }) → { sessionId }` — insère `sessions` avec `session_type='free'`, `started_at=now`, `status='in_progress'`.
- `addFreeActivity({ sessionId, …fields })`
- `updateFreeActivity` / `deleteFreeActivity`
- `listFreeActivities({ sessionId })`
- `attachSessionMedia({ sessionId, type, storagePath, caption? })` — résout `public_url` (signed URL longue durée ou URL publique selon bucket) et insère la ligne.
- `listSessionMedia({ sessionId })`
- `deleteSessionMedia({ id })`
- `finishFreeSession({ sessionId, overallFeeling?, averageRpe?, memberNote? })` — `status='completed'`, `ended_at`, `duration_minutes`.

L'upload du blob est fait côté client avec `supabase.storage.from('session-media').upload(path, file)` (RLS storage le scope au membre), puis on appelle `attachSessionMedia`.

### Routes / pages

1. **`/membre/commencer`** (nouveau, `src/routes/_authenticated.membre.commencer.tsx` + `src/pages/membre/Commencer.tsx`) — écran de choix :
   - Bloc « MON PROGRAMME » : liste des séances de la semaine (tag ✓/●/○, badge « recommandée » sur la prochaine non faite), bouton ▶ par ligne → `/membre/logger?day=…&week=…`.
   - Bloc « SÉANCE LIBRE » → bouton qui appelle `createFreeSession` puis navigue vers `/membre/seance-libre/$sessionId`.
   - Si pas de programme assigné → seul le bloc libre (en grand).
2. **Dashboard** : le bouton « COMMENCER » garde le 1-clic vers la séance recommandée et ajoute un lien « Choisir une autre séance » → `/membre/commencer`. Si aucun programme : « DÉMARRER UNE SÉANCE LIBRE » direct.
3. **`/membre/seance-libre/$sessionId`** (nouveau) — écran séance libre :
   - Sélecteur catégorie + champ titre.
   - Liste d'activités + bouton « + Ajouter une activité » (modale avec champs dépendant de la catégorie : muscu = séries/reps/charge ; course = distance/durée/D+ ; cardio = durée/intensité ; sport/autre = durée + note).
   - Zone « Notes pour le coach ».
   - Pièces jointes : 3 inputs (`accept="image/*" capture="environment"`, `accept="video/*" capture="environment"`, `accept="image/*,video/*" multiple`). Miniatures + caption + suppression avant envoi. Compression de base si vidéo > 50 Mo via re-encode best-effort (sinon erreur si > 100 Mo).
   - Ressenti (4 emojis) + RPE 1-10 + bouton « Signaler une gêne » (réutilise `PainReportDialog`).
   - Bouton « TERMINER ET ENVOYER AU COACH → » : `finishFreeSession`, puis écran confirmation `/membre` avec toast récap.
4. **Logger existant (`/membre/logger`)** : inchangé, reste pour les séances programme. Plus de création « Séance libre » implicite ici — si arrivée sans `?day=` et sans `in_progress`, rediriger vers `/membre/commencer`.
5. **Historique & Carnet** : afficher tag `LIBRE` quand `session_type='free'`, titre = `free_title || session_label`. Les séances libres comptent dans volume/durée/ressenti mais pas dans l'adhérence programme (filtrer sur `session_type='program'` pour le ratio d'adhérence).
6. **Côté coach** :
   - `RecentSessionsList` / fiche membre : badge LIBRE + titre, activités, médias (galerie cliquable plein écran), note membre.
   - Nouvelle page/section `SessionDetail` : si `session_type='free'`, afficher activités + médias + note (au lieu de la vue set_logs).
   - `getCoachDashboard` (ou équivalent) : intégrer les séances libres dans le flux récent (le tri par `created_at` les inclut déjà, on ajoute juste le tag).
   - Notification : insertion dans `messages` au coach (`to_id` = coach assignant le programme, ou s'il n'y en a pas, premier coach trouvé) avec « <Prénom> a fait une séance libre · <titre> ». Pas de système séparé.

### Détails techniques

- Bucket privé + URL via `createSignedUrl(path, 60*60*24*30)` au moment de `listSessionMedia` → stockée temporairement côté front (1 jour de cache react-query suffisant).
- Vidéo : pas de thumbnail serveur (limites Worker), on capture la 1re frame côté client via `<video>` + `<canvas>` au moment de l'upload et on l'upload aussi → `thumbnail_url`.
- Réutiliser composants existants : `CSTSectionNum`, `cst-card-dark`, `cst-btn`, `PainReportDialog`, palette tokens.
- Pas d'auto-confirm email, pas de RLS sur `auth.*`, pas de nouveau provider auth.

## Hors scope (phase 2 éventuelle)

- Édition d'une séance libre après envoi.
- Commentaires coach inline sur chaque média (le coach pourra déjà répondre via Messages).
- Compression vidéo poussée (on plafonne à 100 Mo, best-effort).
- Notifications push / email (on s'appuie sur le flux existant).

## Fichiers / objets créés ou modifiés

**Migration** : `sessions` (3 colonnes), `free_activities`, `session_media`, bucket `session-media` + policies storage.

**Nouveaux** :
- `src/lib/free-session.functions.ts`
- `src/pages/membre/Commencer.tsx` + `src/routes/_authenticated.membre.commencer.tsx`
- `src/pages/membre/SeanceLibre.tsx` + `src/routes/_authenticated.membre.seance-libre.$sessionId.tsx`
- `src/components/cst/FreeActivityDialog.tsx`
- `src/components/cst/MediaUploader.tsx` (gère capture / galerie / miniature / progression)
- `src/components/cst/MediaGallery.tsx` (lecture, plein écran)
- `src/components/coach/FreeSessionView.tsx`

**Modifiés** :
- `src/pages/membre/Dashboard.jsx` : lien « Choisir une autre séance » + cas « pas de programme ».
- `src/routes/_authenticated.membre.logger.tsx` : si pas de `?day=` et pas d'`in_progress`, redirige vers `/membre/commencer` au lieu de créer une « Séance libre » fantôme.
- `src/pages/membre/Historique.jsx` : badge LIBRE + titre.
- `src/pages/membre/Carnet.tsx` : compte séances libres séparément dans le résumé.
- `src/components/coach/RecentSessionsList.tsx` + `src/pages/coach/SessionDetail.tsx` (et la route associée) : affichage séance libre.
- `src/lib/member-stats.functions.ts` / `coach-dashboard.functions.ts` : exclure les séances libres du calcul d'adhérence ; les inclure dans volume/durée.

## Question avant de lancer

Faut-il livrer tout ça d'un coup ou en **2 phases** ?

- **Phase 1 (rapide, ~2 itérations)** : choix de séance + séance libre côté membre (création, activités, médias, envoi) + tag dans l'historique. Le coach voit déjà tout via la page séance + médias.
- **Phase 2** : vue coach dédiée (galerie inline, notification dans Messages, intégration carnet/adhérence).

Je propose la phase 1 d'abord pour que tu puisses tester de bout en bout, puis on enchaîne la phase 2. Dis-moi si tu préfères tout d'un seul jet.
