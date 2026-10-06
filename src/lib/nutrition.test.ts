import { describe, expect, it } from "bun:test";

import {
  DEFAULT_NUTRITION_FOODS,
  buildNutritionSummary,
  buildNutritionMacroComparison,
  kcalForPortion,
  nutritionGoalStatus,
  type NutritionEntry,
} from "./nutrition";

const entry = (overrides: Partial<NutritionEntry> = {}): NutritionEntry => ({
  id: "entry-1",
  date: "2026-10-04",
  meal: "lunch",
  foodName: "Riz cuit",
  grams: 150,
  kcalPer100g: 130,
  ...overrides,
});

describe("kcalForPortion", () => {
  it("calcule les calories d'une portion en grammes", () => {
    expect(kcalForPortion({ grams: 150, kcalPer100g: 130 })).toBe(195);
    expect(kcalForPortion({ grams: 33, kcalPer100g: 89 })).toBe(29);
  });

  it("borne les valeurs invalides a zero", () => {
    expect(kcalForPortion({ grams: -20, kcalPer100g: 130 })).toBe(0);
    expect(kcalForPortion({ grams: 100, kcalPer100g: -10 })).toBe(0);
  });
});

describe("DEFAULT_NUTRITION_FOODS", () => {
  it("fournit une base d'aliments utilisable meme si le seed DB ne remonte pas", () => {
    expect(DEFAULT_NUTRITION_FOODS.length).toBeGreaterThanOrEqual(100);
    expect(DEFAULT_NUTRITION_FOODS.map((food) => food.name)).toContain("Riz cuit");
    expect(DEFAULT_NUTRITION_FOODS.every((food) => food.kcal_per_100g > 0)).toBe(true);
  });

  it("couvre les grandes familles alimentaires attendues dans une app nutrition", () => {
    const categories = new Set(DEFAULT_NUTRITION_FOODS.map((food) => food.category));
    expect(categories).toEqual(
      new Set([
        "Fruits",
        "Legumes",
        "Feculents",
        "Proteines",
        "Produits laitiers",
        "Matieres grasses",
        "Oleagineux",
        "Boissons",
        "Petit-dejeuner",
        "Snacks",
        "Plats simples",
      ]),
    );
  });

  it("garde des identifiants uniques pour le select membre", () => {
    const ids = DEFAULT_NUTRITION_FOODS.map((food) => food.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildNutritionSummary", () => {
  it("regroupe les entrees par repas et calcule le total journee", () => {
    const summary = buildNutritionSummary({
      date: "2026-10-04",
      goalKcal: 2200,
      entries: [
        entry({ id: "rice", meal: "lunch", grams: 150, kcalPer100g: 130 }),
        entry({ id: "egg", meal: "breakfast", grams: 120, kcalPer100g: 155 }),
        entry({ id: "banana", meal: "snack", grams: 100, kcalPer100g: 89 }),
      ],
    });

    expect(summary.totalKcal).toBe(470);
    expect(summary.remainingKcal).toBe(1730);
    expect(summary.meals.breakfast.totalKcal).toBe(186);
    expect(summary.meals.lunch.totalKcal).toBe(195);
    expect(summary.meals.snack.totalKcal).toBe(89);
    expect(summary.meals.dinner.totalKcal).toBe(0);
  });

  it("classe les aliments dans l'ordre stable de creation", () => {
    const summary = buildNutritionSummary({
      date: "2026-10-04",
      goalKcal: null,
      entries: [
        entry({ id: "b", createdAt: "2026-10-04T09:30:00Z", foodName: "B" }),
        entry({ id: "a", createdAt: "2026-10-04T08:30:00Z", foodName: "A" }),
      ],
    });

    expect(summary.meals.lunch.entries.map((item) => item.foodName)).toEqual(["A", "B"]);
    expect(summary.remainingKcal).toBeNull();
  });
});

describe("buildNutritionMacroComparison", () => {
  it("sums today's known macros by portion and compares them with prior logged days", () => {
    const comparison = buildNutritionMacroComparison("2026-10-06", [
      entry({
        id: "today-known",
        date: "2026-10-06",
        grams: 150,
        proteinPer100g: 20,
        carbsPer100g: 30,
        fatPer100g: 10,
      }),
      entry({
        id: "today-unknown",
        date: "2026-10-06",
        grams: 200,
        proteinPer100g: null,
        carbsPer100g: 10,
        fatPer100g: null,
      }),
      entry({
        id: "prior-a",
        date: "2026-10-05",
        grams: 100,
        proteinPer100g: 20,
        carbsPer100g: 40,
        fatPer100g: 5,
      }),
      entry({
        id: "prior-b",
        date: "2026-10-04",
        grams: 200,
        proteinPer100g: 15,
        carbsPer100g: null,
        fatPer100g: 10,
      }),
      entry({ id: "outside-window", date: "2026-09-29", proteinPer100g: 99 }),
      entry({ id: "future", date: "2026-10-07", proteinPer100g: 99 }),
    ]);

    expect(comparison.axes).toEqual([
      {
        key: "protein",
        label: "Protéines",
        todayGrams: 30,
        previousAverageGrams: 25,
        previousDays: 2,
        missingEntries: 1,
        previousMissingEntries: 0,
      },
      {
        key: "carbs",
        label: "Glucides",
        todayGrams: 65,
        previousAverageGrams: 40,
        previousDays: 1,
        missingEntries: 0,
        previousMissingEntries: 1,
      },
      {
        key: "fat",
        label: "Lipides",
        todayGrams: 15,
        previousAverageGrams: 12.5,
        previousDays: 2,
        missingEntries: 1,
        previousMissingEntries: 0,
      },
    ]);
    expect(comparison.todayEntryCount).toBe(2);
    expect(comparison.todayIncompleteEntryCount).toBe(1);
    expect(comparison.previousIncompleteEntryCount).toBe(1);
  });

  it("compte une seule fois chaque aliment incomplet même si plusieurs macros manquent", () => {
    const comparison = buildNutritionMacroComparison("2026-10-06", [
      entry({ date: "2026-10-06", proteinPer100g: null, carbsPer100g: 10, fatPer100g: null }),
      entry({
        id: "missing-carbs",
        date: "2026-10-06",
        proteinPer100g: 20,
        carbsPer100g: null,
        fatPer100g: 5,
      }),
    ]);

    expect(comparison.todayIncompleteEntryCount).toBe(2);
  });

  it("keeps known zero values and reports no comparison without prior known days", () => {
    const comparison = buildNutritionMacroComparison("2026-10-06", [
      entry({ date: "2026-10-06", proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 }),
    ]);

    expect(comparison.axes.map((axis) => axis.todayGrams)).toEqual([0, 0, 0]);
    expect(comparison.axes.map((axis) => axis.previousAverageGrams)).toEqual([null, null, null]);
  });
});

describe("nutritionGoalStatus", () => {
  it("donne une progression lisible autour de l'objectif", () => {
    expect(nutritionGoalStatus(1980, 2200)).toEqual({
      progress: 0.9,
      deltaKcal: -220,
      label: "Encore 220 kcal",
      tone: "under",
    });
    expect(nutritionGoalStatus(2200, 2200)).toEqual({
      progress: 1,
      deltaKcal: 0,
      label: "Objectif pile",
      tone: "target",
    });
    expect(nutritionGoalStatus(2380, 2200)).toEqual({
      progress: 1,
      deltaKcal: 180,
      label: "+180 kcal",
      tone: "over",
    });
  });

  it("reste neutre sans objectif nutrition", () => {
    expect(nutritionGoalStatus(1200, null)).toEqual({
      progress: null,
      deltaKcal: null,
      label: "Objectif non fixe",
      tone: "neutral",
    });
  });
});
