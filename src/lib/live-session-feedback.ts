import type { Database } from "@/integrations/supabase/types";

type ExerciseFeedbackInsert = Database["public"]["Tables"]["exercise_feedbacks"]["Insert"];

type ExpertRecapGroupLike = {
  exerciseName: string;
  rows: Array<{
    stepIdx: number;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
  }>;
};

export function normalizeExpertRpeForStorage(value: number | null): number | null {
  if (value == null) return null;
  return value > 10 ? 10 : value;
}

export function trimOptionalComment(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function buildExpertExerciseFeedbackRows(
  sessionId: string,
  groups: ExpertRecapGroupLike[],
  rpeByExercise: Record<string, number | null>,
  commentByExercise: Record<string, string>,
): ExerciseFeedbackInsert[] {
  return groups.map((group) => {
    const selectedRpe = rpeByExercise[group.exerciseName] ?? null;
    const couldNotDo = selectedRpe != null && selectedRpe > 10;

    return {
      session_id: sessionId,
      exercise_name: group.exerciseName,
      rpe: normalizeExpertRpeForStorage(selectedRpe),
      could_not_do: couldNotDo,
      felt_too_hard: couldNotDo,
      member_comment: trimOptionalComment(commentByExercise[group.exerciseName]),
    };
  });
}
