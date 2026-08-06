import { describe, expect, it } from "bun:test";

import { currentPlanningWeekNumber, planningWeekBounds } from "./planning-weeks";

describe("planningWeekBounds", () => {
  it("ancre la première semaine sur le lundi de la semaine calendrier", () => {
    expect(planningWeekBounds("2026-07-30", 1)).toEqual({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
    });
  });

  it("fait avancer les semaines par blocs lundi → dimanche", () => {
    expect(planningWeekBounds("2026-07-30", 2)).toEqual({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
    });
  });
});

describe("currentPlanningWeekNumber", () => {
  it("garde le membre dans la semaine 1 jusqu'au dimanche inclus", () => {
    expect(currentPlanningWeekNumber("2026-07-30", "2026-08-02")).toBe(1);
  });

  it("bascule en semaine 2 le lundi suivant", () => {
    expect(currentPlanningWeekNumber("2026-07-30", "2026-08-03")).toBe(2);
  });

  it("évite les semaines 0 avant le démarrage", () => {
    expect(currentPlanningWeekNumber("2026-07-30", "2026-07-28")).toBe(1);
  });
});
