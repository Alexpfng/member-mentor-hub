## Objectif

Remplacer les deux `<select>` natifs de la page Membre (« — Sélectionner un programme — » et « CHANGER DE PROGRAMME… ») par un **combobox typeahead** : Léo tape, la liste se filtre en direct, il clique pour assigner. Le composant suit la DA CST (police mono, vert `--cst-mid-green`, cartes sombres, hairlines).

## Composant `ProgramPicker` (inline dans Member.jsx)

Petite combobox autonome, réutilisée aux deux endroits :

- Champ `cst-input` avec placeholder configurable (« Rechercher un programme… » ou « CHANGER DE PROGRAMME… »).
- Au focus ou dès qu'on tape : panel absolu en dessous (fond `--cst-card-bg`, bordure `--cst-card-border`, ombre, `borderRadius 10`, max-height ~280px scrollable).
- Filtrage **insensible à la casse et aux accents** sur `name` (+ `objective` si présent), match par sous-chaîne — ordre alphabétique respecté.
- Chaque ligne : nom du programme (cst-display, taille 13), petit chip `--cst-mono` à droite (durée en semaines si dispo, sinon objectif). Hover : fond `rgba(45,90,53,0.10)`. Sélectionnée au clavier : bordure gauche verte.
- État vide filtré : « Aucun programme trouvé. » en mono muted.
- Clavier : ↑/↓ navigue, Entrée sélectionne, Echap ferme, Tab ferme aussi.
- Clic en dehors → ferme (listener sur `mousedown` du document).
- Au choix : appel `onPick(programId)` puis vide le champ et ferme. `disabled` désactive le champ.

Signature :
```tsx
<ProgramPicker
  programs={programs}
  excludeId={data.program?.id}        // pour la variante « changer de »
  placeholder="Rechercher un programme…"
  disabled={assignBusy}
  onPick={handleAssign}
/>
```

## Intégration dans `src/pages/coach/Member.jsx`

1. **Card « AUCUN PROGRAMME ASSIGNÉ »** (≈ ligne 305-314) : remplacer le `<select>` par `<ProgramPicker programs={programs} placeholder="Rechercher un programme…" disabled={assignBusy} onPick={handleAssign} />`, conteneur `maxWidth: 360, margin: '0 auto'`.
2. **Bouton « CHANGER DE PROGRAMME… »** (≈ ligne 326-335) : même composant avec `excludeId={data.program.id}`, placeholder `"CHANGER DE PROGRAMME…"`, taille plus compacte (`maxWidth: 260`, padding réduit via prop `size="sm"` qui ajuste juste padding/fontSize).

Aucun changement de logique métier : `handleAssign(programId)` reste l'unique point d'appel ; la liste `programs` continue d'être chargée via `listProgramsFn`.

## Hors scope

- Pas de modification du backend (`listPrograms`, `assignProgram`).
- Pas de refonte des autres sélecteurs de la page.
- Pas d'ajout de dépendance (cmdk, downshift…) — combobox maison ~80 lignes, fidèle à la DA et sans surcoût bundle.
