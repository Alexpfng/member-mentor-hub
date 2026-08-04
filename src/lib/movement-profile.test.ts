import { describe, expect, it } from "bun:test";

import {
  axisFromColor,
  buildAxisIndex,
  buildMovementProfile,
  type LoggedSet,
} from "./movement-profile";

const LIBRARY = [
  { name: "Back squat libre", color: "red" },
  { name: "Développé couché haltères", color: "🔴" },
  { name: "Curl marteau alterné", color: "green" },
  { name: "Squats jumps", color: "yellow" },
  { name: "CARs épaules", color: "lime" },
  { name: "Neck side plank", color: "blue" },
  { name: "Exercice sans couleur", color: null },
];

function set(name: string, date: string, weight: number | null, reps: number | null): LoggedSet {
  return { exerciseName: name, date, weightKg: weight, reps };
}

describe("axisFromColor", () => {
  it("accepte les deux écritures de couleur", () => {
    expect(axisFromColor("red")).toBe("force");
    expect(axisFromColor("🔴")).toBe("force");
    expect(axisFromColor("LIME")).toBe("mobilite");
    // Le builder a longtemps écrit « orange » pour la mobilité.
    expect(axisFromColor("orange")).toBe("mobilite");
  });

  it("renvoie null sur une couleur inconnue ou absente", () => {
    expect(axisFromColor(null)).toBeNull();
    expect(axisFromColor("mauve")).toBeNull();
  });
});

describe("buildAxisIndex", () => {
  it("indexe sur un nom normalisé", () => {
    const index = buildAxisIndex(LIBRARY);
    expect(index.get("back squat libre")).toBe("force");
    expect(index.get("developpe couche halteres")).toBe("force");
    expect(index.get("cars epaules")).toBe("mobilite");
  });

  it("ignore les exercices sans couleur", () => {
    expect(buildAxisIndex(LIBRARY).has("exercice sans couleur")).toBe(false);
  });

  it("garde la première couleur vue en cas de doublon", () => {
    const index = buildAxisIndex([
      { name: "Squat", color: "red" },
      { name: "squat", color: "blue" },
    ]);
    expect(index.get("squat")).toBe("force");
  });
});

describe("buildMovementProfile", () => {
  const index = buildAxisIndex(LIBRARY);

  it("renvoie un profil vide sans séries", () => {
    const profile = buildMovementProfile([], index);
    expect(profile.empty).toBe(true);
    expect(profile.points).toHaveLength(5);
    expect(profile.points.every((p) => p.empty)).toBe(true);
  });

  it("compte le tonnage sur les exercices chargés", () => {
    const profile = buildMovementProfile([set("Back squat libre", "2026-01-01", 100, 5)], index);
    const force = profile.points.find((p) => p.axis === "force");
    expect(force?.afterRaw).toBe(500);
  });

  it("compte les répétitions quand il n'y a pas de charge", () => {
    // Sinon la mobilité pèserait zéro et son axe resterait plat à vie.
    const profile = buildMovementProfile([set("CARs épaules", "2026-01-01", null, 12)], index);
    const mobilite = profile.points.find((p) => p.axis === "mobilite");
    expect(mobilite?.afterRaw).toBe(12);
    expect(mobilite?.empty).toBe(false);
  });

  it("sépare début et fin sur deux fenêtres de même durée", () => {
    const sets = [
      set("Back squat libre", "2026-01-01", 100, 5), // 500, fenêtre « avant »
      set("Back squat libre", "2026-04-01", 140, 5), // 700, fenêtre « maintenant »
    ];
    const profile = buildMovementProfile(sets, index);
    const force = profile.points.find((p) => p.axis === "force");
    expect(force?.beforeRaw).toBe(500);
    expect(force?.afterRaw).toBe(700);
    // Chaque axe est ramené à son propre maximum.
    expect(force?.after).toBe(100);
    expect(force?.before).toBe(71);
  });

  it("range tout dans « maintenant » quand l'historique est trop court", () => {
    const sets = [
      set("Back squat libre", "2026-01-01", 100, 5),
      set("Back squat libre", "2026-01-08", 110, 5),
    ];
    const profile = buildMovementProfile(sets, index);
    const force = profile.points.find((p) => p.axis === "force");
    expect(force?.beforeRaw).toBe(0);
    expect(force?.afterRaw).toBe(1050);
    expect(profile.beforeRange).toBeNull();
  });

  it("marque vide un axe jamais travaillé", () => {
    const profile = buildMovementProfile([set("Back squat libre", "2026-01-01", 60, 10)], index);
    expect(profile.points.find((p) => p.axis === "explosif")?.empty).toBe(true);
    expect(profile.points.find((p) => p.axis === "force")?.empty).toBe(false);
  });

  it("ignore un exercice absent de l'index", () => {
    const profile = buildMovementProfile([set("Exercice inconnu", "2026-01-01", 50, 10)], index);
    expect(profile.empty).toBe(true);
  });

  it("expose les bornes de dates des deux périodes", () => {
    const sets = [
      set("Back squat libre", "2026-01-01", 100, 5),
      set("Curl marteau alterné", "2026-01-10", 20, 10),
      set("Back squat libre", "2026-05-01", 140, 5),
      set("Back squat libre", "2026-05-20", 145, 5),
    ];
    const profile = buildMovementProfile(sets, index);
    expect(profile.beforeRange).toEqual({ from: "2026-01-01", to: "2026-01-10" });
    expect(profile.afterRange).toEqual({ from: "2026-05-01", to: "2026-05-20" });
  });
});
