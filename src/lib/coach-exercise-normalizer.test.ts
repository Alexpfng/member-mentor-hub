import { describe, expect, it } from "bun:test";

import { normalizeCoachEditableExercise, normalizeCoachEditableWeek } from "./coach-exercise-normalizer";

describe("normalizeCoachEditableExercise", () => {
  it("moves legacy text stored in rpe_target into coach notes for editing", () => {
    expect(
      normalizeCoachEditableExercise({
        name: "Mouvements balistiques hanches",
        rpe_target: "Echauffer les hanches",
        coach_notes: null,
      }),
    ).toEqual({
      name: "Mouvements balistiques hanches",
      rpe_target: null,
      coach_notes: "Echauffer les hanches",
    });
  });

  it("appends legacy text to existing coach notes without duplicating it", () => {
    expect(
      normalizeCoachEditableExercise({
        name: "Mouvements balistiques hanches",
        rpe_target: "Echauffer les hanches",
        coach_notes: "Course basse intensite",
      }),
    ).toEqual({
      name: "Mouvements balistiques hanches",
      rpe_target: null,
      coach_notes: "Course basse intensite\nEchauffer les hanches",
    });

    expect(
      normalizeCoachEditableExercise({
        name: "Mouvements balistiques hanches",
        rpe_target: "Echauffer les hanches",
        coach_notes: "Course basse intensite\nEchauffer les hanches",
      }).coach_notes,
    ).toBe("Course basse intensite\nEchauffer les hanches");
  });

  it("keeps numeric rpe targets and failure targets in their rpe field", () => {
    expect(normalizeCoachEditableExercise({ name: "A", rpe_target: "8,5" })).toEqual({
      name: "A",
      rpe_target: "8,5",
    });
    expect(normalizeCoachEditableExercise({ name: "B", rpe_target: "echec" })).toEqual({
      name: "B",
      rpe_target: "echec",
    });
  });

  it("normalizes all exercises in a coach week structure", () => {
    expect(
      normalizeCoachEditableWeek({
        days: [
          {
            label: "EF",
            exercises: [
              { name: "A", rpe_target: "Echauffer les hanches" },
              { name: "B", rpe_target: 8 },
            ],
          },
        ],
      }),
    ).toEqual({
      days: [
        {
          label: "EF",
          exercises: [
            { name: "A", rpe_target: null, coach_notes: "Echauffer les hanches" },
            { name: "B", rpe_target: 8 },
          ],
        },
      ],
    });
  });

  it("rattache les lignes de consigne endurance au bloc précédent au lieu d'en faire une carte", () => {
    expect(
      normalizeCoachEditableWeek({
        days: [
          {
            label: "Séance type fractionné (Durée : ~1h)",
            exercises: [
              {
                name: "BLOC B : 10x1'/1'",
                series: "1",
                reps: "10",
                tempo: "~ 6:00 / km",
                coach_notes: "OBJECTIF : rester propre",
              },
              {
                name: "travail de maintien d'allure",
                series: "-",
                reps: "-",
                recup: "1min recup",
                tempo: "~ 8:00 / km",
                rpe_target: null,
              },
              {
                name: "BLOC C. 6x30s à bloc",
                series: "1",
                reps: "6",
              },
            ],
          },
        ],
      }),
    ).toEqual({
      days: [
        {
          label: "Séance type fractionné (Durée : ~1h)",
          exercises: [
            {
              name: "BLOC B : 10x1'/1'",
              series: "1",
              reps: "10",
              tempo: "~ 6:00 / km",
              coach_notes:
                "OBJECTIF : rester propre\ntravail de maintien d'allure — Récup : 1min recup — Allure : ~ 8:00 / km",
            },
            {
              name: "BLOC C. 6x30s à bloc",
              series: "1",
              reps: "6",
            },
          ],
        },
      ],
    });
  });
});
