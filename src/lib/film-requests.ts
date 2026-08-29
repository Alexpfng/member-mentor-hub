import { normalizeExerciseFeedbackKey } from "./exercise-feedback";

type FilmExercise = { name?: string | null; film_requested?: boolean | null };
type FilmDay = { exercises?: FilmExercise[] | null };
type FilmWeek = { days?: FilmDay[] | null };

/**
 * Noms d'exercices pour lesquels une vidéo a bien été reçue, normalisés pour
 * pouvoir être comparés au nom écrit dans le programme (accents, casse…).
 */
export function filmedExerciseKeys(videos: Array<{ exercise_name?: string | null }>): Set<string> {
  const keys = new Set<string>();
  for (const video of videos) {
    const key = normalizeExerciseFeedbackKey(video.exercise_name);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Retire la demande de vidéo (« 📹 Demander une vidéo au membre ») des seuls
 * exercices dont la vidéo a bien été reçue pendant la semaine copiée.
 *
 * Une demande restée sans réponse est CONSERVÉE d'une semaine sur l'autre :
 * le coach continue de la voir tant que le membre n'a pas filmé, sans avoir à
 * la recocher. Sans ça la case restait allumée pour toujours, même une fois la
 * vidéo envoyée.
 */
export function clearFulfilledFilmRequests<T extends FilmWeek>(
  structure: T,
  filmed: Set<string>,
): T {
  if (filmed.size === 0) return structure;

  return {
    ...structure,
    days: (structure.days ?? []).map((day) => ({
      ...day,
      exercises: (day.exercises ?? []).map((exercise) => {
        if (!exercise.film_requested) return exercise;
        const key = normalizeExerciseFeedbackKey(exercise.name);
        if (!key || !filmed.has(key)) return exercise;
        return { ...exercise, film_requested: null };
      }),
    })),
  };
}
