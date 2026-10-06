import { describe, expect, test } from "bun:test";
import {
  getProgramExerciseColorFromIntensity,
  getProgramExerciseLibraryIntensity,
} from "./library-exercise-payload";
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

describe("getProgramExerciseColorFromIntensity", () => {
  test("donne une couleur programme aux exercices créés avec une intensité bibliothèque", () => {
    expect(getProgramExerciseColorFromIntensity("semi_epuisant")).toBe("green");
    expect(getProgramExerciseColorFromIntensity("epuisant")).toBe("red");
    expect(getProgramExerciseColorFromIntensity("explosif")).toBe("yellow");
  });

  test("ne force pas de pastille pour les exercices non classés", () => {
    expect(getProgramExerciseColorFromIntensity("non_classe")).toBeNull();
    expect(getProgramExerciseColorFromIntensity(null)).toBeNull();
  });
});
