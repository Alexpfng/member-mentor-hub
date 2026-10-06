export type MemberWeekSession = {
  id: string;
  date: string | null;
  status: string;
  session_type?: string | null;
  session_label?: string | null;
};

export type MemberWeekPlannedSession = {
  id: string;
  planned_date: string | null;
  status: string;
  day_label: string;
};

export type MemberWeekActivity = {
  date: string;
  steps: number | null;
};

export type MemberWeekDay = {
  date: string;
  workoutState: "completed" | "in_progress" | "planned" | "rest" | "free" | "open";
  workoutLabels: string[];
  steps: number | null;
  stepProgress: number | null;
  stepsState: "met" | "short" | "missing" | "no-goal" | "upcoming";
};

export type MemberWeekOverview = {
  days: MemberWeekDay[];
  summary: {
    completedSessions: number;
    sessionTarget: number;
    sessionProgress: number;
    stepGoalsReached: number;
    stepDaysTracked: number;
    stepDaysElapsed: number;
  };
};

export function getSessionGoalProgress(completed: number, target: number) {
  const hasTarget = target > 0;
  const complete = hasTarget && completed >= target;

  return {
    percent: hasTarget ? Math.min(100, Math.round((Math.max(0, completed) / target) * 100)) : 0,
    remaining: hasTarget ? Math.max(0, target - completed) : 0,
    complete,
    hasTarget,
  };
}

export function buildMemberWeekOverview(input: {
  weekDates: string[];
  today: string;
  sessionTarget: number;
  sessions: MemberWeekSession[];
  planned: MemberWeekPlannedSession[];
  activity: MemberWeekActivity[];
  stepsGoal: number | null;
}): MemberWeekOverview {
  const sessionsByDate = groupByDate(input.sessions);
  const plannedByDate = groupByDate(input.planned);
  const activityByDate = new Map(input.activity.map((day) => [day.date, day]));
  const elapsedDates = input.weekDates.filter((date) => date <= input.today);
  const completedSessions = input.sessions.filter(
    (session) =>
      session.status === "completed" && (session.session_type ?? "program") === "program",
  ).length;
  const stepDaysTracked =
    input.stepsGoal == null
      ? 0
      : elapsedDates.filter((date) => activityByDate.get(date)?.steps != null).length;
  const stepGoalsReached =
    input.stepsGoal == null
      ? 0
      : elapsedDates.filter((date) => {
          const steps = activityByDate.get(date)?.steps;
          return steps != null && steps >= input.stepsGoal!;
        }).length;

  const days = input.weekDates.map((date): MemberWeekDay => {
    const sessions = sessionsByDate.get(date) ?? [];
    const planned = plannedByDate.get(date) ?? [];
    const programSessions = sessions.filter(
      (session) => (session.session_type ?? "program") === "program",
    );
    const active = programSessions.find((session) => session.status === "in_progress");
    const completed = programSessions.some((session) => session.status === "completed");
    const isRest = planned.some((session) => session.status === "rest");
    const isPlanned = planned.some((session) => session.status === "planned");
    const workoutState = active
      ? "in_progress"
      : completed
        ? "completed"
        : isPlanned
          ? "planned"
          : isRest
            ? "rest"
            : sessions.length > 0
              ? "free"
              : "open";
    const workoutLabels = [
      ...programSessions.map((session) => session.session_label).filter(isNonEmpty),
      ...planned
        .filter((session) => session.status === "planned")
        .map((session) => session.day_label)
        .filter(isNonEmpty),
    ].filter((label, index, labels) => labels.indexOf(label) === index);
    const steps = activityByDate.get(date)?.steps ?? null;
    const isUpcoming = date > input.today;
    const stepsState =
      input.stepsGoal == null
        ? "no-goal"
        : isUpcoming
          ? "upcoming"
          : steps == null
            ? "missing"
            : steps >= input.stepsGoal
              ? "met"
              : "short";

    return {
      date,
      workoutState,
      workoutLabels,
      steps,
      stepProgress:
        input.stepsGoal != null && steps != null
          ? Math.min(100, Math.round((steps / input.stepsGoal) * 100))
          : null,
      stepsState,
    };
  });

  return {
    days,
    summary: {
      completedSessions,
      sessionTarget: input.sessionTarget,
      sessionProgress:
        input.sessionTarget > 0
          ? Math.min(100, Math.round((completedSessions / input.sessionTarget) * 100))
          : 0,
      stepGoalsReached,
      stepDaysTracked,
      stepDaysElapsed: elapsedDates.length,
    },
  };
}

function groupByDate<T extends { planned_date?: string | null; date?: string | null }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const date = row.planned_date ?? row.date;
    if (!date) continue;
    const list = grouped.get(date) ?? [];
    list.push(row);
    grouped.set(date, list);
  }
  return grouped;
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
