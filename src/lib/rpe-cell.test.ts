import { describe, expect, test } from "bun:test";

import { parseRpeCell } from "./rpe-cell";

describe("parseRpeCell", () => {
  test("nombre pur → RPE seul", () => {
    expect(parseRpeCell("10")).toEqual({ rpe: "10", comment: null, consigne: null, isFailure: false });
  });

  test("virgule décimale → normalisée en point", () => {
    expect(parseRpeCell("9,5")).toEqual({ rpe: "9.5", comment: null, consigne: null, isFailure: false });
  });

  test("« nombre (commentaire) » → RPE + commentaire (cas Brice)", () => {
    expect(parseRpeCell("10 (10kg trop lourd)")).toEqual({
      rpe: "10",
      comment: "10kg trop lourd",
      consigne: null,
      isFailure: false,
    });
  });

  test("décimale + commentaire", () => {
    expect(parseRpeCell("8,5 (dos rond)")).toEqual({
      rpe: "8.5",
      comment: "dos rond",
      consigne: null,
      isFailure: false,
    });
  });

  test("échec reste un échec", () => {
    expect(parseRpeCell("échec").isFailure).toBe(true);
    expect(parseRpeCell("echec").isFailure).toBe(true);
  });

  test("consigne cardio commençant par un chiffre (sans parenthèses) NON transformée", () => {
    const r = parseRpeCell("3 séries de 20' à 70%");
    expect(r.rpe).toBeNull();
    expect(r.consigne).toBe("3 séries de 20' à 70%");
  });

  test("nombre hors plage RPE (>10) avec parenthèses → consigne, pas RPE", () => {
    const r = parseRpeCell("45 (min à 70%)");
    expect(r.rpe).toBeNull();
    expect(r.consigne).toBe("45 (min à 70%)");
  });

  test("vide → tout null", () => {
    expect(parseRpeCell("")).toEqual({ rpe: null, comment: null, consigne: null, isFailure: false });
    expect(parseRpeCell(null)).toEqual({ rpe: null, comment: null, consigne: null, isFailure: false });
  });
});
