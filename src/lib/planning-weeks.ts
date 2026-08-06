import { addDaysISO, localDateISO } from "@/lib/local-date";
import { mondayOf } from "@/lib/streak";

function isoUtc(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function currentPlanningWeekNumber(
  assignmentStartDate: string | null | undefined,
  todayISO: string = localDateISO(),
) {
  const startISO = assignmentStartDate?.slice(0, 10) ?? todayISO;
  const anchorMonday = mondayOf(startISO);
  const todayMonday = mondayOf(todayISO);
  const diffDays = Math.floor(
    (isoUtc(todayMonday).getTime() - isoUtc(anchorMonday).getTime()) / 86400000,
  );
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export function planningWeekBounds(
  assignmentStartDate: string | null | undefined,
  weekNumber: number,
) {
  const startISO = assignmentStartDate?.slice(0, 10) ?? localDateISO();
  const anchorMonday = mondayOf(startISO);
  const weekStart = addDaysISO(anchorMonday, Math.max(0, weekNumber - 1) * 7);
  const weekEnd = addDaysISO(weekStart, 6);
  return { weekStart, weekEnd };
}
