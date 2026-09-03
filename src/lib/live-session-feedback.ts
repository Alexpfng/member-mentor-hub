import type { Database } from "@/integrations/supabase/types";
import type { ExpertSavedStep } from "./live-session-progress";

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

/**
 * Mode assisté : le RPE est déjà saisi série par série (set_logs), on ne
 * réécrit donc PAS de RPE de bloc — seul le commentaire libre du membre est
 * remonté au coach. Les exercices sans commentaire ne produisent aucune ligne.
 */
export function buildMemberCommentFeedbackRows(
  sessionId: string,
  groups: ExpertRecapGroupLike[],
  commentByExercise: Record<string, string>,
): ExerciseFeedbackInsert[] {
  return groups
    .map((group) => ({
      group,
      comment: trimOptionalComment(commentByExercise[group.exerciseName]),
    }))
    .filter((entry) => entry.comment != null)
    .map((entry) => ({
      session_id: sessionId,
      exercise_name: entry.group.exerciseName,
      member_comment: entry.comment,
    }));
}

export function buildSkippedPainFeedbackRows(
  sessionId: string,
  savedByStep: Record<number, ExpertSavedStep>,
): ExerciseFeedbackInsert[] {
  const byExercise = new Map<string, string | null>();

  Object.values(savedByStep).forEach((row) => {
    if (row.skipped !== "pain") return;
    if (byExercise.has(row.exo)) return;
    byExercise.set(row.exo, trimOptionalComment(row.note));
  });

  return Array.from(byExercise.entries()).map(([exerciseName, note]) => ({
    session_id: sessionId,
    exercise_name: exerciseName,
    rpe: null,
    could_not_do: true,
    felt_too_hard: true,
    member_comment: note ? `Douleur signalée : ${note}` : "Douleur signalée : exercice non fait",
  }));
}

export function buildEarlyFinishMemberNote(
  existingNote: string | null | undefined,
  unfinishedExerciseNames: string[],
  reason: string,
): string {
  const current = trimOptionalComment(existingNote);
  const names = unfinishedExerciseNames.length
    ? unfinishedExerciseNames.join(", ")
    : "non précisés";
  const finishNote = `Séance terminée avant la fin. Exercices non faits : ${names}. Raison : ${reason.trim()}`;
  return current ? `${current}\n\n${finishNote}` : finishNote;
}
