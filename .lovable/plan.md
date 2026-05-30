## Problème
Sur la fiche membre (`/coach/membre/:memberId`), les boutons "MESSAGE →" et "OUVRIR LA MESSAGERIE →" naviguent vers `/coach/messages` sans préciser le membre. L'écran affiche alors "Sélectionne un membre" et il faut recliquer dans la liste — bloquant quand la conversation n'existe pas encore.

## Solution
Ouvrir directement la conversation du membre en passant son id (et ses infos) via la query string, puis auto-sélectionner ce membre côté Messages.

### 1. `src/pages/coach/Member.jsx`
Les deux boutons (ligne 257 et 495) → `navigate({ to: '/coach/messages', search: { partner: memberId } })`.

### 2. `src/pages/coach/Messages.tsx`
- Lire `partner` depuis `useSearch()` de la route `/coach/messages`.
- Au chargement (et quand `conversations` arrivent) : si `partner` est défini et qu'aucun `activePartner` n'est sélectionné, chercher dans `conversations` ; si trouvé → `setActivePartner`.
- Si le membre n'est pas encore dans `conversations` (jamais échangé) : récupérer son profil minimal via une nouvelle petite serverFn `getMemberProfile({ memberId })` (ou réutiliser `listMemberVideos`/coach.functions existante si elle expose le profil) pour construire un objet `Partner` et l'activer. Cela permet de démarrer une nouvelle conversation depuis la fiche.

### 3. Route `src/routes/_authenticated.coach.messages.tsx`
Ajouter un `validateSearch` simple (`z.object({ partner: z.string().uuid().optional() })`) pour typer le param.

## Résultat
Cliquer "MESSAGE" sur la fiche d'un client ouvre directement la conversation avec lui, prêt à écrire — même s'il n'y a aucun message antérieur.