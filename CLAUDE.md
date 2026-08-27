# ColoSmart Training — application de coaching sportif

App SaaS de coaching fitness : un **coach** construit des programmes/séances, ses **membres** les suivent, loggent leurs séances et voient leur progression. C'est **l'app active** (pas les dossiers marketing look-alike : `colosmartraining-site`, `Colo-smart-training-site`, `colosmart-training`…).

## Stack

- **TanStack Start** (SSR) + **React 19** + **TypeScript**
- **Vite 7**, **Bun** (runtime + package manager — voir `bun.lock`, `bunfig.toml`)
- **Tailwind v4** + **shadcn/ui** (Radix) — `components.json`
- **TanStack Router** (routes fichiers) + **TanStack Query** (data)
- **Supabase** (auth + Postgres + storage) — client dans `src/integrations/supabase/`
- **Lovable** (hébergement + email/webhooks : `@lovable.dev/*`)
- Déploiement **Cloudflare** (`wrangler.jsonc`, `@cloudflare/vite-plugin`, `nitro`)
- Libs clés : `dnd-kit` (builder drag&drop), `recharts` (progression), `xlsx` (import Excel → `src/lib/excel-import/`), `react-email` (templates → `src/lib/email-templates/`), `leaflet` (running), `canvas-confetti`, `zod`, `react-hook-form`

## Commandes (Bun)

```bash
bun install
bun run dev       # vite dev
bun run build     # vite build
bun run lint      # eslint
bun run format    # prettier --write .
```

⚠️ `package-lock.json` traîne à côté de `bun.lock` — **utilise Bun** pour rester aligné sur le lockfile qui fait foi.

## Architecture

- **Routing fichiers** dans `src/routes/`. Layout d'auth `_authenticated.tsx` → deux espaces : `_authenticated.coach.*` et `_authenticated.membre.*`. Onboarding `onboarding.$step.tsx`. Racine `__root.tsx`. Routes API dans `src/routes/api/`, routes Lovable dans `src/routes/lovable/`.
- `src/components/{coach,cst,ui}/`, `src/pages/{auth,coach,membre}/`, `src/hooks/`, `src/lib/`, `src/data/`.
- Voir `AUDIT.md` (audit existant) et `docs/` pour le contexte projet.

## Modèle métier — les séances sont du **JSONB**

Les programmes/séances ne sont PAS des tables relationnelles classiques : la structure vit en **JSONB** dans `programs.structure` et `assignment_weeks.structure`, au format `weeks[].days[].exercises[]`. Quand tu manipules des séances, raisonne sur ce JSON imbriqué, pas sur des jointures.

## Supabase — prod HORS MCP (important)

- **Prod** : project ref `lupqpeqvtxnohjpolhna`. Il **n'est PAS** sur le MCP Supabase connecté (le projet MCP `colosmartraining` = `wvcfiimxudedppmolsic` est **inactif**).
- ⟹ Pour toute migration/requête prod : **fournir du SQL prêt à coller** (Alex l'exécute dans le dashboard), ne pas supposer un accès MCP.
- Migrations locales versionnées dans `supabase/migrations/` (timestamp).

## Déploiement (Vercel — Lovable abandonné depuis 2026-08-10)

- **`git push origin main` = déploiement prod automatique** via Vercel. Aucun clic « Publish » à faire.
- Domaine : `app.colosmartraining.fr` → projet Vercel `colo-smart-app` (alex-pfennig-projects).
- Lovable = abandonné. Ne pas mentionner Lovable ni demander de Publish pour ce repo.

## Pièges connus

- **Bug Outlet TanStack** (récurrent) : une route parente qui rend un composant **au lieu de `<Outlet/>`** → la route enfant affiche silencieusement le parent. Fix = séparer **layout + route index**.
- Ne pas confondre ce repo avec les sites vitrine ColoSmart (dossiers look-alike).

## Conventions

- TypeScript strict, ESLint + Prettier (config présentes). Respecter le style existant.
- UI : composer avec shadcn/ui (`src/components/ui/`) plutôt que du CSS ad hoc.
- Data : passer par TanStack Query + le client Supabase de `src/integrations/supabase/`.
