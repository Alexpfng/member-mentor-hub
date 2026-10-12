import { describe, expect, it } from "bun:test";

import {
  currentPublishedPlanningWeekNumber,
  currentPlanningWeekNumber,
  normalizeWeekStartsOn,
  planningWeekBounds,
  planningWeekBoundsForPublishedWeek,
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

  it("utilise la date de démarrage choisie à la publication de la semaine", () => {
    expect(planningWeekBoundsForPublishedWeek("2026-07-30", 2, "2026-08-17")).toEqual({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
    });
  });

  it("fait démarrer lundi une semaine publiée le dimanche pour la semaine à venir", () => {
    expect(planningWeekBoundsForPublishedWeek("2026-09-30", 3, "2026-10-11")).toEqual({
      weekStart: "2026-10-12",
      weekEnd: "2026-10-18",
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

  it("priorise une semaine publiée datée sur le calcul global du programme", () => {
    expect(
      currentPublishedPlanningWeekNumber(
        "2026-07-30",
        [{ weekNumber: 2, startDate: "2026-09-14" }],
        "2026-09-15",
      ),
    ).toBe(2);
  });

  it("garde S3 comme semaine courante quand elle est publiée le dimanche précédent", () => {
    expect(
      currentPublishedPlanningWeekNumber(
        "2026-09-21",
        [
          { weekNumber: 1, startDate: "2026-09-30" },
          { weekNumber: 2, startDate: "2026-10-06" },
          { weekNumber: 3, startDate: "2026-10-11" },
        ],
        "2026-10-12",
      ),
    ).toBe(3);
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
