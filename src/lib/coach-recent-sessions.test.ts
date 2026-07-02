import { describe, expect, it } from "bun:test";

import { filterRecentSessionsForCoach } from "./coach-recent-sessions";

describe("filterRecentSessionsForCoach", () => {
  it("keeps only completed sessions in the recent coach feed", () => {
    const sessions = [
      { id: "1", status: "completed", coach_hidden_at: null },
      { id: "2", status: "in_progress", coach_hidden_at: null },
      { id: "3", status: "completed", coach_hidden_at: null },
    ];

    expect(filterRecentSessionsForCoach(sessions)).toEqual([
      { id: "1", status: "completed", coach_hidden_at: null },
      { id: "3", status: "completed", coach_hidden_at: null },
    ]);
  });

  it("removes sessions hidden by the coach", () => {
    const sessions = [
      { id: "visible", status: "completed", coach_hidden_at: null },
      { id: "hidden", status: "completed", coach_hidden_at: "2026-07-02T18:58:00.000Z" },
    ];

    expect(filterRecentSessionsForCoach(sessions)).toEqual([
      { id: "visible", status: "completed", coach_hidden_at: null },
    ]);
  });
});
