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
