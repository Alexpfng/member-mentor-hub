import { describe, expect, it } from "bun:test";
import { buildMemberWeekDetails } from "./member-week-details";

describe("buildMemberWeekDetails", () => {
  it("keeps each day's label, rest state, and complete exercise details", () => {
    const details = buildMemberWeekDetails([
      {
        label: "Full-body 1",
        type: "Séance",
        exercises: [
          { name: "CARs épaules", reps: "5 - 6", tempo: "très lent", coach_notes: "Bras tendus" },
        ],
      },
      { label: "Repos", type: "Repos", exercises: [] },
    ]);

    expect(details).toEqual([
      {
        label: "Full-body 1",
        type: "Séance",
        isRest: false,
        exercises: [
          { name: "CARs épaules", reps: "5 - 6", tempo: "très lent", coach_notes: "Bras tendus" },
        ],
      },
      { label: "Repos", type: "Repos", isRest: true, exercises: [] },
    ]);
  });

  it("provides a stable label when a day has no explicit name", () => {
    expect(buildMemberWeekDetails([{ exercises: [] }])[0].label).toBe("Séance 1");
  });
});
