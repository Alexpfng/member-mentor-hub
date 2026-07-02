type ProgExerciseLike = { rpe_target?: string | number | null };
type DayLike = { exercises?: ProgExerciseLike[] };
type WeekStructureLike = { days?: DayLike[] };

export function setExerciseQuickRpe<T extends WeekStructureLike>(
  structure: T,
  dayIdx: number,
  exoIdx: number,
  rpe: number | null,
): T {
  const days = [...(structure.days ?? [])];
  const day = { ...days[dayIdx] };
  const exercises = [...(day.exercises ?? [])];
  exercises[exoIdx] = { ...exercises[exoIdx], rpe_target: rpe };
  day.exercises = exercises;
  days[dayIdx] = day;
  return { ...structure, days };
}
