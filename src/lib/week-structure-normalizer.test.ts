import { describe, expect, it } from "bun:test";

import { normalizeWeekStructure } from "./week-structure-normalizer";

describe("normalizeWeekStructure", () => {
  it("détache une queue cardio/boxe greffée à une séance muscu", () => {
    const normalized = normalizeWeekStructure({
      days: [
        {
          label: "Upper 2 focus push",
          exercises: [
            { name: "Développé incliné smith", color: "red", rpe_target: 8 },
            { name: "Cable chest flies", color: "yellow", rpe_target: 8 },
            { name: "Corde à sauter", color: "gray", rpe_target: "20'' / 10''" },
            { name: "Sac de frappe en échauffement", color: "gray", rpe_target: "1 à 2 rounds×5min" },
            { name: "Sac de frappe corps de séance", color: "gray", rpe_target: "3 rounds×3min fractionné" },
          ],
        },
      ],
    });

    expect(normalized.days).toHaveLength(2);
    expect(normalized.days?.[0]?.label).toBe("Upper 2 focus push");
    expect(normalized.days?.[0]?.exercises).toHaveLength(2);
    expect(normalized.days?.[1]?.label).toBe("Séance boxe");
    expect(normalized.days?.[1]?.exercises?.map((exercise) => exercise.name)).toEqual([
      "Corde à sauter",
      "Sac de frappe en échauffement",
      "Sac de frappe corps de séance",
    ]);
  });

  it("ne touche pas une vraie séance cardio", () => {
    const normalized = normalizeWeekStructure({
      days: [
        {
          label: "Séance course endurance fondamentale",
          exercises: [
            { name: "Montée de genoux", color: "gray", rpe_target: "30''" },
            { name: "Sprint progressif", color: "gray", rpe_target: "30m" },
            { name: "Course basse intensité", color: "gray", rpe_target: "RPE 4-5 max." },
          ],
        },
      ],
    });

    expect(normalized.days).toHaveLength(1);
    expect(normalized.days?.[0]?.exercises).toHaveLength(3);
  });

  it("ne scinde pas un simple échauffement isolé", () => {
    const normalized = normalizeWeekStructure({
      days: [
        {
          label: "Upper 1",
          exercises: [
            { name: "Corde à sauter", color: "gray", rpe_target: "2min" },
            { name: "Développé couché", color: "red", rpe_target: 8 },
          ],
        },
      ],
    });

    expect(normalized.days).toHaveLength(1);
    expect(normalized.days?.[0]?.exercises).toHaveLength(2);
  });
});
