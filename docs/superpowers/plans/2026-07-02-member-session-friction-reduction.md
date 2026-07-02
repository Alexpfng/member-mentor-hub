# Member Session Friction Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** finish the expert member session flow, make done/remaining exercise state visible, and let coaches dismiss leftover video priority items.

**Architecture:** keep the existing live session component, extract the new expert/progress summarization into a small tested helper, then wire the coach priority feed to the existing video review mutation. Avoid schema changes and keep the beginner flow untouched.

**Tech Stack:** React, TanStack Router/Start, Bun tests, Supabase

---

### Task 1: Add tested session progress helpers

**Files:**
- Create: `src/lib/live-session-progress.ts`
- Create: `src/lib/live-session-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- grouping completed expert steps by exercise;
- preserving auto-derived weight/reps in the recap rows;
- computing `done / current / remaining` overview state from `savedByStep`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/live-session-progress.test.ts`
Expected: fail because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement small pure helpers that:
- normalize completed step data;
- group per exercise for expert recap;
- derive overview status for each exercise.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/live-session-progress.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-session-progress.ts src/lib/live-session-progress.test.ts
git commit -m "test: add live session progress helpers"
```

### Task 2: Finish expert end-of-session flow

**Files:**
- Modify: `src/components/cst/LiveSession.tsx`

- [ ] **Step 1: Write the failing test coverage first where feasible**

Reuse the helper tests from Task 1 as the behavioral contract for expert recap grouping and overview state.

- [ ] **Step 2: Implement expert step capture without RPE entry**

Update the `expert` branch so each validated step stores auto-derived weight/reps in memory and marks the step done without inserting `set_logs` immediately.

- [ ] **Step 3: Implement expert recap inputs**

In `phase === "recap"`, render a dedicated expert recap:
- grouped by exercise;
- showing auto-filled weights/reps;
- asking only for per-exercise RPE.

- [ ] **Step 4: Persist expert recap on finish**

Before calling the existing `onFinish`, insert the missing `set_logs` rows from the expert recap so session aggregates continue to work.

- [ ] **Step 5: Verify flow-level behavior**

Run: `bun test src/lib/live-session-progress.test.ts`
Expected: still green.

- [ ] **Step 6: Commit**

```bash
git add src/components/cst/LiveSession.tsx
git commit -m "feat(membre): finish expert recap session flow"
```

### Task 3: Show done vs remaining exercises in-session

**Files:**
- Modify: `src/components/cst/LiveSession.tsx`
- Reuse: `src/lib/live-session-progress.ts`

- [ ] **Step 1: Add overview status mapping**

Use the helper from Task 1 to compute visual state per exercise from `savedByStep` and current step.

- [ ] **Step 2: Render visible progress**

Update the live header/overview panel to show:
- done count;
- remaining count;
- `fait / en cours / à faire` per exercise in the overview.

- [ ] **Step 3: Verify manually through build**

Run: `bun run build`
Expected: successful client + server build.

- [ ] **Step 4: Commit**

```bash
git add src/components/cst/LiveSession.tsx src/lib/live-session-progress.ts
git commit -m "feat(membre): show done and remaining exercises"
```

### Task 4: Let coach dismiss video priority items

**Files:**
- Modify: `src/components/coach/PriorityFeed.tsx`
- Modify: `src/components/coach/priority-feed.ts`
- Modify: `src/components/coach/priority-feed.test.ts`
- Reuse: `src/lib/videos.functions.ts`

- [ ] **Step 1: Write the failing test**

Add a unit test proving that the local priority-item filter removes only the targeted video card.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/components/coach/priority-feed.test.ts`
Expected: fail because the video helper does not exist yet.

- [ ] **Step 3: Implement the filter helper**

Extend the local priority filtering helper with video-item removal support.

- [ ] **Step 4: Wire the UI action**

In `PriorityFeed`, add a dismiss button on `video` items and call the existing `markVideoReviewed` server function for persistence.

- [ ] **Step 5: Run tests**

Run: `bun test src/components/coach/priority-feed.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/coach/PriorityFeed.tsx src/components/coach/priority-feed.ts src/components/coach/priority-feed.test.ts
git commit -m "feat(coach): dismiss priority videos"
```

### Task 5: Final verification

**Files:**
- Verify: `src/components/cst/LiveSession.tsx`
- Verify: `src/components/coach/PriorityFeed.tsx`
- Verify: `src/lib/live-session-progress.ts`

- [ ] **Step 1: Run targeted tests**

Run: `bun test src/lib/live-session-progress.test.ts src/components/coach/priority-feed.test.ts`
Expected: all pass.

- [ ] **Step 2: Run full build**

Run: `bun run build`
Expected: successful production build.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: reduce member session friction"
```
