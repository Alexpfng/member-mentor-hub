# Réglage Du Début De Semaine Coaché

## Objectif

Permettre à chaque coaché de choisir son propre jour de début de semaine afin que son planning se construise sur un cycle cohérent de 7 jours, sans dépendre d'un lundi forcé ni d'un décalage incompréhensible lié à la date de démarrage du programme.

## Décision

Le coaché choisit un seul réglage `jour de début de semaine`. La fin de semaine est calculée automatiquement 6 jours plus tard.

Exemples :
- `lundi` => semaine `lundi -> dimanche`
- `vendredi` => semaine `vendredi -> jeudi`

## Stockage

Le réglage est stocké sur le profil du coaché, pas sur le programme.

Champ attendu :
- `planning_week_start_day`

Format recommandé :
- entier `1..7`
- `1 = lundi`
- `7 = dimanche`

Valeur par défaut :
- `1` (`lundi`) si aucune préférence n'est encore définie

## Portée Fonctionnelle

Le réglage doit piloter :
- le planning coaché
- la semaine courante affichée
- les bornes `weekStart` / `weekEnd`
- la navigation semaine précédente / suivante
- les jours proposés dans les feuilles de déplacement de séance
- le blocage des jours avant `assignment.start_date` sur la première semaine

Le réglage ne doit pas :
- changer la durée d'une semaine
- casser les séances déjà planifiées
- modifier le mode coach ou le mode séance

## UX

Côté coaché :
- ajout d'un sélecteur simple dans le profil ou les paramètres
- libellé clair : `Début de ma semaine`

Côté coach :
- le coach peut voir et modifier ce réglage depuis la fiche membre si besoin

Affichage utile :
- texte explicite du type `Semaine perso : vendredi -> jeudi`

## Logique Métier

Le calcul des semaines ne part plus uniquement du lundi calendaire.

Il faut :
1. prendre le `planning_week_start_day` du coaché
2. calculer l'ancre de semaine correspondant à ce jour
3. découper les semaines sur des blocs fixes de 7 jours
4. conserver la protection qui empêche de placer des séances avant le vrai démarrage du programme

## Compatibilité

Pour éviter de perdre des données existantes :
- si une séance planifiée a déjà un `planned_date`, on continue à la rattacher par plage de dates
- si une ancienne donnée n'a pas encore de `planned_date`, on garde le fallback existant tant qu'il est nécessaire

## Vérification Attendue

Cas à couvrir :
- coaché sans préférence => `lundi -> dimanche`
- coaché avec préférence `vendredi` => `vendredi -> jeudi`
- semaine 1 qui démarre après le début réel du bloc de semaine => jours avant `start_date` indisponibles
- déplacement de séance qui n'autorise pas des jours hors plage utile
- navigation entre semaines cohérente avec le nouveau cycle
