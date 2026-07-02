import { describe, expect, it } from "bun:test";

import { setExerciseQuickRpe } from "./adapter-week-rpe";

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
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: 6 }] },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 0, null)).toEqual({
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: null }] },
      ],
    });
  });
});
