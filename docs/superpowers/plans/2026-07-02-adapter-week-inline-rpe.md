# Adapter Week Inline RPE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches edit exercise RPE values directly from the week adaptation board.

**Architecture:** Add a pure structure-update helper with tests, then wire a lightweight quick-selector popover into the existing `AdapterSemaine` exercise cards so the current auto-save persists the change.

**Tech Stack:** React, TanStack Start, Bun tests

---

### Task 1: Add a tested structure update helper

**Files:**
- Create: `src/lib/adapter-week-rpe.ts`
- Create: `src/lib/adapter-week-rpe.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Wire the quick RPE selector into `AdapterSemaine`

**Files:**
- Modify: `src/pages/coach/AdapterSemaine.tsx`
- Test: `src/lib/adapter-week-rpe.test.ts`

- [ ] **Step 1: Use the helper inside the existing structure state update flow**
- [ ] **Step 2: Add a compact `0–10` selector opened from the card badge**
- [ ] **Step 3: Close the selector on outside click or after selection**
- [ ] **Step 4: Verify the existing reset button still clears every RPE**

### Task 3: Verify

**Files:**
- No new files

- [ ] **Step 1: Run `bun test src/lib/adapter-week-rpe.test.ts`**
- [ ] **Step 2: Run `bun run build`**
