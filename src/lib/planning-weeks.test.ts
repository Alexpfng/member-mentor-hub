import { describe, expect, it } from "bun:test";

import {
  currentPlanningWeekNumber,
  normalizeWeekStartsOn,
  planningWeekBounds,
  weekWindowLabel,
} from "./planning-weeks";

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

  it("supporte un cycle personnalisé vendredi → jeudi", () => {
    expect(planningWeekBounds("2026-07-30", 1, { weekStartsOn: 5 })).toEqual({
      weekStart: "2026-07-31",
      weekEnd: "2026-08-06",
    });
    expect(planningWeekBounds("2026-07-30", 2, { weekStartsOn: 5 })).toEqual({
      weekStart: "2026-08-07",
      weekEnd: "2026-08-13",
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

  it("respecte une semaine perso vendredi → jeudi", () => {
    expect(currentPlanningWeekNumber("2026-07-30", "2026-08-06", { weekStartsOn: 5 })).toBe(1);
    expect(currentPlanningWeekNumber("2026-07-30", "2026-08-07", { weekStartsOn: 5 })).toBe(2);
  });
});

describe("planning week helpers", () => {
  it("retombe sur lundi si la valeur n'est pas valide", () => {
    expect(normalizeWeekStartsOn(undefined)).toBe(1);
    expect(normalizeWeekStartsOn(0)).toBe(1);
    expect(normalizeWeekStartsOn(9)).toBe(1);
  });

  it("formate la fenêtre lisible de la semaine perso", () => {
    expect(weekWindowLabel(1)).toBe("lundi → dimanche");
    expect(weekWindowLabel(5)).toBe("vendredi → jeudi");
    expect(weekWindowLabel(7)).toBe("dimanche → samedi");
  });
});
