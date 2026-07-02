# Session Resolution Guardrail Design

## Goal

Fix the remaining `Aucun exercice trouvé` failure for member sessions by correcting session-to-week resolution and adding a safe guardrail when a stored session points to inconsistent week/day metadata.

## Problem Summary

The member session page `/membre/seance/$sessionId` still has a failure path where a session row exists but resolves to zero exercises. The current flow depends on `sessions.program_id`, `week_number`, `day_number`, `session_label`, and the member's published `assignment_weeks`. If one of those values is offset, stale, or linked to the wrong assignment/program, the page falls through to the blocking “séance indisponible” screen.

## Root-Cause-Oriented Approach

### 1. Audit and correct the resolution source

- Inspect the session creation/reopen flow from `Commencer` and `logger`.
- Confirm how `week_number`, `day_number`, and `session_label` are persisted in `sessions`.
- Compare those persisted values against the currently active assignment and the published `assignment_weeks`.
- Ensure the member session page resolves exercises against the correct assignment/program scope first, then the correct week/day inside the adapted structure.

### 2. Add a guardrail for inconsistent sessions

If the direct `week_number` / `day_number` lookup returns no exercises:

- try a safe secondary resolution using the session label against the resolved week/day definitions for the active assignment
- only fall back when the match is unambiguous
- log enough context in the console for future diagnosis

The app must never silently load the wrong workout. The guardrail is allowed only when it resolves to one clear session.

### 3. Preserve the blocking screen only for true data corruption

Keep the current “séance indisponible” page only when:

- the session has no valid program linkage
- the active assignment cannot be resolved
- the fallback remains ambiguous or empty

## UX Outcome

- valid sessions should open normally even if the stored metadata is slightly inconsistent
- broken sessions should fail with a more trustworthy, rarer blocking state
- coaches should stop seeing demo failures on existing published weeks

## Testing

- add a regression test for adapted-week exercise resolution with shifted or inconsistent session metadata
- verify one standard published session still resolves normally
- verify ambiguous fallback does not guess

## Scope

- in scope: member program sessions
- in scope: resolution logic and fallback guardrail
- out of scope: free sessions, self-composed sessions, broader PDF-requested UX features for this pass
