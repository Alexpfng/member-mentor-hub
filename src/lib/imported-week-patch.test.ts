import { describe, expect, it } from "bun:test";
import { mergeImportedWeeksIntoProgramStructure } from "./imported-week-patch";

describe("mergeImportedWeeksIntoProgramStructure", () => {
  it("replaces only imported week numbers and preserves the rest of the active program", () => {
    const base = {
      weeks: [
        { days: [{ label: "S1 J1", exercises: [{ name: "old 1" }] }] },
        { days: [{ label: "S2 J1", exercises: [{ name: "old 2" }] }] },
        { days: [{ label: "S3 J1", exercises: [{ name: "old 3" }] }] },
        { days: [{ label: "S4 J1", exercises: [{ name: "old 4" }] }] },
        { days: [{ label: "S5 J1", exercises: [{ name: "old 5" }] }] },
      ],
    };

    const merged = mergeImportedWeeksIntoProgramStructure(base, [
      { number: 5, days: [{ label: "S5 MAJ", exercises: [{ name: "new 5" }] }] },
    ]);

    expect(merged.weeks).toHaveLength(5);
    expect(merged.weeks[0]).toEqual(base.weeks[0]);
    expect(merged.weeks[1]).toEqual(base.weeks[1]);
    expect(merged.weeks[2]).toEqual(base.weeks[2]);
    expect(merged.weeks[3]).toEqual(base.weeks[3]);
    expect(merged.weeks[4]).toEqual({
      days: [{ label: "S5 MAJ", exercises: [{ name: "new 5" }] }],
    });
  });

  it("extends the structure when an imported week is beyond the template duration", () => {
    const merged = mergeImportedWeeksIntoProgramStructure(
      { weeks: [{ days: [{ label: "S1", exercises: [] }] }] },
      [{ number: 3, days: [{ label: "S3 ajoutée", exercises: [{ name: "exo" }] }] }],
    );

    expect(merged.weeks).toEqual([
      { days: [{ label: "S1", exercises: [] }] },
      { days: [] },
      { days: [{ label: "S3 ajoutée", exercises: [{ name: "exo" }] }] },
    ]);
  });
});
