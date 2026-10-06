import { parseRpeCell } from "@/lib/rpe-cell";

type CoachEditableExercise = {
  name?: string | null;
  code?: string | null;
  block_type?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
  coach_notes?: string | null;
};

type CoachEditableDay<TExercise extends CoachEditableExercise = CoachEditableExercise> = {
  label?: string | null;
  exercises?: TExercise[] | null;
};

type CoachEditableWeek<TDay extends CoachEditableDay = CoachEditableDay> = {
  days?: TDay[] | null;
};

function mergeCoachNote(existing: string | null | undefined, consigne: string) {
  const current = (existing ?? "").trim();
  const note = consigne.trim();
  if (!note) return current || null;
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current}\n${note}`;
}

export function normalizeCoachEditableExercise<TExercise extends CoachEditableExercise>(
  exercise: TExercise,
): TExercise {
  const consigne = parseRpeCell(exercise.rpe_target).consigne?.trim();
  if (!consigne) return exercise;

  return {
    ...exercise,
    rpe_target: null,
    coach_notes: mergeCoachNote(exercise.coach_notes, consigne),
  };
}

const ENDURANCE_SESSION_RE =
  /(course|running|endurance|fractionn|footing|trail|run|ef\b|fondamentale|natation|velo|vélo|bike|cardio)/i;
const INSTRUCTION_LINE_RE =
  /^(objectif|consigne|travail|maintien|developper|développer|echauffer|échauffer|recup|récup|retour|allure)\b/i;

function isEmptyMetric(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return !text || text === "-" || text === "—" || text === "–" || /^-+$/.test(text);
}

function looksLikeEnduranceInstruction(exercise: CoachEditableExercise): boolean {
  const name = String(exercise.name ?? "").trim();
  if (!name) return false;
  if (exercise.code || String(exercise.block_type ?? "").toLowerCase() === "emom") return false;
  if (/^(bloc|block)\b/i.test(name)) return false;
  if (/^[A-Z]\d?\s*[.:]/.test(name)) return false;
  if (!isEmptyMetric(exercise.series) && !isEmptyMetric(exercise.reps)) return false;
  return INSTRUCTION_LINE_RE.test(name) || /^[a-zàâäéèêëîïôöùûüç]/.test(name);
}

function enduranceInstructionText(exercise: CoachEditableExercise): string {
  const parts = [String(exercise.name ?? "").trim()];
  if (!isEmptyMetric(exercise.recup)) parts.push(`Récup : ${String(exercise.recup).trim()}`);
  if (!isEmptyMetric(exercise.tempo)) parts.push(`Allure : ${String(exercise.tempo).trim()}`);
  if (!isEmptyMetric(exercise.charge)) parts.push(`Intensité : ${String(exercise.charge).trim()}`);
  const consigne = parseRpeCell(exercise.rpe_target).consigne?.trim();
  if (consigne) parts.push(consigne);
  if (exercise.coach_notes?.trim()) parts.push(exercise.coach_notes.trim());
  return parts.filter(Boolean).join(" — ");
}

export function normalizeCoachEditableWeek<TWeek>(structure: TWeek | null | undefined): TWeek {
  const week = (structure ?? { days: [] }) as CoachEditableWeek;
  const days = (week.days ?? []).map((day) => ({
    ...day,
    exercises: (day.exercises ?? []).reduce<CoachEditableExercise[]>((acc, exercise) => {
      const normalized = normalizeCoachEditableExercise(exercise);
      const isEnduranceDay = ENDURANCE_SESSION_RE.test(day.label ?? "");
      const previous = acc[acc.length - 1];
      if (isEnduranceDay && previous && looksLikeEnduranceInstruction(normalized)) {
        previous.coach_notes = mergeCoachNote(
          previous.coach_notes,
          enduranceInstructionText(normalized),
        );
        return acc;
      }
      acc.push(normalized);
      return acc;
    }, []),
  }));
  return { ...week, days } as TWeek;
}
