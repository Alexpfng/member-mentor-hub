type ProgExerciseLike = {
  rpe_target?: string | number | null;
  rpe_cleared?: boolean | null;
  member_rpe_hidden?: boolean | null;
};
type ProgExerciseWithCoachNoteLike = ProgExerciseLike & { coach_notes?: string | null };
type DayLike = { exercises?: ProgExerciseWithCoachNoteLike[] };
type WeekStructureLike = { days?: DayLike[] };

function isNumericCoachRpe(value: string | number | null | undefined) {
  const stringValue = String(value ?? "").trim();
  return stringValue !== "" && !Number.isNaN(Number(stringValue.replace(",", ".")));
}

export function setExerciseQuickRpe<T extends WeekStructureLike>(
  structure: T,
  dayIdx: number,
  exoIdx: number,
  rpe: string | number | null,
): T {
  const days = [...(structure.days ?? [])];
  const day = { ...days[dayIdx] };
  const exercises = [...(day.exercises ?? [])];
  exercises[exoIdx] = {
    ...exercises[exoIdx],
    rpe_target: rpe,
    rpe_cleared: rpe == null,
    member_rpe_hidden: rpe == null,
  };
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

export function resetWeekExerciseRpeTargets<T extends WeekStructureLike>(structure: T): T {
  return {
    ...structure,
    days: (structure.days ?? []).map((day) => ({
      ...day,
      exercises: (day.exercises ?? []).map((exercise) => ({
        ...exercise,
        rpe_target: isNumericCoachRpe(exercise.rpe_target) ? null : exercise.rpe_target,
        rpe_cleared: true,
        member_rpe_hidden: true,
      })),
    })),
  };
}
