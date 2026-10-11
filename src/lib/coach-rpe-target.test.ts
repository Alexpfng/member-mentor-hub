import { describe, expect, it } from "bun:test";
import { getNumericCoachRpeTarget } from "./coach-rpe-target";

describe("getNumericCoachRpeTarget", () => {
  it("does not interpret an absent target as zero", () => {
    expect(getNumericCoachRpeTarget(null)).toBeNull();
    expect(getNumericCoachRpeTarget(undefined)).toBeNull();
    expect(getNumericCoachRpeTarget("  ")).toBeNull();
  });

  it("parses decimal comma targets and ignores free-text instructions", () => {
    expect(getNumericCoachRpeTarget("8,5")).toBe(8.5);
    expect(getNumericCoachRpeTarget("échec")).toBeNull();
    expect(getNumericCoachRpeTarget("RPE libre")).toBeNull();
  });
});
