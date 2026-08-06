# Affichage des RPE coachés dans l'adaptation coach

## Objectif

Faire remonter, dans l'écran d'adaptation de semaine côté coach, le RPE réel rempli par le coaché pour chaque exercice précis, afin que le coach ne voie plus `RPE —` alors que la séance a bien été faite.

## Problème constaté

L'écran `AdapterSemaine` sait déjà afficher un retour membre via `ctx.feedback`, mais le matching entre :

- le nom d'exercice stocké dans `set_logs` / `exercise_feedbacks`
- et le nom d'exercice affiché dans `assignment_weeks.structure`

est trop fragile. Dès qu'un libellé varie légèrement, la carte coach perd le lien et affiche un badge vide.

## Solution retenue

Approche 2, robuste :

1. Continuer à agréger les retours depuis `set_logs` et `exercise_feedbacks`.
2. Renforcer la résolution des feedbacks par une clé normalisée plus tolérante.
3. Ajouter un fallback de correspondance par variantes de libellé proches quand le nom exact ne matche pas.
4. Conserver l'affichage actuel dans `AdapterSemaine`, mais lui garantir une donnée fiable par exercice.

## Portée

- `src/lib/exercise-feedback.ts`
- `src/lib/exercise-feedback.test.ts`
- `src/lib/weekly-adaptation.functions.ts`
- éventuellement un test serveur ciblé si la logique d'agrégation le justifie

## Hors périmètre

- refonte de la structure Supabase
- changement du format de saisie RPE côté coaché
- migration de données historique

## Critères de succès

- un exercice rempli par le coaché affiche son RPE réel sur la bonne carte côté coach
- les variations mineures de libellé ne cassent plus l'affichage
- aucun RPE ne remonte sur le mauvais exercice
- une régression automatisée couvre ce cas
