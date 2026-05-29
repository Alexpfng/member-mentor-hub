## Problème

Le bouton flottant de bascule jour/nuit (icône soleil, en `position: fixed` en haut à droite) recouvre le bouton `DÉCONNEXION` ajouté dans la barre du haut du dashboard membre.

## Correction

1. Supprimer le toggle thème flottant de `src/components/MemberNav.jsx` (le bloc `position: fixed` en haut à droite).
2. Intégrer `ThemeToggle` directement dans la barre du haut du dashboard membre (`src/pages/membre/Dashboard.jsx`), à gauche du bouton `DÉCONNEXION`, dans le même conteneur flex que l'avatar.
3. Ordre final dans la barre du haut, de gauche à droite : logo CST · (espace) · avatar · toggle thème · DÉCONNEXION — alignés, espacés de 10px, sans chevauchement.

## Résultat

Plus aucun élément flottant ne recouvre la déconnexion, et le bouton thème reste accessible sur toutes les pages membres via la barre du haut.