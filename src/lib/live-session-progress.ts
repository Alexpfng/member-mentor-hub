export type ExpertSavedStep = {
  exo: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
};

export type SessionProgressStep = {
  index: number;
  exerciseName: string;
  kind: "set" | "emom" | "circuit";
};

export type ExerciseOverviewRow = {
  exerciseName: string;
  state: "done" | "current" | "todo";
  completedSteps: number;
  totalSteps: number;
};

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
      }>;
    }
  >();

  Object.entries(savedByStep)
    .map(([stepIdx, row]) => ({ stepIdx: Number(stepIdx), row }))
    .sort((a, b) => a.stepIdx - b.stepIdx)
    .forEach(({ stepIdx, row }) => {
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
      });
      groups.set(row.exo, existing);
    });

  return Array.from(groups.values());
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
    const workStepIdxs = steps
      .filter((step) => step.exerciseName === name)
      .map((step) => step.index);
    if (workStepIdxs.length === 0) continue; // aucun travail à logger → rien à rattraper
    const done = workStepIdxs.every((index) => savedByStep[index] != null);
    if (!done) return name;
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

    const completedSteps = stepIndexes.filter((stepIdx) => savedByStep[stepIdx]).length;
    const totalSteps = stepIndexes.length;
    const includesCurrent = stepIndexes.includes(currentStepIdx);

    let state: ExerciseOverviewRow["state"] = "todo";
    if (totalSteps > 0 && completedSteps === totalSteps) state = "done";
    else if (includesCurrent || completedSteps > 0) state = "current";

    return {
      exerciseName,
      state,
      completedSteps,
      totalSteps,
    };
  });
}
