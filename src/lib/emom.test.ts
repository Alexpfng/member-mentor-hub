import { describe, expect, it } from "bun:test";

import { parseEmom } from "./emom";

describe("parseEmom — saisie via le builder (Durée = Séries, Reps/min = Reps)", () => {
  it("lit la durée et les reps des deux champs", () => {
    expect(parseEmom("10", "1", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
    expect(parseEmom("12", "3", "Développé couché")).toEqual({ durationMin: 12, repsPerMin: 3 });
  });

  it("accepte l'unité écrite dans le champ Séries", () => {
    expect(parseEmom("10min", "1", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
  });

  it("gère les reps alternées (3/4)", () => {
    expect(parseEmom("10", "3/4", "Fentes")).toEqual({ durationMin: 10, repsPerMin: 3 });
  });
});

describe("parseEmom — EMOM écrit dans le nom", () => {
  it("lit la durée depuis le nom", () => {
    expect(parseEmom(null, "1", "Tractions EMOM10'")).toEqual({ durationMin: 10, repsPerMin: 1 });
    expect(parseEmom(null, "2", "Squat EMOM 8 min")).toEqual({ durationMin: 8, repsPerMin: 2 });
  });

  it("lit le format combiné repsxdurée", () => {
    expect(parseEmom(null, null, "Tractions EMOM1x10'")).toEqual({
      durationMin: 10,
      repsPerMin: 1,
    });
  });
});

describe("parseEmom — le champ Reps fait foi sur « EMOM n » écrit dans Séries", () => {
  it("ne prend plus le nombre de Séries pour des reps", () => {
    // Régression : « EMOM 10 » (Séries) + « 1 » (Reps) donnait 10 reps/min.
    expect(parseEmom("EMOM 10", "1", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
  });

  it("utilise « EMOM n » comme durée et non comme durée par défaut", () => {
    // Régression : « EMOM 6 » donnait 10 min (défaut) et 6 reps/min.
    expect(parseEmom("EMOM 6", "2", "Tractions")).toEqual({ durationMin: 6, repsPerMin: 2 });
  });

  it("garde l'ancien repli quand le champ Reps est vide", () => {
    expect(parseEmom("EMOM3", null, "Tractions")).toEqual({ durationMin: 10, repsPerMin: 3 });
  });
});

describe("parseEmom — durée et reps saisies à l'envers", () => {
  it("remet dans le bon sens un EMOM d'une minute (cas Léo : 10 min / 1 rep)", () => {
    // Séries = 1, Reps = 10 → un « EMOM 1 minute à 10 reps » n'existe pas.
    expect(parseEmom("1", "10", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
  });

  it("ne touche pas un EMOM d'une minute sans reps", () => {
    expect(parseEmom("1", null, "Tractions")).toEqual({ durationMin: 1, repsPerMin: null });
  });

  it("ne touche pas un EMOM d'une minute à 1 rep", () => {
    expect(parseEmom("1", "1", "Tractions")).toEqual({ durationMin: 1, repsPerMin: 1 });
  });

  it("laisse intacts les EMOM plausibles", () => {
    expect(parseEmom("2", "10", "Burpees")).toEqual({ durationMin: 2, repsPerMin: 10 });
    expect(parseEmom("15", "5", "Squats")).toEqual({ durationMin: 15, repsPerMin: 5 });
  });
});

describe("parseEmom — repli", () => {
  it("retombe sur 10 minutes quand rien n'est exploitable", () => {
    expect(parseEmom(null, null, "Tractions")).toEqual({ durationMin: 10, repsPerMin: null });
  });
});
