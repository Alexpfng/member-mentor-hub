import { describe, expect, it } from "bun:test";

import { adapterWeekHorizontalScrollWidth } from "./adapter-week-horizontal-scroll";

describe("adapterWeekHorizontalScrollWidth", () => {
  it("matches the adaptation board width including the add-session column", () => {
    expect(
      adapterWeekHorizontalScrollWidth({
        dayCount: 3,
        dayWidth: 360,
        addDayWidth: 140,
        gap: 14,
      }),
    ).toBe(1262);
  });

  it("returns zero when there is no day board", () => {
    expect(adapterWeekHorizontalScrollWidth({ dayCount: 0 })).toBe(0);
  });
});
