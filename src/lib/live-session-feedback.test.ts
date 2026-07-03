import { describe, expect, test } from "bun:test";

import {
  buildExpertExerciseFeedbackRows,
  normalizeExpertRpeForStorage,
  trimOptionalComment,
} from "./live-session-feedback";

describe("normalizeExpertRpeForStorage", () => {
  test("keeps regular rpe values as-is", () => {
    expect(normalizeExpertRpeForStorage(8.5)).toBe(8.5);
  });

  test("caps KO values to 10 for storage", () => {
    expect(normalizeExpertRpeForStorage(11)).toBe(10);
  });
});

describe("trimOptionalComment", () => {
  test("returns null for empty comments", () => {
    expect(trimOptionalComment("   ")).toBeNull();
  });

  test("keeps the trimmed comment text", () => {
    expect(trimOptionalComment("  trop dur aujourd'hui  ")).toBe("trop dur aujourd'hui");
  });
});

describe("buildExpertExerciseFeedbackRows", () => {
  test("builds feedback rows with optional member comments", () => {
    expect(
      buildExpertExerciseFeedbackRows(
        "session-1",
        [
          {
            exerciseName: "Rowing barre",
            rows: [{ stepIdx: 0, setNumber: 1, weight: 40, reps: 8, rpe: 8 }],
          },
          {
            exerciseName: "Back squat",
            rows: [{ stepIdx: 1, setNumber: 1, weight: 80, reps: 5, rpe: 10 }],
          },
        ],
        {
          "Rowing barre": 8.5,
          "Back squat": 11,
        },
        {
          "Rowing barre": "bonne sensation",
          "Back squat": "échec sur la dernière rep",
        },
      ),
    ).toEqual([
      {
        session_id: "session-1",
        exercise_name: "Rowing barre",
        rpe: 8.5,
        could_not_do: false,
        felt_too_hard: false,
        member_comment: "bonne sensation",
      },
      {
        session_id: "session-1",
        exercise_name: "Back squat",
        rpe: 10,
        could_not_do: true,
        felt_too_hard: true,
        member_comment: "échec sur la dernière rep",
      },
    ]);
  });
});
