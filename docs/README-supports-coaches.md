# Supports d'explication pour les coachés

Deux supports complémentaires, destinés aux athlètes qui découvrent l'app.

| Fichier | Quoi | Pour qui |
|---|---|---|
| `ColoSmart-Training-Guide-Coache.pdf` | Guide complet, 23 pages, 17 chapitres | Ceux qui veulent tout comprendre |
| `demo-coache.html` | Démo animée : les 10 étapes se jouent seules sur un téléphone | Ceux qui ne liront pas le guide |

## La démo animée

Page autonome (aucune dépendance à part Google Fonts) : ouvre `demo-coache.html`
dans un navigateur, ou publie-la où tu veux. Elle joue en boucle les 10 étapes
clés du parcours coaché — accueil, pas et série, choix du mode, série, RPE,
repos, changement d'exercice, résumé, fin de séance, et la suite.

Elle sert aussi de **storyboard** : chaque étape porte son titre, son explication
et sa punchline, dans l'ordre du montage.

## Le guide PDF

Le PDF est généré depuis `guide-coache.source.html` + `guide-coache.style.css`.
Pour le régénérer après une modification du texte ou du style :

```bash
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=docs/ColoSmart-Training-Guide-Coache.pdf \
  file://$PWD/docs/guide-coache.source.html
```

(Sur cette machine, le binaire est `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.)

## À tenir à jour

Ces supports décrivent l'app telle qu'elle est aujourd'hui. Quand un écran change
côté coaché — nouveau bouton en séance, nouvelle notation, nouvel onglet —
pense à reprendre le chapitre concerné du guide et l'étape correspondante de la
démo, sinon les deux se périment en silence.
