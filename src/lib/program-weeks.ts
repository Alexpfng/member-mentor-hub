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
 * Résout les exercices d'une séance membre.
 *
 * `sessions.week_number` est 1-based (convention DB unifiée — les anciennes lignes
 * 0-based ont été recalées par migration), donc la semaine stockée fait autorité :
 * weekIdx = week_number - 1. Le libellé ne sert plus qu'à rattraper les cas où le
 * coach a réordonné ou renommé des jours depuis le début de la séance.
 *
 * Ordre de résolution :
 * 1. position exacte (semaine + jour) si le libellé concorde (ou sans libellé)
 * 2. même semaine, jour retrouvé par libellé (jours réordonnés)
 * 3. position exacte malgré un libellé différent (jour renommé)
 * 4. libellé unique dans tout le programme (dernier recours)
 */
export function resolveMemberSessionExercises(
  base: StructureLike,
  adapted: AdaptedWeek[] | null | undefined,
  weekNumber: number | null | undefined,
  dayNumber: number | null | undefined,
  sessionLabel?: string | null,
) {
  const weeks = mergeAssignmentWeeks(base, adapted);
  const weekIdx = Math.max(0, (weekNumber ?? 1) - 1);
  const dayIdx = Math.max(0, (dayNumber ?? 1) - 1);
  const normalizedLabel = normalizeDayLabel(sessionLabel);

  const days = weeks[weekIdx]?.days ?? [];
  const direct = days[dayIdx];
  const directExercises = direct?.exercises ?? [];

  if (
    directExercises.length > 0 &&
    (!normalizedLabel || normalizeDayLabel(direct?.label) === normalizedLabel)
  ) {
    return directExercises;
  }

  if (normalizedLabel) {
    const byLabel = days.find(
      (d) => (d?.exercises?.length ?? 0) > 0 && normalizeDayLabel(d?.label) === normalizedLabel,
    );
    if (byLabel) return byLabel.exercises ?? [];
  }

  if (directExercises.length > 0) return directExercises;

  if (normalizedLabel) {
    const matches = weeks.flatMap((w) =>
      (w?.days ?? []).filter(
        (d) => (d?.exercises?.length ?? 0) > 0 && normalizeDayLabel(d?.label) === normalizedLabel,
      ),
    );
    if (matches.length === 1) return matches[0].exercises ?? [];
  }

  return [];
}
