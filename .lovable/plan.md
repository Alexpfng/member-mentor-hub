## Objectif

Permettre à Léo de construire un programme **semaine par semaine**, simplement, depuis l'app : ajouter / modifier / supprimer / réordonner des exercices, dupliquer une semaine, puis **l'envoyer à un coaché** en un clic. Côté Teddy (et autres membres), le programme assigné s'affiche réellement avec toutes les infos (séries, reps, charge, repos, RPE, tempo, notes, vidéo YouTube).

## État actuel

- `programs.structure` (jsonb) supporte déjà `{ weeks: [{ number, days: [{ number, label, exercises:[…] }] }] }` — c'est ce que lit `ProgramDetail` et ce qu'on a déjà rempli pour Teddy.
- `src/pages/coach/Builder.jsx` est en grande partie **maquette statique** : sélecteur de semaine sans état réel, bibliothèque hardcodée, pas de CRUD d'exo, pas de gestion multi-semaines, save écrase tout avec `{ days }` (pas `weeks`).
- `src/pages/membre/Programme.jsx` affiche une liste **hardcodée** — il faut le brancher sur le vrai programme assigné.
- Serveur : `saveProgram`, `getProgram`, `listExercises`, `saveExercise`, `assignProgram`, `listMembers` existent déjà.

## Ce qu'on construit

### 1. Builder coach (réécriture de `src/pages/coach/Builder.jsx` → `.tsx`)

Route : `/coach/builder` (création) + `/coach/builder/$id` (édition d'un programme existant).

État local = miroir de `program.structure.weeks` + champs (nom, objectif, niveau, durée, fréquence, description). Sauvegarde via `saveProgram` (avec `id` si édition).

UI (une seule page, 3 zones) :

```text
┌────────── PARAMÈTRES ──────────┬───────────── SEMAINES ─────────────┐
│ Nom · Objectif · Niveau        │  [S1][S2][S3][S4][S5][S6][S7][S8]+ │
│ Durée (auto = nb semaines)     │  ▸ Dupliquer S ▸ Vider S ▸ Suppr.  │
│ Fréquence · Description        ├────────────────────────────────────┤
│                                │  JOUR 1  [Label ex: Full-body 1]   │
│ [SAUVEGARDER]                  │   ▸ liste exos (drag pour ordre)   │
│ [ENVOYER À UN MEMBRE ▾]        │   ▸ [+ Ajouter un exercice]        │
├──────── BIBLIOTHÈQUE ──────────┤  JOUR 2 … (idem)                   │
│ Recherche + filtres muscles    │  [+ AJOUTER UN JOUR]               │
│ Liste exos (clic = ajoute au   │                                    │
│ jour actif) — boutons "+ Nouv."│                                    │
└────────────────────────────────┴────────────────────────────────────┘
```

Actions semaine : ajouter, dupliquer (copie en S+1), vider, supprimer. La durée du programme = nb de semaines (sync auto).

Actions jour : ajouter / supprimer / renommer (`label` : Full-body 1, Push A, Mobilité, etc.).

Actions exercice (ligne par exercice) :
- Champs inline : `series`, `reps`, `charge`, `repos`, `RPE`, `tempo`, `notes`, `youtube_url` (préremplis depuis l'exo de la bibliothèque).
- Boutons : monter / descendre / dupliquer / supprimer.
- "Cloner sur toutes les semaines" pour propager.

Ajout d'exercice :
- Depuis la bibliothèque (clic → push dans le jour actif) ou bouton `+ Nouvel exercice` → mini-modale qui crée l'exo dans la table `exercises` (via `saveExercise`, `is_global=true`, `created_by=coach`) puis l'ajoute.

Envoyer au membre : bouton `ENVOYER →` ouvre une liste des membres (`listMembers`) ; sélection appelle `assignProgram({ member_id, program_id, start_date: aujourd'hui })`. Toast de confirmation.

Sauvegarde automatique : bouton explicite "Sauvegarder" + autosave (debounce 1.5 s) avec indicateur "Enregistré ✓".

### 2. Page liste programmes (`/coach/programmes`)

- Bouton "+ Nouveau" → `/coach/builder`.
- Sur chaque carte : ajout d'un bouton "ÉDITER" → `/coach/builder/$id` (les boutons VOIR / DUPLIQUER / ASSIGNER restent).

### 3. Page détail (`/coach/programmes/$id`)

Déjà OK en lecture. On ajoute juste un bouton "ÉDITER" en haut → builder.

### 4. Côté membre — `src/pages/membre/Programme.jsx`

Réécrire pour :
- Appeler un nouveau server fn `getMyAssignedProgram` (renvoie le programme actif assigné au membre courant + `structure.weeks`).
- Affichage en accordéon par semaine (semaine courante ouverte par défaut, calculée depuis `assignments.start_date`).
- Pour chaque jour : liste d'exos avec `series · reps · charge · repos · RPE · tempo`, note coach, et **lien YouTube** cliquable (ou aperçu intégré si `youtube_id`).
- Bouton "Démarrer cette séance" → route existante `/membre/logger?week=X&day=Y` (déjà en place).

### 5. Server functions (ajouts dans `src/lib/coach.functions.ts`)

- `getMyAssignedProgram` (membre) — récupère l'assignment actif + le programme + structure.
- `deleteProgram` (coach) — supprime un programme (+ assignments orphelins en cascade applicative).

`saveProgram` est déjà compatible : on lui passe `{ id?, name, …, structure: { weeks } }`.

## Détails techniques

- **Drag & drop** : pas de lib lourde — boutons ▲▼ + glisser natif HTML5 si rapide ; sinon on garde ▲▼ uniquement (suffit pour "simple d'utilisation").
- **Validation Zod** : étendre `programSchema` côté serveur pour accepter le shape `{ weeks: [{ number, days: [{ number, label, exercises:[{name, series, reps, charge, repos, rpe, tempo, notes, youtube_url, youtube_id, exercise_id?}] }] }] }`. On reste permissif (`.passthrough()`).
- **Pas de migration DB** nécessaire — tout vit dans `programs.structure` (jsonb) et `exercises` (déjà OK).
- **RLS** : déjà en place (`Coach manages own programs`, `Members view assigned programs`).
- **Types** : Builder passe en TSX pour profiter des types `Program`/`Week`/`Day`/`Exercise`. Composant partagé : `ProgramBlocks` réutilisé.

## Fichiers touchés

- Réécrit : `src/pages/coach/Builder.jsx` → `src/pages/coach/Builder.tsx` (vrai éditeur multi-semaines).
- Modifié : `src/pages/coach/Programmes.tsx` (bouton ÉDITER).
- Modifié : `src/pages/coach/ProgramDetail.tsx` (bouton ÉDITER).
- Réécrit : `src/pages/membre/Programme.jsx` (branchement réel).
- Nouveau route : `src/routes/_authenticated.coach.builder.$id.tsx` (édition).
- Modifié : `src/lib/coach.functions.ts` (schéma `structure.weeks`, `getMyAssignedProgram`, `deleteProgram`).

## Hors périmètre (à confirmer si tu veux dedans)

- Modèles / templates de séance réutilisables (au-delà de "dupliquer une semaine").
- Notifications push / e-mail au membre lors d'un nouvel envoi.
- Édition de la structure depuis le téléphone du membre (lecture seule pour lui).
