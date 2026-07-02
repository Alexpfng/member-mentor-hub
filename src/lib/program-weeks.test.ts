import { describe, expect, it } from "bun:test";

import { resolveSessionExercises } from "./program-weeks";

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
