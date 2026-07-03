import { describe, expect, test } from "bun:test";

import {
  getCoachMetricLabel,
  getCoachMetricValue,
  getExpertEmomLoggedValue,
  getExpertSetLoggedValue,
} from "./session-prescription";

describe("getExpertSetLoggedValue", () => {
  test("uses prescribed reps for standard expert exercises", () => {
    expect(
      getExpertSetLoggedValue(
        { name: "Back squat", reps: "8", tempo: null },
        3,
        1,
      ),
    ).toEqual({ value: 8, kind: "reps" });
  });

  test("uses prescribed seconds for timed isometric exercises", () => {
    expect(
      getExpertSetLoggedValue(
        { name: "Star plank isométrie", reps: "20s / côté", tempo: "ISO" },
        2,
        1,
      ),
    ).toEqual({ value: 20, kind: "seconds" });
  });
});

describe("getExpertEmomLoggedValue", () => {
  test("computes total prescribed reps for simple emom blocks", () => {
    expect(getExpertEmomLoggedValue({ series: "10", reps: "3", block_type: "emom" }, 10)).toBe(30);
  });

  test("computes total prescribed reps for alternating emom blocks", () => {
    expect(getExpertEmomLoggedValue({ series: "10", reps: "3/4", block_type: "emom" }, 10)).toBe(35);
  });
});

describe("coach metric display", () => {
  test("uses SECONDES label for timed isometric exercises", () => {
    expect(getCoachMetricLabel({ name: "Star plank isométrie", reps: "20s / côté" })).toBe("SECONDES");
    expect(getCoachMetricValue({ name: "Star plank isométrie", reps: "20s / côté" }, 20)).toBe("20 s");
  });

  test("keeps REPS label for regular exercises", () => {
    expect(getCoachMetricLabel({ name: "Rowing barre", reps: "8" })).toBe("REPS");
    expect(getCoachMetricValue({ name: "Rowing barre", reps: "8" }, 8)).toBe("8");
  });
});
