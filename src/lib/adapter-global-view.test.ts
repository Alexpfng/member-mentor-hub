import { describe, expect, it } from "bun:test";
import { describeGlobalDay, describeGlobalRpe } from "./adapter-global-view";

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

describe("describeGlobalRpe", () => {
  it("shows only each recorded member RPE in series order", () => {
    expect(describeGlobalRpe([7.5, 8, 9])).toEqual({
      member: "7.5, 8, 9",
    });
  });

  it("shows recorded member RPEs even when the coach has no target", () => {
    expect(describeGlobalRpe([8, 8.5, 9])).toEqual({
      member: "8, 8.5, 9",
    });
  });

  it("shows no value when the member has not recorded any series RPE", () => {
    expect(describeGlobalRpe([])).toEqual({ member: null });
  });
});
