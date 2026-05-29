# Faire fonctionner la messagerie membre ↔ coach

## État actuel

- **Backend** : déjà prêt dans `src/lib/coach.functions.ts` — `sendMessage`, `listConversations`, `listMessages`, `pinMessage`. La table `messages` stocke tout (from_id, to_id, content, created_at, read, pinned) → **l'historique est déjà conservé** automatiquement, rien à ajouter côté DB.
- **Coach** : page complète à `/coach/messages` avec liste de conversations, fil de discussion, realtime, accusés de lecture, réponses rapides.
- **Membre** : la barre de navigation pointe vers `/membre/messages` (avec un badge non-lus déjà câblé)… mais **la page n'existe pas** → c'est la pièce manquante.

## Ce qui sera fait

### 1. Page Messages côté membre

Créer la route `src/routes/_authenticated.membre.messages.tsx` + le composant `src/pages/membre/Messages.tsx`. Différences avec la page coach :

- **Un seul interlocuteur** : le coach. Au chargement, on récupère automatiquement le coach via une nouvelle server fn `getMyCoach()` (lit la table `user_roles` pour trouver l'utilisateur avec `role = 'coach'`), donc pas de liste de conversations à gauche → vue plein écran du fil.
- Réutilise `sendMessage`, `listMessages` (déjà existants, qui marquent automatiquement les messages reçus comme lus).
- Realtime Supabase identique au coach (canal `postgres_changes` sur `messages`).
- En-tête : nom + email du coach, bouton retour vers `/membre`.
- Saisie + envoi avec Entrée, message optimiste, gestion d'erreur via toast.
- Style cohérent avec le reste de l'app membre (palette CST, bottom-nav visible).

### 2. Badge "non-lus" dans la nav membre

- Ajouter une server fn `getUnreadCount()` (count des `messages` où `to_id = userId` et `read = false`).
- L'appeler dans `_authenticated.membre.tsx` (layout) toutes les 30 s + à chaque navigation, et passer la valeur à `<MemberNav unreadCount={...} />` qui consomme déjà la prop.

### 3. Suivi / historique

Aucune action DB requise : tous les messages sont déjà stockés indéfiniment dans la table `messages` avec timestamp. La page membre les affiche du plus ancien au plus récent (scroll), et la page coach déjà existante garde le même historique par conversation. Côté coach, la liste des conversations affiche `last_message` + `last_at` → suivi naturel.

## Détails techniques

**Fichiers créés**
- `src/routes/_authenticated.membre.messages.tsx` — route file
- `src/pages/membre/Messages.tsx` — composant

**Fichiers modifiés**
- `src/lib/coach.functions.ts` — ajouter `getMyCoach` + `getUnreadCount` (server fns avec `requireSupabaseAuth`)
- `src/routes/_authenticated.membre.tsx` (ou layout équivalent) — polling badge → `<MemberNav unreadCount={n} />`

**Sécurité**
- Les nouvelles server fns utilisent `requireSupabaseAuth` (déjà la convention du fichier).
- `getMyCoach` ne renvoie que `id, first_name, last_name, email` du coach — pas de PII sensible.
- `sendMessage` côté membre n'autorise que l'envoi vers un coach (la policy RLS `Users send messages` l'impose déjà).

**Pas de migration SQL nécessaire** — la table `messages` et ses policies sont déjà en place.
