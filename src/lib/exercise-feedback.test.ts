import { describe, expect, test } from "bun:test";

import { getExerciseFeedback, normalizeExerciseFeedbackKey } from "./exercise-feedback";

describe("normalizeExerciseFeedbackKey", () => {
  test("normalizes casing, accents and whitespace", () => {
    expect(normalizeExerciseFeedbackKey("  CARS épaule\ncouché  ")).toBe("cars epaule couche");
  });

  test("normalizes typographic apostrophes and dashes", () => {
    expect(normalizeExerciseFeedbackKey("Pallof — demi‑agenouillé")).toBe("pallof - demi-agenouille");
  });
});

describe("getExerciseFeedback", () => {
  test("finds feedback even when the exercise label formatting differs", () => {
    const feedback = {
      "tour du monde avec manche a balai": {
        rpe: 8.5,
        pain: false,
        tooHard: false,
        tooEasy: false,
        failure: false,
      },
    };

    expect(getExerciseFeedback(feedback, " Tour du monde avec manche à\nbalai ")).toEqual(
      feedback["tour du monde avec manche a balai"],
    );
  });
});
