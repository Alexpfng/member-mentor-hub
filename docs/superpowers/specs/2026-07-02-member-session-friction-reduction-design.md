# Réduction de friction séance membre Design

## Objectif

Réduire les frictions remontées en réunion sur l'expérience séance membre et le nettoyage coach, sans refonte large de l'application.

## Périmètre

Ce lot couvre trois corrections/finitions liées :

1. Le mode `expert` ne doit plus demander le RPE pendant la séance, mais seulement à la fin.
2. La séance doit rendre visibles les exercices déjà faits et ceux qui restent, y compris après reprise d'une séance interrompue.
3. Le dashboard coach doit pouvoir retirer aussi les items vidéo non revus qui restent parasites dans la colonne priorité.

## Approches considérées

### Option A — Refaire complètement le flux de séance

Réécrire `LiveSession` autour d'un nouvel état de session.

Avantages :
- Base plus propre à long terme.

Inconvénients :
- Beaucoup trop risqué pour un correctif de prod immédiat.
- Touche un écran déjà complexe avec un risque élevé de régression.

### Option B — Finition ciblée sur le flux existant

Conserver `LiveSession`, extraire la logique de progression/récap dans un helper testé, puis adapter seulement les branches `expert`, `recap` et `overview`.

Avantages :
- Corrige vite les points de friction remontés.
- Garde les comportements existants stables.
- Permet d'ajouter des tests ciblés.

Inconvénients :
- Le composant reste volumineux.

### Option C — Corriger uniquement l'UI visible

Ajouter des badges/compteurs sans changer la logique de sauvegarde expert.

Avantages :
- Très rapide.

Inconvénients :
- Ne corrige pas la vraie friction du mode expert.
- L'utilisateur continuerait à saisir un RPE à chaque série.

## Choix retenu

Option B.

## Design

### 1. Mode expert fin de séance

Pendant la séance expert :
- l'utilisateur avance exercice par exercice / série par série sans saisir de RPE ;
- on conserve automatiquement, pour chaque step, les valeurs calculées par le moteur existant (`charge` issue du programme ou de l'historique, `reps` cible ou dernière valeur cohérente) ;
- le step est marqué comme fait pour la progression.

En fin de séance expert :
- un récapitulatif regroupe les steps par exercice ;
- les poids/reps auto-déduits sont affichés sans ressaisie ;
- le sportif renseigne uniquement un RPE final par exercice ;
- lors de la validation, les `set_logs` sont insérés à partir de ces données auto-déduites avec le RPE d'exercice recopié sur les séries concernées.

Cela respecte la demande "les poids et les reps sortent, ils n'ont plus à les rentrer" tout en gardant une donnée exploitable côté coach.

### 2. Visibilité fait / restant dans la séance

L'écran de séance doit montrer clairement :
- le nombre de blocs/séries faits ;
- le nombre restant ;
- dans l'aperçu complet (`☰`), un état visuel par exercice : `fait`, `en cours`, `à faire`.

Le calcul ne doit pas dépendre de l'ordre initial uniquement ; il doit refléter le vrai avancement basé sur `savedByStep`, afin que le fait de sauter un exercice puis d'y revenir reste lisible.

### 3. Nettoyage coach

La colonne priorité gère déjà le retrait des messages et des séances. On l'étend aux vidéos :
- ajout d'un bouton de retrait sur les cartes `video` ;
- ce retrait marque la vidéo comme revue (`coach_reviewed = true`) ;
- l'item disparaît immédiatement de l'UI, comme les autres actions de nettoyage.

## Données et compatibilité

- Aucun changement de schéma Supabase n'est nécessaire pour ce lot.
- On réutilise `set_logs`, `sessions.average_rpe` et `technique_videos.coach_reviewed`.
- Le mode `debutant` ne change pas.

## Tests

- Tests unitaires sur le helper de progression/récap expert.
- Tests unitaires sur le filtrage local des items priorité pour couvrir aussi la suppression des vidéos.
- Build complet pour valider les écrans touchés.

