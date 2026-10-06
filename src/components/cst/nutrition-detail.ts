import type { NutritionMacroComparison } from "@/lib/nutrition";

export type NutritionRadarPoint = {
  label: string;
  aujourdhui: number | null;
  moyenne: number | null;
};

export function buildNutritionRadarModel(comparison: NutritionMacroComparison | null | undefined) {
  const data = (comparison?.axes ?? []).map(
    (axis): NutritionRadarPoint => ({
      label: axis.label,
      aujourdhui: axis.todayGrams,
      moyenne: axis.previousAverageGrams,
    }),
  );
  const values = data.flatMap((point) => [point.aujourdhui, point.moyenne]);
  const maxGrams = Math.max(0, ...values.filter((value): value is number => value != null));

  return {
    data,
    maxGrams: maxGrams || 1,
    hasToday: data.some((point) => point.aujourdhui != null),
    hasPreviousAverage: data.some((point) => point.moyenne != null),
  };
}

export function nutritionMissingDataMessage(
  comparison: NutritionMacroComparison | null | undefined,
): string | null {
  if (!comparison) return null;
  const currentMissing = comparison.todayIncompleteEntryCount;
  const previousMissing = comparison.previousIncompleteEntryCount;
  if (currentMissing === 0 && previousMissing === 0) return null;

  const current =
    currentMissing > 0
      ? `${currentMissing} aliment${currentMissing > 1 ? "s" : ""} aujourd’hui`
      : null;
  const previous =
    previousMissing > 0
      ? `${previousMissing} aliment${previousMissing > 1 ? "s" : ""} sur les jours comparés`
      : null;
  const scope = [current, previous].filter(Boolean).join(" et ");
  return `Macros manquantes pour ${scope}. Les totaux affichés utilisent uniquement les valeurs renseignées.`;
}
