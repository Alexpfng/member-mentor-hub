import { describe, expect, test } from "bun:test";

import {
  findExerciseFeedback,
  getExerciseFeedback,
  normalizeExerciseFeedbackKey,
  type ExerciseFeedback,
} from "./exercise-feedback";

function fb(rpe: number): ExerciseFeedback {
  return { rpe, pain: false, tooHard: false, tooEasy: false, failure: false };
}

describe("normalizeExerciseFeedbackKey", () => {
  test("normalizes casing, accents and whitespace", () => {
    expect(normalizeExerciseFeedbackKey("  CARS épaule\ncouché  ")).toBe("cars epaule couche");
  });

  test("normalizes typographic apostrophes and dashes", () => {
    expect(normalizeExerciseFeedbackKey("Pallof — demi‑agenouillé")).toBe(
      "pallof - demi-agenouille",
    );
  });
});

describe("getExerciseFeedback", () => {
  test("finds feedback even when the exercise label formatting differs", () => {
    const feedback = { "tour du monde avec manche a balai": fb(8.5) };

    expect(getExerciseFeedback(feedback, " Tour du monde avec manche à\nbalai ")).toEqual(
      feedback["tour du monde avec manche a balai"],
    );
  });

  test("finds feedback when one label contains punctuation that the other omits", () => {
    const feedback = {
      "back squat barre libre emom3": {
        rpe: 9,
        pain: false,
        tooHard: true,
        tooEasy: false,
        failure: false,
      },
    };

    expect(getExerciseFeedback(feedback, "Back squat barre libre EMOM3'")).toEqual(
      feedback["back squat barre libre emom3"],
    );
  });
});

// Cas réels relevés sur la semaine 6 de Teddy : le coach avait renommé ses
// exercices d'une semaine à l'autre, et 2 retours sur 8 seulement remontaient.
describe("findExerciseFeedback — noms qui bougent d'une semaine à l'autre", () => {
  const week6 = {
    "developpe couche halteres": fb(9),
    "dips lestees en lourd": fb(9),
    "romanian deadlift aux halteres": fb(9),
    "elevations laterales haltere unilaterale": fb(9),
    "fentes bulgares pied avant sureleve avec halteres": fb(10),
    "tirage horizontal prise large": fb(10),
    "landmine meadows row": fb(9),
    "tractions lestees": fb(10),
  };

  test("garde le match exact et le signale comme tel", () => {
    const match = findExerciseFeedback(week6, "Développé couché haltères");
    expect(match?.exact).toBe(true);
    expect(match?.feedback.rpe).toBe(9);
  });

  test("retrouve une variante précisée par le coach", () => {
    const match = findExerciseFeedback(week6, "Dips lestées");
    expect(match?.exact).toBe(false);
    expect(match?.key).toBe("dips lestees en lourd");
  });

  test("ignore le singulier/pluriel et les mots outils", () => {
    const match = findExerciseFeedback(week6, "Elevations latérales haltères");
    expect(match?.key).toBe("elevations laterales haltere unilaterale");
  });

  test("retrouve un exercice dont le matériel a changé", () => {
    const match = findExerciseFeedback(week6, "Romanian deadlift à la barre");
    expect(match?.key).toBe("romanian deadlift aux halteres");
  });

  test("retrouve un exercice enrichi d'une précision de matériel", () => {
    const match = findExerciseFeedback(week6, "Fentes bulgares smith machine pied avant surélevé");
    expect(match?.key).toBe("fentes bulgares pied avant sureleve avec halteres");
  });

  test("ne rapproche pas deux exercices différents", () => {
    expect(findExerciseFeedback(week6, "Rowing buste penché")).toBeNull();
  });

  test("un seul mot commun ne suffit pas", () => {
    // « landmine » partagé avec « landmine meadows row » : mouvements différents.
    expect(findExerciseFeedback(week6, "Half kneeling landmine press")).toBeNull();
  });

  test("ignore les nombres du libellé", () => {
    // « ladder 2/3/4 » ne doit rapprocher de rien via ses chiffres.
    expect(findExerciseFeedback(week6, "Développé militaire à la barre ladder 2/3/4")).toBeNull();
  });

  test("s'abstient quand deux variantes sont aussi proches", () => {
    const ambiguous = {
      "dips lestees en lourd": fb(9),
      "dips lestees en leger": fb(5),
    };
    expect(findExerciseFeedback(ambiguous, "Dips lestées")).toBeNull();
  });

  test("ne renvoie rien sans nom", () => {
    expect(findExerciseFeedback(week6, "")).toBeNull();
    expect(findExerciseFeedback(week6, null)).toBeNull();
  });
});
