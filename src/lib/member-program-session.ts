import {
  planningWeekBounds,
  planningWeekBoundsForPublishedWeek,
  normalizeWeekStartsOn,
} from "@/lib/planning-weeks";

export function getProgramSessionDayNumber(dayIndex: number) {
  return dayIndex + 1;
}

type ProgramWeek = { days?: Array<{ type?: string | null } | null> | null } | null;
type ProgramSession = {
  id: string;
  program_id: string | null;
  week_number: number | null;
  day_number: number | null;
  status: string;
  date: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export function mapCurrentProgramSessions(
  sessions: ProgramSession[],
  weeks: ProgramWeek[],
  activeProgramId: string | null | undefined,
  assignmentStartDate: string | null | undefined,
  weekStartsOn?: number | null,
  publishedWeekStartDates?: Record<number, string | null | undefined>,
) {
  const mapped: Record<string, { id: string; status: string }> = {};
  if (!activeProgramId) return mapped;

  const activeSession = sessions
    .filter(
      (session) =>
        (session.program_id === activeProgramId || session.program_id == null) &&
        session.status === "in_progress" &&
        session.started_at,
    )
    .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))[0];

  for (const session of sessions) {
    const week = session.week_number == null ? null : weeks[session.week_number - 1];
    const day = session.day_number == null ? null : week?.days?.[session.day_number - 1];
    if (
      !week ||
      !day ||
      day.type === "Repos" ||
      !session.date ||
      (assignmentStartDate && session.date < assignmentStartDate.slice(0, 10)) ||
      session.status !== "completed" ||
      !session.started_at ||
      !session.ended_at
    ) {
      continue;
    }

    const options = {
      weekStartsOn: normalizeWeekStartsOn(weekStartsOn),
    };
    const publishedBounds = planningWeekBoundsForPublishedWeek(
      assignmentStartDate,
      session.week_number!,
      publishedWeekStartDates?.[session.week_number!],
      options,
    );
    const assignmentBounds = planningWeekBounds(assignmentStartDate, session.week_number!, options);
    const isInPublishedWeek =
      session.date >= publishedBounds.weekStart && session.date <= publishedBounds.weekEnd;
    const isInAssignmentWeek =
      session.date >= assignmentBounds.weekStart && session.date <= assignmentBounds.weekEnd;
    if (!isInPublishedWeek && !isInAssignmentWeek) continue;

    const key = `${session.week_number}-${session.day_number}`;
    mapped[key] = { id: session.id, status: session.status };
  }

  if (activeSession) {
    const week = activeSession.week_number == null ? null : weeks[activeSession.week_number - 1];
    const day =
      activeSession.day_number == null ? null : week?.days?.[activeSession.day_number - 1];
    if (week && day && day.type !== "Repos") {
      mapped[`${activeSession.week_number}-${activeSession.day_number}`] = {
        id: activeSession.id,
        status: activeSession.status,
      };
    }
  }

  return mapped;
}
