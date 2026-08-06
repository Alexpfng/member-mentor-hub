import { describe, expect, test } from "bun:test";
import { getProgramExerciseLibraryIntensity } from "./library-exercise-payload";
import { sanitizeLibraryExerciseNotes } from "./library-exercise-payload";

describe("sanitizeLibraryExerciseNotes", () => {
  test("limite les notes importées à 2000 caractères", () => {
    const notes = `  ${"a".repeat(2050)}  `;

    expect(sanitizeLibraryExerciseNotes(notes)).toHaveLength(2000);
  });
});

describe("getProgramExerciseLibraryIntensity", () => {
  test("ne transforme pas une couleur de carte en code intensité Supabase", () => {
    expect(getProgramExerciseLibraryIntensity("yellow")).toBeNull();
    expect(getProgramExerciseLibraryIntensity("red")).toBeNull();
    expect(getProgramExerciseLibraryIntensity("green")).toBeNull();
  });
});
