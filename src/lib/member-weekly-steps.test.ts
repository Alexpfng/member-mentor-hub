import { describe, expect, it } from "bun:test";

import { buildMemberWeeklySteps } from "./member-weekly-steps";

describe("buildMemberWeeklySteps", () => {
  it("groups entered daily steps into comparable calendar-week totals", () => {
    const weeks = buildMemberWeeklySteps(
      [
        { date: "2026-10-06", steps: 9_600 },
        { date: "2026-10-07", steps: 13_246 },
        { date: "2026-10-08", steps: 9_819 },
        { date: "2026-10-09", steps: 10_783 },
        { date: "2026-10-10", steps: 22_129 },
        { date: "2026-10-12", steps: 8_000 },
      ],
      10_000,
    );

    expect(weeks).toEqual([
      {
        monday: "2026-10-05",
        total: 65_577,
        daysTracked: 5,
        goal: 50_000,
        goalReached: true,
      },
      {
        monday: "2026-10-12",
        total: 8_000,
        daysTracked: 1,
        goal: 10_000,
        goalReached: false,
      },
    ]);
  });

  it("keeps weekly goal unavailable when no daily goal is set", () => {
    expect(buildMemberWeeklySteps([{ date: "2026-10-06", steps: 12_000 }], null)[0]).toMatchObject({
      total: 12_000,
      daysTracked: 1,
      goal: null,
      goalReached: null,
    });
  });
});
