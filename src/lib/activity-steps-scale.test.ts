import { describe, expect, it } from "bun:test";
import {
  clampSteps,
  formatStepsValue,
  getStepsScaleMax,
  nudgeSteps,
  parseStepsValue,
} from "./activity-steps-scale";

describe("activity steps scale", () => {
  it("borne les pas dans les limites acceptees par le serveur", () => {
    expect(clampSteps(-1200)).toBe(0);
    expect(clampSteps(8500)).toBe(8500);
    expect(clampSteps(250000)).toBe(200000);
  });

  it("dimensionne l'echelle autour de l'objectif quand il existe", () => {
    expect(getStepsScaleMax(null, "")).toBe(20000);
    expect(getStepsScaleMax(8000, "")).toBe(20000);
    expect(getStepsScaleMax(18000, "")).toBe(27000);
    expect(getStepsScaleMax(8000, "24500")).toBe(25000);
  });

  it("augmente ou diminue par paliers lisibles", () => {
    expect(nudgeSteps("", 500)).toBe("500");
    expect(nudgeSteps("8 000", 500)).toBe("8500");
    expect(nudgeSteps("250", -500)).toBe("0");
  });

  it("parse et formate les valeurs de pas", () => {
    expect(parseStepsValue("8 250")).toBe(8250);
    expect(parseStepsValue("")).toBeNull();
    expect(parseStepsValue("abc")).toBeNull();
    expect(formatStepsValue(12500)).toBe("12 500");
  });
});
