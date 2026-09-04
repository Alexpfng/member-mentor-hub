import { alternatingRepsCycle, parseEmom } from "./emom";

type ExerciseLike = {
  name?: string | null;
  reps?: string | number | null;
  series?: string | number | null;
  tempo?: string | null;
  block_type?: string | null;
};

type MetricKind = "reps" | "seconds";

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function isDurationReps(reps?: string | number | null): boolean {
  if (reps == null) return false;
  const r = String(reps).toLowerCase().trim();
  return /\d+\s*(s|sec|secondes?|"|''|min|m)\b/.test(r) || /\d+\s*['"]/.test(r);
}

function parseDurationSeconds(reps?: string | number | null): number | null {
  if (reps == null) return null;
  const r = String(reps).toLowerCase().trim();
  let m = r.match(/(\d+)\s*(s|sec|secondes?)/);
  if (m) return parseInt(m[1], 10);
  m = r.match(/(\d+)\s*(min|minutes?)/);
  if (m) return parseInt(m[1], 10) * 60;
  m = r.match(/(\d+)[:'](\d{2})/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

function parseRepsPerSet(repsTarget: string | number | null | undefined, seriesCount: number): string[] {
  const fallback = Array(seriesCount).fill("");
  if (repsTarget == null || repsTarget === "") return fallback;
  const raw = String(repsTarget).trim();
  const range = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range && seriesCount !== 2) return Array(seriesCount).fill(raw);
  const parts = raw
    .split(/[\/,;]|\s+[-–]\s+|(?<=\d)\s*[-–]\s*(?=\d)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === seriesCount) return parts;
  return Array(seriesCount).fill(parts[0] || raw);
}

function extractNumeric(value?: string | number | null): number | null {
  if (value == null) return null;
  const match = String(value).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isTimedByName(name?: string | null, tempo?: string | null) {
  const merged = normalizeText(`${name ?? ""} ${tempo ?? ""}`);
  return /gainage|plank|planche|iso\b|isometr|hold|tenir|maintien|floating/.test(merged);
}

export function getExpertSetLoggedValue(exercise: ExerciseLike, totalSets: number, setNumber: number): { value: number | null; kind: MetricKind } {
  const repTarget = parseRepsPerSet(exercise.reps, totalSets)[setNumber - 1] || (exercise.reps ? String(exercise.reps) : "");
  const durationValue = isDurationReps(repTarget) ? parseDurationSeconds(repTarget) : null;
  if (durationValue != null) return { value: durationValue, kind: "seconds" };
  const numericValue = extractNumeric(repTarget);
  if (numericValue != null) return { value: Math.round(numericValue), kind: "reps" };
  if (isTimedByName(exercise.name, exercise.tempo)) return { value: null, kind: "seconds" };
  return { value: null, kind: "reps" };
}

export function getExpertEmomLoggedValue(exercise: ExerciseLike, durationMin: number): number | null {
  const { repsPerMin } = parseEmom(
    exercise.series != null ? String(exercise.series) : null,
    exercise.reps != null ? String(exercise.reps) : null,
    exercise.name ?? null,
  );
  const alternating = alternatingRepsCycle(exercise.reps != null ? String(exercise.reps) : null);
  if (alternating) {
    let total = 0;
    for (let index = 0; index < durationMin; index += 1) {
      total += index % 2 === 0 ? alternating[0] : alternating[1];
    }
    return total;
  }
  if (repsPerMin == null) return null;
  return repsPerMin * durationMin;
}

export function getCoachMetricLabel(exercise?: ExerciseLike | null): string {
  if (!exercise) return "REPS";
  if (isDurationReps(exercise.reps) || isTimedByName(exercise.name, exercise.tempo)) return "SECONDES";
  return "REPS";
}

export function getCoachMetricValue(exercise: ExerciseLike | null | undefined, loggedValue: number | null | undefined): string {
  if (loggedValue == null) return "—";
  return getCoachMetricLabel(exercise) === "SECONDES" ? `${loggedValue} s` : String(loggedValue);
}
