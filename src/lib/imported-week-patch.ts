import { normalizeProgramStructure, normalizeWeekStructure } from "@/lib/week-structure-normalizer";

export type ImportedWeekPatch = {
  number: number;
  days?: unknown[] | null;
};

export type ProgramStructurePatch = {
  weeks?: Array<unknown> | null;
};

export function normalizeImportedWeekPatches(weeks: ImportedWeekPatch[]) {
  const byNumber = new Map<number, { number: number; structure: { days: unknown[] } }>();

  for (const week of weeks) {
    if (!Number.isInteger(week.number) || week.number < 1) continue;
    byNumber.set(week.number, {
      number: week.number,
      structure: normalizeWeekStructure({ days: week.days ?? [] }),
    });
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export function mergeImportedWeeksIntoProgramStructure(
  base: ProgramStructurePatch | null | undefined,
  importedWeeks: ImportedWeekPatch[],
) {
  const normalizedBase = normalizeProgramStructure(base ?? { weeks: [] });
  const weeks = [...(normalizedBase.weeks ?? [])];

  for (const patch of normalizeImportedWeekPatches(importedWeeks)) {
    const idx = patch.number - 1;
    while (weeks.length <= idx) weeks.push({ days: [] });
    weeks[idx] = patch.structure;
  }

  return { ...normalizedBase, weeks };
}
