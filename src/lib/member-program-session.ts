import { planningWeekBounds, normalizeWeekStartsOn } from "@/lib/planning-weeks";

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
) {
  const mapped: Record<string, { id: string; status: string }> = {};
  if (!activeProgramId) return mapped;

  for (const session of sessions) {
    const week = session.week_number == null ? null : weeks[session.week_number - 1];
    const day = session.day_number == null ? null : week?.days?.[session.day_number - 1];
    if (
      session.program_id !== activeProgramId ||
      !week ||
      !day ||
      day.type === "Repos" ||
      !session.date ||
      !session.started_at ||
      (session.status !== "in_progress" &&
        (session.status !== "completed" || !session.ended_at))
    ) {
      continue;
    }

    const bounds = planningWeekBounds(assignmentStartDate, session.week_number!, {
      weekStartsOn: normalizeWeekStartsOn(weekStartsOn),
    });
    if (session.date < bounds.weekStart || session.date > bounds.weekEnd) continue;

    const key = `${session.week_number}-${session.day_number}`;
    const previous = mapped[key];
    if (
      !previous ||
      session.status === "in_progress" ||
      (previous.status !== "in_progress" && session.status === "completed")
    ) {
      mapped[key] = { id: session.id, status: session.status };
    }
  }

  return mapped;
}
