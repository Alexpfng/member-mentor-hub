import { describe, expect, it } from "bun:test";

import {
  computeDailyStreak,
  goalProgress,
  isFilled,
  isGoalReached,
  streakLabel,
  type ActivityDay,
} from "./activity-streak";

const day = (date: string, steps: number | null = 8000): ActivityDay => ({
  date,
  steps,
  calories: null,
});

describe("isFilled", () => {
  it("compte un jour dès qu'une valeur est notée", () => {
    expect(isFilled({ date: "2026-08-19", steps: 5000, calories: null })).toBe(true);
    expect(isFilled({ date: "2026-08-19", steps: null, calories: 300 })).toBe(true);
  });

  it("ignore un jour vide ou absent", () => {
    expect(isFilled({ date: "2026-08-19", steps: null, calories: null })).toBe(false);
    expect(isFilled(null)).toBe(false);
  });
});

describe("computeDailyStreak", () => {
  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    const days = [day("2026-08-17"), day("2026-08-18"), day("2026-08-19")];
    expect(computeDailyStreak(days, "2026-08-19")).toBe(3);
  });

  it("ne casse pas la série tant que le jour en cours n'est pas rempli", () => {
    // Rempli hier et avant-hier, rien encore aujourd'hui : la série tient.
    const days = [day("2026-08-17"), day("2026-08-18")];
    expect(computeDailyStreak(days, "2026-08-19")).toBe(2);
  });

  it("repart de zéro après un jour manqué", () => {
    // Trou le 18 : seul le 19 compte.
    const days = [day("2026-08-16"), day("2026-08-17"), day("2026-08-19")];
    expect(computeDailyStreak(days, "2026-08-19")).toBe(1);
  });

  it("renvoie 0 quand rien n'est rempli", () => {
    expect(computeDailyStreak([], "2026-08-19")).toBe(0);
    expect(computeDailyStreak([day("2026-08-10")], "2026-08-19")).toBe(0);
  });

  it("ignore les jours notés vides", () => {
    const days = [day("2026-08-18"), { date: "2026-08-19", steps: null, calories: null }];
    expect(computeDailyStreak(days, "2026-08-19")).toBe(1);
  });

  it("traverse un changement de mois", () => {
    const days = [day("2026-07-31"), day("2026-08-01")];
    expect(computeDailyStreak(days, "2026-08-01")).toBe(2);
  });
});

describe("goalProgress / isGoalReached", () => {
  it("borne la progression entre 0 et 1", () => {
    expect(goalProgress(5000, 10000)).toBe(0.5);
    expect(goalProgress(15000, 10000)).toBe(1);
    expect(goalProgress(null, 10000)).toBe(0);
  });

  it("renvoie null sans objectif fixé", () => {
    expect(goalProgress(5000, null)).toBeNull();
    expect(goalProgress(5000, 0)).toBeNull();
  });

  it("détecte l'objectif atteint", () => {
    expect(isGoalReached(10000, 10000)).toBe(true);
    expect(isGoalReached(9999, 10000)).toBe(false);
    expect(isGoalReached(9999, null)).toBe(false);
  });
});

describe("streakLabel", () => {
  it("ne dit rien sans série", () => {
    expect(streakLabel(0)).toBeNull();
  });

  it("encourage au premier jour et fête les paliers", () => {
    expect(streakLabel(1)).toContain("c'est parti");
    expect(streakLabel(7)).toContain("7 jours d'affilée !");
    expect(streakLabel(30)).toContain("mois plein");
    expect(streakLabel(100)).toContain("légendaire");
  });

  it("reste sobre entre deux paliers", () => {
    expect(streakLabel(5)).toBe("5 jours d'affilée");
  });
});
