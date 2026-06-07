## Lots de suivi — Adaptation hebdo

Découpage en 6 lots indépendants, à valider/livrer un par un. Chaque lot est autonome et testable.

---

### Lot 1 — Entrées rapides « Adapter S+1 »
**Objectif :** ouvrir l'adaptation en 1 clic depuis les contextes naturels.

- **Fiche membre, onglet « Suivi »** : bouton primaire `ADAPTER S+1 →` dans le header de `MemberFollowupTab.tsx` (à côté du nom/avatar du membre).
- **Détail séance coach** (`SessionDetail.tsx`) : bouton flottant `ADAPTER LA SEMAINE SUIVANTE` en footer, qui ouvre `/coach/membre/$memberId/adapter?week=<week+1>`.
- **Dashboard coach** (`Dashboard.jsx`, ligne membre) : icône ✎ discrète au survol pour ouvrir l'adapter direct.

Aucune nouvelle server fn — réutilise `getMemberWeekContext`.

---

### Lot 2 — Modale « Remplacer par… »
**Objectif :** remplacer un exercice en gardant séries/RPE/charge, avec suggestions filtrées.

- Nouveau composant `ReplaceExerciseModal.tsx` :
  - Recherche dans `exercises` (table existante), filtres par `movement_patterns`, `muscle_group`, `equipement`, `color`.
  - Préselection : exercices au même `movement_patterns` que l'exercice source.
  - Aperçu (nom, vidéo, code intensité).
  - Champ optionnel « note pour le membre » → stocké dans `coach_notes` de l'exo dans la `structure`.
- Server fn `replaceExercise(weekId, dayIdx, exoIdx, newExerciseId, note?)` dans `weekly-adaptation.functions.ts` : remplace en conservant `series/reps/charge/rpe_target/tempo/recup`.
- Bouton « ⇄ Remplacer » à côté du 🗑 dans `AdapterSemaine.tsx`.

---

### Lot 3 — Duplication multi-semaines (UI)
**Objectif :** créer S+1, S+2, S+3 d'un coup avec progression.

- Bouton `Dupliquer vers…` dans le footer de `AdapterSemaine.tsx`.
- Modale `MultiWeekDuplicateModal.tsx` :
  - Checkboxes S+1 / S+2 / S+3 / +4 / +5.
  - Radio progression : `Identique` / `+5% cumulatif` / `Déload sur la dernière`.
  - Aperçu (« 3 semaines seront créées : S03 identique, S04 +5%, S05 +10% »).
- Appelle `duplicateWeekTo` (déjà existante).
- Toast + redirection vers la première créée.

---

### Lot 4 — Duplication de programme vers un autre membre (UI)
**Objectif :** cloner le programme actif d'un membre vers un nouveau coaché.

- Sur `/coach/programmes/$id` : bouton `Assigner à un membre`.
- Sur fiche membre, onglet « Programme actuel » : bouton `Copier ce programme à…`.
- Modale `CopyProgramToMemberModal.tsx` :
  - Picker membre (liste sans le membre source).
  - Date de démarrage.
  - Checkbox « Cloner aussi les semaines déjà publiées » (par défaut : non — repart à S1).
  - Option « Désactiver le programme actuel du membre cible » si actif.
- Appelle `duplicateProgramForMember` (déjà existante), à étendre pour copier les `assignment_weeks` si demandé.

---

### Lot 5 — Lecture prioritaire `assignment_weeks` côté membre
**Objectif :** le membre voit toujours la dernière version publiée par Léo, pas le programme figé.

Helper unique `getMemberWeekStructure(memberId, weekNumber)` :
1. Cherche dans `assignment_weeks` (status ∈ published/in_progress/done) → renvoie cette structure.
2. Sinon fallback sur `programs.structure.weeks[weekNumber-1]`.

À intégrer dans :
- `Programme.jsx` (membre) — vue semaine en cours.
- `planning.functions.ts` — `getPlannedSessions` et création de séances : copier la structure prioritaire.
- `logbook.functions.ts` — référence pour calcul d'adhérence.
- `seance.$sessionId.tsx` (membre) — bloc programme.
- `carnet.tsx` — résumé hebdo.

Realtime : abonnement `postgres_changes` sur `assignment_weeks` filtré par `member_id`, toast « 📬 Nouvelle semaine publiée par Léo » + refetch.

---

### Lot 6 — Historique des versions + drag & drop
**Objectif :** Léo voit l'évolution et réordonne sans peine.

**Historique** :
- Onglet « Historique » dans `AdapterSemaine.tsx` (ou drawer latéral).
- Liste les semaines passées du membre via `listMemberWeekHistory` (déjà existante) avec diff visuel S vs S-1 (exos ajoutés/retirés/charges modifiées via `changes_summary`).
- Bouton « Restaurer cette version » → écrase le draft courant.

**Drag & drop** :
- Bibliothèque : `@dnd-kit/core` + `@dnd-kit/sortable`.
- Réordonner les exercices dans un jour.
- Réordonner les jours dans la semaine.
- Déplacer un exo d'un jour à l'autre.
- Persistence via le `saveDraftWeek` existant (autosave).
- Handles visibles ⋮⋮ à gauche de chaque ligne exo.

---

## Ordre d'attaque recommandé

```text
Lot 1  →  immédiat (gain UX énorme, 0 risque)
Lot 5  →  prioritaire métier (sinon la duplication n'a aucun effet pour le membre)
Lot 2  →  haute valeur quotidienne
Lot 3  →  utile pour préparer un bloc de 3-4 semaines
Lot 6  →  confort
Lot 4  →  cas plus rare
```

Dis-moi quel lot je lance (ou plusieurs en parallèle si compatibles — 1+2+3 le sont).
