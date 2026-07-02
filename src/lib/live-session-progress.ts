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
