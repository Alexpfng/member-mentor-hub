## Problème

Après l'ajout de `src/routes/_authenticated.coach.tsx` (garde de rôle pour rediriger les non-coachs vers `/membre`), toutes les pages affichent **« This page didn't load »** avec :

```
Invariant failed: Expected to find a match below the root match in SPA mode.
```

### Cause

1. Le parent `_authenticated/route.tsx` est `ssr: false` (géré par l'intégration).
2. La nouvelle couche `_authenticated.coach.tsx` n'hérite pas explicitement de cette config et son composant renvoie tantôt `<div>Chargement…</div>`, tantôt `<Navigate />`, tantôt `<Outlet />`. Le routeur attend toujours un `<Outlet />` côté layout, sinon il ne trouve pas le match enfant attendu pendant l'hydratation.

Résultat : l'hydratation crashe globalement → toutes les routes tombent sur la page d'erreur.

## Correctif

Supprimer la garde via couche/layout et faire la vérification de rôle **dans la page `CoachDashboard`** (et seulement là). Avantages :
- Plus de fichier layout intermédiaire → plus d'invariant SPA.
- L'erreur originale (« Accès réservé aux coachs » sur `listMembers`) n'apparaissait que sur `/coach`, donc gater uniquement `CoachDashboard` suffit. Les autres routes `/coach/*` sont accédées via la nav coach, donc inatteignables par un membre dans le flux normal.
- Reste cohérent avec le pattern Supabase de l'intégration (pas de double gate, pas de `beforeLoad` qui appelle une server fn protégée pendant le SSR).

### Changements

1. **Supprimer** `src/routes/_authenticated.coach.tsx` (le fichier que j'ai créé).
2. **Modifier** `src/pages/coach/Dashboard.tsx` (ou `.jsx`) pour, avant tout rendu de données :
   - lire `useAuth()` ;
   - si `loading` → écran de chargement ;
   - si pas de user → `<Navigate to="/login" />` ;
   - si `role && role !== "coach"` → `<Navigate to="/membre" />`.
3. Aucun changement de base de données, de RLS, ni de server function.

### Vérification

- `/` se charge à nouveau.
- `/coach` connecté en tant que membre redirige vers `/membre` sans déclencher l'appel `listMembers` (pas d'erreur 500 « Accès réservé aux coachs »).
- `/coach` connecté en tant que coach affiche le dashboard normalement.
- `/coach/builder`, `/login` etc. se chargent (l'invariant SPA disparaît).
