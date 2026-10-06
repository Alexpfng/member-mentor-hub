import { describe, expect, it } from "bun:test";
import { buildMemberWeekOverview, getSessionGoalProgress } from "./member-week-overview";

describe("getSessionGoalProgress", () => {
  it("shows half progress and the remaining sessions for a 3 of 6 goal", () => {
    expect(getSessionGoalProgress(3, 6)).toEqual({
      percent: 50,
      remaining: 3,
      complete: false,
      hasTarget: true,
    });
  });

  it("caps progress at the goal and treats a missing goal as neutral", () => {
    expect(getSessionGoalProgress(8, 6)).toEqual({
      percent: 100,
      remaining: 0,
      complete: true,
      hasTarget: true,
    });
    expect(getSessionGoalProgress(0, 0)).toEqual({
      percent: 0,
      remaining: 0,
      complete: false,
      hasTarget: false,
    });
  });
});

describe("buildMemberWeekOverview", () => {
  it("summarizes sessions, explicit rest, and only recorded step goals through today", () => {
    const overview = buildMemberWeekOverview({
      weekDates: [
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ],
      today: "2026-10-06",
      sessionTarget: 2,
      sessions: [
        {
          id: "s1",
          date: "2026-10-05",
          status: "completed",
          session_type: "program",
          session_label: "Full-body 1",
        },
        {
          id: "s2",
          date: "2026-10-06",
          status: "completed",
          session_type: "free",
          session_label: "Libre",
        },
      ],
      planned: [
        { id: "p1", planned_date: "2026-10-06", status: "planned", day_label: "Full-body 2" },
        { id: "p2", planned_date: "2026-10-07", status: "rest", day_label: "Repos" },
      ],
      activity: [
        { date: "2026-10-05", steps: 12000 },
        { date: "2026-10-06", steps: 8000 },
        { date: "2026-10-11", steps: 15000 },
      ],
      stepsGoal: 12000,
    });

    expect(overview.summary).toEqual({
      completedSessions: 1,
      sessionTarget: 2,
      sessionProgress: 50,
      stepGoalsReached: 1,
      stepDaysTracked: 2,
      stepDaysElapsed: 2,
    });
    expect(overview.days[0]).toMatchObject({ workoutState: "completed", stepsState: "met" });
    expect(overview.days[1]).toMatchObject({ workoutState: "planned", stepsState: "short" });
    expect(overview.days[2]).toMatchObject({ workoutState: "rest", stepsState: "upcoming" });
    expect(overview.days[6]).toMatchObject({ workoutState: "open", stepsState: "upcoming" });
  });

  it("does not invent session or step targets when the member has no coach goals", () => {
    const overview = buildMemberWeekOverview({
      weekDates: ["2026-10-05", "2026-10-06"],
      today: "2026-10-05",
      sessionTarget: 0,
      sessions: [],
      planned: [],
      activity: [],
      stepsGoal: null,
    });

    expect(overview.summary).toEqual({
      completedSessions: 0,
      sessionTarget: 0,
      sessionProgress: 0,
      stepGoalsReached: 0,
      stepDaysTracked: 0,
      stepDaysElapsed: 1,
    });
    expect(overview.days[0]).toMatchObject({ workoutState: "open", stepsState: "no-goal" });
    expect(overview.days[1]).toMatchObject({ workoutState: "open", stepsState: "no-goal" });
  });
});
