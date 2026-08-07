export function getFeedbackWeekCandidates({
  targetWeekNumber,
  basedOnWeek,
}: {
  targetWeekNumber: number | null | undefined;
  basedOnWeek: number | null | undefined;
}) {
  const candidates: number[] = [];
  const add = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value) || value < 1) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  add(basedOnWeek);
  const startWeek = basedOnWeek ?? (targetWeekNumber ?? 0) - 1;
  for (let week = startWeek; week >= 1; week -= 1) {
    add(week);
  }
  add(targetWeekNumber);

  return candidates;
}

export type AdapterExerciseFeedback = {
  rpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
  loadLabel?: string | null;
};

export function mergeExerciseFeedbackMaps(
  maps: Array<Record<string, AdapterExerciseFeedback>>,
) {
  return maps.reduce<Record<string, AdapterExerciseFeedback>>((merged, current) => {
    for (const [key, feedback] of Object.entries(current)) {
      merged[key] = feedback;
    }
    return merged;
  }, {});
}
