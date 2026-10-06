import { describe, expect, it } from "bun:test";

import { buildNutritionRadarModel, nutritionMissingDataMessage } from "./nutrition-detail";
import type { NutritionMacroComparison } from "@/lib/nutrition";

const comparison: NutritionMacroComparison = {
  date: "2026-10-06",
  todayEntryCount: 2,
  previousEntryCount: 3,
  todayIncompleteEntryCount: 1,
  previousIncompleteEntryCount: 1,
  axes: [
    {
      key: "protein",
      label: "Protéines",
      todayGrams: 85.4,
      previousAverageGrams: 72.2,
      previousDays: 2,
      missingEntries: 1,
      previousMissingEntries: 0,
    },
    {
      key: "carbs",
      label: "Glucides",
      todayGrams: 120,
      previousAverageGrams: null,
      previousDays: 0,
      missingEntries: 0,
      previousMissingEntries: 2,
    },
    {
      key: "fat",
      label: "Lipides",
      todayGrams: null,
      previousAverageGrams: 41,
      previousDays: 1,
      missingEntries: 2,
      previousMissingEntries: 0,
    },
  ],
};

describe("nutrition detail presentation", () => {
  it("keeps missing macro values out of the radar and exposes a useful scale", () => {
    expect(buildNutritionRadarModel(comparison)).toEqual({
      data: [
        { label: "Protéines", aujourdhui: 85.4, moyenne: 72.2 },
        { label: "Glucides", aujourdhui: 120, moyenne: null },
        { label: "Lipides", aujourdhui: null, moyenne: 41 },
      ],
      maxGrams: 120,
      hasToday: true,
      hasPreviousAverage: true,
    });
  });

  it("explains incomplete current and historical entries without treating them as zero", () => {
    expect(nutritionMissingDataMessage(comparison)).toBe(
      "Macros manquantes pour 1 aliment aujourd’hui et 1 aliment sur les jours comparés. Les totaux affichés utilisent uniquement les valeurs renseignées.",
    );
    expect(nutritionMissingDataMessage(null)).toBeNull();
  });
});
