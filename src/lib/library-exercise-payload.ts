const MAX_LIBRARY_EXERCISE_NOTES_LENGTH = 2000;

export function sanitizeLibraryExerciseNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LIBRARY_EXERCISE_NOTES_LENGTH);
}

export function getProgramExerciseLibraryIntensity(_color: string | null | undefined): null {
  return null;
}

export function getProgramExerciseColorFromIntensity(
  intensityCode: string | null | undefined,
): "red" | "green" | "yellow" | "lime" | "blue" | null {
  const code = String(intensityCode ?? "")
    .trim()
    .toLowerCase();
  if (!code || code === "non_classe") return null;
  if (code.includes("semi_epuisant") || code.includes("isolation")) return "green";
  if (code.includes("epuisant") || code.includes("force")) return "red";
  if (code.includes("explos") || code.includes("plio")) return "yellow";
  if (code.includes("core") || code.includes("gainage")) return "lime";
  if (code.includes("mobil") || code.includes("prevent")) return "blue";
  return null;
}
