/**
 * Série de semaines actives. Une semaine compte quand le membre y a terminé au
 * moins `minPerWeek` séances ; la semaine en cours ne casse jamais la série,
 * puisqu'elle n'est pas finie.
 *
 * Extrait du tableau de bord membre pour être partagé avec les trophées : deux
 * calculs séparés auraient fini par diverger, et le membre aurait vu deux
 * chiffres différents pour la même chose.
 */

const WEEKS_SCANNED = 26;

/** Lundi de la semaine d'une date, en UTC pour rester indépendant du fuseau. */
export function mondayOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : new Date(date);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayFromMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayFromMonday);
  return utc.toISOString().slice(0, 10);
}

export function weeklyStreak(
  sessionDates: Array<string | null | undefined>,
  today: Date | string = new Date(),
  minPerWeek = 3,
): number {
  const counts = new Map<string, number>();
  for (const date of sessionDates) {
    if (!date) continue;
    const key = mondayOf(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const currentMonday = mondayOf(today);
  let streak = 0;
  for (let i = 0; i < WEEKS_SCANNED; i++) {
    const cursor = new Date(`${currentMonday}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - i * 7);
    const key = cursor.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    if (count >= minPerWeek) {
      streak++;
      continue;
    }
    // La semaine en cours est encore ouverte : elle ne compte pas, mais elle
    // ne doit pas non plus interrompre la série.
    if (key === currentMonday) continue;
    break;
  }
  return streak;
}
