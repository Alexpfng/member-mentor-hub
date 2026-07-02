export type ExerciseFeedback = {
  rpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
};

export function normalizeExerciseFeedbackKey(name: string | null | undefined) {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getExerciseFeedback(
  feedback: Record<string, ExerciseFeedback>,
  exerciseName: string | null | undefined,
) {
  return feedback[normalizeExerciseFeedbackKey(exerciseName)];
}
