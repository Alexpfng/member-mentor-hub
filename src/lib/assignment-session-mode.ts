export type AssignmentSessionMode = "expert" | "debutant";

export function normalizeAssignmentSessionMode(
  mode: string | null | undefined,
): AssignmentSessionMode {
  return mode === "expert" ? "expert" : "debutant";
}

export function preserveAssignmentSessionMode(
  previousMode: string | null | undefined,
): AssignmentSessionMode {
  return normalizeAssignmentSessionMode(previousMode);
}
