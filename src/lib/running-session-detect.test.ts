import { describe, expect, it } from "bun:test";

import { isRunningSession, isRunningSessionLabel } from "./running-session-detect";

describe("isRunningSessionLabel", () => {
  // Les libellés réellement utilisés par le coach dans ses programmes.
  const courses = [
    "Séance type trail",
    "Séance type trail (Durée : 1h30 minimum)",
    "Séance côtes",
    "Séance côtes (Durée : ~1h15)",
    "Séance course endurance fondamentale",
    "Séance endurance fondamentale (Durée : 45 à 60min)",
    "Séance reprise course à pied",
    "Séance type fractionné (Durée : ~1h)",
  ];

  it.each(courses)("reconnaît « %s »", (label) => {
    expect(isRunningSessionLabel(label)).toBe(true);
  });

  const muscu = [
    "Full body 1",
    "Lower 2 : Chaîne post. (Durée : 60min)",
    "Upper 1 focus pull (Durée : 60min)",
    "Séance 3 : HIIT + Circuit abdos (Durée : 30min)",
    "Séance mobilité maison",
    "Séance boxe",
    "Séance Stairmaster",
    "Push",
    "Pull",
  ];

  it.each(muscu)("ne prend pas « %s » pour une course", (label) => {
    expect(isRunningSessionLabel(label)).toBe(false);
  });

  it("tolère un libellé absent", () => {
    expect(isRunningSessionLabel(null)).toBe(false);
    expect(isRunningSessionLabel(undefined)).toBe(false);
  });
});

describe("isRunningSession", () => {
  it("suit le libellé même quand les exercices sont de l'échauffement", () => {
    // Cas réel : la séance trail partait dans le logger de muscu parce que ses
    // premiers exercices sont des gammes, qui ne ressemblent pas à de la course.
    expect(
      isRunningSession("Séance type trail (Durée : 1h30 minimum)", [
        { name: "Mouvements ballistiques hanches" },
        { name: "Montée de genoux dynamiques" },
        { name: "Sprint progressif sur 30m" },
        { name: "Trail en fartlek" },
        { name: "Varier les allures au feeling, accélération, déccélération" },
        { name: "Travail de fractionné très léger" },
      ]),
    ).toBe(true);
  });

  it("retombe sur les exercices quand le libellé ne dit rien", () => {
    expect(isRunningSession("Séance 4", [{ name: "Course lente" }, { name: "Footing" }])).toBe(
      true,
    );
  });

  it("laisse une séance de muscu au logger de muscu", () => {
    expect(
      isRunningSession("Full body 1", [{ name: "Développé couché" }, { name: "Course lente" }]),
    ).toBe(false);
  });
});
