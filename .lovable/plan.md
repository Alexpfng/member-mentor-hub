# Plan — Création de programmes & invitation d'adhérents par email

## Objectif

Permettre au coach de :
1. **Créer / sauvegarder un programme** (nom, durée, fréquence, objectif, structure des semaines/jours/exercices) dans la base.
2. **Inviter un adhérent par email**. L'adhérent reçoit un email avec un lien pour définir son mot de passe, puis accède à son espace membre.

Tout le reste de l'UI existante (mockups statiques) reste en place — on branche uniquement les flux demandés.

---

## 1. Backend — Server Functions (TanStack `createServerFn`)

Nouveau fichier `src/lib/coach.functions.ts` protégé par `requireSupabaseAuth` + vérification du rôle `coach` :

- **`saveProgram`** — insert/update dans `programs` (champs : `name`, `description`, `duration_weeks`, `frequency_per_week`, `objective`, `level`, `structure` JSONB, `coach_id = auth.uid()`). Validation Zod.
- **`listPrograms`** — liste les programmes du coach.
- **`getProgram(id)`** — récupère un programme pour édition.
- **`listMembers`** — joint `user_roles` (role=member) + `profiles` + dernière `assignment`/`session` pour la page Membres.
- **`inviteMember({ email, firstName?, lastName? })`** — utilise `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/reset-password, data: { first_name, last_name } })`. Le trigger `handle_new_user` existant crée automatiquement le profil + rôle `member`. Retourne success/erreur (email déjà existant, etc.).
- **`assignProgram({ memberId, programId, startDate })`** — crée une ligne dans `assignments`.

Le client side-bearer attacher est déjà câblé (`src/start.ts`).

---

## 2. Email — invitation

L'appel `auth.admin.inviteUserByEmail` envoie automatiquement un email d'invitation Supabase (template "Invite user") contenant un lien magique qui redirige vers `/reset-password`. La page `/reset-password` existe déjà et gère la définition du mot de passe.

**Deux options pour l'email :**

- **A. Par défaut** : Supabase envoie l'email depuis son domaine système (limité à ~30/heure, marqué "via supabase.io"). Fonctionne immédiatement, zéro setup. **Recommandé pour démarrer.**
- **B. Lovable Emails** (recommandé pour production) : configurer un domaine d'envoi + scaffold des templates auth → l'email d'invitation part depuis `notify@votredomaine` avec un design propre. Nécessite que vous renseigniez votre domaine.

Je peux faire l'option A d'abord, puis basculer en B quand vous voulez. **Dites-moi si vous voulez configurer Lovable Emails dès maintenant** (il vous faudra l'accès DNS du domaine).

---

## 3. Frontend

### `src/pages/coach/Builder.jsx`
- Brancher les `<input>`/`<select>` à un state React (nom, durée, fréquence, objectif, jours/exercices).
- Bouton **"SAUVEGARDER →"** appelle `saveProgram` via `useServerFn`, toast succès, redirige vers `/coach`.
- La library d'exercices reste statique pour ce lot (pas demandé).

### `src/pages/coach/Dashboard.jsx` (membres)
- Remplacer la grille statique par `listMembers` (TanStack Query).
- Ajouter un bouton **"+ INVITER UN ADHÉRENT"** ouvrant un modal :
  - Champs : email (requis), prénom, nom.
  - Submit → `inviteMember` → toast "Invitation envoyée à X".
- Optionnel : bouton "Assigner programme" sur chaque carte membre → modal qui liste les programmes du coach et appelle `assignProgram`.

### `src/pages/coach/Member.jsx`
- Petit ajout : sélecteur de programme + bouton "Assigner" qui appelle `assignProgram`.

### `/reset-password` (déjà existant)
- Vérifier qu'il gère bien le cas "invitation" (token `type=invite` en plus de `type=recovery`) — `supabase.auth.updateUser({ password })` fonctionne pour les deux.

---

## 4. Base de données

Aucune migration nécessaire. Les tables `programs`, `assignments`, `profiles`, `user_roles` existent déjà avec les bonnes RLS. Le trigger `handle_new_user` crée profil + rôle `member` automatiquement à l'invitation.

---

## 5. Hors scope (à confirmer)

- Édition/suppression d'un programme existant (juste création pour ce lot).
- Drag & drop d'exercices dans le builder (l'UI actuelle est statique — on sauvegarde la structure telle qu'éditée dans les champs textes).
- Renvoi d'invitation / révocation d'accès.

Si vous voulez ces éléments inclus, dites-le.

---

## Question avant implémentation

**Pour les emails d'invitation, vous préférez :**
- (A) Démarrer avec les emails Supabase par défaut (rapide, ok pour tests),
- (B) Configurer Lovable Emails maintenant avec votre domaine (production-ready) ?
