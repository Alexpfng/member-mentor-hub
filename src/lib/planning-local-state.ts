type WeekPlanLike = {
  planned?: Array<Record<string, unknown> & { id?: string | null }>;
};

type PlannedSessionLike = Record<string, unknown> & { id?: string | null };

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
