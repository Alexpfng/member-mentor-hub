import { describe, expect, it } from "bun:test";

import {
  resetWeekExerciseRpeTargets,
  markMemberRpeAddressedAfterPrescriptionChange,
  setExerciseQuickCoachNote,
  setExerciseQuickRpe,
} from "./adapter-week-rpe";

type TestWeek = {
  days: Array<{
    label: string;
    exercises: Array<{
      name: string;
      rpe_target?: string | number | null;
      rpe_cleared?: boolean;
      member_rpe_hidden?: boolean;
      coach_notes?: string | null;
    }>;
  }>;
};

describe("setExerciseQuickRpe", () => {
  it("updates only the targeted exercise rpe in the selected day", () => {
    const structure: TestWeek = {
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", rpe_target: 6 },
            { name: "B", rpe_target: 7 },
          ],
        },
        { label: "Séance 2", exercises: [{ name: "C", rpe_target: 8 }] },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 1, 9)).toEqual({
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", rpe_target: 6 },
            { name: "B", rpe_target: 9, rpe_cleared: false, member_rpe_hidden: false },
          ],
        },
        { label: "Séance 2", exercises: [{ name: "C", rpe_target: 8 }] },
      ],
    });
  });

  it("clears the rpe when value is null", () => {
    const structure: TestWeek = {
      days: [
        { label: "Séance 1", exercises: [{ name: "A", rpe_target: 6 as string | number | null }] },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 0, null)).toEqual({
      days: [
        {
          label: "Séance 1",
          exercises: [{ name: "A", rpe_target: null, rpe_cleared: true, member_rpe_hidden: true }],
        },
      ],
    });
  });

  it("removes the explicit member rpe hide marker when a new coach target is set again", () => {
    const structure: TestWeek = {
      days: [
        {
          label: "Séance 1",
          exercises: [
            {
              name: "A",
              rpe_target: null,
              rpe_cleared: true,
              member_rpe_hidden: true,
            },
          ],
        },
      ],
    };

    expect(setExerciseQuickRpe(structure, 0, 0, 8.5)).toEqual({
      days: [
        {
          label: "Séance 1",
          exercises: [{ name: "A", rpe_target: 8.5, rpe_cleared: false, member_rpe_hidden: false }],
        },
      ],
    });
  });

  it("updates only the targeted exercise coach note in the selected day", () => {
    const structure: TestWeek = {
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", coach_notes: "ancien" },
            { name: "B", coach_notes: null },
          ],
        },
        { label: "Séance 2", exercises: [{ name: "C", coach_notes: "ok" }] },
      ],
    };

    expect(setExerciseQuickCoachNote(structure, 0, 1, "à surveiller")).toEqual({
      days: [
        {
          label: "Séance 1",
          exercises: [
            { name: "A", coach_notes: "ancien" },
            { name: "B", coach_notes: "à surveiller" },
          ],
        },
        { label: "Séance 2", exercises: [{ name: "C", coach_notes: "ok" }] },
      ],
    });
  });

  it("clears only numeric coach rpe targets across the full week", () => {
    const structure: TestWeek = {
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
            { name: "A", rpe_target: null, rpe_cleared: true, member_rpe_hidden: true },
            { name: "B", rpe_target: null, rpe_cleared: true, member_rpe_hidden: true },
            { name: "C", rpe_target: "échec", rpe_cleared: true, member_rpe_hidden: true },
            {
              name: "D",
              rpe_target: "courir relâché 20 min",
              rpe_cleared: true,
              member_rpe_hidden: true,
            },
          ],
        },
      ],
    });
  });
});

describe("markMemberRpeAddressedAfterPrescriptionChange", () => {
  it("hides prior member RPE after the coach changes a prescription", () => {
    const previous: Record<string, unknown> = {
      name: "Pompes",
      reps: "10 - 8",
      member_rpe_hidden: false,
    };
    const next: Record<string, unknown> = {
      name: "Pompes",
      reps: "12 - 10",
      member_rpe_hidden: false,
    };
    expect(
      markMemberRpeAddressedAfterPrescriptionChange(previous, next),
    ).toEqual({ name: "Pompes", reps: "12 - 10", member_rpe_hidden: true, rpe_cleared: true });
  });

  it("does not hide RPE for unrelated edits or unchanged prescriptions", () => {
    const exercise: Record<string, unknown> = { name: "Pompes", reps: "10 - 8", coach_notes: "ancienne note" };
    expect(
      markMemberRpeAddressedAfterPrescriptionChange(exercise, {
        ...exercise,
        coach_notes: "nouvelle note",
      }),
    ).toEqual({ ...exercise, coach_notes: "nouvelle note" });
  });
});
