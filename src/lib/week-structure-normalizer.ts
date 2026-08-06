import { parseRpeCell } from "@/lib/rpe-cell";

type ProgExerciseLike = {
  name?: string | null;
  color?: string | null;
  block_type?: string | null;
  rpe_target?: string | number | null;
};

type DayLike<TExercise extends ProgExerciseLike = ProgExerciseLike> = {
  label?: string | null;
  exercises?: TExercise[] | null;
};

type WeekStructureLike<TDay extends DayLike = DayLike> = {
  days?: TDay[] | null;
};

const ENDURANCE_SESSION_RE =
  /(course|courir|footing|run(?:ning)?|natation|nage|swim|renfo|renforcement|trail|cardio|endurance|sortie|v[ée]lo|marche)/i;

const BOXING_EXERCISE_RE =
  /(boxe|boxing|corde[ -]a[ -]sauter|corde à sauter|sac[ -]de[ -]frappe|sac de frappe|shadow|pao|pattes?[ -]d['’]?ours|jab|cross|uppercut|crochet)/i;

function isEnduranceLabel(label?: string | null) {
  return ENDURANCE_SESSION_RE.test(label ?? "");
}

function isCardioLikeExercise(exercise: ProgExerciseLike) {
  if ((exercise.block_type ?? "").toLowerCase() === "cardio") return true;
  if (BOXING_EXERCISE_RE.test(exercise.name ?? "")) return true;
  const consigne = parseRpeCell(exercise.rpe_target).consigne;
  return !!(consigne && consigne.length > 3);
}

function inferDetachedDayLabel<TExercise extends ProgExerciseLike>(exercises: TExercise[]) {
  if (exercises.some((exercise) => BOXING_EXERCISE_RE.test(exercise.name ?? ""))) {
    return "Séance boxe";
  }
  return "Séance cardio";
}

function splitAccidentalCardioTail<
  TExercise extends ProgExerciseLike,
  TDay extends DayLike<TExercise>,
>(day: TDay): TDay[] {
  const exercises = [...(day.exercises ?? [])];
  if (exercises.length < 3 || isEnduranceLabel(day.label)) return [day];

  let tailStart = exercises.length;
  while (tailStart > 0 && isCardioLikeExercise(exercises[tailStart - 1])) {
    tailStart -= 1;
  }

  const tail = exercises.slice(tailStart);
  const head = exercises.slice(0, tailStart);

  if (head.length === 0 || tail.length < 2) return [day];
  if (!head.some((exercise) => !isCardioLikeExercise(exercise))) return [day];

  return [
    { ...day, exercises: head } as TDay,
    {
      ...day,
      label: inferDetachedDayLabel(tail),
      exercises: tail,
    } as TDay,
  ];
}

export function normalizeWeekStructure<
  TDay extends DayLike,
  TWeek extends WeekStructureLike<TDay>,
>(structure: TWeek | null | undefined): TWeek {
  const week = (structure ?? { days: [] }) as TWeek;
  const normalizedDays = (week.days ?? []).flatMap((day) => splitAccidentalCardioTail(day));
  return { ...week, days: normalizedDays } as TWeek;
}
