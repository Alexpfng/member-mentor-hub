import { describe, expect, it } from "bun:test";
import { describeGlobalDay } from "./adapter-global-view";

describe("describeGlobalDay", () => {
  it("makes each session selectable by name and previews its contents", () => {
    expect(
      describeGlobalDay({
        label: "Full-body 1",
        exercises: [{ name: "Squat" }, { name: "Row" }],
      }),
    ).toEqual({
      label: "Full-body 1 · 2 exercices",
      contents: "Squat · Row",
    });
  });

  it("uses a stable fallback for empty sessions", () => {
    expect(describeGlobalDay({ label: "", exercises: [] })).toEqual({
      label: "Séance · 0 exercice",
      contents: "Aucun exercice",
    });
  });
});
