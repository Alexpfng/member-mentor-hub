## Objectif

App 100% fonctionnelle (plus aucune mention « bêta » ni « démo »), tableaux de bord **vides**. Seuls deux comptes existent : Léo (coach) et Teddy (membre).

## 1. Retirer toute notion de bêta / démo du code

- `src/lib/site.ts` → supprimer `BETA_MODE` et `BETA_CONTACT_EMAIL`
- `src/lib/app-mode.ts` → garder `SUPABASE_ENABLED = true`, supprimer `DEFAULT_DEMO_ROLE` et toute logique « démo »
- `src/routes/__root.tsx` → retirer `<BetaBanner />`
- `src/components/BetaBanner.tsx` → supprimer le fichier
- `src/pages/auth/Login.jsx` → supprimer :
  - le bloc « BÊTA PRIVÉE · ACCÈS RÉSERVÉ » qui affiche les emails
  - les boutons / branches « mode démo »
  - le message « Mode démo local actif »
- `src/pages/coach/Dashboard.jsx` → supprimer la welcome card « Bienvenue, Léo 👋 » + la clé localStorage `beta_welcome_seen_coach`
- `src/components/CoachSidebar.jsx` et `src/components/MemberNav.jsx` → supprimer les conditions `BETA_MODE` pour que **toutes** les sections soient à nouveau accessibles (Import, Running, Progression, etc.)
- `src/routes/api.public.seed-beta.ts` + `src/lib/seed.functions.ts` → supprimer (plus de seed automatique)

## 2. Vider la base de données

Comptes à **garder** :
- `leocolognesi@gmail.com` (Léo Colognesi, coach)
- `morin.td@gmail.com` (Teddy Morin, member)

Comptes à **supprimer** + toutes leurs données :
- `coach.demo@colosmart.test`
- `membre.demo@colosmart.test`
- `max.corre@icloud.com`

Tables à vider entièrement (aucune donnée utile actuellement) :
`set_logs`, `exercise_feedbacks`, `personal_records`, `weight_logs`, `technique_videos`, `sessions`, `assignments`, `messages`, `member_profiles`, `programs`, `exercises`

Puis suppression des 3 comptes démo dans `user_roles`, `profiles`, `auth.identities` et `auth.users`.

## 3. Résultat attendu

- `/login` : design propre, aucun bandeau vert, aucun message bêta/démo. Seul un formulaire email + mot de passe (+ mot de passe oublié).
- Léo se connecte → dashboard coach **vide** : 0 programme, 0 séance, 1 membre (Teddy).
- Teddy se connecte → dashboard membre **vide** : aucun programme assigné, écran « pas encore de programme » propre (sans mention bêta).
- Sidebar/nav complètes (toutes les fonctionnalités de l'app visibles).

## Fichiers touchés

- Supprimés : `src/components/BetaBanner.tsx`, `src/routes/api.public.seed-beta.ts`, `src/lib/seed.functions.ts`
- Modifiés : `src/lib/site.ts`, `src/lib/app-mode.ts`, `src/routes/__root.tsx`, `src/pages/auth/Login.jsx`, `src/pages/coach/Dashboard.jsx`, `src/components/CoachSidebar.jsx`, `src/components/MemberNav.jsx`
- Migration / nettoyage SQL : vidage des tables ci-dessus + suppression des 3 comptes démo
