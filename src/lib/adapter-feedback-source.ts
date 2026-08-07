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
  add((targetWeekNumber ?? 0) - 1);
  add(targetWeekNumber);

  return candidates;
}
