import { parseRpeCell } from "./rpe-cell";

export function getNumericCoachRpeTarget(value: string | number | null | undefined): number | null {
  const parsed = parseRpeCell(value).rpe;
  if (parsed == null) return null;
  const target = Number(parsed);
  return Number.isFinite(target) ? target : null;
}
