# Expert Session Summary And Final RPE Design

## Goal

Faire évoluer uniquement le mode `expert` côté coaché pour qu'il puisse :
- ouvrir un `Résumé` pendant la séance,
- voir tous les exercices avec état `fait / pas fait`,
- cliquer sur n'importe quel exercice pour y revenir,
- puis, en fin de séance, remplir un RPE final par exercice réellement effectué avant envoi au coach.

Le mode `suivi` reste strictement inchangé.

## Root Cause Found

La page de fin expert plante actuellement car le récap tente de rendre `RPESelector` sans import valide dans `LiveSession.tsx`. Le build ne le bloque pas, mais le runtime casse au moment d'afficher la page finale.

## UX Design

### Pendant la séance expert

- Le bouton header `☰` devient `RÉSUMÉ`.
- Le résumé ouvre un panneau mobile compact listant uniquement les exercices de la séance.
- Chaque ligne affiche :
  - `✓` si l'exercice a été entièrement réalisé,
  - `…` si l'exercice est en cours,
  - `□` s'il n'a pas encore été fait.
- Chaque ligne reste cliquable, y compris pour un exercice déjà fait.
- Le clic renvoie l'utilisateur sur cet exercice dans la séance expert.

### Fin de séance expert

- La page finale n'affiche que les exercices réellement faits.
- Chaque carte d'exercice affiche :
  - le nom de l'exercice,
  - le rappel automatique des séries/reps/charges capturées,
  - un badge `RPE —` ou `RPE X`.
- Le badge ouvre un sélecteur compact `0 → 10` avec action `EFFACER LE RPE`, dans le style de la capture coach.
- Le bouton de fin reste bloqué tant qu'un exercice fait n'a pas reçu son RPE final.
- La validation enregistre un RPE uniforme par exercice sur toutes les lignes `set_logs` correspondantes, puis termine la séance et l'envoie au coach via le flux déjà en place.

## Technical Design

- Conserver `savedByStep` comme source de vérité du mode expert.
- Réutiliser `groupExpertRecapByExercise(savedByStep)` pour construire la page finale.
- Réutiliser `buildExerciseOverview(...)` pour le résumé pendant la séance.
- Ajouter un picker RPE compact local au flux expert final, plutôt que dépendre du composant de saisie série-par-série du mode suivi.
- Garder la navigation `jumpToExercise(...)` existante pour les retours depuis le résumé.

## Constraints

- Aucun changement fonctionnel sur le mode `debutant / suivi`.
- Aucun changement de schéma Supabase requis.
- Les exercices non commencés ne doivent jamais apparaître sur la page finale RPE.

## Verification

- Vérifier qu'une séance expert ouvre bien le résumé sans crash.
- Vérifier qu'un clic sur une ligne du résumé renvoie à l'exercice voulu.
- Vérifier qu'après le dernier exercice on arrive sur la page finale RPE.
- Vérifier que la validation finale termine bien la séance et navigue vers l'historique.
