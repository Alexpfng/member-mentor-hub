# Assignment Start Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to assign a program starting from any program week by deriving the stored `start_date` from the selected week.

**Architecture:** Keep the current data model based on `assignments.start_date`. Add a shared helper that converts a selected assignment date plus a selected program week into the effective stored start date, then reuse that helper in all coach assignment flows.

**Tech Stack:** TanStack Start, React, Bun test runner, Supabase server functions

---

### Task 1: Shared start-date helper

**Files:**
- Create: `src/lib/assignment-start.ts`
- Test: `src/lib/assignment-start.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test";
import { deriveAssignmentStartDate } from "./assignment-start";

describe("deriveAssignmentStartDate", () => {
  it("keeps the selected date when starting at week 1", () => {
    expect(deriveAssignmentStartDate("2026-06-16", 1)).toBe("2026-06-16");
  });

  it("backs up the stored start date when starting at week 4", () => {
    expect(deriveAssignmentStartDate("2026-06-16", 4)).toBe("2026-05-26");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/assignment-start.test.ts`
Expected: FAIL because `src/lib/assignment-start.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function deriveAssignmentStartDate(selectedDate: string, startWeek: number): string {
  const base = new Date(`${selectedDate}T00:00:00`);
  const safeWeek = Number.isFinite(startWeek) && startWeek > 0 ? Math.floor(startWeek) : 1;
  base.setDate(base.getDate() - (safeWeek - 1) * 7);
  return base.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/assignment-start.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignment-start.ts src/lib/assignment-start.test.ts
git commit -m "test: cover assignment start week helper"
```

### Task 2: Apply helper in coach assignment flows

**Files:**
- Modify: `src/pages/coach/Programmes.tsx`
- Modify: `src/pages/coach/Member.jsx`
- Modify: `src/pages/coach/Import.tsx`
- Modify: `src/pages/coach/BuilderNew.tsx`
- Test: `src/lib/assignment-start.test.ts`

- [ ] **Step 1: Write the failing test for helper-driven week offset if needed**

```ts
it("backs up by full weeks only", () => {
  expect(deriveAssignmentStartDate("2026-06-16", 2)).toBe("2026-06-09");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/assignment-start.test.ts`
Expected: FAIL until the new case is implemented if needed.

- [ ] **Step 3: Add UI and assignment payload changes**

```tsx
const [selectedWeek, setSelectedWeek] = useState(1);
const weekOptions = Array.from({ length: Math.max(1, program.duration_weeks ?? 1) }, (_, index) => index + 1);

await assignFn({
  data: {
    member_id: memberId,
    program_id: program.id,
    start_date: deriveAssignmentStartDate(startDate, selectedWeek),
  },
});
```

- [ ] **Step 4: Run focused verification**

Run: `bun test src/lib/assignment-start.test.ts`
Expected: PASS

Run: `npm run build`
Expected: build succeeds without type or bundling regressions

- [ ] **Step 5: Commit**

```bash
git add src/pages/coach/Programmes.tsx src/pages/coach/Member.jsx src/pages/coach/Import.tsx src/pages/coach/BuilderNew.tsx src/lib/assignment-start.ts src/lib/assignment-start.test.ts
git commit -m "feat: allow assigning a program from any week"
```
