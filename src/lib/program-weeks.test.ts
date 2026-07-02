import { describe, expect, it } from "bun:test";

import { resolveMemberSessionExercises, resolveSessionExercises } from "./program-weeks";

describe("resolveSessionExercises", () => {
  it("prefers adapted week exercises over the base program structure", () => {
    const exercises = [{ name: "Tour du monde avec manche a balai" }];
    const resolved = resolveSessionExercises(
      {
        weeks: [
          { days: [{ label: "Séance 1", exercises: [] }] },
          { days: [{ label: "Séance 1", exercises: [] }] },
        ],
      },
      [
        {
          week_number: 2,
          structure: {
            days: [{ label: "Séance 1", exercises }],
          },
        },
      ],
      1,
      1,
    );

    expect(resolved).toEqual(exercises);
  });

  it("returns base program exercises when there is no adapted week", () => {
    const exercises = [{ name: "CARS épaules couché" }];
    const resolved = resolveSessionExercises(
      {
        weeks: [{ days: [{ label: "Séance 1", exercises }] }],
      },
      [],
      0,
      1,
    );

    expect(resolved).toEqual(exercises);
  });
});

describe("resolveMemberSessionExercises", () => {
  it("falls back to the previous week index when the stored session week is one-based", () => {
    const exercises = [{ name: "Romanian deadlift" }];

    const resolved = resolveMemberSessionExercises(
      {
        weeks: [
          { days: [{ label: "Lower body 1", exercises }] },
          { days: [{ label: "Lower body 2", exercises: [] }] },
        ],
      },
      [],
      1,
      1,
      "Lower body 1",
    );

    expect(resolved).toEqual(exercises);
  });

  it("does not guess when the label matches multiple possible weeks", () => {
    const resolved = resolveMemberSessionExercises(
      {
        weeks: [
          { days: [{ label: "Séance 1", exercises: [{ name: "A" }] }] },
          { days: [{ label: "Séance 1", exercises: [{ name: "B" }] }] },
        ],
      },
      [],
      1,
      1,
      "Séance 1",
    );

    expect(resolved).toEqual([]);
  });
});
