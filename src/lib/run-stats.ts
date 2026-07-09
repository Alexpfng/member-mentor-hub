/* Statistiques de course — fonctions pures (parsing, normalisation, comparaison,
   verdict). Aucune dépendance serveur : testable et réutilisable côté client. */

/** Métriques normalisées d'une course (unités canoniques). */
export type RunMetrics = {
  distanceKm: number | null;
  durationSec: number | null;
  elevationM: number | null;
  avgHr: number | null;
  paceSecPerKm: number | null;
  rpe: number | null;
};

/** JSON attendu de l'IA après lecture d'une capture d'écran. */
export type RunExtraction = {
  distanceKm: number | null;
  durationMin: number | null;
  elevationM: number | null;
  avgHr: number | null;
  pacePerKm: string | null; // "5:50"
  confidence: number; // 0..1
};

/** Valeurs pré-remplies pour le formulaire (champs texte). */
export type RunFormValues = {
  distanceKm: string;
  durationMin: string;
  elevationM: string;
  avgHr: string;
  pace: string;
};

/** Parse un nombre saisi en français ("8,2") ou anglais ("8.2"). */
export function parseNum(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return isFinite(input) ? input : null;
  const cleaned = input
    .trim()
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** "5:50" ou "5:50 /km" → 350 (secondes par km). Accepte aussi "5.5" (min décimales). */
export function parsePaceToSec(input: string | null | undefined): number | null {
  if (!input) return null;
  const s = input.trim();
  const mmss = s.match(/(\d{1,2})\s*[:'’]\s*(\d{1,2})/);
  if (mmss) {
    const min = parseInt(mmss[1], 10);
    const sec = parseInt(mmss[2], 10);
    if (isFinite(min) && isFinite(sec)) return min * 60 + sec;
  }
  const dec = parseNum(s);
  if (dec != null) return Math.round(dec * 60); // minutes décimales → secondes
  return null;
}

/** 350 → "5:50". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return "";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  // Gère l'arrondi qui pousse à 60 s (ex. 5:60 → 6:00)
  const adjMin = sec === 60 ? min + 1 : min;
  const adjSec = sec === 60 ? 0 : sec;
  return `${adjMin}:${String(adjSec).padStart(2, "0")}`;
}

/** Nombre français avec virgule ("8.2" → "8,2"). */
function frNum(n: number): string {
  return String(n).replace(".", ",");
}

/** Allure dérivée si absente mais distance + durée connues. */
export function derivePaceSecPerKm(
  distanceKm: number | null,
  durationSec: number | null,
): number | null {
  if (!distanceKm || !durationSec || distanceKm <= 0 || durationSec <= 0) return null;
  return Math.round(durationSec / distanceKm);
}

/** Extraction IA → valeurs de formulaire (champs texte), pour pré-remplissage éditable. */
export function extractionToFormValues(
  ext: Partial<RunExtraction> | null | undefined,
): RunFormValues {
  const distanceKm = ext?.distanceKm ?? null;
  const durationMin = ext?.durationMin ?? null;
  let pace = ext?.pacePerKm ? formatPace(parsePaceToSec(ext.pacePerKm)) : "";
  if (!pace) {
    const derived = derivePaceSecPerKm(distanceKm, durationMin != null ? durationMin * 60 : null);
    pace = formatPace(derived);
  }
  return {
    distanceKm: distanceKm != null ? frNum(distanceKm) : "",
    durationMin: durationMin != null ? String(durationMin) : "",
    elevationM: ext?.elevationM != null ? String(ext.elevationM) : "",
    avgHr: ext?.avgHr != null ? String(ext.avgHr) : "",
    pace,
  };
}

/** Champs texte du formulaire → métriques normalisées (pour persistance run_stats). */
export function formValuesToMetrics(
  v: Partial<RunFormValues> & { rpe?: number | null },
): RunMetrics {
  const distanceKm = parseNum(v.distanceKm ?? null);
  const durationMin = parseNum(v.durationMin ?? null);
  const durationSec = durationMin != null ? Math.round(durationMin * 60) : null;
  let paceSecPerKm = parsePaceToSec(v.pace ?? null);
  if (paceSecPerKm == null) paceSecPerKm = derivePaceSecPerKm(distanceKm, durationSec);
  return {
    distanceKm,
    durationSec,
    elevationM:
      parseNum(v.elevationM ?? null) != null ? Math.round(parseNum(v.elevationM ?? null)!) : null,
    avgHr: parseNum(v.avgHr ?? null) != null ? Math.round(parseNum(v.avgHr ?? null)!) : null,
    paceSecPerKm,
    rpe: v.rpe ?? null,
  };
}

/** Une métrique comparée entre la course actuelle et la précédente. */
export type MetricDelta = {
  key: "pace" | "distance" | "elevation" | "avgHr";
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null; // current - previous
  direction: "up" | "down" | "same" | null;
  sentiment: "good" | "bad" | "neutral";
};

const SAME_EPS: Record<MetricDelta["key"], number> = {
  pace: 2,
  distance: 0.1,
  elevation: 5,
  avgHr: 1,
};

function makeDelta(
  key: MetricDelta["key"],
  label: string,
  current: number | null,
  previous: number | null,
  betterWhenLower: boolean | null,
): MetricDelta {
  if (current == null || previous == null) {
    return { key, label, current, previous, delta: null, direction: null, sentiment: "neutral" };
  }
  const delta = Math.round((current - previous) * 100) / 100;
  const direction: MetricDelta["direction"] =
    Math.abs(delta) <= SAME_EPS[key] ? "same" : delta > 0 ? "up" : "down";
  let sentiment: MetricDelta["sentiment"] = "neutral";
  if (betterWhenLower != null && direction !== "same") {
    const improved = betterWhenLower ? delta < 0 : delta > 0;
    sentiment = improved ? "good" : "bad";
  }
  return { key, label, current, previous, delta, direction, sentiment };
}

/** Compare la course actuelle à la précédente. `previous` null → tableau vide. */
export function computeRunComparison(
  previous: RunMetrics | null,
  current: RunMetrics,
): MetricDelta[] {
  if (!previous) return [];
  return [
    makeDelta("pace", "Allure", current.paceSecPerKm, previous.paceSecPerKm, true),
    makeDelta("distance", "Distance", current.distanceKm, previous.distanceKm, false),
    makeDelta("elevation", "D+", current.elevationM, previous.elevationM, null),
    makeDelta("avgHr", "FC moy", current.avgHr, previous.avgHr, null),
  ];
}

/** Verdict court à base de règles (aucune IA). */
export function runVerdict(deltas: MetricDelta[]): string {
  if (!deltas.length) return "Première course enregistrée — la base est posée 💪";
  const pace = deltas.find((d) => d.key === "pace");
  const distance = deltas.find((d) => d.key === "distance");

  if (pace?.delta != null && pace.direction === "down") {
    return `Allure en progrès de ${formatDeltaSec(pace.delta)} 🔥`;
  }
  if (distance?.direction === "up" && (pace == null || pace.direction === "same")) {
    return "Plus de distance à allure tenue 💪";
  }
  if (pace?.delta != null && pace.direction === "up") {
    return "Allure en baisse — jour sans, ou parcours plus dur ?";
  }
  return "Séance solide, on garde le cap 👊";
}

function formatDeltaSec(deltaSec: number): string {
  const abs = Math.abs(Math.round(deltaSec));
  return `${abs} s/km`;
}
