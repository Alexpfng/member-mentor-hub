/**
 * Reconnaissance d'une séance de course, partagée par le lecteur de séance du
 * membre et par le rapprochement des activités Strava.
 *
 * Les deux avaient leur propre copie de la liste de mots-clés et elles avaient
 * divergé : celle de Strava connaissait « trail », celle du lecteur non. Une
 * séance de trail partait donc dans le logger de muscu (séries, kg, RPE) alors
 * que Strava, lui, la considérait bien comme une course.
 */
export const RUNNING_SESSION_RE = /course|run|endurance|c[oô]tes|fractionn|sortie|footing|trail/i;

export function isRunningSessionLabel(label?: string | null): boolean {
  return RUNNING_SESSION_RE.test(label ?? "");
}

/**
 * Le libellé du jour fait foi. À défaut, une séance dont TOUS les exercices
 * portent un nom de course en est une aussi (jours importés sans libellé).
 */
export function isRunningSession(
  label?: string | null,
  exercises?: Array<{ name: string }>,
): boolean {
  if (isRunningSessionLabel(label)) return true;
  if (exercises?.length && exercises.every((exercise) => RUNNING_SESSION_RE.test(exercise.name))) {
    return true;
  }
  return false;
}
