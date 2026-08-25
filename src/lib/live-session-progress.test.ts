import { describe, expect, it } from "bun:test";

import {
  allExercisesDone,
  buildExerciseOverview,
  groupExpertRecapByExercise,
  isExerciseDone,
  nextUndoneExerciseName,
  type ExpertSavedStep,
  type SessionProgressStep,
} from "./live-session-progress";

const steps: SessionProgressStep[] = [
  { index: 0, exerciseName: "Squat", kind: "set" },
  { index: 1, exerciseName: "Squat", kind: "set" },
  { index: 2, exerciseName: "Row", kind: "set" },
  { index: 3, exerciseName: "Gainage", kind: "set" },
];

describe("groupExpertRecapByExercise", () => {
  it("groups saved expert rows by exercise while preserving auto-derived weight and reps", () => {
    const savedByStep: Record<number, ExpertSavedStep> = {
      0: { exo: "Squat", weight: 80, reps: 8, rpe: null },
      1: { exo: "Squat", weight: 80, reps: 8, rpe: null, note: "genou qui tire" },
      2: { exo: "Row", weight: 42.5, reps: 10, rpe: null },
    };

    expect(groupExpertRecapByExercise(savedByStep)).toEqual([
      {
        exerciseName: "Squat",
        rows: [
          { stepIdx: 0, setNumber: 1, weight: 80, reps: 8, rpe: null, note: null },
          {
            stepIdx: 1,
            setNumber: 2,
            weight: 80,
            reps: 8,
            rpe: null,
            note: "genou qui tire",
          },
        ],
      },
      {
        exerciseName: "Row",
        rows: [{ stepIdx: 2, setNumber: 1, weight: 42.5, reps: 10, rpe: null, note: null }],
      },
    ]);
  });
});

describe("buildExerciseOverview", () => {
  it("marks done, current and remaining exercises from saved steps and current position", () => {
    const savedByStep: Record<number, ExpertSavedStep> = {
      0: { exo: "Squat", weight: 80, reps: 8, rpe: null },
      1: { exo: "Squat", weight: 80, reps: 8, rpe: null },
    };

    expect(buildExerciseOverview(["Squat", "Row", "Gainage"], steps, savedByStep, 2)).toEqual([
      { exerciseName: "Squat", state: "done", completedSteps: 2, totalSteps: 2 },
      { exerciseName: "Row", state: "current", completedSteps: 0, totalSteps: 1 },
      { exerciseName: "Gainage", state: "todo", completedSteps: 0, totalSteps: 1 },
    ]);
  });

  it("treats an exercise as done only when all its tracked steps are completed", () => {
    const savedByStep: Record<number, ExpertSavedStep> = {
      0: { exo: "Squat", weight: 80, reps: 8, rpe: null },
    };

    expect(buildExerciseOverview(["Squat", "Row"], steps, savedByStep, 1)).toEqual([
      { exerciseName: "Squat", state: "current", completedSteps: 1, totalSteps: 2 },
      { exerciseName: "Row", state: "todo", completedSteps: 0, totalSteps: 1 },
    ]);
  });
});

describe("nextUndoneExerciseName", () => {
  const names = ["Squat", "Row", "Gainage"];
  const done = (...idx: number[]): Record<number, ExpertSavedStep> =>
    Object.fromEntries(idx.map((i) => [i, { exo: "x", weight: null, reps: null, rpe: null }]));

  it("continues forward to the next un-done exercise", () => {
    // Squat fait (0,1), on est sur Squat → l'exercice suivant non fait est Row.
    expect(nextUndoneExerciseName(names, steps, done(0, 1), "Squat")).toBe("Row");
  });

  it("wraps back to an earlier skipped exercise once nothing remains ahead", () => {
    // On vient de finir le dernier (Gainage) mais Squat/Row ont été sautés :
    // on reboucle au tout premier exo non fait.
    expect(nextUndoneExerciseName(names, steps, done(3), "Gainage")).toBe("Squat");
  });

  it("skips already-done exercises when wrapping", () => {
    // Squat fait, Row sauté, on finit Gainage → on reboucle sur Row, pas Squat.
    expect(nextUndoneExerciseName(names, steps, done(0, 1, 3), "Gainage")).toBe("Row");
  });

  it("returns null when every exercise is done", () => {
    expect(nextUndoneExerciseName(names, steps, done(0, 1, 2, 3), "Gainage")).toBeNull();
  });

  it("counts an exercise done only when ALL its steps are saved", () => {
    // Row et Gainage faits, on finit sur Gainage ; Squat n'a qu'une de ses deux
    // séries saisies → il reste à faire, on y revient.
    expect(nextUndoneExerciseName(names, steps, done(0, 2, 3), "Gainage")).toBe("Squat");
  });

  it("ignores exercises that have no work step to log", () => {
    const withGhost = [...names, "Échauffement"]; // aucun step associé
    expect(nextUndoneExerciseName(withGhost, steps, done(0, 1, 2, 3), "Gainage")).toBeNull();
  });
});

describe("isExerciseDone / allExercisesDone", () => {
  const names = ["Squat", "Row", "Gainage"];
  const done = (...idx: number[]): Record<number, ExpertSavedStep> =>
    Object.fromEntries(idx.map((i) => [i, { exo: "x", weight: null, reps: null, rpe: null }]));

  it("marks an exercise done only when every one of its steps is saved", () => {
    expect(isExerciseDone("Squat", steps, done(0))).toBe(false); // 1/2 séries
    expect(isExerciseDone("Squat", steps, done(0, 1))).toBe(true); // 2/2
    expect(isExerciseDone("Row", steps, done(2))).toBe(true);
  });

  it("never counts an exercise with no work step as done", () => {
    expect(isExerciseDone("Échauffement", steps, done(0, 1, 2, 3))).toBe(false);
  });

  it("is true only once all loggable exercises are complete", () => {
    // Scénario de Léo : A fait, C fait, on finit B (le dernier restant) → séance finie.
    expect(allExercisesDone(names, steps, done(0, 1, 2))).toBe(false); // Gainage pas fait
    expect(allExercisesDone(names, steps, done(0, 1, 3))).toBe(false); // Row pas fait
    expect(allExercisesDone(names, steps, done(0, 1, 2, 3))).toBe(true); // tout fait
  });

  it("ignores ghost exercises (no work step) when deciding the session is over", () => {
    const withGhost = [...names, "Échauffement"];
    expect(allExercisesDone(withGhost, steps, done(0, 1, 2, 3))).toBe(true);
  });
});
