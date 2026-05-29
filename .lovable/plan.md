## Problème
Actuellement, la démo YouTube et les notes coach n'apparaissent que sur l'écran **BRIEF** (avant de commencer le bloc). Dès qu'on entre en mode SET (logger une série) ou REPOS, le coaché n'a plus accès à la vidéo ni aux consignes — il doit revenir en arrière.

## Solution
Rendre la **démo vidéo + consignes coach** accessibles depuis tous les écrans actifs de la séance via un bouton compact et un lecteur intégré.

### 1. `src/components/cst/LiveSession.tsx` — écran SET (logging)
Ajouter, juste sous le bandeau "SÉRIE x/y", une barre d'actions discrète :
- Bouton **▶ DÉMO** (si `youtube_id` / `youtube_url` présent) → ouvre overlay lecteur YouTube embed.
- Bouton **📋 CONSIGNES** (si `coach_notes` ou `tempo` ou `rpe_target` présent) → ouvre overlay listant : tempo + explication, RPE cible, notes coach, code couleur.

### 2. Écran REPOS (`RestScreen`)
Ajouter sous le chrono les mêmes boutons (▶ DÉMO / 📋 CONSIGNES) pour l'**exercice en cours** ET pour le **next preview** s'il diffère. Le repos est le bon moment pour relire les consignes du prochain mouvement.

### 3. Nouveau composant `VideoModal` (interne au fichier)
Overlay plein écran (style cohérent avec `Overlays`) avec iframe YouTube embed responsive 16/9 (`https://www.youtube.com/embed/{id}?autoplay=1&rel=0`). Extraction du `youtube_id` depuis `youtube_url` si nécessaire (helper `extractYoutubeId`). Fallback : lien externe si extraction échoue.

### 4. Nouveau composant `CuesModal`
Overlay regroupant : code couleur (réutiliser `ColorTooltip`), tempo (réutiliser `TempoExplainer` contenu), RPE cible + `RPEGuidance`, notes coach en italique.

### 5. État local
Ajouter `showVideo: ProgExercise | null` et `showCues: ProgExercise | null` dans le composant principal. Branchés dans `<Overlays />`.

## Hors scope
- Pas de changement de schéma DB.
- Pas de changement sur `ExerciseThread` (filmer / commenter) — déjà accessible via bouton existant.
- Pas de modification du BRIEF (déjà fonctionnel).

## Fichiers touchés
- **Modifié** : `src/components/cst/LiveSession.tsx`
