// Résolution de la structure « effective » d'un programme pour un membre.
//
// Un programme a une structure template (`programs.structure.weeks`), mais chaque
// semaine peut être adaptée par le coach et publiée dans `assignment_weeks`. La
// version adaptée (la plus récente) doit toujours l'emporter — sinon le membre voit
// une séance (côté vue programme, qui fusionne déjà) qui n'existe pas côté planning /
// logger (qui lisaient le template brut) → « le jour X n'existe pas dans le programme ».
//
// Ce helper centralise la fusion pour que la vue programme, le planning et le lanceur
// de séance partagent EXACTEMENT la même structure.

export type WeekDay = {
  label?: string | null;
  type?: string | null;
  exercises?: unknown[] | null;
};
export type WeekLike = { number?: number | null; days?: WeekDay[] | null };
export type StructureLike = { weeks?: WeekLike[] } | null | undefined;
export type AdaptedWeek = { week_number?: number | null; structure?: unknown };

function normalizeDayLabel(label: string | null | undefined) {
  return (label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getDayExercises(weeks: WeekLike[], weekIdx: number, dayIdx: number) {
  const day = weeks[weekIdx]?.days?.[dayIdx];
  return {
    weekIdx,
    day,
    exercises: day?.exercises ?? [],
  };
}

/**
 * Fusionne la structure template avec les semaines adaptées publiées.
 * Les `assignment_weeks` sont indexées par `week_number` (1-based) → position `n - 1`.
 * La version adaptée remplace la semaine template correspondante.
 */
export function mergeAssignmentWeeks(base: StructureLike, adapted: AdaptedWeek[] | null | undefined): WeekLike[] {
  const weeks: WeekLike[] = Array.isArray(base?.weeks) ? [...(base!.weeks as WeekLike[])] : [];
  for (const w of adapted ?? []) {
    const idx = Math.max(0, (w.week_number ?? 1) - 1);
    while (weeks.length <= idx) weeks.push({ days: [] });
    weeks[idx] = (w.structure as WeekLike) ?? { days: [] };
  }
  return weeks;
}

export function resolveSessionExercises(
  base: StructureLike,
  adapted: AdaptedWeek[] | null | undefined,
  weekNumber: number | null | undefined,
  dayNumber: number | null | undefined,
) {
  const weeks = mergeAssignmentWeeks(base, adapted);
  const weekIdx = Math.max(0, weekNumber ?? 0);
  const dayIdx = Math.max(0, (dayNumber ?? 1) - 1);
  return weeks[weekIdx]?.days?.[dayIdx]?.exercises ?? [];
}

/**
 * Résout les exercices d'une séance membre en tolérant les anciennes lignes `sessions`
 * où `week_number` a parfois été stocké en index 0-based, parfois en numéro 1-based.
 *
 * Ordre de résolution :
 * 1. semaine stockée telle quelle
 * 2. semaine précédente (fallback legacy one-based -> zero-based)
 * 3. correspondance unique par libellé dans tout le programme
 *
 * On refuse de "deviner" si plusieurs semaines possibles portent le même libellé.
 */
export function resolveMemberSessionExercises(
  base: StructureLike,
  adapted: AdaptedWeek[] | null | undefined,
  weekNumber: number | null | undefined,
  dayNumber: number | null | undefined,
  sessionLabel?: string | null,
) {
  const weeks = mergeAssignmentWeeks(base, adapted);
  const dayIdx = Math.max(0, (dayNumber ?? 1) - 1);
  const normalizedLabel = normalizeDayLabel(sessionLabel);

  const candidateIndexes = Array.from(
    new Set(
      [weekNumber ?? 0, weekNumber != null ? weekNumber - 1 : null].filter(
        (value): value is number => value != null && value >= 0,
      ),
    ),
  );

  const candidates = candidateIndexes.map((weekIdx) => getDayExercises(weeks, weekIdx, dayIdx));

  if (normalizedLabel) {
    const matchingCandidates = candidates.filter(
      ({ day, exercises }) =>
        exercises.length > 0 && normalizeDayLabel(day?.label) === normalizedLabel,
    );

    if (matchingCandidates.length === 1) {
      return matchingCandidates[0].exercises;
    }

    if (matchingCandidates.length > 1) {
      return [];
    }
  }

  const directCandidate = candidates.find(({ exercises }) => exercises.length > 0);
  if (directCandidate) {
    return directCandidate.exercises;
  }

  if (!normalizedLabel) {
    return [];
  }

  const globalLabelMatches = weeks
    .map((week, weekIdx) => getDayExercises(weeks, weekIdx, dayIdx))
    .filter(
      ({ day, exercises }) =>
        exercises.length > 0 && normalizeDayLabel(day?.label) === normalizedLabel,
    );

  if (globalLabelMatches.length === 1) {
    return globalLabelMatches[0].exercises;
  }

  return [];
}
