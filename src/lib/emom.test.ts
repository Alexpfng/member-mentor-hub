import { describe, expect, it } from "bun:test";

import { alternatingRepsCycle, buildEmomPlan, parseEmom } from "./emom";

describe("parseEmom — saisie via le builder (Durée = Séries, Reps/min = Reps)", () => {
  it("lit la durée et les reps des deux champs", () => {
    expect(parseEmom("10", "1", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
    expect(parseEmom("12", "3", "Développé couché")).toEqual({ durationMin: 12, repsPerMin: 3 });
  });

  it("accepte l'unité écrite dans le champ Séries", () => {
    expect(parseEmom("10min", "1", "Tractions")).toEqual({ durationMin: 10, repsPerMin: 1 });
  });

  it("lit une cible de répétitions saisie au format EMOM4", () => {
    expect(parseEmom("10", "EMOM4", "Back squat")).toEqual({
      durationMin: 10,
      repsPerMin: 4,
    });
  });

  it("gère les reps alternées (3/4)", () => {
    expect(parseEmom("10", "3/4", "Fentes")).toEqual({ durationMin: 10, repsPerMin: 3 });
  });

  it("laisse les champs explicites du coach prioritaires sur un ancien EMOM dans le nom", () => {
    expect(parseEmom("10", "5", "Gobelet squat EMOM5/7'")).toEqual({
      durationMin: 10,
      repsPerMin: 5,
    });
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

describe("parseEmom — import Sheet avec total de reps", () => {
  it("corrige EMOM3' + 30 en tout en 10 minutes à 3 reps/min", () => {
    expect(parseEmom("EMOM3'", "30 en tout", "Tractions pronation")).toEqual({
      durationMin: 10,
      repsPerMin: 3,
    });
  });

  it("garde EMOM10' + 30 en tout comme 10 minutes à 3 reps/min", () => {
    expect(parseEmom("EMOM10'", "30 en tout", "Tractions pronation")).toEqual({
      durationMin: 10,
      repsPerMin: 3,
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

describe("alternatingRepsCycle", () => {
  it("joue la 1re minute (impaire) avec la seconde valeur", () => {
    // « 1/2 » = 1 rep les minutes paires, 2 reps les impaires.
    // Minute 1 impaire → 2 reps, minute 2 paire → 1 rep.
    expect(alternatingRepsCycle("1/2")).toEqual([2, 1]);
  });

  it("accepte les espaces autour du séparateur", () => {
    expect(alternatingRepsCycle(" 3 / 4 ")).toEqual([4, 3]);
  });

  it("renvoie null hors notation alternée", () => {
    expect(alternatingRepsCycle("10")).toBeNull();
    expect(alternatingRepsCycle(null)).toBeNull();
    expect(alternatingRepsCycle("EMOM 10")).toBeNull();
    expect(alternatingRepsCycle("3/4/5")).toBeNull(); // ladder, pas alterné
  });
});

describe("buildEmomPlan", () => {
  it("classifies a single-exercise EMOM as classic", () => {
    expect(
      buildEmomPlan([{ name: "Tractions", block_type: "emom", series: "10", reps: "3" }]),
    ).toEqual({
      mode: "classic",
      durationMin: 10,
      repsPerMin: 3,
      repsLabel: "3",
      minutePlan: Array.from({ length: 10 }, (_, index) => ({
        minute: index + 1,
        exerciseIndex: 0,
        exerciseName: "Tractions",
        targetLabel: "3 reps",
      })),
    });
  });

  it("shows the target reps when the imported reps field contains EMOM4", () => {
    const plan = buildEmomPlan([
      { name: "Back squat", block_type: "emom", series: "10", reps: "EMOM4" },
    ]);

    expect(plan.repsPerMin).toBe(4);
    expect(plan.minutePlan.every((minute) => minute.targetLabel === "4 reps")).toBe(true);
  });

  it("classifies slash reps as alternating reps with odd minutes using the second value", () => {
    expect(
      buildEmomPlan([{ name: "Tractions", block_type: "emom", series: "4", reps: "1/2" }]),
    ).toEqual({
      mode: "alternating-reps",
      durationMin: 4,
      repsPerMin: 1,
      repsLabel: "1/2",
      repsCycle: [2, 1],
      minutePlan: [
        { minute: 1, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "2 reps" },
        { minute: 2, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "1 rep" },
        { minute: 3, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "2 reps" },
        { minute: 4, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "1 rep" },
      ],
    });
  });

  it("classifies a two-exercise EMOM block as alternating exercises", () => {
    expect(
      buildEmomPlan([
        { name: "Tractions", block_type: "emom", code: "A1", series: "6", reps: "3" },
        { name: "Goblet squat", block_type: "emom", code: "A2", series: "6", reps: "5" },
      ]),
    ).toEqual({
      mode: "alternating-exercises",
      durationMin: 6,
      repsPerMin: null,
      repsLabel: null,
      exercises: [
        { name: "Tractions", targetLabel: "3 reps" },
        { name: "Goblet squat", targetLabel: "5 reps" },
      ],
      minutePlan: [
        { minute: 1, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "3 reps" },
        { minute: 2, exerciseIndex: 1, exerciseName: "Goblet squat", targetLabel: "5 reps" },
        { minute: 3, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "3 reps" },
        { minute: 4, exerciseIndex: 1, exerciseName: "Goblet squat", targetLabel: "5 reps" },
        { minute: 5, exerciseIndex: 0, exerciseName: "Tractions", targetLabel: "3 reps" },
        { minute: 6, exerciseIndex: 1, exerciseName: "Goblet squat", targetLabel: "5 reps" },
      ],
    });
  });
});
