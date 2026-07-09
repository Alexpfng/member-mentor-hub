import { describe, it, expect } from "bun:test";
import {
  parseNum,
  parsePaceToSec,
  formatPace,
  derivePaceSecPerKm,
  extractionToFormValues,
  formValuesToMetrics,
  computeRunComparison,
  runVerdict,
  type RunMetrics,
} from "./run-stats";

describe("parseNum", () => {
  it("parses French comma decimals", () => {
    expect(parseNum("8,2")).toBe(8.2);
  });
  it("parses English dot decimals and strips units", () => {
    expect(parseNum("142 bpm")).toBe(142);
  });
  it("returns null for empty/garbage", () => {
    expect(parseNum("")).toBeNull();
    expect(parseNum("—")).toBeNull();
    expect(parseNum(null)).toBeNull();
  });
});

describe("parsePaceToSec / formatPace", () => {
  it("parses mm:ss", () => {
    expect(parsePaceToSec("5:50")).toBe(350);
    expect(parsePaceToSec("5:50 /km")).toBe(350);
  });
  it("parses decimal minutes", () => {
    expect(parsePaceToSec("5.5")).toBe(330);
  });
  it("formats seconds back to mm:ss", () => {
    expect(formatPace(350)).toBe("5:50");
    expect(formatPace(360)).toBe("6:00");
  });
  it("handles rounding to 60s", () => {
    expect(formatPace(359.6)).toBe("6:00");
  });
  it("returns empty for null/invalid", () => {
    expect(formatPace(null)).toBe("");
    expect(parsePaceToSec("")).toBeNull();
  });
});

describe("derivePaceSecPerKm", () => {
  it("derives pace from distance and duration", () => {
    // 8 km in 40 min (2400s) => 300 s/km
    expect(derivePaceSecPerKm(8, 2400)).toBe(300);
  });
  it("returns null when inputs missing", () => {
    expect(derivePaceSecPerKm(null, 2400)).toBeNull();
    expect(derivePaceSecPerKm(8, 0)).toBeNull();
  });
});

describe("extractionToFormValues", () => {
  it("maps extraction and keeps French decimal for distance", () => {
    const v = extractionToFormValues({
      distanceKm: 8.2,
      durationMin: 48,
      elevationM: 120,
      avgHr: 142,
      pacePerKm: "5:50",
      confidence: 0.9,
    });
    expect(v).toEqual({
      distanceKm: "8,2",
      durationMin: "48",
      elevationM: "120",
      avgHr: "142",
      pace: "5:50",
    });
  });
  it("derives pace when not provided", () => {
    const v = extractionToFormValues({ distanceKm: 8, durationMin: 40 });
    expect(v.pace).toBe("5:00");
  });
  it("produces empty strings for missing fields", () => {
    const v = extractionToFormValues(null);
    expect(v).toEqual({ distanceKm: "", durationMin: "", elevationM: "", avgHr: "", pace: "" });
  });
});

describe("formValuesToMetrics", () => {
  it("normalizes form strings to canonical metrics", () => {
    const m = formValuesToMetrics({
      distanceKm: "8,2",
      durationMin: "48",
      elevationM: "120",
      avgHr: "142",
      pace: "5:50",
      rpe: 6,
    });
    expect(m).toEqual({
      distanceKm: 8.2,
      durationSec: 2880,
      elevationM: 120,
      avgHr: 142,
      paceSecPerKm: 350,
      rpe: 6,
    });
  });
  it("derives pace when absent", () => {
    const m = formValuesToMetrics({ distanceKm: "8", durationMin: "40" });
    expect(m.paceSecPerKm).toBe(300);
  });
});

describe("computeRunComparison", () => {
  const prev: RunMetrics = {
    distanceKm: 8,
    durationSec: 2880,
    elevationM: 100,
    avgHr: 145,
    paceSecPerKm: 360,
    rpe: 7,
  };

  it("returns empty when no previous run", () => {
    expect(computeRunComparison(null, prev)).toEqual([]);
  });

  it("flags a faster pace as good (down)", () => {
    const curr: RunMetrics = { ...prev, paceSecPerKm: 340 };
    const pace = computeRunComparison(prev, curr).find((d) => d.key === "pace")!;
    expect(pace.direction).toBe("down");
    expect(pace.sentiment).toBe("good");
    expect(pace.delta).toBe(-20);
  });

  it("flags a slower pace as bad (up)", () => {
    const curr: RunMetrics = { ...prev, paceSecPerKm: 390 };
    const pace = computeRunComparison(prev, curr).find((d) => d.key === "pace")!;
    expect(pace.direction).toBe("up");
    expect(pace.sentiment).toBe("bad");
  });

  it("treats a tiny pace change as 'same'", () => {
    const curr: RunMetrics = { ...prev, paceSecPerKm: 361 };
    const pace = computeRunComparison(prev, curr).find((d) => d.key === "pace")!;
    expect(pace.direction).toBe("same");
    expect(pace.sentiment).toBe("neutral");
  });

  it("more distance is good", () => {
    const curr: RunMetrics = { ...prev, distanceKm: 10 };
    const dist = computeRunComparison(prev, curr).find((d) => d.key === "distance")!;
    expect(dist.direction).toBe("up");
    expect(dist.sentiment).toBe("good");
  });

  it("elevation and HR stay neutral", () => {
    const curr: RunMetrics = { ...prev, elevationM: 300, avgHr: 130 };
    const cmp = computeRunComparison(prev, curr);
    expect(cmp.find((d) => d.key === "elevation")!.sentiment).toBe("neutral");
    expect(cmp.find((d) => d.key === "avgHr")!.sentiment).toBe("neutral");
  });
});

describe("runVerdict", () => {
  const base: RunMetrics = {
    distanceKm: 8,
    durationSec: 2880,
    elevationM: 100,
    avgHr: 145,
    paceSecPerKm: 360,
    rpe: 7,
  };

  it("celebrates a first run", () => {
    expect(runVerdict([])).toContain("Première course");
  });
  it("celebrates pace progress", () => {
    const v = runVerdict(computeRunComparison(base, { ...base, paceSecPerKm: 340 }));
    expect(v).toContain("progrès");
  });
  it("notes more distance at steady pace", () => {
    const v = runVerdict(computeRunComparison(base, { ...base, distanceKm: 11 }));
    expect(v).toContain("distance");
  });
  it("flags a slower pace gently", () => {
    const v = runVerdict(computeRunComparison(base, { ...base, paceSecPerKm: 400 }));
    expect(v.toLowerCase()).toContain("baisse");
  });
});
