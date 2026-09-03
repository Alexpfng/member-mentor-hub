import { describe, expect, test } from "bun:test";

import {
  buildEarlyFinishMemberNote,
  buildExpertExerciseFeedbackRows,
  buildMemberCommentFeedbackRows,
  buildSkippedPainFeedbackRows,
  normalizeExpertRpeForStorage,
  trimOptionalComment,
} from "./live-session-feedback";

describe("normalizeExpertRpeForStorage", () => {
  test("keeps regular rpe values as-is", () => {
    expect(normalizeExpertRpeForStorage(8.5)).toBe(8.5);
  });

  test("caps KO values to 10 for storage", () => {
    expect(normalizeExpertRpeForStorage(11)).toBe(10);
  });
});

describe("trimOptionalComment", () => {
  test("returns null for empty comments", () => {
    expect(trimOptionalComment("   ")).toBeNull();
  });

  test("keeps the trimmed comment text", () => {
    expect(trimOptionalComment("  trop dur aujourd'hui  ")).toBe("trop dur aujourd'hui");
  });
});

describe("buildExpertExerciseFeedbackRows", () => {
  test("builds feedback rows with optional member comments", () => {
    expect(
      buildExpertExerciseFeedbackRows(
        "session-1",
        [
          {
            exerciseName: "Rowing barre",
            rows: [{ stepIdx: 0, setNumber: 1, weight: 40, reps: 8, rpe: 8 }],
          },
          {
            exerciseName: "Back squat",
            rows: [{ stepIdx: 1, setNumber: 1, weight: 80, reps: 5, rpe: 10 }],
          },
        ],
        {
          "Rowing barre": 8.5,
          "Back squat": 11,
        },
        {
          "Rowing barre": "bonne sensation",
          "Back squat": "échec sur la dernière rep",
        },
      ),
    ).toEqual([
      {
        session_id: "session-1",
        exercise_name: "Rowing barre",
        rpe: 8.5,
        could_not_do: false,
        felt_too_hard: false,
        member_comment: "bonne sensation",
      },
      {
        session_id: "session-1",
        exercise_name: "Back squat",
        rpe: 10,
        could_not_do: true,
        felt_too_hard: true,
        member_comment: "échec sur la dernière rep",
      },
    ]);
  });
});

describe("buildMemberCommentFeedbackRows", () => {
  const groups = [
    {
      exerciseName: "Rowing barre",
      rows: [{ stepIdx: 0, setNumber: 1, weight: 40, reps: 8, rpe: 8 }],
    },
    {
      exerciseName: "Back squat",
      rows: [{ stepIdx: 1, setNumber: 1, weight: 80, reps: 5, rpe: 9 }],
    },
  ];

  test("ne remonte que les exercices réellement commentés", () => {
    expect(
      buildMemberCommentFeedbackRows("session-2", groups, {
        "Rowing barre": "  barre trop basse  ",
        "Back squat": "   ",
      }),
    ).toEqual([
      {
        session_id: "session-2",
        exercise_name: "Rowing barre",
        member_comment: "barre trop basse",
      },
    ]);
  });

  test("n'écrit aucun RPE de bloc — il est déjà saisi série par série", () => {
    const [row] = buildMemberCommentFeedbackRows("session-2", groups, {
      "Back squat": "genou qui tire",
    });
    expect(row).not.toHaveProperty("rpe");
  });

  test("ne produit rien quand aucun commentaire n'est saisi", () => {
    expect(buildMemberCommentFeedbackRows("session-2", groups, {})).toEqual([]);
  });
});

describe("buildSkippedPainFeedbackRows", () => {
  test("creates one could-not-do feedback per pain-skipped exercise", () => {
    expect(
      buildSkippedPainFeedbackRows("session-3", {
        0: {
          exo: "Fentes bulgares",
          weight: null,
          reps: null,
          rpe: null,
          skipped: "pain",
          note: "Tendon d'Achille",
        },
        1: {
          exo: "Fentes bulgares",
          weight: null,
          reps: null,
          rpe: null,
          skipped: "pain",
          note: "Tendon d'Achille",
        },
        2: { exo: "Rowing", weight: 40, reps: 10, rpe: 8 },
      }),
    ).toEqual([
      {
        session_id: "session-3",
        exercise_name: "Fentes bulgares",
        rpe: null,
        could_not_do: true,
        felt_too_hard: true,
        member_comment: "Douleur signalée : Tendon d'Achille",
      },
    ]);
  });
});

describe("buildEarlyFinishMemberNote", () => {
  test("adds the unfinished exercise list and member reason", () => {
    expect(
      buildEarlyFinishMemberNote("Fatigue générale", ["Tractions", "Presse"], "Trop mal au tendon"),
    ).toBe(
      "Fatigue générale\n\nSéance terminée avant la fin. Exercices non faits : Tractions, Presse. Raison : Trop mal au tendon",
    );
  });

  test("works without an existing session note", () => {
    expect(buildEarlyFinishMemberNote("", ["Tractions"], "Plus le temps")).toBe(
      "Séance terminée avant la fin. Exercices non faits : Tractions. Raison : Plus le temps",
    );
  });
});
