import { describe, expect, it } from "bun:test";
import { deriveAssignmentStartDate } from "./assignment-start";

describe("deriveAssignmentStartDate", () => {
  it("keeps the selected date when starting at week 1", () => {
    expect(deriveAssignmentStartDate("2026-06-16", 1)).toBe("2026-06-16");
  });

  it("backs up the stored start date when starting at week 4", () => {
    expect(deriveAssignmentStartDate("2026-06-16", 4)).toBe("2026-05-26");
  });

  it("backs up by full weeks only", () => {
    expect(deriveAssignmentStartDate("2026-06-16", 2)).toBe("2026-06-09");
  });
});
