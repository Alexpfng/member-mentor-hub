export type ExpertSavedStep = {
  exo: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  /** Commentaire libre laissé par le membre au moment de valider la série. */
  note?: string | null;
  /** L'exercice est résolu sans stats, par exemple quand une douleur empêche de le faire. */
  skipped?: "pain" | null;
};

export type SessionProgressStep = {
  index: number;
  exerciseName: string;
  kind: "set" | "emom" | "circuit";
};

export type ExerciseOverviewRow = {
  exerciseName: string;
  state: "done" | "current" | "todo" | "skipped";
  completedSteps: number;
  totalSteps: number;
};

function isSkippedStep(step: ExpertSavedStep | undefined): boolean {
  return step?.skipped === "pain";
}

export function groupExpertRecapByExercise(savedByStep: Record<number, ExpertSavedStep>) {
  const groups = new Map<
    string,
    {
      exerciseName: string;
      rows: Array<{
        stepIdx: number;
        setNumber: number;
        weight: number | null;
        reps: number | null;
        rpe: number | null;
        note?: string | null;
      }>;
    }
  >();

  Object.entries(savedByStep)
    .map(([stepIdx, row]) => ({ stepIdx: Number(stepIdx), row }))
    .sort((a, b) => a.stepIdx - b.stepIdx)
    .forEach(({ stepIdx, row }) => {
      if (isSkippedStep(row)) return;
      const existing = groups.get(row.exo) ?? {
        exerciseName: row.exo,
        rows: [],
      };
      existing.rows.push({
        stepIdx,
        setNumber: existing.rows.length + 1,
        weight: row.weight,
        reps: row.reps,
        rpe: row.rpe,
        note: row.note ?? null,
      });
      groups.set(row.exo, existing);
    });

  return Array.from(groups.values());
}

/** Un exercice a-t-il au moins une étape à logger ? (un intitulé sans série ne
 *  compte pas — rien à faire dessus, donc jamais « en attente »). */
function hasWorkStep(exerciseName: string, steps: SessionProgressStep[]): boolean {
  return steps.some((step) => step.exerciseName === exerciseName);
}

/**
 * Un exercice est TERMINÉ quand toutes ses étapes de travail sont saisies. Un
 * exercice sans étape à logger n'est jamais « terminé » (il n'y a rien à faire,
 * on ne veut pas le compter comme un travail accompli).
 */
export function isExerciseDone(
  exerciseName: string,
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
): boolean {
  const workStepIdxs = steps
    .filter((step) => step.exerciseName === exerciseName)
    .map((step) => step.index);
  if (workStepIdxs.length === 0) return false;
  return workStepIdxs.every(
    (index) => savedByStep[index] != null && !isSkippedStep(savedByStep[index]),
  );
}

function isExerciseSkippedForPain(
  exerciseName: string,
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
): boolean {
  const workStepIdxs = steps
    .filter((step) => step.exerciseName === exerciseName)
    .map((step) => step.index);
  return (
    workStepIdxs.length > 0 && workStepIdxs.every((index) => isSkippedStep(savedByStep[index]))
  );
}

function isExerciseResolved(
  exerciseName: string,
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
): boolean {
  return (
    isExerciseDone(exerciseName, steps, savedByStep) ||
    isExerciseSkippedForPain(exerciseName, steps, savedByStep)
  );
}

/**
 * Tous les exercices à logger sont-ils faits ? Sert à clore la séance dès que
 * plus rien ne reste — où que se trouve le membre — pour ne jamais rester bloqué
 * sur un exo déjà bouclé ni rater l'écran de fin.
 */
export function allExercisesDone(
  exerciseNames: string[],
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
): boolean {
  const toLog = exerciseNames.filter((name) => hasWorkStep(name, steps));
  return toLog.length > 0 && toLog.every((name) => isExerciseResolved(name, steps, savedByStep));
}

/**
 * Prochain exercice NON terminé, dans l'ordre du programme : on cherche d'abord
 * vers l'avant à partir de l'exercice courant, puis on reboucle au début. Les
 * exercices déjà entièrement faits sont sautés — les renvoyer ferait refaire des
 * séries qui portent déjà leur RPE, ce qui embrouille la séance. `null` quand il
 * ne reste plus rien à faire (→ la séance peut se terminer).
 *
 * Sert au renvoi automatique après chaque exercice : le membre n'a plus besoin
 * de repasser par le résumé pour rattraper un exo qu'il a sauté (machine prise),
 * chose facile à oublier en pleine séance.
 */
export function nextUndoneExerciseName(
  exerciseNames: string[],
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
  currentExerciseName: string | null,
): string | null {
  const currentPos = currentExerciseName ? exerciseNames.indexOf(currentExerciseName) : -1;
  // On repart juste après l'exercice courant, puis on reboucle jusqu'à lui inclus.
  const order = [...exerciseNames.slice(currentPos + 1), ...exerciseNames.slice(0, currentPos + 1)];
  for (const name of order) {
    if (hasWorkStep(name, steps) && !isExerciseResolved(name, steps, savedByStep)) return name;
  }
  return null;
}

export function buildExerciseOverview(
  exerciseNames: string[],
  steps: SessionProgressStep[],
  savedByStep: Record<number, ExpertSavedStep>,
  currentStepIdx: number,
): ExerciseOverviewRow[] {
  return exerciseNames.map((exerciseName) => {
    const stepIndexes = steps
      .filter((step) => step.exerciseName === exerciseName)
      .map((step) => step.index);

    const completedSteps = stepIndexes.filter(
      (stepIdx) => savedByStep[stepIdx] && !isSkippedStep(savedByStep[stepIdx]),
    ).length;
    const totalSteps = stepIndexes.length;
    const includesCurrent = stepIndexes.includes(currentStepIdx);
    const skipped =
      totalSteps > 0 && stepIndexes.every((stepIdx) => isSkippedStep(savedByStep[stepIdx]));

    let state: ExerciseOverviewRow["state"] = "todo";
    if (skipped) state = "skipped";
    else if (totalSteps > 0 && completedSteps === totalSteps) state = "done";
    else if (includesCurrent || completedSteps > 0) state = "current";

    return {
      exerciseName,
      state,
      completedSteps,
      totalSteps,
    };
  });
}

export function markExerciseSkippedForPain(
  savedByStep: Record<number, ExpertSavedStep>,
  steps: SessionProgressStep[],
  exerciseName: string,
  reason: string,
): Record<number, ExpertSavedStep> {
  const next = { ...savedByStep };
  const note = reason.trim() || "Douleur signalée";
  steps
    .filter((step) => step.exerciseName === exerciseName)
    .forEach((step) => {
      next[step.index] = {
        exo: exerciseName,
        weight: null,
        reps: null,
        rpe: null,
        skipped: "pain",
        note,
      };
    });
  return next;
}
