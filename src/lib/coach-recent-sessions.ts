export function filterRecentSessionsForCoach<T extends { status: string | null; coach_hidden_at?: string | null }>(sessions: T[]) {
  return sessions.filter((session) => session.status === "completed" && !session.coach_hidden_at);
}
