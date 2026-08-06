# RPE coach adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire afficher le RPE réel rempli par le coaché sur chaque exercice de l'écran d'adaptation coach.

**Architecture:** On garde la source de vérité actuelle (`set_logs` + `exercise_feedbacks`) mais on rend la résolution de feedback beaucoup plus robuste via une normalisation enrichie et un fallback de matching tolérant. L'UI `AdapterSemaine` reste quasi inchangée et profite d'une donnée fiabilisée.

**Tech Stack:** React, TanStack Start, TypeScript, Bun, Supabase

---

### Task 1: Écrire la régression sur la résolution des feedbacks

**Files:**
- Modify: `src/lib/exercise-feedback.test.ts`
- Modify: `src/lib/exercise-feedback.ts`

- [ ] **Step 1: Write the failing test**

Ajouter un cas qui vérifie qu'un feedback stocké sous une variante de libellé est retrouvé pour l'exercice affiché côté coach.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/exercise-feedback.test.ts`
Expected: FAIL sur le nouveau cas de correspondance robuste.

- [ ] **Step 3: Write minimal implementation**

Étendre la normalisation et ajouter une résolution multi-clés/fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/exercise-feedback.test.ts`
Expected: PASS

### Task 2: Sécuriser l'agrégation côté adaptation coach

**Files:**
- Modify: `src/lib/weekly-adaptation.functions.ts`

- [ ] **Step 1: Write a failing regression if needed**

Si la logique montre que l'agrégation produit de mauvaises clés, ajouter un test ciblé ou un helper pur testable.

- [ ] **Step 2: Patch the aggregation**

Faire en sorte que les feedbacks produits par `getMemberWeekContext` exposent des clés cohérentes avec la résolution côté UI.

- [ ] **Step 3: Verify**

Run the relevant test command(s) and confirm the returned payload still contient les RPE attendus.

### Task 3: Vérification finale

**Files:**
- Verify: `src/pages/coach/AdapterSemaine.tsx`

- [ ] **Step 1: Run targeted tests**

Run: `bun test src/lib/exercise-feedback.test.ts`

- [ ] **Step 2: Run broader safety check**

Run: `bun test`

- [ ] **Step 3: Optional type/build verification**

Run: `bun run build`

- [ ] **Step 4: Commit**

Commit avec un message du type: `fix(rpe): affiche les retours coachés sur les cartes d'adaptation`
