## Problème identifié

La page `/coach` ne charge pas parce que le serveur essaie encore d’importer une ancienne route supprimée :

```text
src/routes/_authenticated.coach.tsx
```

Cette référence obsolète dans l’arbre de routes provoque un crash serveur avant même que la page coach puisse s’afficher.

## Plan de correction

1. **Nettoyer la route générée obsolète**
   - Régénérer ou corriger l’arbre de routes pour supprimer toute référence à `_authenticated.coach.tsx`.
   - Ne pas recréer cette route guard intermédiaire, car elle avait causé l’erreur SPA précédente.

2. **Conserver le guard existant**
   - Garder le contrôle coach directement dans `src/pages/coach/Dashboard.jsx`.
   - Garder le layout `_authenticated.tsx` comme parent global des routes protégées.

3. **Vérifier le chargement**
   - Vérifier que `/coach` ne tente plus d’importer le fichier supprimé.
   - Vérifier que la page affiche soit le dashboard coach, soit redirige correctement selon le rôle.

## Fichiers concernés

- `src/routeTree.gen.ts` uniquement si la génération automatique n’a pas déjà retiré l’ancienne référence.
- Aucun changement prévu côté base de données ou sécurité.