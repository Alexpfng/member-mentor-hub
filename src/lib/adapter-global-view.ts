export function describeGlobalDay(day: {
  label?: string | null;
  exercises?: Array<{ name?: string | null }> | null;
}) {
  const label = day.label?.trim() || "Séance";
  const names = (day.exercises ?? []).map((exercise) => exercise.name?.trim()).filter(Boolean);
  return {
    label: `${label} · ${names.length} exercice${names.length > 1 ? "s" : ""}`,
    contents: names.length ? names.join(" · ") : "Aucun exercice",
  };
}

export function describeGlobalRpe(setRpes: number[], memberRpeHidden = false) {
  return { member: !memberRpeHidden && setRpes.length ? setRpes.join(", ") : null };
}

type ModificationComparableExercise = {
  code?: string | null;
  name?: string | null;
  block_type?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
};

const PRESCRIPTION_FIELDS = [
  "name",
  "block_type",
  "series",
  "reps",
  "charge",
  "tempo",
  "recup",
  "rpe_target",
] as const;

function comparableValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value).trim().replace(/,/g, ".");
}

export function isExercisePrescriptionModified(
  current: ModificationComparableExercise,
  previous: ModificationComparableExercise | null,
) {
  if (!previous) return true;
  return PRESCRIPTION_FIELDS.some(
    (field) => comparableValue(current[field]) !== comparableValue(previous[field]),
  );
}

export function findPreviousExerciseForModification(
  current: ModificationComparableExercise,
  previousExercises: ModificationComparableExercise[] | null | undefined,
  currentIndex: number,
) {
  if (!previousExercises?.length) return null;
  const code = String(current.code ?? "").trim().toUpperCase();
  if (code) {
    const codedMatch = previousExercises.find(
      (exercise) => String(exercise.code ?? "").trim().toUpperCase() === code,
    );
    if (codedMatch) return codedMatch;
  }

  const name = String(current.name ?? "").trim().toLocaleLowerCase();
  const namedMatches = previousExercises.filter(
    (exercise) => String(exercise.name ?? "").trim().toLocaleLowerCase() === name,
  );
  if (namedMatches.length) {
    const sameIndex = previousExercises[currentIndex];
    if (sameIndex && String(sameIndex.name ?? "").trim().toLocaleLowerCase() === name) {
      return sameIndex;
    }
    return namedMatches[0];
  }

  return null;
}

export function getCoachModificationStatus(modified: boolean) {
  return modified ? "modified" : "not-modified";
}
