import { MEAL_LABELS, MEAL_ORDER } from "@/lib/nutrition";

type SummaryInput = {
  totalKcal?: number | null;
  goalKcal?: number | null;
  remainingKcal?: number | null;
  meals?: Partial<Record<(typeof MEAL_ORDER)[number], { totalKcal?: number | null }>> | null;
} | null;

export function buildNutritionWidgetModel(summary: SummaryInput) {
  const consumedKcal = Math.max(0, Math.round(summary?.totalKcal ?? 0));
  const rawGoal = summary?.goalKcal;
  const goalKcal = rawGoal != null && rawGoal > 0 ? Math.round(rawGoal) : null;

  return {
    consumedKcal,
    goalKcal,
    remainingKcal: summary?.remainingKcal ?? null,
    progressPercent:
      goalKcal != null ? Math.min(100, Math.round((consumedKcal / goalKcal) * 100)) : null,
    meals: MEAL_ORDER.map((key) => ({
      key,
      label: MEAL_LABELS[key],
      totalKcal: Math.max(0, Math.round(summary?.meals?.[key]?.totalKcal ?? 0)),
    })),
  };
}
