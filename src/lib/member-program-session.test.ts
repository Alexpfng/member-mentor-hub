import { describe, expect, it } from "bun:test";
import { getProgramSessionDayNumber, mapCurrentProgramSessions } from "./member-program-session";

describe("getProgramSessionDayNumber", () => {
  it("uses the session position rather than a possibly duplicated display number", () => {
    expect(getProgramSessionDayNumber(3)).toBe(4);
    expect(getProgramSessionDayNumber(4)).toBe(5);
  });
});

describe("mapCurrentProgramSessions", () => {
  const weeks = [{ days: [{}, {}, {}] }, { days: [{}, {}] }];

  it("ignores other programs, prior-cycle sessions, and out-of-range weeks", () => {
    const mapped = mapCurrentProgramSessions(
      [
        {
          id: "old-program",
          program_id: "old",
          week_number: 2,
          day_number: 1,
          status: "completed",
          date: "2026-09-01",
          started_at: "2026-09-01T10:00:00Z",
          ended_at: "2026-09-01T11:00:00Z",
        },
        {
          id: "stale-week",
          program_id: "active",
          week_number: 3,
          day_number: 1,
          status: "completed",
          date: "2026-10-06",
          started_at: "2026-10-06T10:00:00Z",
          ended_at: "2026-10-06T11:00:00Z",
        },
        {
          id: "same-program-prior-cycle",
          program_id: "active",
          week_number: 2,
          day_number: 2,
          status: "completed",
          date: "2026-09-15",
          started_at: "2026-09-15T10:00:00Z",
          ended_at: "2026-09-15T11:00:00Z",
        },
        {
          id: "planned-slot",
          program_id: "active",
          week_number: 2,
          day_number: 1,
          status: "in_progress",
          date: "2026-10-06",
          started_at: "2026-10-06T10:00:00Z",
          ended_at: null,
        },
        {
          id: "not-finished",
          program_id: "active",
          week_number: 2,
          day_number: 2,
          status: "completed",
          date: "2026-10-06",
          started_at: "2026-10-06T10:00:00Z",
          ended_at: null,
        },
      ],
      weeks,
      "active",
      "2026-09-28",
      1,
    );

    expect(mapped).toEqual({ "2-1": { id: "planned-slot", status: "in_progress" } });
  });

  it("does not count more completed slots than the active program contains", () => {
    const mapped = mapCurrentProgramSessions(
      [
        { id: "s1", program_id: "active", week_number: 1, day_number: 1, status: "completed", date: "2026-09-28", started_at: "2026-09-28T10:00:00Z", ended_at: "2026-09-28T11:00:00Z" },
        { id: "s2", program_id: "active", week_number: 1, day_number: 2, status: "completed", date: "2026-09-29", started_at: "2026-09-29T10:00:00Z", ended_at: "2026-09-29T11:00:00Z" },
        { id: "s3", program_id: "active", week_number: 1, day_number: 3, status: "completed", date: "2026-09-30", started_at: "2026-09-30T10:00:00Z", ended_at: "2026-09-30T11:00:00Z" },
        {
          id: "outside-day",
          program_id: "active",
          week_number: 1,
          day_number: 4,
          status: "completed",
          date: "2026-10-01",
          started_at: "2026-10-01T10:00:00Z",
          ended_at: "2026-10-01T11:00:00Z",
        },
      ],
      weeks,
      "active",
      "2026-09-28",
      1,
    );

    expect(Object.values(mapped).filter((session) => session.status === "completed")).toHaveLength(
      3,
    );
  });

  it("maps only the latest real in-progress session and keeps planned slots out of that state", () => {
    const mapped = mapCurrentProgramSessions(
      [
        {
          id: "older-active-session",
          program_id: "active",
          week_number: 4,
          day_number: 2,
          status: "in_progress",
          date: "2026-10-21",
          started_at: "2026-10-20T08:00:00Z",
          ended_at: null,
        },
        {
          id: "current-active-session",
          program_id: null,
          week_number: 4,
          day_number: 1,
          status: "in_progress",
          date: "2026-10-20",
          started_at: "2026-10-20T09:00:00Z",
          ended_at: null,
        },
      ],
      Array.from({ length: 4 }, () => ({ days: [{}, {}, {}, {}] })),
      "active",
      "2026-09-28",
      1,
    );

    expect(mapped).toEqual({ "4-1": { id: "current-active-session", status: "in_progress" } });
  });
});
