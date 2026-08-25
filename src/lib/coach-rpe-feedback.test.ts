import { describe, expect, it } from "bun:test";

import {
  buildCoachExerciseFeedback,
  getQuickRpePopoverPlacement,
} from "./coach-rpe-feedback";

describe("buildCoachExerciseFeedback", () => {
  it("garde le dernier rpe réellement saisi au lieu de calculer une moyenne", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [],
      feedbacks: [
        {
          exercise_name: "Leg curl assis en tempo",
          rpe: 8.5,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:00:00.000Z",
        },
        {
          exercise_name: "Leg curl assis en tempo",
          rpe: 9,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:05:00.000Z",
        },
      ],
      pains: [],
    });

    expect(feedback["leg curl assis en tempo"]?.rpe).toBe(9);
  });

  it("prend la valeur la plus récente entre les logs et les feedbacks", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [
        {
          exercise_name: "Hack squat",
          rpe: 7.5,
          completed: true,
          logged_at: "2026-08-06T14:10:00.000Z",
        },
      ],
      feedbacks: [
        {
          exercise_name: "Hack squat",
          rpe: 8,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:12:00.000Z",
        },
      ],
      pains: [],
    });

    expect(feedback["hack squat"]?.rpe).toBe(8);
  });

  it("arrondit les anciens rpe à des pas de 0,5 côté coach", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [],
      feedbacks: [
        {
          exercise_name: "Leg curl assis en tempo",
          rpe: 8.8,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:05:00.000Z",
        },
      ],
      pains: [],
    });

    expect(feedback["leg curl assis en tempo"]?.rpe).toBe(9);
  });

  it("remonte la charge réellement utilisée par le coaché", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [
        {
          exercise_name: "Leg curl assis en tempo",
          rpe: 8,
          completed: true,
          logged_at: "2026-08-06T14:10:00.000Z",
          weight_kg: 40,
          reps: 10,
        },
        {
          exercise_name: "Leg curl assis en tempo",
          rpe: 8.5,
          completed: true,
          logged_at: "2026-08-06T14:11:00.000Z",
          weight_kg: 50,
          reps: 8,
        },
      ],
      feedbacks: [],
      pains: [],
    });

    expect(feedback["leg curl assis en tempo"]?.loadLabel).toBe("40–50kg");
  });
});

describe("getQuickRpePopoverPlacement", () => {
  it("ouvre le menu vers le haut quand il manque de place sous le bouton", () => {
    expect(
      getQuickRpePopoverPlacement({
        anchorTop: 640,
        anchorBottom: 668,
        popoverHeight: 340,
        viewportHeight: 800,
      }),
    ).toBe("top");
  });

  it("ouvre le menu vers le bas quand la place est suffisante", () => {
    expect(
      getQuickRpePopoverPlacement({
        anchorTop: 120,
        anchorBottom: 148,
        popoverHeight: 340,
        viewportHeight: 800,
      }),
    ).toBe("bottom");
  });
});

describe("buildCoachExerciseFeedback — commentaires du membre", () => {
  it("remonte les notes de série et les commentaires de bloc, du plus récent au plus ancien", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [
        {
          exercise_name: "Développé couché",
          rpe: 8,
          completed: true,
          logged_at: "2026-08-06T14:00:00.000Z",
          note: "banc pris, fait aux haltères",
        },
      ],
      feedbacks: [
        {
          exercise_name: "Développé couché",
          rpe: 9,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:20:00.000Z",
          member_comment: "épaule un peu sensible",
        },
      ],
      pains: [],
    });

    expect(feedback["developpe couche"]?.comments).toEqual([
      "épaule un peu sensible",
      "banc pris, fait aux haltères",
    ]);
  });

  it("ne garde qu'une fois un commentaire dupliqué entre série et bloc", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [
        {
          exercise_name: "Tractions",
          rpe: 9,
          completed: true,
          logged_at: "2026-08-06T14:00:00.000Z",
          note: "  échec sur la dernière  ",
        },
      ],
      feedbacks: [
        {
          exercise_name: "Tractions",
          rpe: 9,
          felt_too_hard: false,
          felt_too_easy: false,
          could_not_do: false,
          created_at: "2026-08-06T14:30:00.000Z",
          member_comment: "échec sur la dernière",
        },
      ],
      pains: [],
    });

    expect(feedback["tractions"]?.comments).toEqual(["échec sur la dernière"]);
  });

  it("renvoie une liste vide quand le membre n'a rien écrit", () => {
    const feedback = buildCoachExerciseFeedback({
      logs: [
        {
          exercise_name: "Soulevé de terre",
          rpe: 7,
          completed: true,
          logged_at: "2026-08-06T14:00:00.000Z",
        },
      ],
      feedbacks: [],
      pains: [],
    });

    expect(feedback["souleve de terre"]?.comments).toEqual([]);
  });
});
