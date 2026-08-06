const MAX_LIBRARY_EXERCISE_NOTES_LENGTH = 2000;

export function sanitizeLibraryExerciseNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LIBRARY_EXERCISE_NOTES_LENGTH);
}

export function getProgramExerciseLibraryIntensity(_color: string | null | undefined): null {
  return null;
}
