/**
 * Profil de mouvement d'un membre : où son travail se situe, et comment il a
 * évolué. Les axes reprennent le code couleur déjà utilisé partout dans l'app
 * (fiche exercice, séance, pédagogie) — inventer une autre taxonomie ici
 * aurait donné deux vocabulaires pour la même chose.
 *
 * Le radar compare deux périodes de la même personne, chaque axe étant ramené à
 * son propre maximum : il montre une FORME qui s'étend, pas un score absolu
 * comparable d'un membre à l'autre.
 */

import { normalizeExerciseFeedbackKey } from "./exercise-feedback";

export type MovementAxis = "force" | "isolation" | "explosif" | "mobilite" | "prevention";

export const AXIS_LABEL: Record<MovementAxis, string> = {
  force: "Force",
  isolation: "Isolation",
  explosif: "Explosivité",
  mobilite: "Mobilité",
  prevention: "Prévention",
};

export const AXIS_ORDER: MovementAxis[] = [
  "force",
  "isolation",
  "explosif",
  "mobilite",
  "prevention",
];

/** La couleur est stockée en nom (structure, bibliothèque) ou en emoji (builder). */
const COLOR_TO_AXIS: Record<string, MovementAxis> = {
  red: "force",
  "🔴": "force",
  green: "isolation",
  "🟢": "isolation",
  yellow: "explosif",
  "🟡": "explosif",
  lime: "mobilite",
  orange: "mobilite",
  "🟠": "mobilite",
  blue: "prevention",
  "🔵": "prevention",
};

export function axisFromColor(color: string | null | undefined): MovementAxis | null {
  if (!color) return null;
  return COLOR_TO_AXIS[String(color).trim().toLowerCase()] ?? null;
}

export type LoggedSet = {
  exerciseName: string | null;
  weightKg: number | null;
  reps: number | null;
  /** Date de la séance (ISO court), pour répartir entre les périodes. */
  date: string | null;
};

export type ExerciseColorSource = { name: string | null; color: string | null };

/** Index nom d'exercice → axe, construit depuis la bibliothèque et les programmes. */
export function buildAxisIndex(sources: ExerciseColorSource[]): Map<string, MovementAxis> {
  const index = new Map<string, MovementAxis>();
  for (const source of sources) {
    const key = normalizeExerciseFeedbackKey(source.name);
    const axis = axisFromColor(source.color);
    if (!key || !axis || index.has(key)) continue;
    index.set(key, axis);
  }
  return index;
}

/**
 * Charge de travail d'une série. Un exercice au poids du corps ou de mobilité
 * n'a pas de charge : on compte alors les répétitions, sinon il pèserait zéro
 * et son axe resterait plat quoi que fasse le membre.
 */
function setWorkload(set: LoggedSet): number {
  const reps = set.reps != null && set.reps > 0 ? set.reps : 1;
  const weight = set.weightKg != null && set.weightKg > 0 ? set.weightKg : 0;
  return weight > 0 ? weight * reps : reps;
}

export type AxisPoint = {
  axis: MovementAxis;
  label: string;
  /** Charge brute des deux périodes, pour l'infobulle. */
  beforeRaw: number;
  afterRaw: number;
  /** Ramené à 0-100 sur le maximum de l'axe. */
  before: number;
  after: number;
  /** Aucun travail sur cet axe, ni avant ni maintenant. */
  empty: boolean;
};

export type MovementProfile = {
  points: AxisPoint[];
  /** Dates de coupure réellement utilisées, pour l'affichage. */
  beforeRange: { from: string; to: string } | null;
  afterRange: { from: string; to: string } | null;
  /** Aucune donnée exploitable : l'appelant doit afficher un état vide. */
  empty: boolean;
};

function emptyProfile(): MovementProfile {
  return {
    points: AXIS_ORDER.map((axis) => ({
      axis,
      label: AXIS_LABEL[axis],
      beforeRaw: 0,
      afterRaw: 0,
      before: 0,
      after: 0,
      empty: true,
    })),
    beforeRange: null,
    afterRange: null,
    empty: true,
  };
}

/**
 * Compare les `windowDays` premiers jours d'entraînement aux `windowDays`
 * derniers. Deux fenêtres de même durée : sans ça, un membre suivi depuis
 * longtemps verrait sa période « avant » écraser la seconde par simple volume.
 */
export function buildMovementProfile(
  sets: LoggedSet[],
  axisIndex: Map<string, MovementAxis>,
  windowDays = 28,
): MovementProfile {
  const dated = sets
    .filter((set) => !!set.date && !!set.exerciseName)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length === 0) return emptyProfile();

  const firstDate = String(dated[0].date);
  const lastDate = String(dated[dated.length - 1].date);

  const shiftDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const beforeEnd = shiftDays(firstDate, windowDays);
  const afterStart = shiftDays(lastDate, -windowDays);
  // Historique trop court pour deux fenêtres disjointes : on ne peut pas encore
  // parler de progression, on affiche la période comme « maintenant ».
  const hasTwoWindows = afterStart >= beforeEnd;

  const before = new Map<MovementAxis, number>();
  const after = new Map<MovementAxis, number>();
  const beforeDates: string[] = [];
  const afterDates: string[] = [];

  for (const set of dated) {
    const axis = axisIndex.get(normalizeExerciseFeedbackKey(set.exerciseName));
    if (!axis) continue;
    const date = String(set.date);
    const load = setWorkload(set);
    const inAfter = hasTwoWindows ? date >= afterStart : true;
    if (inAfter) {
      after.set(axis, (after.get(axis) ?? 0) + load);
      afterDates.push(date);
    } else if (date < beforeEnd) {
      before.set(axis, (before.get(axis) ?? 0) + load);
      beforeDates.push(date);
    }
  }

  // `dated` est trié : les bornes sont les extrémités de chaque liste.
  const rangeOf = (dates: string[]) =>
    dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null;

  if (before.size === 0 && after.size === 0) return emptyProfile();

  const points = AXIS_ORDER.map((axis) => {
    const beforeRaw = Math.round(before.get(axis) ?? 0);
    const afterRaw = Math.round(after.get(axis) ?? 0);
    const max = Math.max(beforeRaw, afterRaw);
    return {
      axis,
      label: AXIS_LABEL[axis],
      beforeRaw,
      afterRaw,
      before: max > 0 ? Math.round((beforeRaw / max) * 100) : 0,
      after: max > 0 ? Math.round((afterRaw / max) * 100) : 0,
      empty: max === 0,
    };
  });

  return {
    points,
    beforeRange: rangeOf(beforeDates),
    afterRange: rangeOf(afterDates),
    empty: false,
  };
}
