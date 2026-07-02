# Coach Dashboard Session Hide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to remove false or already processed sessions from the coach dashboard without deleting the underlying session data.

**Architecture:** Add a persistent `coach_hidden_at` timestamp on `sessions`, filter hidden sessions out of coach dashboard queries, and expose a coach-only server action plus UI buttons on recent-session cards. Reuse pure filtering helpers so the hidden-session behavior is testable without hitting Supabase.

**Tech Stack:** TanStack Start server functions, React Query, Supabase/Postgres, Bun tests

---

### Task 1: Persist hidden state on sessions

**Files:**
- Create: `supabase/migrations/20260702192000_add_coach_hidden_at_to_sessions.sql`
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/lib/coach-recent-sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("removes sessions hidden by the coach", () => {
  expect(
    filterRecentSessionsForCoach([
      { id: "visible", status: "completed", coach_hidden_at: null },
      { id: "hidden", status: "completed", coach_hidden_at: "2026-07-02T18:58:00.000Z" },
    ]),
  ).toEqual([{ id: "visible", status: "completed", coach_hidden_at: null }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: FAIL because hidden sessions are still returned.

- [ ] **Step 3: Write minimal implementation**

```sql
alter table public.sessions
  add column if not exists coach_hidden_at timestamptz;
```

```ts
coach_hidden_at: string | null
coach_hidden_at?: string | null
```

```ts
export function filterRecentSessionsForCoach<T extends { status: string | null; coach_hidden_at?: string | null }>(sessions: T[]) {
  return sessions.filter((session) => session.status === "completed" && !session.coach_hidden_at);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260702192000_add_coach_hidden_at_to_sessions.sql src/integrations/supabase/types.ts src/lib/coach-recent-sessions.test.ts src/lib/coach-recent-sessions.ts
git commit -m "feat: persist hidden coach dashboard sessions"
```

### Task 2: Hide sessions from coach dashboard data sources

**Files:**
- Modify: `src/lib/coach-dashboard.functions.ts`
- Test: `src/lib/coach-recent-sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("keeps only completed visible sessions for coach dashboard feeds", () => {
  expect(
    filterRecentSessionsForCoach([
      { id: "done", status: "completed", coach_hidden_at: null },
      { id: "live", status: "in_progress", coach_hidden_at: null },
      { id: "hidden", status: "completed", coach_hidden_at: "2026-07-02T18:58:00.000Z" },
    ]).map((session) => session.id),
  ).toEqual(["done"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: FAIL because the helper still returns hidden or non-completed sessions.

- [ ] **Step 3: Write minimal implementation**

```ts
const { data: sessions } = await supabaseAdmin
  .from("sessions")
  .select("..., coach_hidden_at")
  .eq("status", "completed")
  .is("coach_hidden_at", null);
```

```ts
supabaseAdmin
  .from("sessions")
  .select("..., coach_hidden_at")
  .eq("coach_seen", false)
  .eq("status", "completed")
  .is("coach_hidden_at", null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/coach-dashboard.functions.ts src/lib/coach-recent-sessions.test.ts
git commit -m "fix: exclude hidden sessions from coach dashboard feeds"
```

### Task 3: Add coach-only hide action and dashboard buttons

**Files:**
- Modify: `src/lib/coach-dashboard.functions.ts`
- Modify: `src/components/coach/RecentSessionsList.tsx`
- Test: `src/lib/coach-recent-sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("accepts rows that will be hidden later without breaking visible-session filtering", () => {
  expect(
    filterRecentSessionsForCoach([
      { id: "row", status: "completed", coach_hidden_at: null },
    ]),
  ).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: FAIL if helper typings or shape do not yet support the hide field.

- [ ] **Step 3: Write minimal implementation**

```ts
export const hideSessionFromCoachDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ coach_hidden_at: new Date().toISOString(), coach_seen: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

```tsx
<button
  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
  onClick={(event) => {
    event.stopPropagation();
    void onHideSession(s.id);
  }}
>
  ✕
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/coach-recent-sessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/coach-dashboard.functions.ts src/components/coach/RecentSessionsList.tsx
git commit -m "feat: let coach hide sessions from dashboard"
```

### Task 4: Verify end to end

**Files:**
- No code changes required

- [ ] **Step 1: Run targeted tests**

Run: `bun test src/lib/coach-recent-sessions.test.ts src/lib/program-weeks.test.ts src/lib/exercise-feedback.test.ts`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `bun run build`
Expected: successful build

- [ ] **Step 3: Review git diff**

Run: `git status --short`
Expected: only intended files changed

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-02-coach-dashboard-session-hide.md
git commit -m "docs: add coach dashboard hide-session plan"
```
