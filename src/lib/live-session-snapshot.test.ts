import { describe, expect, it } from "bun:test";

import {
  createSessionSnapshot,
  shouldPersistSessionSnapshot,
  type SessionSnapshot,
} from "./live-session-snapshot";

describe("shouldPersistSessionSnapshot", () => {
  it("skips a pristine intro screen", () => {
    expect(shouldPersistSessionSnapshot({ phase: "intro", savedStepCount: 0 })).toBe(false);
  });

  it("keeps the recap screen when expert recap data exists", () => {
    expect(shouldPersistSessionSnapshot({ phase: "recap", savedStepCount: 3 })).toBe(true);
  });
});

describe("createSessionSnapshot", () => {
  it("stores expert recap rpe and comments alongside saved steps", () => {
    expect(
      createSessionSnapshot({
        sessionId: "session-1",
        stepIdx: 8,
        phase: "recap",
        savedByStep: {
          0: { exo: "Squat", weight: 60, reps: 8, rpe: 8 },
        },
        startedAt: 111,
        updatedAt: 222,
        expertRecapRpeByExercise: { Squat: 8.5 },
        expertRecapCommentByExercise: { Squat: "propre" },
        sessionNote: "grosse fatigue aujourd'hui",
      }),
    ).toEqual<SessionSnapshot>({
      sessionId: "session-1",
      stepIdx: 8,
      phase: "recap",
      savedByStep: {
        0: { exo: "Squat", weight: 60, reps: 8, rpe: 8 },
      },
      startedAt: 111,
      updatedAt: 222,
      expertRecapRpeByExercise: { Squat: 8.5 },
      expertRecapCommentByExercise: { Squat: "propre" },
      sessionNote: "grosse fatigue aujourd'hui",
    });
  });
});
