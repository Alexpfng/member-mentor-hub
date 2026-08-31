type WeekPlanLike = {
  planned?: Array<Record<string, unknown> & { id?: string | null }>;
};

type PlannedSessionLike = Record<string, unknown> & { id?: string | null };
type SessionWithDateLike = Record<string, unknown> & { date?: string | null };

export function applyPlannedSessionToWeekPlan<T extends WeekPlanLike>(
  state: T | null,
  plannedSession: PlannedSessionLike,
): T | null {
  if (!state) return state;

  const planned = state.planned ?? [];
  const existingIndex = planned.findIndex(
    (session) => session.id != null && session.id === plannedSession.id,
  );
  const nextPlanned =
    existingIndex >= 0
      ? planned.map((session, index) => (index === existingIndex ? plannedSession : session))
      : [...planned, plannedSession];

  return { ...state, planned: nextPlanned };
}

export function groupSessionsByDate<T extends SessionWithDateLike>(
  sessions: T[] | null | undefined,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const session of sessions ?? []) {
    if (!session.date) continue;
    const existing = grouped.get(session.date) ?? [];
    grouped.set(session.date, [...existing, session]);
  }

  return grouped;
}
