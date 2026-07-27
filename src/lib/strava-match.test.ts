import { describe, expect, it } from "bun:test";
import { matchStravaActivityToSession } from "./strava-match";

type Candidate = Parameters<typeof matchStravaActivityToSession>[0]["sessions"][number];

function candidate(patch: Partial<Candidate> = {}): Candidate {
  return {
    id: "session-1",
    date: "2026-07-27",
    status: "planned",
    sessionType: "program",
    sessionLabel: "Séance course endurance fondamentale",
    hasRunStats: false,
    ...patch,
  };
}

describe("matchStravaActivityToSession", () => {
  it("prioritizes the in-progress running session on the same day", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T08:15:00Z",
      sessions: [
        candidate({ id: "planned-run", status: "planned" }),
        candidate({ id: "live-run", status: "in_progress" }),
      ],
    });

    expect(result).toEqual({
      status: "matched",
      sessionId: "live-run",
      reason: "in_progress_same_day",
    });
  });

  it("matches a planned running session when there is no in-progress one", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T18:30:00Z",
      sessions: [candidate({ id: "planned-run", status: "planned" })],
    });

    expect(result).toEqual({
      status: "matched",
      sessionId: "planned-run",
      reason: "planned_same_day",
    });
  });

  it("matches a completed running session on the same day if it has no run stats yet", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T18:30:00Z",
      sessions: [candidate({ id: "done-run", status: "completed", hasRunStats: false })],
    });

    expect(result).toEqual({
      status: "matched",
      sessionId: "done-run",
      reason: "completed_without_stats_same_day",
    });
  });

  it("ignores sessions that already have run stats", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T18:30:00Z",
      sessions: [candidate({ id: "done-run", status: "completed", hasRunStats: true })],
    });

    expect(result).toEqual({
      status: "none",
      reason: "no_candidate",
    });
  });

  it("ignores non-running sessions even on the same day", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T18:30:00Z",
      sessions: [candidate({ sessionLabel: "Upper body 1", id: "upper-1" })],
    });

    expect(result).toEqual({
      status: "none",
      reason: "no_candidate",
    });
  });

  it("returns ambiguous when several same-priority running sessions exist on the same day", () => {
    const result = matchStravaActivityToSession({
      activityStartedAt: "2026-07-27T18:30:00Z",
      sessions: [
        candidate({ id: "run-a", status: "planned", sessionLabel: "Séance course basse intensité" }),
        candidate({ id: "run-b", status: "planned", sessionLabel: "Séance course type fartlek" }),
      ],
    });

    expect(result).toEqual({
      status: "ambiguous",
      reason: "multiple_same_priority_candidates",
      sessionIds: ["run-a", "run-b"],
    });
  });
});
