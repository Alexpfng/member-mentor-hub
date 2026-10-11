import { describe, expect, test } from "bun:test";
import { toProgramExerciseLibraryPayload } from "./program-exercise-library-payload";

describe("toProgramExerciseLibraryPayload", () => {
  test("copies library fields but never copies session prescriptions", () => {
    const payload = toProgramExerciseLibraryPayload({
      name: "  Rowing barre  ",
      color: "green",
      tempo: "2010",
      youtube_url: "https://youtube.com/watch?v=abcdefghijk",
      coach_notes: "  Garde le dos neutre  ",
      series: 4,
      reps: "8-10",
      charge: "50 kg",
      recup: "90s",
      rpe_target: 8,
    });

    expect(payload).toEqual({
      name: "Rowing barre",
      color: "green",
      intensity_code: null,
      category: null,
      default_tempo: "2010",
      youtube_url: "https://youtube.com/watch?v=abcdefghijk",
      youtube_id: "abcdefghijk",
      coach_notes: "Garde le dos neutre",
    });
    expect(payload).not.toHaveProperty("series");
    expect(payload).not.toHaveProperty("reps");
    expect(payload).not.toHaveProperty("charge");
    expect(payload).not.toHaveProperty("recup");
    expect(payload).not.toHaveProperty("rpe_target");
  });
});
