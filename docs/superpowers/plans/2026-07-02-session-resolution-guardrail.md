# Session Resolution Guardrail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining member-session resolution bug that can show “Aucun exercice trouvé” for valid published sessions.

**Architecture:** Add a pure resolution helper that supports both legacy zero-based and current one-based week metadata with a safe label-based fallback, then align the session launcher to persist one-based session weeks going forward and scope adapted weeks to the active assignment.

**Tech Stack:** TanStack Start, React, Supabase, Bun tests

---

### Task 1: Add a tested session-resolution helper

**Files:**
- Modify: `src/lib/program-weeks.ts`
- Modify: `src/lib/program-weeks.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it to verify it fails**
- [ ] **Step 3: Implement the minimal helper**
- [ ] **Step 4: Run the test to verify it passes**

### Task 2: Use the helper in the member session route

**Files:**
- Modify: `src/routes/_authenticated.membre.seance.$sessionId.tsx`

- [ ] **Step 1: Fetch adapted weeks scoped to the active assignment**
- [ ] **Step 2: Replace raw exercise lookup with the new guardrail helper**
- [ ] **Step 3: Keep the blocking error only when fallback remains empty**

### Task 3: Normalize newly created sessions

**Files:**
- Modify: `src/routes/_authenticated.membre.logger.tsx`

- [ ] **Step 1: Persist session `week_number` as one-based when creating/updating in-progress program sessions**
- [ ] **Step 2: Keep planner search params unchanged so current navigation still works**

### Task 4: Verify

**Files:**
- No new files

- [ ] **Step 1: Run `bun test src/lib/program-weeks.test.ts`**
- [ ] **Step 2: Run `bun run build`**
