type ProgExerciseLike = { rpe_target?: string | number | null };
type ProgExerciseWithCoachNoteLike = ProgExerciseLike & { coach_notes?: string | null };
type DayLike = { exercises?: ProgExerciseWithCoachNoteLike[] };
type WeekStructureLike = { days?: DayLike[] };

export function setExerciseQuickRpe<T extends WeekStructureLike>(
  structure: T,
  dayIdx: number,
  exoIdx: number,
  rpe: string | number | null,
): T {
  const days = [...(structure.days ?? [])];
  const day = { ...days[dayIdx] };
  const exercises = [...(day.exercises ?? [])];
  exercises[exoIdx] = { ...exercises[exoIdx], rpe_target: rpe };
  day.exercises = exercises;
  days[dayIdx] = day;
  return { ...structure, days };
}

export function setExerciseQuickCoachNote<T extends WeekStructureLike>(
  structure: T,
  dayIdx: number,
  exoIdx: number,
  coachNote: string | null,
): T {
  const days = [...(structure.days ?? [])];
  const day = { ...days[dayIdx] };
  const exercises = [...(day.exercises ?? [])];
  exercises[exoIdx] = { ...exercises[exoIdx], coach_notes: coachNote };
  day.exercises = exercises;
  days[dayIdx] = day;
  return { ...structure, days };
}
