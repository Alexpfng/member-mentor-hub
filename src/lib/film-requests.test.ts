import { describe, expect, it } from "bun:test";

import { clearFulfilledFilmRequests, filmedExerciseKeys } from "./film-requests";

const week = {
  days: [
    {
      label: "Jour 1",
      exercises: [
        { name: "Développé couché", film_requested: true },
        { name: "Rowing barre", film_requested: true },
        { name: "Curl biceps", film_requested: null },
      ],
    },
    {
      label: "Jour 2",
      exercises: [{ name: "Back squat", film_requested: true }],
    },
  ],
};

describe("filmedExerciseKeys", () => {
  it("normalise les noms et ignore les lignes sans exercice", () => {
    expect(
      filmedExerciseKeys([
        { exercise_name: "Développé Couché" },
        { exercise_name: "  " },
        { exercise_name: null },
      ]),
    ).toEqual(new Set(["developpe couche"]));
  });
});

describe("clearFulfilledFilmRequests", () => {
  it("décoche uniquement les exercices dont la vidéo est arrivée", () => {
    const next = clearFulfilledFilmRequests(week, new Set(["developpe couche"]));

    expect(next.days[0].exercises[0].film_requested).toBeNull();
    // Pas de vidéo pour ceux-là : la demande reste, le coach relance.
    expect(next.days[0].exercises[1].film_requested).toBe(true);
    expect(next.days[1].exercises[0].film_requested).toBe(true);
  });

  it("rapproche les noms malgré la casse et les accents", () => {
    const next = clearFulfilledFilmRequests(
      { days: [{ exercises: [{ name: "BACK SQUAT", film_requested: true }] }] },
      filmedExerciseKeys([{ exercise_name: "Back squat" }]),
    );

    expect(next.days[0].exercises[0].film_requested).toBeNull();
  });

  it("ne touche pas aux exercices sans demande", () => {
    const next = clearFulfilledFilmRequests(week, new Set(["curl biceps"]));

    expect(next.days[0].exercises[2].film_requested).toBeNull();
    expect(next.days[0].exercises[0].film_requested).toBe(true);
  });

  it("ne modifie pas la structure d'origine", () => {
    clearFulfilledFilmRequests(week, new Set(["developpe couche", "back squat"]));

    expect(week.days[0].exercises[0].film_requested).toBe(true);
    expect(week.days[1].exercises[0].film_requested).toBe(true);
  });

  it("renvoie la structure telle quelle quand aucune vidéo n'a été reçue", () => {
    expect(clearFulfilledFilmRequests(week, new Set())).toBe(week);
  });
});
