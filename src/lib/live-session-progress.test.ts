import { describe, expect, it } from "bun:test";

import {
  buildExerciseOverview,
  groupExpertRecapByExercise,
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
      1: { exo: "Squat", weight: 80, reps: 8, rpe: null },
      2: { exo: "Row", weight: 42.5, reps: 10, rpe: null },
    };

    expect(groupExpertRecapByExercise(savedByStep)).toEqual([
      {
        exerciseName: "Squat",
        rows: [
          { stepIdx: 0, setNumber: 1, weight: 80, reps: 8, rpe: null },
          { stepIdx: 1, setNumber: 2, weight: 80, reps: 8, rpe: null },
        ],
      },
      {
        exerciseName: "Row",
        rows: [{ stepIdx: 2, setNumber: 1, weight: 42.5, reps: 10, rpe: null }],
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
