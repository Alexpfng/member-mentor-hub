## Constat

Le projet a bien un thème clair (toggle `ThemeToggle`, variables `--cst-*` re-définies dans `html.theme-light`, et une couche d'overrides dans `src/tokens.css` qui ré-attribue certains styles inline du mode sombre). Mais ~60 styles inline dans les pages utilisent encore des couleurs sombres en dur **non couvertes** par cette couche, donc en mode clair on voit des panneaux/cartes/bordures sombres au milieu d'un fond crème.

Patterns qui fuient actuellement en clair :

- Hex sombres en dur : `#16261A`, `#1F2A22`, `#243029`, `#0F1B11`, `#1B2E1F` (panneaux Builder, items exercice, fond Logger, header Messages, etc.)
- `rgba(255,255,255,0.02)` (fond cartes "jour" Builder, items Programme membre…) — la couche d'override couvre 0.03/0.05/0.06/0.08 mais pas 0.02
- `rgba(0,0,0,0.x)` non couverts pour quelques x
- Quelques `color: '#fff'` à l'intérieur d'éléments qui doivent rester verts (boutons primaires) — déjà OK — mais d'autres textes blancs sur fond désormais clair restent illisibles malgré l'override (cas où le parent est forcé clair mais l'enfant garde `color: #fff` explicite ré-écrit en `color: rgb(255, 255, 255)` — déjà couvert, à valider page par page)

Pages les plus touchées :

- `src/pages/coach/Builder.jsx` (panneau gauche `#16261A`, items `#1F2A22`, cartes jour `rgba(255,255,255,0.02)`)
- `src/pages/coach/BuilderNew.tsx`, `Programmes.tsx`, `ProgramDetail.tsx`, `Import.jsx`, `Member.jsx`, `Running.tsx`, `Dashboard.jsx`, `Messages.tsx`
- `src/pages/membre/Dashboard.jsx`, `Programme.jsx`, `Logger.jsx`, `Historique.jsx`, `Progression.jsx`, `Messages.tsx`
- `src/components/CoachSidebar.jsx` (fond `#16261A`)
- `src/components/Atoms.jsx` (`#1B2E1F`, `#1F2A22`)
- `src/components/MemberNav.jsx` (barre du bas)

## Plan de correction

### 1. Étendre la couche d'override dans `src/tokens.css` (gain rapide, sans toucher aux pages)

Ajouter des règles `html.theme-light [style*="..."]` pour ré-attribuer en mode clair :

- `background: #16261A` / `rgb(22, 38, 26)` → `var(--cst-bg-elev)` (#EDE8D8)
- `background: #1F2A22` / `rgb(31, 42, 34)` → `var(--cst-card-bg)` (#FFFFFF)
- `background: #243029` / `rgb(36, 48, 41)` → `var(--cst-card-bg)`
- `background: #0F1B11` / `rgb(15, 27, 17)` → `var(--cst-bg)`
- `background: #1B2E1F` / `rgb(27, 46, 31)` → `var(--cst-bg)`
- `background: rgba(255, 255, 255, 0.02)` → tint encre léger
- `background: rgba(45, 90, 53, 0.08/0.10/0.12/0.15/0.18)` → laisser (vert OK sur crème) mais réduire à 0.08 max pour ne pas surcharger
- `border-color` translucides blancs manquants (0.04, 0.05, 0.10, 0.12, 0.18, 0.35) → encre translucide
- Hairlines `height: 1px; background: rgba(255,255,255,0.06/0.10)` → encre 10%
- `color: rgba(255,255,255,0.35/0.4/0.5/0.65/0.72)` → `var(--cst-text-soft)` / `--cst-text-muted` (compléter les stops manquants)

### 2. Refactor ciblé des composants partagés en `var(--cst-*)`

Remplacer les hex en dur par des tokens dans :

- `src/components/CoachSidebar.jsx` — fond, bordures, textes nav
- `src/components/MemberNav.jsx` — barre bas
- `src/components/Atoms.jsx` — `CSTPlaceholder`, `CSTDuoTitle`

Ces 3 fichiers sont importés partout, donc les corriger en tokens règle d'un coup une grosse partie des fuites sans toucher à chaque page.

### 3. Refactor des pages les plus visibles (route active de l'utilisateur en priorité)

Pour `coach/Builder.jsx` (page actuellement ouverte), remplacer les constantes `panelStyle`, `exItem`, `dayCard` par des tokens : `var(--cst-bg-elev)`, `var(--cst-card-bg)`, `var(--cst-card-border)`, `var(--cst-hairline)`. Idem pour `Logger.jsx`, `Messages.tsx` (header `#16261A`, bulles `#243029`), `Dashboard.jsx` membre (fond `var(--cst-dark-green)` → `var(--cst-bg)`).

### 4. QA en mode clair

Après chaque lot, naviguer dans le preview en mode clair sur :
`/coach`, `/coach/builder`, `/coach/programmes`, `/coach/messages`, `/coach/import`, `/coach/membre/...`, `/membre`, `/membre/programme`, `/membre/messages`, `/membre/historique`, `/membre/progression`, `/membre/logger`.

Pour chaque écran, screenshot et vérifier :
- Pas de gros bloc sombre résiduel
- Contraste texte/fond AA
- Bordures visibles mais discrètes
- Boutons primaires verts conservent leur texte blanc

## Périmètre

Visuel uniquement (CSS + inline styles). Aucune logique métier, aucun changement de routes ou de serveur. Aucun changement DB.

## Fichiers à modifier

```text
src/tokens.css                       (étendre la couche d'override)
src/components/CoachSidebar.jsx      (tokeniser)
src/components/MemberNav.jsx         (tokeniser)
src/components/Atoms.jsx             (tokeniser)
src/pages/coach/Builder.jsx          (tokeniser)
src/pages/coach/Messages.tsx
src/pages/coach/Dashboard.jsx
src/pages/coach/Programmes.tsx
src/pages/coach/ProgramDetail.tsx
src/pages/coach/Import.jsx
src/pages/coach/Member.jsx
src/pages/coach/Running.jsx
src/pages/coach/BuilderNew.tsx
src/pages/membre/Dashboard.jsx
src/pages/membre/Programme.jsx
src/pages/membre/Logger.jsx
src/pages/membre/Messages.tsx
src/pages/membre/Historique.jsx
src/pages/membre/Progression.jsx
```

Approche : étape 1 d'abord (override CSS — règle 80 % des cas en quelques minutes), puis étape 2 (composants partagés), puis étape 3 page par page seulement si la QA visuelle révèle encore des fuites. Ça évite de toucher inutilement 18 fichiers si l'override suffit.
