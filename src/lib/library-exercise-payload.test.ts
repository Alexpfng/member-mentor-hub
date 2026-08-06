import { describe, expect, test } from "bun:test";
import { sanitizeLibraryExerciseNotes } from "./library-exercise-payload";

describe("sanitizeLibraryExerciseNotes", () => {
  test("limite les notes importées à 2000 caractères", () => {
    const notes = `  ${"a".repeat(2050)}  `;

    expect(sanitizeLibraryExerciseNotes(notes)).toHaveLength(2000);
  });
});
