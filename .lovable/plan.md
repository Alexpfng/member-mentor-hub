## Objectif

Rendre `/coach/import` (fichier `src/pages/coach/Import.jsx`) 100% fonctionnelle : Léo dépose son Excel → parsing du format exact (S1/S2…, en-tête « Exercice », couleurs, YouTube) → mapping vérifiable → aperçu → enregistrement dans `programs` → assignation à un coaché.

## Périmètre

- Frontend : remplacement complet de la page Import (actuellement mockée).
- Backend : réutilise `saveProgram` et `assignProgram` déjà présents dans `src/lib/coach.functions.ts`. Aucun changement DB.
- Aucune modification des autres pages (Builder, Membre, Programmes).

## Dépendance

- Ajouter `xlsx` (SheetJS) — parsing 100% côté client (lecture du `ArrayBuffer`, pas d'upload serveur). `cellStyles: true` pour les couleurs.

## Architecture des fichiers

```text
src/pages/coach/Import.jsx                    ← réécrit (orchestrateur 3 étapes)
src/lib/excel-import/parser.ts                ← nouveau, parsing pur (testable)
  - parseExcelFile(file) → { metadata, weeks, stats, warnings }
  - findColumnLayout, detectColor, getYoutubeUrl, extractYoutubeId
  - parseWeekSheet, detectBlockType, extractMetadata
src/components/coach/import/Dropzone.tsx       ← nouveau (drag & drop + bouton)
src/components/coach/import/MappingTable.tsx   ← nouveau (mapping colonnes corrigeable)
src/components/coach/import/ProgramPreview.tsx ← nouveau (aperçu semaine/séance/exos, pastilles couleur, badge vidéo)
src/components/coach/import/AssignDialog.tsx   ← nouveau (recherche coaché + date début)
```

## Flux UX (3 étapes dans une seule page, état React local)

```text
[1 UPLOAD] → parsing client → [2 PRÉVISUALISATION + MAPPING] → "Convertir et enregistrer"
            ↓
[3 CONFIRMATION modale] → "Assigner à un coaché" → AssignDialog → toast succès
```

### Étape 1 — Upload
- Dropzone : drag-over highlight vert, click → input file (`.xlsx,.xls,.csv`), taille max 20 Mo.
- Loader « Analyse du fichier… ».
- Erreurs : fichier invalide, > 20 Mo, aucune feuille `S\d+`, aucun exercice — messages clairs en français, jamais d'échec silencieux.

### Étape 2 — Prévisualisation & Mapping
- Bandeau récap : nom programme (préfilled depuis `OBJECTIF DU PROG`, éditable), athlète détecté, profil/date course, nb semaines/séances/exercices, vidéos, couleurs.
- Tableau de mapping des colonnes détectées (`Exercice`, `Série(s)`, `Reps`, `Charge`, `Tempo`, `Récup`, `RPE`, `Consignes`, `YouTube`, `Couleur`) avec dropdown de correction + option « Ignorer ».
- Aperçu interactif : semaines → séances → exercices avec code couleur (réutilise les conventions visuelles de `ProgramBlocks.tsx`), badge 🎬, alertes « X exercices sans couleur ».
- Boutons : `← Recommencer`, `Convertir et enregistrer →`.

### Étape 3 — Enregistrement & Assignation
- Appel `saveProgram({ name, objective, description, duration_weeks, frequency_per_week, structure: { weeks } })`.
- Modale de confirmation : `Assigner à un coaché` / `Modifier dans le Builder` / `Retour à mes programmes`.
- `AssignDialog` : `listMembers` (déjà existant), recherche, sélection, date début (défaut lundi prochain), bouton confirmer → `assignProgram({ program_id, member_id, start_date })`.

## Parser — règles clés (cf. spec utilisateur)

- Feuilles retenues : nom matche `/^S\d+/`. Ignorer `Poids`, `NBR PAS`, etc.
- Métadonnées : scanner les ~20 premières lignes, détecter par mot-clé (`NOM`, `OBJECTIF`, `SPLIT`, `DATE COURSE`, `PROFIL`, `CARDIO`, `STEPS`).
- Détection dynamique des colonnes via la cellule « Exercice » + en-têtes adjacents (regex `série|reps|charge|tempo|récup|rpe`). Défauts si manquants.
- Couleurs : `cell.s?.fgColor?.rgb` (6 derniers hex) → map red/green/yellow/blue ; sinon `null`.
- YouTube : `cell.l?.Target` prioritaire, sinon regex URL dans le texte ; ID extrait via regex 11 chars.
- Titres de séance vs exercices vs parasites : règles `SESSION_RE`, `EX_CODE_RE`, `JUNK_RE` de la spec.
- Block type : `emom|ladder|amrap|dropset|iso|circuit|standard`.
- Valeurs texte préservées telles quelles (PDC, EMOM3', 20s/pied, fourchettes…). Jamais de cast destructif.

## Structure persistée dans `programs.structure`

```json
{
  "source": "excel_import",
  "metadata": { "athlete": "...", "objective": "...", "split": "...", "race_date": "...", "race_profile": "..." },
  "weeks": [
    { "number": 1, "days": [
      { "number": 1, "label": "Full body (Durée : 50min)", "exercises": [
        { "code": "A1", "name": "CARS hanches", "series": "2", "reps": "8-9",
          "charge": "pdc", "tempo": "très lent", "recup": null, "rpe_target": null,
          "coach_notes": "...", "color": "blue", "youtube_url": "...", "youtube_id": "...",
          "block_type": "standard" }
      ] }
    ] }
  ]
}
```

Compatible avec le format déjà lu par `ProgramBlocks` / `Builder` (mêmes champs `code`, `name`, `series`, `reps`, `charge`, `tempo`, `recup`, `rpe_target`, `color`, `youtube_*`, `block_type`, `coach_notes`).

## Direction artistique

- Réutiliser les tokens existants (`--cst-mid-green`, `cst-display`, `cst-mono`, `cst-screen`, `CSTSectionNum`, `cst-btn-*`) — même langage visuel que Builder/Programmes. Écritures blanches sur fond `#1F2A22`.
- Pastilles couleur identiques à `ProgramBlocks` (`COLOR_MAP`).

## Hors périmètre (volontairement)

- Pas d'édition inline complète des exos avant import dans cette première itération : un bouton `Modifier dans le Builder` redirige vers `/coach/builder/$id` après save (le Builder gère déjà l'édition fine).
- Pas de sync automatique des exercices vers la bibliothèque `exercises` (la spec le mentionne mais c'est risqué côté doublons — à traiter dans une itération dédiée). Les exos restent stockés dans `programs.structure`.
- Pas de notification push au coaché (juste l'assignation DB ; Realtime côté coaché déjà en place).

## Vérification

- Upload du fichier `Programme_Max_C_.xlsx` → 1 semaine, 5 séances, ~47 exercices, ~42 vidéos, 45/47 couleurs.
- Valeurs texte (`PDC`, `EMOM3'`, `8 on peut augmenter`, `20s/pied`, fourchettes) affichées telles quelles.
- Save → `programs` créé, visible dans `/coach/programmes`.
- Assign → ligne dans `assignments`, visible côté `/membre/programme`.
