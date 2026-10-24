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

export function getCoachModificationStatus(modified: boolean) {
  return modified ? "modified" : "not-modified";
}
