import { describe, expect, it } from "bun:test";
import {
  buildLadderCycle,
  buildLadderPlan,
  formatLadderLabel,
  ladderRepsForMinute,
  parseLadderPattern,
  resolveLadderMinutes,
} from "./ladder";

describe("parseLadderPattern", () => {
  it("lit une liste explicite montante", () => {
    expect(parseLadderPattern("3/4/5")).toEqual([3, 4, 5]);
  });

  it("lit une liste explicite descendante", () => {
    expect(parseLadderPattern("5/4/3")).toEqual([5, 4, 3]);
  });

  it("accepte les virgules et les espaces", () => {
    expect(parseLadderPattern(" 3, 4 , 5 ")).toEqual([3, 4, 5]);
  });

  it("ignore le préfixe « Ladder » du champ Séries", () => {
    expect(parseLadderPattern("Ladder 2/3/4")).toEqual([2, 3, 4]);
  });

  it("déroule des bornes montantes", () => {
    expect(parseLadderPattern("3-5")).toEqual([3, 4, 5]);
  });

  it("déroule des bornes descendantes", () => {
    expect(parseLadderPattern("5-3")).toEqual([5, 4, 3]);
  });

  it("ne prend pas une prescription de volume pour une échelle", () => {
    expect(parseLadderPattern("27 en tout")).toEqual([]);
  });

  it("ne prend pas un nombre seul pour une échelle", () => {
    expect(parseLadderPattern("10")).toEqual([]);
  });

  it("renvoie vide sur une saisie absente", () => {
    expect(parseLadderPattern(null)).toEqual([]);
    expect(parseLadderPattern("")).toEqual([]);
  });
});

describe("buildLadderCycle", () => {
  it("remonte puis redescend sans rejouer le sommet", () => {
    expect(buildLadderCycle([3, 4, 5])).toEqual([3, 4, 5, 4]);
  });

  it("inverse la logique sur une échelle descendante", () => {
    expect(buildLadderCycle([5, 4, 3])).toEqual([5, 4, 3, 4]);
  });

  it("laisse une échelle à deux marches en alternance simple", () => {
    expect(buildLadderCycle([3, 4])).toEqual([3, 4]);
  });

  it("gère une échelle longue", () => {
    expect(buildLadderCycle([3, 4, 5, 6])).toEqual([3, 4, 5, 6, 5, 4]);
  });
});

describe("buildLadderPlan", () => {
  it("boucle la pyramide jusqu'à la durée demandée", () => {
    expect(buildLadderPlan([3, 4, 5], 10)).toEqual([3, 4, 5, 4, 3, 4, 5, 4, 3, 4]);
  });

  it("s'arrête net si la durée coupe la pyramide", () => {
    expect(buildLadderPlan([3, 4, 5], 3)).toEqual([3, 4, 5]);
  });

  it("ne produit rien sans motif ni durée", () => {
    expect(buildLadderPlan([], 10)).toEqual([]);
    expect(buildLadderPlan([3, 4, 5], 0)).toEqual([]);
  });
});

describe("ladderRepsForMinute", () => {
  it("boucle sur le cycle", () => {
    const cycle = buildLadderCycle([3, 4, 5]);
    expect(ladderRepsForMinute(cycle, 0)).toBe(3);
    expect(ladderRepsForMinute(cycle, 2)).toBe(5);
    expect(ladderRepsForMinute(cycle, 4)).toBe(3);
    expect(ladderRepsForMinute(cycle, 6)).toBe(5);
  });

  it("renvoie null sans cycle", () => {
    expect(ladderRepsForMinute([], 0)).toBeNull();
  });
});

describe("resolveLadderMinutes", () => {
  it("respecte la durée saisie par le coach", () => {
    expect(resolveLadderMinutes([3, 4, 5], { durationRaw: "10" })).toBe(10);
  });

  it("déroule jusqu'au volume prescrit", () => {
    // cycle 2,3,4,3 → cumul 2,5,9,12,14,17,21,24,26,29 : 27 reps atteints à la 10e minute
    expect(resolveLadderMinutes([2, 3, 4], { totalRepsRaw: "27 en tout" })).toBe(10);
  });

  it("fait une pyramide complète par défaut", () => {
    // 3,4,5,4,3 : on redescend jusqu'à la base
    expect(resolveLadderMinutes([3, 4, 5])).toBe(5);
  });

  it("plafonne une durée aberrante", () => {
    expect(resolveLadderMinutes([3, 4, 5], { durationRaw: "999" })).toBe(60);
  });

  it("renvoie 0 sans motif", () => {
    expect(resolveLadderMinutes([])).toBe(0);
  });
});

describe("formatLadderLabel", () => {
  it("résume une suite en bornes", () => {
    expect(formatLadderLabel([3, 4, 5])).toBe("3→5");
    expect(formatLadderLabel([5, 4, 3])).toBe("5→3");
  });

  it("garde le détail quand les marches sautent", () => {
    expect(formatLadderLabel([2, 4, 6])).toBe("2/4/6");
  });

  it("renvoie null sans motif", () => {
    expect(formatLadderLabel([])).toBeNull();
  });
});
