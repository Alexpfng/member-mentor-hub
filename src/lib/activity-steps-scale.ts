const MIN_STEPS = 0;
const MAX_STEPS = 200000;
const DEFAULT_SCALE_MAX = 20000;
const STEP_INCREMENT = 500;

export function clampSteps(value: number): number {
  if (!Number.isFinite(value)) return MIN_STEPS;
  return Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(value)));
}

export function parseStepsValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/\s/g, ""));
  if (!Number.isFinite(value)) return null;
  return clampSteps(value);
}

export function formatStepsValue(value: number): string {
  return clampSteps(value).toLocaleString("fr-FR").replace(/\u202f/g, " ");
}

export function getStepsScaleMax(goalSteps: number | null | undefined, rawSteps: string): number {
  const currentSteps = parseStepsValue(rawSteps) ?? 0;
  const goalBasedMax = goalSteps != null ? Math.ceil((goalSteps * 1.5) / 1000) * 1000 : 0;
  const currentBasedMax = currentSteps > 0 ? Math.ceil(currentSteps / 1000) * 1000 : 0;
  return clampSteps(Math.max(DEFAULT_SCALE_MAX, goalBasedMax, currentBasedMax));
}

export function nudgeSteps(rawSteps: string, delta = STEP_INCREMENT): string {
  const current = parseStepsValue(rawSteps) ?? 0;
  return String(clampSteps(current + delta));
}

export { MAX_STEPS, STEP_INCREMENT };
