## Problème

`/coach/membre` n'existe plus en tant que route — elle a été remplacée par `/coach/membre/$memberId` (qui exige un ID). Du coup, dès qu'on clique sur **"Membres"** dans la sidebar coach, on tombe sur la page 404 (visible dans le replay).

Source du bug : `src/components/CoachSidebar.jsx` ligne 9 pointe encore sur l'ancien path :
```js
{ id: "membres", label: "Membres", icon: "○", path: "/coach/membre" },
```

## Plan

1. Dans `src/components/CoachSidebar.jsx`, faire pointer l'entrée **Membres** vers `/coach` (le dashboard, qui contient déjà la liste des membres avec le bouton VOIR pour ouvrir la fiche de chacun).
2. Ajuster la logique `active` du sidebar pour que **Membres** reste surligné aussi bien sur `/coach` que sur `/coach/membre/...`.

Aucun autre changement nécessaire — le dashboard liste déjà les membres et la fiche détaillée fonctionne bien via `/coach/membre/$memberId`.