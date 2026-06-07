## Diagnostic

L'écran noir « This page didn't load » est le **fallback de secours du worker** (`src/lib/error-page.ts`) : il s'affiche quand le rendu serveur lève une erreur catastrophique. Il apparaît uniquement sur le domaine publié, jamais en preview.

Deux signaux concordants :

1. **Console** : `null is not an object (evaluating 'dispatcher.useContext')` — symptôme typique d'un crash React au tout début du rendu (hook appelé sans contexte React valide).
2. **Runtime** : `React error #418` — *Hydration failed because the server rendered HTML didn't match the client*.

La cause la plus probable est un **mismatch d'hydratation** sur l'élément `<html>` :

- `src/routes/__root.tsx` injecte un script `themeBootstrapScript` qui, au tout début du chargement, **mute `document.documentElement.classList`** (`theme-light` / `theme-dark` / `dark`) en lisant `localStorage`.
- Le HTML SSR rendu, lui, sort `<html lang="fr">` **sans aucune de ces classes**.
- Au premier rendu client, React compare et lève une erreur d'hydratation. En production minifiée, React démonte tout l'arbre → `dispatcher` devient null → tous les `useContext` (`QueryClientProvider`, `ThemeProvider`, Router) explosent → le worker renvoie le fallback HTML.

Cela explique parfaitement pourquoi :
- ça se produit **partout** (la racine `<html>` plante tout l'arbre, peu importe la route),
- c'est **sporadique** (dépend de l'état de `localStorage` et du media query `prefers-color-scheme` au moment du load),
- ça ne se voit **pas en preview** (le build dev n'est pas minifié et tolère les warnings d'hydratation — React les transforme en hard error uniquement en prod).

## Correctif

Édition ciblée d'un seul fichier : `src/routes/__root.tsx`.

1. Ajouter `suppressHydrationWarning` sur le `<html>` et sur le `<body>` dans `RootShell` — c'est la recommandation officielle TanStack (cf. knowledge `tanstack-ssr-head`) dès qu'un script pre-hydratation modifie l'élément.
2. S'assurer que le script de bootstrap thème s'exécute bien **avant** `<HeadContent />` (déjà le cas).
3. Vérifier qu'aucun autre script pre-hydratation ne mute le DOM sans suppression de warning.

## Vérification après correctif

- Recharger `app.colosmartraining.fr` plusieurs fois (avec `localStorage.cst-theme` à `light`, `dark`, et vide) → plus d'écran noir.
- Console : plus de `dispatcher.useContext` ni de React error #418.
- Récupérer les logs worker publiés (`stack_modern--server-function-logs deployment=published`) pour confirmer qu'aucune SSR exception ne reste — si une autre cause apparaît dans les logs, on traite en suivant le même pattern.

## Hors scope

- Pas de changement de schéma DB ni de RLS.
- Pas de modification du provider thème, du routeur, du worker, ni des routes membre/coach.
- Pas de toucher à `src/lib/error-page.ts` ni à `src/server.ts` — le fallback fonctionne déjà comme prévu, on supprime juste la cause du crash en amont.

## Fichier modifié

- `src/routes/__root.tsx`
