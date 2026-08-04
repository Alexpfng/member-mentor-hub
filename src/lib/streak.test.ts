import { describe, expect, it } from "bun:test";

import { mondayOf, weeklyStreak } from "./streak";

describe("mondayOf", () => {
  it("ramène n'importe quel jour au lundi de sa semaine", () => {
    expect(mondayOf("2026-08-04")).toBe("2026-08-03"); // mardi → lundi
    expect(mondayOf("2026-08-03")).toBe("2026-08-03"); // lundi → lui-même
    expect(mondayOf("2026-08-09")).toBe("2026-08-03"); // dimanche → lundi d'avant
  });

  it("accepte un horodatage complet", () => {
    expect(mondayOf("2026-08-04T18:42:00.000Z")).toBe("2026-08-03");
  });
});

describe("weeklyStreak", () => {
  const today = "2026-08-04"; // mardi, semaine du 3 août

  function week(mondayISO: string, count: number) {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(`${mondayISO}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  it("renvoie 0 sans séance", () => {
    expect(weeklyStreak([], today)).toBe(0);
  });

  it("compte les semaines consécutives à 3 séances", () => {
    const dates = [...week("2026-07-27", 3), ...week("2026-07-20", 4)];
    expect(weeklyStreak(dates, today)).toBe(2);
  });

  it("ne casse pas la série sur la semaine en cours, encore ouverte", () => {
    // Une seule séance faite cette semaine : la série des semaines pleines tient.
    const dates = [...week("2026-08-03", 1), ...week("2026-07-27", 3)];
    expect(weeklyStreak(dates, today)).toBe(1);
  });

  it("compte la semaine en cours dès qu'elle est complète", () => {
    const dates = [...week("2026-08-03", 3), ...week("2026-07-27", 3)];
    expect(weeklyStreak(dates, today)).toBe(2);
  });

  it("s'arrête à la première semaine creuse", () => {
    const dates = [...week("2026-07-27", 3), ...week("2026-07-13", 5)];
    expect(weeklyStreak(dates, today)).toBe(1);
  });

  it("ignore les dates absentes", () => {
    const dates = [null, undefined, ...week("2026-07-27", 3)];
    expect(weeklyStreak(dates, today)).toBe(1);
  });

  it("respecte un seuil hebdomadaire personnalisé", () => {
    const dates = week("2026-07-27", 2);
    expect(weeklyStreak(dates, today, 2)).toBe(1);
    expect(weeklyStreak(dates, today, 3)).toBe(0);
  });
});
