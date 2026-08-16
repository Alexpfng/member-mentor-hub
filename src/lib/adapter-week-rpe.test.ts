import { describe, expect, it } from "bun:test";

import {
  resetWeekExerciseRpeTargets,
  setExerciseQuickCoachNote,
  setExerciseQuickRpe,
} from "./adapter-week-rpe";

describe("setExerciseQuickRpe", () => {
  it("updates only the targeted exercise rpe in the selected day", () => {
    const structure = {
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: 6 }, { name: "B", rpe_target: 7 }] },
        { label: "Séance 2", exercises: [{ name: "C", rpe_target: 8 }] },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 1, 9)).toEqual({
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: 6 }, { name: "B", rpe_target: 9 }] },
        { label: "Séance 2", exercises: [{ name: "C", rpe_target: 8 }] },
      ],
    });
  });

  it("clears the rpe when value is null", () => {
    const structure = {
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: 6 as string | number | null }] },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 0, null)).toEqual({
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: null }] },
      ],
    });
  });

  it("updates only the targeted exercise coach note in the selected day", () => {
    const structure = {
      days: [
        { label: "Séance 1", exercises: [{ name: "A", coach_notes: "ancien" }, { name: "B", coach_notes: null }] },
        { label: "Séance 2", exercises: [{ name: "C", coach_notes: "ok" }] },
      ],
    };

    expect(setExerciseQuickCoachNote(structure, 0, 1, "à surveiller")).toEqual({
      days: [
        { label: "Séance 1", exercises: [{ name: "A", coach_notes: "ancien" }, { name: "B", coach_notes: "à surveiller" }] },
        { label: "Séance 2", exercises: [{ name: "C", coach_notes: "ok" }] },
      ],
    });
  });

  it("clears only numeric coach rpe targets across the full week", () => {
    const structure = {
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", rpe_target: 8 },
            { name: "B", rpe_target: "8,5" },
            { name: "C", rpe_target: "échec" },
            { name: "D", rpe_target: "courir relâché 20 min" },
          ],
        },
      ],
    };

    expect(resetWeekExerciseRpeTargets(structure)).toEqual({
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", rpe_target: null },
            { name: "B", rpe_target: null },
            { name: "C", rpe_target: "échec" },
            { name: "D", rpe_target: "courir relâché 20 min" },
          ],
        },
      ],
    });
  });
});
