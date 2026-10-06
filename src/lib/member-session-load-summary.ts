type SetLogRow = {
  session_id: string | null;
  exercise_name: string | null;
  weight_kg: number | null;
  logged_at?: string | null;
};

export type SessionLoadSummary = {
  exerciseName: string;
  loadLabel: string;
};

function formatKg(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 10) / 10).replace(".", ",");
}

function formatLoadLabel(weights: number[]) {
  const unique = [...new Set(weights.map((value) => Math.round(value * 10) / 10))].sort(
    (a, b) => a - b,
  );
  if (unique.length === 0) return null;
  if (unique.length === 1) return `${formatKg(unique[0])}kg`;
  return `${formatKg(unique[0])}–${formatKg(unique[unique.length - 1])}kg`;
}

export function buildSessionLoadSummaries(
  logs: SetLogRow[],
): Record<string, SessionLoadSummary[]> {
  const bySession = new Map<string, Map<string, number[]>>();

  for (const row of logs) {
    if (!row.session_id || !row.exercise_name || row.weight_kg == null) continue;
    const weight = Number(row.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) continue;

    if (!bySession.has(row.session_id)) bySession.set(row.session_id, new Map());
    const exercises = bySession.get(row.session_id)!;
    if (!exercises.has(row.exercise_name)) exercises.set(row.exercise_name, []);
    exercises.get(row.exercise_name)!.push(weight);
  }

  return Object.fromEntries(
    [...bySession.entries()].map(([sessionId, exercises]) => [
      sessionId,
      [...exercises.entries()].flatMap(([exerciseName, weights]) => {
        const loadLabel = formatLoadLabel(weights);
        return loadLabel ? [{ exerciseName, loadLabel }] : [];
      }),
    ]),
  );
}
