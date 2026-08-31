import { isRunningSessionLabel } from "./running-session-detect";

export type StravaSessionCandidate = {
  id: string;
  date: string | null;
  status: "planned" | "in_progress" | "completed" | string;
  sessionType?: "program" | "free" | "self" | string | null;
  sessionLabel?: string | null;
  hasRunStats?: boolean;
};

export type StravaMatchResult =
  | {
      status: "matched";
      sessionId: string;
      reason:
        | "existing_strava_link"
        | "in_progress_same_day"
        | "planned_same_day"
        | "completed_without_stats_same_day";
    }
  | { status: "ambiguous"; reason: "multiple_same_priority_candidates"; sessionIds: string[] }
  | { status: "none"; reason: "no_candidate" };

function activityDateISO(activityStartedAt: string): string | null {
  const d = new Date(activityStartedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isRunningSession(session: StravaSessionCandidate): boolean {
  if ((session.sessionType ?? "program") === "free") return false;
  return isRunningSessionLabel(session.sessionLabel);
}

export function matchStravaActivityToSession(input: {
  activityStartedAt: string;
  sessions: StravaSessionCandidate[];
}): StravaMatchResult {
  const date = activityDateISO(input.activityStartedAt);
  if (!date) return { status: "none", reason: "no_candidate" };

  const sameDayRunning = input.sessions.filter(
    (session) => session.date === date && isRunningSession(session),
  );

  const inProgress = sameDayRunning.filter((session) => session.status === "in_progress");
  if (inProgress.length === 1) {
    return { status: "matched", sessionId: inProgress[0].id, reason: "in_progress_same_day" };
  }
  if (inProgress.length > 1) {
    return {
      status: "ambiguous",
      reason: "multiple_same_priority_candidates",
      sessionIds: inProgress.map((session) => session.id),
    };
  }

  const planned = sameDayRunning.filter((session) => session.status === "planned");
  if (planned.length === 1) {
    return { status: "matched", sessionId: planned[0].id, reason: "planned_same_day" };
  }
  if (planned.length > 1) {
    return {
      status: "ambiguous",
      reason: "multiple_same_priority_candidates",
      sessionIds: planned.map((session) => session.id),
    };
  }

  const completedWithoutStats = sameDayRunning.filter(
    (session) => session.status === "completed" && !session.hasRunStats,
  );
  if (completedWithoutStats.length === 1) {
    return {
      status: "matched",
      sessionId: completedWithoutStats[0].id,
      reason: "completed_without_stats_same_day",
    };
  }
  if (completedWithoutStats.length > 1) {
    return {
      status: "ambiguous",
      reason: "multiple_same_priority_candidates",
      sessionIds: completedWithoutStats.map((session) => session.id),
    };
  }

  return { status: "none", reason: "no_candidate" };
}
