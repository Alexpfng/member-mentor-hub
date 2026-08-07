import { describe, expect, it } from "bun:test";

import { getFeedbackWeekCandidates } from "./adapter-feedback-source";

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
