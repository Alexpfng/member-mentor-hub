import { describe, expect, it } from "bun:test";

import { buildCatchupMetadata, getCatchupInfo, isCatchupPlannedSession } from "./planning-catchup";

describe("planning catchup metadata", () => {
  it("marks a postponed planned session as a priority catchup with original context", () => {
    const metadata = buildCatchupMetadata({
      sourcePlannedId: "plan-1",
      sourceWeekNumber: 3,
      sourcePlannedDate: "2026-10-02",
      reason: "no_time",
    });

    expect(isCatchupPlannedSession({ metadata })).toBe(true);
    expect(getCatchupInfo({ metadata })).toEqual({
      active: true,
      sourcePlannedId: "plan-1",
      sourceWeekNumber: 3,
      sourcePlannedDate: "2026-10-02",
      reason: "no_time",
    });
  });

  it("treats regular planned sessions as non catchup", () => {
    expect(isCatchupPlannedSession({ metadata: null })).toBe(false);
    expect(getCatchupInfo({ metadata: { catchup: false } })).toEqual({ active: false });
  });
});
