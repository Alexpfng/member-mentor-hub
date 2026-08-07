import { describe, expect, it } from "bun:test";

import { getFeedbackWeekCandidates, mergeExerciseFeedbackMaps } from "./adapter-feedback-source";

function fb(rpe: number) {
  return { rpe, pain: false, tooHard: false, tooEasy: false, failure: false };
}

describe("getFeedbackWeekCandidates", () => {
  it("prioritizes the copied source week before fallbacks", () => {
    expect(getFeedbackWeekCandidates({ targetWeekNumber: 7, basedOnWeek: 6 })).toEqual([6, 7]);
  });

  it("falls back to previous week then current week when based_on_week is missing", () => {
    expect(getFeedbackWeekCandidates({ targetWeekNumber: 6, basedOnWeek: null })).toEqual([5, 6]);
  });

  it("keeps week 1 usable when there is no previous week", () => {
    expect(getFeedbackWeekCandidates({ targetWeekNumber: 1, basedOnWeek: null })).toEqual([1]);
  });
});

describe("mergeExerciseFeedbackMaps", () => {
  it("keeps feedback from all candidate weeks instead of stopping at the first non-empty week", () => {
    expect(
      mergeExerciseFeedbackMaps([
        { "cars hanches": fb(7), "back squat": fb(8) },
        { "curl biceps incline sur banc": fb(9) },
      ]),
    ).toEqual({
      "cars hanches": fb(7),
      "back squat": fb(8),
      "curl biceps incline sur banc": fb(9),
    });
  });

  it("lets the most recent candidate override the copied source week for the same exercise", () => {
    expect(
      mergeExerciseFeedbackMaps([
        { "curl biceps incline sur banc": fb(8) },
        { "curl biceps incline sur banc": fb(9) },
      ]),
    ).toEqual({ "curl biceps incline sur banc": fb(9) });
  });
});
