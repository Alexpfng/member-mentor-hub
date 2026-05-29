## Problème

`/coach/membre` (`src/pages/coach/Member.jsx`) affiche un membre en dur ("JORDAN FERRER", semaine 4/8, exercices fictifs, tendances inventées, note privée pré-remplie). Aucune donnée réelle, et la route n'a pas d'id de membre dans l'URL — depuis le tableau de bord, le bouton VOIR navigue vers `/coach/membre` sans paramètre.

## Objectif

Quand Léo clique VOIR sur un adhérent, il arrive sur une fiche membre réelle, alimentée par la base, avec uniquement les données qui existent (zéro contenu démo).

## Plan

### 1. Route paramétrée

- Renommer la route fichier en `src/routes/_authenticated.coach.membre.$memberId.tsx` (path `/_authenticated/coach/membre/$memberId`).
- Supprimer l'ancienne `_authenticated.coach.membre.tsx`.
- Mettre à jour `Dashboard.jsx` : bouton VOIR → `navigate({ to: '/coach/membre/$memberId', params: { memberId: r.id } })`.

### 2. Nouvelle server function `getMemberDetail`

Dans `src/lib/coach.functions.ts`, ajouter `getMemberDetail({ member_id })` protégée par `requireSupabaseAuth` + `assertCoach`. Retourne :

- `profile` (id, email, first_name, last_name, created_at, avatar_url)
- `member_profile` (poids, taille, niveau, objectif, blessures, `coach_private_notes`)
- `assignment` actif + `program` lié (id, name, duration_weeks, frequency_per_week, objective, structure)
- `sessions` (30 dernières : date, status, session_label, week_number, day_number, duration_minutes, average_rpe)
- `recent_set_logs` (≤ 200 dernières lignes pour calculer les tendances clés)
- `weight_logs` (30 dernières)
- `unread_messages_count` (messages reçus par le coach depuis ce membre, `read=false`)
- `last_weight_kg` (dernière entrée weight_logs)

### 3. Server function `updateMemberNotes`

`updateMemberNotes({ member_id, coach_private_notes })` → upsert dans `member_profiles` (clé `user_id`). Garde-fou coach uniquement.

### 4. Refonte `src/pages/coach/Member.jsx`

Réécrire entièrement, mêmes atomes/style (`CSTSectionNum`, `CSTAvatar`, `CSTStatus`, `cst-card-dark`, etc.), mais :

- Lire `memberId` via `Route.useParams()` (passer en composant route inline ou via `useParams` du router).
- `useEffect` → appelle `getMemberDetail`. État `loading` / `error` propres.
- Header hero : initiales depuis `first_name/last_name`, vrai nom, badge `MEMBRE · ACTIF`, "Inscrit le {created_at}". Stats : Objectif (`member_profile.goal` ou "—"), Poids (`last_weight_kg` ou "—"), Niveau (`member_profile.level` ou "—"), Ancienneté (jours depuis `created_at`), Séances (count `sessions`).
- Onglets : "Programme actuel", "Historique", "Progression", "Profil", "Messages" (badge = `unread_messages_count`, masqué si 0).
- **Programme actuel** : si pas d'assignment → état vide + bouton "ASSIGNER UN PROGRAMME" (réutilise `AssignSelect` ou redirige vers Dashboard). Sinon : nom programme, durée, semaine courante (`min(ceil(jours_depuis_start/7), duration_weeks)`), liste des jours de la semaine courante depuis `program.structure.weeks[w].days[]` avec statut (done si une session du membre matche `week_number/day_number`).
- **Historique** : liste des `sessions` (label, date, durée, RPE moyen, statut).
- **Progression** : top 4 exercices (par fréquence dans `set_logs`) avec delta poids max début→fin (sur la fenêtre). Petit graphe poids corporel (`weight_logs`).
- **Profil** : poids, taille, niveau, objectif, blessures (read-only avec libellés "Non renseigné" si vide).
- **Note privée** : `textarea` lié à `member_profile.coach_private_notes`, bouton ENREGISTRER → `updateMemberNotes`. Indicateur "Enregistré ✓".
- **Bouton MESSAGE** → `navigate({ to: '/coach/messages' })`.
- Breadcrumb : MEMBRES → vrai nom, cliquable retour vers `/coach`.

### 5. Routage / nettoyage

- Aucune donnée fictive ne reste dans `Member.jsx`.
- Pas de migration DB nécessaire (toutes les colonnes existent).
- `useNavigate` depuis `@tanstack/react-router` (le fichier utilise actuellement `react-router-dom` → corriger).

## Fichiers touchés

- `src/lib/coach.functions.ts` (ajout `getMemberDetail`, `updateMemberNotes`)
- `src/pages/coach/Member.jsx` (réécriture)
- `src/routes/_authenticated.coach.membre.tsx` (supprimé)
- `src/routes/_authenticated.coach.membre.$memberId.tsx` (créé)
- `src/pages/coach/Dashboard.jsx` (lien VOIR avec param)

## Hors scope

- Édition complète du profil membre (poids/taille/objectif) côté coach — read-only pour l'instant.
- Adapter la semaine / messagerie inline (boutons mènent aux écrans existants).
