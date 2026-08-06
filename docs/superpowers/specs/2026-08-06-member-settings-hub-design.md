# Hub Réglages Coaché

## Objectif

Donner au coaché un point d'entrée unique pour tous ses réglages personnels afin d'éviter de chercher entre plusieurs écrans ce qu'il peut modifier lui-même.

## Décision

La page actuelle `/membre/profil` devient la vraie page `Réglages` du coaché.

On ne crée pas une nouvelle logique métier. On regroupe et clarifie l'existant dans une interface plus lisible, avec un accès direct visible depuis l'espace membre.

## Structure retenue

La zone `Réglages` doit contenir quatre blocs :

1. `Planning`
   - début de semaine personnalisé

2. `Notifications`
   - toutes les préférences de notifications déjà disponibles

3. `Connexions`
   - connexion et déconnexion Strava

4. `Compte`
   - actions personnelles comme la déconnexion

## Navigation

- le coaché doit voir une entrée explicite `Réglages` dans sa navigation
- l'ancien libellé `Profil` ne doit plus être l'entrée principale si l'écran sert surtout à configurer l'app
- un accès rapide `Réglages` doit aussi être visible depuis l'espace coaché principal

## UX

- les réglages doivent être regroupés par thème
- chaque bloc doit avoir un titre clair et une courte explication
- le coaché doit comprendre immédiatement où modifier :
  - son cycle de semaine
  - ses notifications
  - ses connexions externes
  - ses options de compte

## Portée

Cette évolution ne doit pas :

- changer le comportement des réglages existants
- casser la connexion Strava
- casser les préférences de notifications
- déplacer la logique métier côté backend sans nécessité

Cette évolution doit :

- rendre les réglages trouvables
- donner une impression d'espace `Paramètres` cohérent
- limiter les futures dispersions de réglages dans l'interface membre

## Vérification attendue

- le coaché trouve un accès clair à `Réglages`
- la page regroupe bien `Planning`, `Notifications`, `Connexions`, `Compte`
- les préférences actuelles continuent à fonctionner sans régression
- la navigation membre reste cohérente
