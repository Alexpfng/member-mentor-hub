# Expert Session Summary And Final RPE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expert-only session summary and a robust final per-exercise RPE screen without changing guided tracking mode.

**Architecture:** Keep `LiveSession` as the single orchestrator for expert flow, reuse existing overview and recap derivation helpers, and replace the broken final expert selector with a compact per-exercise RPE picker rendered only in expert mode.

**Tech Stack:** React 19, inline JSX styles, TanStack Start app, Supabase persistence

---

### Task 1: Fix the expert recap crash and add a dedicated compact RPE picker

**Files:**
- Modify: `src/components/cst/LiveSession.tsx`

- [ ] Add a local compact per-exercise RPE picker for the expert recap.
- [ ] Replace the broken recap selector usage with the local picker.
- [ ] Keep final validation blocked until all completed expert exercises have an RPE.

### Task 2: Replace the expert overview with a compact resumable summary

**Files:**
- Modify: `src/components/cst/LiveSession.tsx`

- [ ] Make the header CTA read as `RÉSUMÉ` in expert mode.
- [ ] Render an expert-only summary list with done/current/todo states.
- [ ] Keep rows clickable so the coaché can reopen any exercise.

### Task 3: Verify the expert flow still builds cleanly

**Files:**
- Modify: `src/components/cst/LiveSession.tsx`

- [ ] Run `npm run build`.
- [ ] Review diff and prepare commit.
