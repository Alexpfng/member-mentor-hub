import { describe, expect, it } from "bun:test";

import { getCoachRpeBadgeLabel } from "./adapter-week-rpe-visuals";

describe("getCoachRpeBadgeLabel", () => {
  it("shows the coach target when the exercise still has one", () => {
    expect(getCoachRpeBadgeLabel({ rpe_target: 8.5, memberRpe: 9 })).toBe("RPE 8,5");
  });

  it("shows the member rpe when the coach target is empty but no reset happened yet", () => {
    expect(getCoachRpeBadgeLabel({ rpe_target: null, memberRpe: 8.5 })).toBe("RPE 8,5");
  });

  it("falls back to an empty coach badge only after an explicit reset", () => {
    expect(getCoachRpeBadgeLabel({ rpe_target: null, memberRpe: 8.5, wasReset: true })).toBe(
      "RPE —",
    );
  });

  it("keeps the failure badge when the coach target is a failure marker", () => {
    expect(getCoachRpeBadgeLabel({ rpe_target: "échec", memberRpe: 10 })).toBe("ÉCHEC");
  });
});
