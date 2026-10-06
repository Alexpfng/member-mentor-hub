import { describe, expect, it } from "bun:test";
import { buildNutritionWidgetModel } from "./nutrition-widget";

describe("buildNutritionWidgetModel", () => {
  it("builds a gamified daily summary from tracked calories and the coach goal", () => {
    const model = buildNutritionWidgetModel({
      totalKcal: 900,
      goalKcal: 1800,
      remainingKcal: 900,
      meals: {
        breakfast: { totalKcal: 400 },
        lunch: { totalKcal: 500 },
        snack: { totalKcal: 0 },
        dinner: { totalKcal: 0 },
      },
    });

    expect(model).toEqual({
      consumedKcal: 900,
      goalKcal: 1800,
      remainingKcal: 900,
      progressPercent: 50,
      meals: [
        { key: "breakfast", label: "Matin", totalKcal: 400 },
        { key: "lunch", label: "Midi", totalKcal: 500 },
        { key: "snack", label: "Collation", totalKcal: 0 },
        { key: "dinner", label: "Soir", totalKcal: 0 },
      ],
    });
  });

  it("keeps the progress bounded and does not invent an unset goal", () => {
    const model = buildNutritionWidgetModel({
      totalKcal: 2400,
      goalKcal: null,
      remainingKcal: null,
      meals: {},
    });

    expect(model.goalKcal).toBeNull();
    expect(model.remainingKcal).toBeNull();
    expect(model.progressPercent).toBeNull();
  });
});
