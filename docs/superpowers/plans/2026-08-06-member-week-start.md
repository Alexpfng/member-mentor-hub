# Member Week Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque coaché de choisir son jour de début de semaine et recalculer son planning sur ce cycle personnalisé de 7 jours.

**Architecture:** Ajouter une préférence persistée au niveau du profil membre, centraliser le calcul des bornes de semaine dans les helpers de planning, puis brancher cette préférence sur les écrans coaché et coach qui lisent ou modifient le planning hebdomadaire.

**Tech Stack:** TanStack Start, React, TypeScript, Supabase, Bun

---

### Task 1: Ajouter la préférence Supabase

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Create: `supabase/migrations/<generated>_add_member_week_start_day.sql`

- [ ] **Step 1: Écrire le SQL de migration**

```sql
alter table public.profiles
add column if not exists planning_week_start_day smallint;

alter table public.profiles
drop constraint if exists profiles_planning_week_start_day_check;

alter table public.profiles
add constraint profiles_planning_week_start_day_check
check (planning_week_start_day between 1 and 7);
```

- [ ] **Step 2: Mettre à jour les types Supabase**

Ajouter `planning_week_start_day` aux types `Row`, `Insert` et `Update` de `public.profiles`.

- [ ] **Step 3: Vérifier que le typage compile**

Run: `bun run build`
Expected: build OK sans erreur de type sur `profiles`

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts supabase/migrations
git commit -m "feat(profile): add member planning week start setting"
```

### Task 2: Centraliser le calcul de semaine personnalisée

**Files:**
- Modify: `src/lib/planning-weeks.ts`
- Create: `src/lib/planning-weeks.custom.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from "bun:test";
import { currentPlanningWeekNumber, planningWeekBounds } from "./planning-weeks";

describe("planningWeekBounds with custom start day", () => {
  it("calcule une semaine vendredi -> jeudi", () => {
    expect(
      planningWeekBounds("2026-07-30", 1, {
        weekStartsOn: 5,
      }),
    ).toEqual({
      weekStart: "2026-07-31",
      weekEnd: "2026-08-06",
    });
  });
});

