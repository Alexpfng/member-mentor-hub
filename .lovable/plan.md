## Problème

Dans la modale d'édition d'exercice (page Builder), le fond est codé en dur en vert foncé (`#1A2620`), mais les labels (`SÉRIES`, `REPS`, `RPE CIBLE`, `COULEUR`, `YOUTUBE`, `NOTES COACH`, etc.) utilisent le token `var(--cst-text-muted)` qui en mode clair vaut `#6B7B6E` (gris foncé). Résultat : texte sombre sur fond sombre, illisible.

Le titre `ADDUCTEURS WORK…`, les chiffres RPE non sélectionnés et le bouton `ANNULER` ont le même problème.

## Correction

Un seul fichier touché : `src/pages/coach/BuilderNew.tsx`, dans le composant `EditExerciseModal` (≈ lignes 232–336). On rend la modale **thème-aware** en remplaçant les couleurs codées en dur par les tokens de design :

- **Fond modale** : `#1A2620` → `var(--cst-card-bg)`
- **Bordure modale** : `rgba(45,90,53,0.5)` → `var(--cst-card-border)`
- **Titre exercice** : `color: #fff` → `var(--cst-text)`
- **Bouton fermer (✕)** : `rgba(255,255,255,0.5)` → `var(--cst-text-soft)`
- **Boutons RPE 1–10** :
  - bordure inactive `rgba(255,255,255,0.15)` → `var(--cst-card-border)`
  - couleur texte inactif `#fff` → `var(--cst-text)` ; actif reste `#fff` (sur fond vert)
- **Boutons COULEUR** : bordure inactive `rgba(255,255,255,0.15)` → `var(--cst-card-border)`
- Les labels gardent `var(--cst-text-muted)` (devient lisible une fois sur fond clair)
- Le bouton `ANNULER` (`cst-btn-ghost-dark`) → on remplace par la variante claire/thème (`cst-btn-ghost`) pour qu'il s'adapte

En mode sombre, les tokens redonnent un rendu équivalent à l'actuel (carte sombre + texte clair) ; en mode clair, la modale devient blanche avec texte foncé, parfaitement lisible.

## Hors scope

- Les autres modales/pages ne sont pas touchées, seul l'exemple signalé.
- Aucune logique métier modifiée, uniquement les styles inline de cette modale.
