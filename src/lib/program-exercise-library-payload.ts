import {
  getProgramExerciseLibraryIntensity,
  sanitizeLibraryExerciseNotes,
} from "./library-exercise-payload";

type ProgramExerciseLibrarySource = {
  name: string;
  color?: string | null;
  tempo?: string | null;
  youtube_url?: string | null;
  coach_notes?: string | null;
};

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

export function toProgramExerciseLibraryPayload(exercise: ProgramExerciseLibrarySource) {
  const name = exercise.name.trim();
  const intensity = getProgramExerciseLibraryIntensity(exercise.color);

  return {
    name,
    color: exercise.color?.trim() || null,
    intensity_code: intensity,
    category: intensity,
    default_tempo: exercise.tempo?.trim() || null,
    youtube_url: exercise.youtube_url?.trim() || null,
    youtube_id: extractYoutubeId(exercise.youtube_url),
    coach_notes: sanitizeLibraryExerciseNotes(exercise.coach_notes),
  };
}