describe("currentPlanningWeekNumber with custom start day", () => {
  it("reste en semaine 1 jusqu'au jeudi inclus pour un cycle vendredi -> jeudi", () => {
    expect(
      currentPlanningWeekNumber("2026-07-30", "2026-08-06", {
        weekStartsOn: 5,
      }),
    ).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test pour confirmer l'échec**

Run: `bun test src/lib/planning-weeks.custom.test.ts`
Expected: FAIL car la signature n'accepte pas encore `weekStartsOn`

- [ ] **Step 3: Implémenter le helper minimal**

Étendre `planningWeekBounds` et `currentPlanningWeekNumber` pour accepter une option :

```ts
type PlanningWeekOptions = {
  weekStartsOn?: number;
};
```

Puis remplacer l'ancre `mondayOf(...)` par un helper générique qui recule jusqu'au jour choisi.

- [ ] **Step 4: Relancer les tests**

Run: `bun test src/lib/planning-weeks.test.ts src/lib/planning-weeks.custom.test.ts src/lib/streak.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/planning-weeks.ts src/lib/planning-weeks.test.ts src/lib/planning-weeks.custom.test.ts
git commit -m "feat(planning): support custom member week start"
```

### Task 3: Brancher la préférence sur le backend planning membre

**Files:**
- Modify: `src/lib/planning.functions.ts`
- Test: `src/lib/planning-weeks.custom.test.ts`

- [ ] **Step 1: Écrire le comportement attendu dans le test**

Ajouter un cas qui documente la plage :

```ts
expect(
  planningWeekBounds("2026-07-30", 2, {
    weekStartsOn: 5,
  }),
).toEqual({
  weekStart: "2026-08-07",
  weekEnd: "2026-08-13",
});
```

- [ ] **Step 2: Étendre la requête profil/assignment**

Dans `listWeekPlan`, charger aussi la préférence membre, puis calculer :

```ts
const weekStartsOn = profile?.planning_week_start_day ?? 1;
```

- [ ] **Step 3: Utiliser la préférence dans les bornes**

Passer `weekStartsOn` dans :

```ts
currentPlanningWeekNumber(assignment.start_date, undefined, { weekStartsOn })
planningWeekBounds(assignment.start_date, weekNumber, { weekStartsOn })
```

- [ ] **Step 4: Vérifier build + tests**

Run: `bun test src/lib/planning-weeks.test.ts src/lib/planning-weeks.custom.test.ts src/lib/streak.test.ts && bun run build`
Expected: PASS puis build OK

- [ ] **Step 5: Commit**

```bash
git add src/lib/planning.functions.ts src/lib/planning-weeks.custom.test.ts
git commit -m "fix(planning): use member week start preference"
```

### Task 4: Ajouter le réglage côté coaché

**Files:**
- Modify: `src/pages/membre/Profil.tsx`
- Modify: `src/lib/coach.functions.ts` or the existing member profile server function file used by the profile page

- [ ] **Step 1: Repérer la mutation profil existante**

Chercher l'action qui met déjà à jour le profil du membre et y ajouter `planning_week_start_day`.

- [ ] **Step 2: Ajouter l'UI minimale**

Ajouter un sélecteur :

```tsx
<select value={planningWeekStartDay} onChange={...}>
  <option value={1}>Lundi</option>
  <option value={2}>Mardi</option>
  <option value={3}>Mercredi</option>
  <option value={4}>Jeudi</option>
  <option value={5}>Vendredi</option>
  <option value={6}>Samedi</option>
  <option value={7}>Dimanche</option>
</select>
```

- [ ] **Step 3: Ajouter le libellé explicite**

Afficher un texte de confirmation :

```tsx
<p>Semaine perso : {rangeLabel}</p>
```

- [ ] **Step 4: Vérifier**

Run: `bun run build`
Expected: build OK

- [ ] **Step 5: Commit**

```bash
git add src/pages/membre/Profil.tsx src/lib
git commit -m "feat(profile): let members choose their week start day"
```

### Task 5: Ajouter le réglage côté coach

**Files:**
- Modify: `src/pages/coach/Member.jsx`
- Modify: server function file that updates member settings

- [ ] **Step 1: Ajouter la lecture du champ**

Afficher la préférence actuelle du coaché dans la fiche membre.

- [ ] **Step 2: Ajouter la modification coach**

Réutiliser la même liste de jours pour que le coach puisse corriger le réglage au besoin.

- [ ] **Step 3: Vérifier**

Run: `bun run build`
Expected: build OK

- [ ] **Step 4: Commit**

```bash
git add src/pages/coach/Member.jsx src/lib
git commit -m "feat(coach): edit member week start preference"
```

### Task 6: Rendre l'écran planning cohérent partout

**Files:**
- Modify: `src/pages/membre/Planning.tsx`
- Modify: `src/pages/membre/Programme.jsx`
- Modify: `src/lib/logbook.functions.ts`

- [ ] **Step 1: Corriger les résumés qui affichent encore la logique ancienne**

Rebrancher tout calcul de semaine dépendant encore de `start_date + 7 jours` vers le nouveau helper partagé.

- [ ] **Step 2: Vérifier que la semaine 1 reste bloquée avant le démarrage réel**

Conserver la logique :

```ts
date < assignmentStartISO
```

mais dans la nouvelle plage personnalisée.

- [ ] **Step 3: Vérifier**

Run: `bun run build`
Expected: build OK

- [ ] **Step 4: Commit**

```bash
git add src/pages/membre/Planning.tsx src/pages/membre/Programme.jsx src/lib/logbook.functions.ts
git commit -m "fix(member): align all member week views with custom week start"
```

### Task 7: Vérification finale

**Files:**
- Modify: none

- [ ] **Step 1: Lancer les tests ciblés**

Run: `bun test src/lib/planning-weeks.test.ts src/lib/planning-weeks.custom.test.ts src/lib/streak.test.ts`
Expected: PASS

- [ ] **Step 2: Lancer le build complet**

Run: `bun run build`
Expected: build OK

- [ ] **Step 3: Vérification manuelle**

Checklist :
- membre sans réglage => lundi -> dimanche
- Gaétan avec `vendredi` => vendredi -> jeudi
- semaine 1 avec jours avant démarrage => jours indisponibles
- déplacement de séance => jours proposés cohérents
- navigation semaine précédente / suivante => cohérente

- [ ] **Step 4: Commit de finition**

```bash
git status
```

Expected: worktree propre
