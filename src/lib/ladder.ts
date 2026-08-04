/**
 * Bloc « Ladder » : un format à la minute (comme un EMOM) dont le nombre de reps
 * suit une échelle. Le motif du coach est joué en montée PUIS en redescente, en
 * boucle, jusqu'à la durée du bloc.
 *
 *   « 3/4/5 » → min 1 : 3 · min 2 : 4 · min 3 : 5 · min 4 : 4 · min 5 : 3 · min 6 : 4…
 *   « 5/4/3 » → min 1 : 5 · min 2 : 4 · min 3 : 3 · min 4 : 4 · min 5 : 5…
 *
 * Ni le sommet ni la base ne sont joués deux fois d'affilée : le cycle est une
 * onde triangulaire de période 2n-2 (n = nombre de marches).
 */

/** Au-delà, on considère que la prescription est aberrante (garde-fou de boucle). */
const MAX_LADDER_MINUTES = 60;
/** Une échelle plus longue que ça vient forcément d'une saisie erronée. */
const MAX_LADDER_STEPS = 30;

function firstInteger(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const parsed = parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Motif de reps d'un ladder.
 * Accepte une liste explicite (« 3/4/5 », « 3, 4, 5 ») ou des bornes
 * (« 3-5 », « 5-3 ») déroulées en chiffres qui se suivent.
 * Renvoie [] si le champ ne ressemble pas à une échelle (ex. « 27 en tout »).
 */
export function parseLadderPattern(input: string | number | null | undefined): number[] {
  if (input == null || input === "") return [];
  const raw = String(input)
    .replace(/^ladder\s*/i, "")
    .trim();

  // Bornes « 3-5 » / « 5-3 » → suite complète, montante ou descendante.
  const range = raw.match(/^(\d+)\s*(?:-|–|—|→|>)\s*(\d+)$/);
  if (range) {
    const from = parseInt(range[1], 10);
    const to = parseInt(range[2], 10);
    if (from < 1 || to < 1) return [];
    if (from === to) return [from];
    if (Math.abs(to - from) + 1 > MAX_LADDER_STEPS) return [];
    const step = from < to ? 1 : -1;
    const out: number[] = [];
    for (let value = from; step > 0 ? value <= to : value >= to; value += step) out.push(value);
    return out;
  }

  // Liste explicite : au moins deux valeurs séparées par , ; ou /
  if (!/\d+\s*[,;/]\s*\d+/.test(raw)) return [];
  return raw
    .split(/[,;/]/)
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_LADDER_STEPS);
}

/**
 * Cycle joué en boucle : montée puis redescente, sans rejouer le sommet ni la
 * base d'affilée. [3,4,5] → [3,4,5,4] · [5,4,3] → [5,4,3,4] · [3,4] → [3,4]
 */
export function buildLadderCycle(pattern: number[]): number[] {
  const clean = pattern.filter((n) => Number.isFinite(n) && n > 0);
  if (clean.length <= 2) return clean;
  return [...clean, ...clean.slice(1, -1).reverse()];
}

/** Reps prescrites à la minute `minuteIdx` (0-indexée), en bouclant sur le cycle. */
export function ladderRepsForMinute(cycle: number[], minuteIdx: number): number | null {
  if (cycle.length === 0 || minuteIdx < 0) return null;
  return cycle[minuteIdx % cycle.length];
}

/** Le plan minute par minute, sur `minutes` minutes. */
export function buildLadderPlan(pattern: number[], minutes: number): number[] {
  const cycle = buildLadderCycle(pattern);
  if (cycle.length === 0 || minutes <= 0) return [];
  return Array.from({ length: minutes }, (_, i) => cycle[i % cycle.length]);
}

/**
 * Durée du bloc, par ordre de priorité :
 *   1. la durée explicite du coach (champ « Durée (min) ») ;
 *   2. un volume total prescrit (« 27 en tout ») → on déroule jusqu'à l'atteindre ;
 *   3. à défaut, une pyramide complète qui redescend jusqu'à sa base.
 */
export function resolveLadderMinutes(
  pattern: number[],
  opts: { durationRaw?: string | number | null; totalRepsRaw?: string | number | null } = {},
): number {
  const cycle = buildLadderCycle(pattern);
  if (cycle.length === 0) return 0;

  const duration = firstInteger(opts.durationRaw);
  if (duration != null && duration > 0) return Math.min(duration, MAX_LADDER_MINUTES);

  const totalReps = firstInteger(opts.totalRepsRaw);
  if (totalReps != null && totalReps > 0) {
    let sum = 0;
    let minutes = 0;
    while (sum < totalReps && minutes < MAX_LADDER_MINUTES) {
      sum += cycle[minutes % cycle.length];
      minutes += 1;
    }
    return Math.max(1, minutes);
  }

  // Pyramide complète : le cycle ne contient pas le retour à la base (3,4,5,4),
  // on ajoute la marche qui la referme (…,3) dès qu'il y a un vrai sommet.
  return Math.max(1, cycle.length + (pattern.length > 2 ? 1 : 0));
}

/** Libellé compact pour l'en-tête de séance : « 3→5 » ou « 3/4/5 ». */
export function formatLadderLabel(pattern: number[]): string | null {
  if (pattern.length === 0) return null;
  const isConsecutive = pattern.every((n, i) => i === 0 || Math.abs(n - pattern[i - 1]) === 1);
  if (isConsecutive && pattern.length > 2) return `${pattern[0]}→${pattern[pattern.length - 1]}`;
  return pattern.join("/");
}
