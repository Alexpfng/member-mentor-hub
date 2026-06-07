# Adaptation hebdomadaire des programmes (coach)

Objectif : permettre à Léo de dupliquer la semaine d'un coaché, voir les retours, appliquer des ajustements suggérés et publier la nouvelle semaine — le tout en < 2 min, dans un écran unique, sans ressaisie.

## 1. Base de données

Nouvelle table versionnée `assignment_weeks` (une ligne par semaine livrée à un membre) :

```text
assignment_weeks
  id, assignment_id, member_id, program_id
  week_number, based_on_week
  structure JSONB            -- jours + exercices figés de cette semaine
  status: draft|published|in_progress|done
  changes_summary JSONB      -- récap auto vs semaine précédente
  start_date, published_at
  created_at, updated_at
```

RLS :
- Coach (has_role coach) : ALL
- Membre : SELECT sur ses propres lignes `published`/`in_progress`/`done`
- GRANT authenticated + service_role

Migration de bootstrap : pour chaque `assignment` actif, créer rétroactivement les `assignment_weeks` à partir de `programs.structure.weeks[]` en `published` (pour ne rien casser).

Le code membre (séance, planning, carnet) lit en priorité `assignment_weeks` ; fallback sur `programs.structure` si vide.

## 2. Points d'entrée (bouton « Adapter S+1 »)

Ajouté à 3 endroits, même action :
- **Dashboard coach** — colonne action sur chaque membre du tableau.
- **Fiche membre → onglet Suivi** — gros CTA en tête.
- **Détail d'une séance coach** — dans la barre d'actions.

Le clic ouvre `/coach/membre/$memberId/adapter/$weekNumber` en pré-créant un brouillon `assignment_weeks` (copie de la dernière semaine publiée).

## 3. Éditeur d'adaptation (`AdapterSemaine.tsx`)

Écran unique, auto-save (debounce 600 ms, server fn `saveDraftWeek`).

Structure :
- **En-tête contexte** — membre, programme, semaine N (copiée de N-1), résumé S-1 (adhérence, RPE moyen, douleurs) calculé via server fn `getWeekFeedback`.
- **Barre progression globale** — `[Identique] [+2,5%] [+5%] [Déload −40%]` applique aux exos 🔴 force, exclut ceux avec douleur signalée.
- **Liste des jours** (accordéon ouvert) — chaque exercice avec :
  - poignée drag, pastille couleur, nom, prescription, boutons ✎/🗑
  - **bloc suggestion** sous l'exo si retour pertinent (logique ci-dessous)
  - boutons d'action 1 clic qui patchent l'exo en place
- **Actions par jour** : `+ Ajouter exercice`, réorganiser, renommer, supprimer/ajouter jour.
- **Footer collant** : `[Aperçu membre] [Publier la semaine N →]`.

### Logique de suggestion (client, à partir des feedbacks S-1)

```ts
function suggest(ex, fb) {
  if (fb.pain) return { type:'pain', actions:[
    'Réduire amplitude','Remplacer par…','Mettre en pause'] }
  if (fb.failure || fb.rpe >= 10) return { type:'too_hard', actions:['−10%','−5%','Garder'] }
  if (fb.rpe >= ex.rpe_target + 1) return { type:'high', actions:['−5%','Garder'] }
  if (fb.rpe <= ex.rpe_target - 2) return { type:'low', actions:['+2,5kg','+1 rep','Garder'] }
  if (fb.rpe <= ex.rpe_target - 1) return { type:'slightly_low', actions:['+2,5kg','Garder'] }
  return null
}
```

Données nourrissant `fb` : `set_logs` (RPE réel), `exercise_feedbacks` (too_hard/too_easy), `pain_reports` de la semaine précédente — agrégés par `exercise_name`.

### Modifications libres
- Édition complète d'un exo (modal réutilisant le composant du Builder).
- Remplacement : modal avec recherche, filtres `movement_patterns` identiques, conserve séries/reps/RPE, ajoute note membre optionnelle.
- Drag & drop exos / jours (dnd-kit déjà utilisé dans le Builder).
- Annulation suppression via toast.

## 4. Aperçu membre

Bouton `[Aperçu membre]` ouvre une drawer en lecture seule réutilisant `ProgramBlocks` avec la `structure` du brouillon — exactement ce que le membre verra.

## 5. Publication

Modal `PublierSemaine` :
- Date de début (défaut : prochain lundi).
- Récap auto des changements vs S-1 (diff calculé côté serveur : charges, exos remplacés/ajoutés/retirés, RPE cibles modifiés).
- Checkbox « Notifier le membre » + champ message pré-rempli.
- `[Publier et envoyer]` → server fn `publishWeek` :
  1. `status='published'`, `published_at=now()`, fige `changes_summary`.
  2. Si notifier : insert dans `messages` (from coach → to membre).
  3. Realtime : le membre reçoit via `assignment_weeks` (subscription sur `user:<uid>:weeks`).

## 6. Duplication multi-semaines (bloc)

Action `[Dupliquer vers…]` dans l'éditeur :
- Cases Sem N+1, N+2, N+3.
- Progression : identique / +5%/sem cumulé / déload final.
- Crée plusieurs `assignment_weeks` en `draft`. Léo les ouvre et publie au fil de l'eau.

## 7. Duplication d'un programme vers un autre membre

Depuis `/coach/programmes/$id` et fiche membre :
- `[Dupliquer ce programme]` → sélecteur de membre (existant ou « Nouveau… »).
- Server fn `duplicateProgramForMember` : copie `programs` + crée `assignment` actif + crée `assignment_weeks` initiale (semaine 1 = copie de la semaine 1 du programme source).

## 8. Historique

`/coach/membre/$memberId/historique-semaines` : liste des `assignment_weeks` (statut, date publication, lien vers la version figée). Tout reste consultable même après publication d'une semaine ultérieure.

## 9. Server functions (créer)

`src/lib/weekly-adaptation.functions.ts` :
- `getMemberWeekContext({ memberId, weekNumber })` — renvoie semaine source + feedbacks agrégés + suggestions.
- `createDraftWeek({ assignmentId, basedOnWeek })`
- `saveDraftWeek({ weekId, structure })` (autosave)
- `applyGlobalProgression({ weekId, mode })`
- `replaceExercise({ weekId, dayIdx, exoIdx, newExercise, note })`
- `publishWeek({ weekId, startDate, notify, message })`
- `duplicateWeekTo({ weekId, targets:[...], progression })`
- `duplicateProgramForMember({ programId, memberId })`

Toutes protégées par `requireSupabaseAuth` + check `has_role(uid,'coach')`.

## 10. Realtime côté membre

- Subscription Postgres changes sur `assignment_weeks` filtrée `member_id=eq.<uid>`.
- À l'évènement `INSERT/UPDATE status=published`, refetch des écrans Programme / Planning / Séance.

## 11. UI / design

Réutilisation stricte du design system existant (`cst-*`, `ProgramBlocks`, modals du Builder). Aucune dépendance nouvelle. Mobile-friendly : éditeur scrollable, footer publication collant.

## 12. Garde-fous

- Pas de régression : `programs.structure` reste la source de vérité tant qu'aucune `assignment_weeks` n'existe pour la semaine demandée.
- Toutes les écritures passent par server functions (RLS + audit).
- Auto-save tolérant aux erreurs (toast d'avertissement, pas de navigation).

## Hors périmètre de ce lot
- Cron de rappel « préparer la semaine du dimanche soir » (notif coach).
- Templates de progression personnalisés par coach.
- Comparaison côte à côte S-1 vs S (diff visuel) — le récap textuel suffit pour ce lot.
