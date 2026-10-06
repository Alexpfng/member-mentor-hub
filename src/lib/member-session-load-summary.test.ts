import { describe, expect, it } from "bun:test";

import { buildSessionLoadSummaries } from "./member-session-load-summary";

describe("buildSessionLoadSummaries", () => {
  it("résume les charges réellement utilisées par séance et par exercice", () => {
    expect(
      buildSessionLoadSummaries([
        { session_id: "s1", exercise_name: "Chest press", weight_kg: 25 },
        { session_id: "s1", exercise_name: "Chest press", weight_kg: 35 },
        { session_id: "s1", exercise_name: "Chest press", weight_kg: 40 },
        { session_id: "s1", exercise_name: "Rowing", weight_kg: 24 },
        { session_id: "s2", exercise_name: "Squat", weight_kg: 50 },
      ]),
    ).toEqual({
      s1: [
        { exerciseName: "Chest press", loadLabel: "25–40kg" },
        { exerciseName: "Rowing", loadLabel: "24kg" },
      ],
      s2: [{ exerciseName: "Squat", loadLabel: "50kg" }],
    });
  });
});
