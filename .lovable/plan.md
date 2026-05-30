## Bug

Sur `/coach/builder`, le bouton **ASSIGNER →** vérifie `programId`. Si le programme n'a pas été sauvegardé, `programId` est `undefined`, un toast d'erreur s'affiche mais la modale ne s'ouvre pas. D'où l'impression que « rien ne se fait ».

## Fix dans `src/pages/coach/BuilderNew.tsx`

1. **`handleSave`** : retourner l'ID du programme (`return r.program.id`) en plus de `setProgramId`. Retourne `null` en cas d'erreur.
2. **Nouveau `handleAssignClick`** : si `programId` existe → ouvrir la modale. Sinon → `await handleSave()`, récupérer l'ID, et si OK ouvrir la modale.
3. **Bouton ASSIGNER (ligne 914)** : remplacer le onClick inline par `handleAssignClick`.
4. **Modale (ligne 1007)** : conserver la garde `{showAssign && programId && <AssignModal …>}`.

Aucun autre changement.
