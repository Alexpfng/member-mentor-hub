
# Permettre de filmer / importer depuis n'importe quel appareil

Actuellement le bouton **FILMER** force l'appareil photo arrière du téléphone (`capture="environment"`), ce qui :
- bloque le choix entre caméra avant / arrière sur mobile,
- ne permet pas du tout d'importer une vidéo existante via ce bouton,
- sur desktop / iPad sans caméra arrière, n'affiche rien d'utile.

## Changements

1. **`src/components/cst/ExerciseThread.tsx`**
   - Bouton "🎬 FILMER" : retirer l'attribut `capture` forcé. Garder `accept="video/*"` → l'OS propose alors **Caméra / Photothèque / Fichiers** (iOS, Android, desktop) au lieu d'ouvrir directement la caméra arrière.
   - Renommer en "🎬 FILMER / CHOISIR" pour bien indiquer les deux possibilités.
   - Le bouton "📁 IMPORTER" devient redondant → on le supprime pour ne garder qu'une seule action claire.

2. **`src/components/cst/session.tsx` (`TechniqueVideoCapture`)**
   - Même changement : retirer `capture="environment"`, mettre à jour le libellé en "🎬 FILMER / CHOISIR UNE VIDÉO".

3. **`src/components/cst/LiveSession.tsx`** : aucun changement (passe par `ExerciseThread`).

## Hors scope

- Pas de capture vidéo in-app (MediaRecorder) : on s'appuie sur le sélecteur natif du système, déjà universel.
- Pas de modif du bucket de storage ni des policies.

## Fichiers touchés

- **Modifié** : `src/components/cst/ExerciseThread.tsx`, `src/components/cst/session.tsx`
