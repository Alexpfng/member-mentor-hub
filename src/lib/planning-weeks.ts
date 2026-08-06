import { addDaysISO, localDateISO } from "@/lib/local-date";
import { mondayOf } from "@/lib/streak";

function isoUtc(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export type PlanningWeekOptions = {
  weekStartsOn?: number | null;
};

export const WEEK_START_OPTIONS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
] as const;

export function normalizeWeekStartsOn(weekStartsOn?: number | null) {
  if (typeof weekStartsOn !== "number" || !Number.isInteger(weekStartsOn)) return 1;
  return weekStartsOn >= 1 && weekStartsOn <= 7 ? weekStartsOn : 1;
}

function weekStartsOnToUtcDay(weekStartsOn?: number | null) {
  const normalized = normalizeWeekStartsOn(weekStartsOn);
  return normalized === 7 ? 0 : normalized;
}

function currentCustomWeekStart(iso: string, options?: PlanningWeekOptions) {
  const desiredUtcDay = weekStartsOnToUtcDay(options?.weekStartsOn);
  const base = isoUtc(iso);
  const currentUtcDay = base.getUTCDay();
  const diff = (currentUtcDay - desiredUtcDay + 7) % 7;
  base.setUTCDate(base.getUTCDate() - diff);
  return base.toISOString().slice(0, 10);
}

function assignmentWeekAnchor(iso: string, options?: PlanningWeekOptions) {
  const monday = mondayOf(iso);
  const offsetDays = normalizeWeekStartsOn(options?.weekStartsOn) - 1;
  return addDaysISO(monday, offsetDays);
}

export function weekWindowLabel(weekStartsOn?: number | null) {
  const normalized = normalizeWeekStartsOn(weekStartsOn);
  const start = WEEK_START_OPTIONS.find((opt) => opt.value === normalized)?.label ?? "Lundi";
  const endValue = normalized === 7 ? 6 : normalized - 1;
  const end = WEEK_START_OPTIONS.find((opt) => opt.value === endValue)?.label ?? "Dimanche";
  return `${start.toLowerCase()} → ${end.toLowerCase()}`;
}

export function currentPlanningWeekNumber(
  assignmentStartDate: string | null | undefined,
  todayISO: string = localDateISO(),
  options?: PlanningWeekOptions,
) {
  const startISO = assignmentStartDate?.slice(0, 10) ?? todayISO;
  const anchorWeekStart = assignmentWeekAnchor(startISO, options);
  const todayWeekStart = currentCustomWeekStart(todayISO, options);
  const diffDays = Math.floor(
    (isoUtc(todayWeekStart).getTime() - isoUtc(anchorWeekStart).getTime()) / 86400000,
  );
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export function planningWeekBounds(
  assignmentStartDate: string | null | undefined,
  weekNumber: number,
  options?: PlanningWeekOptions,
) {
  const startISO = assignmentStartDate?.slice(0, 10) ?? localDateISO();
  const anchorWeekStart = assignmentWeekAnchor(startISO, options);
  const weekStart = addDaysISO(anchorWeekStart, Math.max(0, weekNumber - 1) * 7);
  const weekEnd = addDaysISO(weekStart, 6);
  return { weekStart, weekEnd };
}
