import { describe, expect, it } from "bun:test";

import {
  displayProgramDayLabel,
  displayProgramSessionLabel,
  resolveMemberSessionExercises,
  resolveSessionExercises,
  shouldShowWeekRpeResetButton,
} from "./program-weeks";

describe("coach week controls", () => {
  it("keeps the week RPE reset action hidden while preserving the code path", () => {
    expect(shouldShowWeekRpeResetButton()).toBe(false);
  });
});

describe("displayProgramDayLabel", () => {
  it("prefers the real imported session name over generic séance labels", () => {
    expect(
      displayProgramDayLabel(
        {
          label: "Séance 1",
          name: "Upper body focus push",
        },
        0,
      ),
    ).toBe("Upper body focus push");
  });

  it("keeps a custom label when it is already the real session name", () => {
    expect(displayProgramDayLabel({ label: "Full-body 3" }, 2)).toBe("Full-body 3");
  });
});

describe("displayProgramSessionLabel", () => {
  it("uses the published program day name for old generic completed session labels", () => {
    expect(
      displayProgramSessionLabel(
        [
          {
            days: [
              { label: "Séance 1", name: "Full-body 1" },
              { label: "Séance 2", name: "Full-body 2 (Durée : ~70min)" },
            ],
          },
        ],
        1,
        2,
        "Séance 2",
      ),
    ).toBe("Full-body 2 (Durée : ~70min)");
  });

  it("keeps the stored label when no matching program day exists", () => {
    expect(displayProgramSessionLabel([], 3, 1, "Séance libre")).toBe("Séance libre");
  });
});

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
  it("resolves the stored one-based week number to the matching week index", () => {
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

  it("uses the stored week even when the same label exists in other weeks", () => {
    const resolved = resolveMemberSessionExercises(
      {
        weeks: [
          { days: [{ label: "Séance 1", exercises: [{ name: "A" }] }] },
          { days: [{ label: "Séance 1", exercises: [{ name: "B" }] }] },
        ],
      },
      [],
      2,
      1,
      "Séance 1",
    );

    expect(resolved).toEqual([{ name: "B" }]);
  });

  it("recovers a reordered day within the same week by label", () => {
    const push = [{ name: "Développé couché" }];
    const resolved = resolveMemberSessionExercises(
      {
        weeks: [
          {
            days: [
              { label: "Pull", exercises: [{ name: "Tractions" }] },
              { label: "Push", exercises: push },
            ],
          },
        ],
      },
      [],
      1,
      1,
      "Push",
    );

    expect(resolved).toEqual(push);
  });
});
