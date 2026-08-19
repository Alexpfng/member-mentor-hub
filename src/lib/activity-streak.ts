/**
 * Habitude de suivi quotidien : streak, objectif du jour, paliers.
 *
 * Tout se calcule à la volée depuis les lignes d'activité déjà renvoyées par
 * `getMyActivity` (comme les badges) : aucune table à créer, rien à migrer en
 * production, et pas d'état à resynchroniser si le membre corrige un jour.
 */

export type ActivityDay = {
  date: string; // ISO court (YYYY-MM-DD)
  steps: number | null;
  calories: number | null;
};

/** Un jour « rempli » = le membre y a noté au moins une valeur. */
export function isFilled(day: ActivityDay | null | undefined): boolean {
  if (!day) return false;
  return day.steps != null || day.calories != null;
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Nombre de jours consécutifs remplis en repartant d'aujourd'hui.
 *
 * Le jour en cours ne casse pas la série tant qu'il n'est pas rempli : on part
 * alors d'hier — sinon le streak d'un membre régulier afficherait 0 chaque
 * matin, ce qui est décourageant et faux.
 */
export function computeDailyStreak(days: ActivityDay[], today: string): number {
  const filled = new Set(days.filter(isFilled).map((d) => d.date));
  let cursor = filled.has(today) ? today : shiftISO(today, -1);
  let streak = 0;
  while (filled.has(cursor)) {
    streak += 1;
    cursor = shiftISO(cursor, -1);
  }
  return streak;
}

/** Progression 0→1 vers l'objectif du jour (null si aucun objectif fixé). */
export function goalProgress(value: number | null, goal: number | null): number | null {
  if (goal == null || goal <= 0) return null;
  const done = value ?? 0;
  return Math.max(0, Math.min(1, done / goal));
}

/** L'objectif du jour est-il atteint ? Sert à déclencher la célébration. */
export function isGoalReached(value: number | null, goal: number | null): boolean {
  if (goal == null || goal <= 0) return false;
  return (value ?? 0) >= goal;
}

/** Paliers de série : de quoi féliciter sans inventer une nouvelle table. */
export const STREAK_TIERS = [3, 7, 14, 30, 60, 100] as const;

/** Message court affiché sous la série (null si rien de notable). */
export function streakLabel(streak: number): string | null {
  if (streak <= 0) return null;
  if (streak === 1) return "1 jour — c'est parti !";
  const tier = [...STREAK_TIERS].reverse().find((t) => streak >= t);
  if (streak === tier) {
    if (streak >= 100) return `${streak} jours — légendaire 🏆`;
    if (streak >= 30) return `${streak} jours — un mois plein 💪`;
    return `${streak} jours d'affilée !`;
  }
  return `${streak} jours d'affilée`;
}
