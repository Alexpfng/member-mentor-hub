## Constat (audit synthétique)

Après inspection, l'app a une identité forte (CST dark-green, tokens `cst-*`, typographies Barlow / Playfair) mais souffre de trois problèmes structurels :

1. **Architecture responsive fragile** : la plupart des écrans membre sont construits comme une maquette téléphone fixe (`width: 390px`, `height: 780px` en inline-styles) puis « rattrapés » par des sélecteurs CSS très spécifiques (`div[style*="width: 390px"]`) dans `tokens.css`. Sur tablette le membre n'a **plus de navigation** (bottom-nav cachée ≥768px sans remplaçant). Sur desktop le membre apparaît dans une petite carte flottante au lieu d'utiliser l'espace.
2. **Coach** : sidebar 240px puis transformée en barre horizontale scrollable par des sélecteurs `aside[style*="width: 240px"]` — bricolage. La navigation mobile via drawer existe mais les pages contiennent encore des paddings/grilles non adaptés (4 cols → forcés en 2 cols par sélecteurs d'attribut).
3. **Pas de mode clair** : `:root` (light) et `.dark` existent dans `styles.css` mais ne sont jamais appliqués ; tout passe par `cst-dark-green`/`cst-warm-white` codés en dur dans les composants. `.cst-light` n'est utilisé que sur 2 écrans d'onboarding.

## Plan — 4 phases livrables séparément

### Phase 1 — Fondations : ThemeProvider + tokens light/dark cohérents

**Objectif** : pouvoir basculer light/dark sur toute l'app sans toucher chaque composant.

- Nouveau `src/lib/theme.tsx` : `ThemeProvider` + `useTheme()` (valeurs `dark` | `light` | `system`), persistance `localStorage` (`cst-theme`), détection `prefers-color-scheme`, application via `document.documentElement.classList`.
- Wrap `RootComponent` dans `__root.tsx` avec `<ThemeProvider>`. Mise à jour de `<meta name="theme-color">` selon mode.
- Refonte de `tokens.css` pour exposer **les tokens CST en variables thématisables** :
  - Variables sémantiques : `--cst-bg`, `--cst-bg-elev`, `--cst-text`, `--cst-text-muted`, `--cst-border`, `--cst-card`, `--cst-accent` (= mid-green dans les 2 modes).
  - Bloc `:root` (light) : bg = `#F5F2EA`, text = `#1A1A18`, card = `#FFFFFF`, border = `rgba(26,26,24,0.10)`, hatch atténué.
  - Bloc `.dark` (dark) : bg = `#1B2E1F`, text = `#FFFFFF`, card = `#243029`, border = `rgba(255,255,255,0.10)` (valeurs actuelles).
  - Default = dark (le brand est sombre). L'utilisateur peut choisir.
- Mise à jour des classes utilitaires (`.cst-screen`, `.cst-card-dark`, `.cst-input`, `.cst-btn-ghost-*`, `.cst-mono`) pour qu'elles consomment ces variables sémantiques au lieu de hex codés. Les classes gardent leur nom (pas de breaking change).
- Toggle UI :
  - Composant `<ThemeToggle />` (icône soleil/lune, 3 états : light / dark / auto).
  - Placé dans : `CoachSidebar` (bas, à côté du bouton signout) + `MemberNav` top-row (avatar/header) + section dédiée dans `Profil`.

### Phase 2 — Refonte responsive du shell membre (mobile / tablette / desktop)

**Objectif** : sortir du paradigme « phone-frame inline » et offrir une vraie expérience tablette/desktop.

- Nouveau composant `MemberShell` (layout) :
  - **Mobile ≤767px** : contenu pleine largeur + `MemberNav` bottom bar (comportement actuel).
  - **Tablette 768–1023px** : `MemberNav` repensée en **rail latéral gauche** (72px, icônes + labels), contenu fluide max 720px.
  - **Desktop ≥1024px** : sidebar 240px (mêmes items que coach mais palette membre), contenu max 960px centré.
- Suppression des `width: 390px / height: 780px` en inline dans les pages membre (`Dashboard`, `Programme`, `Historique`, `Progression`, `Logger`, `seance/$sessionId`) → remplacés par `<MemberShell>` enveloppant le contenu.
- Suppression des sélecteurs hack `div[style*="width: 390px"]` dans `tokens.css` (devenus inutiles).
- `MemberNav` : ajout de variantes `bottom` (mobile) / `rail` (tablet) / `sidebar` (desktop) pilotées par CSS media queries, plus un slot `<ThemeToggle />`.

### Phase 3 — Refonte responsive du shell coach + grilles

- `CoachSidebar` : remplacer les sélecteurs d'attribut (`aside[style*="width: 240px"]`) par des classes propres (`.coach-sidebar` + variantes `.is-mobile`). Drawer mobile conservé, mais le breakpoint passe à 1023px (tablette utilise le drawer). Sur desktop ≥1280 : sidebar plus large (260px).
- Pages coach (`Dashboard`, `Member`, `Programmes`, `ProgramDetail`, `Builder`, `BuilderNew`, `Import`, `Messages`, `Running`) :
  - Remplacer les `grid-template-columns: repeat(4, 1fr)` inline par des classes responsives Tailwind (`grid-cols-2 md:grid-cols-3 xl:grid-cols-4`).
  - Conteneur max-width 1440px centré.
  - Header de page : pattern `flex-wrap gap-3` pour éviter les chevauchements titre/actions sur 768–900.
  - Tables (`Member`, `Programmes`, `ProgramDetail`) : wrappées dans `.table-scroll` au lieu du `display: block` global qui casse les headers.

### Phase 4 — Passe UX/UI fine (overlaps, hiérarchie, animations)

Pour chaque écran (membre + coach), checklist appliquée :

1. **Aucun chevauchement** : audit visuel à 320 / 375 / 414 / 768 / 1024 / 1440 px.
2. **Cibles tactiles ≥44px**, espacements ≥8px entre boutons groupés.
3. **Hiérarchie info** : titre → meta → contenu → CTA. Les CTA primaires en bas (mobile) ou en haut-droit (desktop), jamais flottants au milieu.
4. **Boutons** : variantes cohérentes (`primary` plein, `secondary` outline, `ghost` discret, `danger` rouge). Plus de mix arbitraire de styles inline.
5. **Animations** : transitions 150–200ms `ease-out` sur hover/active uniquement. Respect `prefers-reduced-motion` (déjà en place). Vibration sur fin de chrono déjà OK.
6. **États vides / loading / erreur** : un pattern unique (icône + label mono + sous-titre + CTA optionnel).
7. **Accessibilité** : `aria-label` sur boutons icônes, focus visibles (ring vert), contrastes ≥ AA en light ET dark.

Pages prioritaires (ordre d'attaque) :
- Membre : `Dashboard`, `Programme`, `seance/$sessionId` (LiveSession), `Logger`, `Historique`, `Progression`, `Profil`.
- Coach : `Dashboard`, `Member`, `ProgramDetail`, `Builder`, `Messages`, `Programmes`, `Import`, `Running`.

## Hors scope (non touché)

- Logique métier (programmes, séries, RPE, vidéos).
- Schéma DB / RLS.
- Refactor du design system vers shadcn (les `cst-*` restent, juste thématisés).
- Refonte typographique / nouvelle DA.

## Approche de livraison

Je propose d'**exécuter les 4 phases d'affilée** dans une seule passe (un seul build), avec vérification visuelle au fil de l'eau. C'est cohérent : Phase 1 débloque Phase 2–4, et faire chaque phase isolément multiplierait les états intermédiaires cassés.

Si tu préfères ne livrer qu'une phase d'abord (par ex. Phase 1 + 2 pour valider le mode clair et le shell membre avant d'attaquer le coach), dis-le et j'adapte.

## Fichiers touchés (estimation)

- **Créés** : `src/lib/theme.tsx`, `src/components/ThemeToggle.tsx`, `src/components/MemberShell.tsx`.
- **Modifiés** : `src/tokens.css`, `src/mobile.css`, `src/routes/__root.tsx`, `src/components/MemberNav.jsx`, `src/components/CoachSidebar.jsx`, les 7 pages membre, les 8 pages coach, `src/routes/_authenticated.membre.seance.$sessionId.tsx`.
