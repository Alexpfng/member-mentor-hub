import { describe, expect, it } from "bun:test";

import {
  filterFeedbackSessionsForProgram,
  getFeedbackWeekCandidates,
  mergeExerciseFeedbackMaps,
} from "./adapter-feedback-source";

function fb(rpe: number) {
  return { rpe, pain: false, tooHard: false, tooEasy: false, failure: false };
}

describe("getFeedbackWeekCandidates", () => {
  it("prioritizes the copied source week before fallbacks", () => {
    expect(getFeedbackWeekCandidates({ targetWeekNumber: 7, basedOnWeek: 6 })).toEqual([
      6,
      5,
      4,
      3,
      2,
      1,
      7,
    ]);
  });

  it("remonte tout l'historique precedent quand based_on_week est manquant", () => {
    expect(getFeedbackWeekCandidates({ targetWeekNumber: 6, basedOnWeek: null })).toEqual([
      5,
      4,
      3,
      2,
      1,
      6,
    ]);
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

  it("ne laisse pas une semaine sans rpe effacer un rpe deja retrouve", () => {
    expect(
      mergeExerciseFeedbackMaps([
        { "back squat barre libre emom4": fb(8.5) },
        {
          "back squat barre libre emom4": {
            rpe: null,
            pain: false,
            tooHard: false,
            tooEasy: false,
            failure: false,
            loadLabel: "23.75kg",
          },
        },
      ]),
    ).toEqual({
      "back squat barre libre emom4": {
        rpe: 8.5,
        pain: false,
        tooHard: false,
        tooEasy: false,
        failure: false,
        loadLabel: "23.75kg",
      },
    });
  });
});

describe("filterFeedbackSessionsForProgram", () => {
  it("drops sessions coming from an older program when a new assignment is active", () => {
    expect(
      filterFeedbackSessionsForProgram(
        [
          { id: "old-1", program_id: "old-program", week_number: 1 },
          { id: "new-1", program_id: "new-program", week_number: 1 },
          { id: "free-1", program_id: null, week_number: 1 },
        ],
        "new-program",
      ),
    ).toEqual([{ id: "new-1", program_id: "new-program", week_number: 1 }]);
  });

  it("keeps the original list when no active program is provided", () => {
    const sessions = [{ id: "s1", program_id: "prog-a", week_number: 2 }];
    expect(filterFeedbackSessionsForProgram(sessions, null)).toEqual(sessions);
  });
});
