import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";

import { parseExcelFile } from "./parser";

/** Construit un fichier Excel en mémoire à partir de lignes brutes. */
function makeFile(rows: (string | number | null)[][], sheet = "S1"): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], "programme.xlsx");
}

/** Séance de course telle que le coach l'écrit : Temps, Allure, Consignes. */
const COURSE_FR = [
  ["Séance type fractionné (Durée : ~1h15)"],
  ["Exercice", "Reps", "Temps", "Allure", "Recup", "RPE", "Consignes / Explications"],
  ["A. Echauffement & travail de pied", null, null, null, "30'", null, "30s entre chaque exo"],
  ["~2 à 3km échauffement"],
  [
    "BLOC B : 10X1'/1'",
    "10",
    "1min travail",
    "~5:00 / km",
    "1'",
    null,
    "Sois précis sur les 10 répétitions",
  ],
  ["OBJECTIF : travail de maintien d'allure"],
  ["BLOC C. 10x40m sprints en côte", "10", "40m", "MAX", "1'", null, "Travail de puissance"],
  ["~1 à 2km retour au calme"],
];

/** Même séance, en-têtes anglais et colonne Distance. */
const COURSE_EN = [
  ["Séance fractionné (Durée : ~60min)"],
  ["Exercise", "Série(s)", "Reps", "Distance", "Récup", "RPE", "Explanation"],
  [
    "A1. Mouvements balistiques de hanche",
    "2",
    "20 / côté",
    null,
    null,
    null,
    "Échauffe tes hanches",
  ],
  [
    "BLOC A. Intervalles longs",
    "6",
    "1000m",
    "5:30min/km",
    "1'30 active",
    "7",
    "Chaque 1000 m entre 5:30 et 5:40",
  ],
  ["~1 à 2km à allure retour au calme"],
];

/** Séance de muscu classique — sert de garde-fou anti-régression. */
const MUSCU = [
  ["Séance Lower Body"],
  ["Exercice", "Séries", "Reps", "Charge", "Tempo", "Récup", "RPE", "Notes"],
  ["A1. Back squat", "4", "10", "80kg", "3010", "2'", "8", "Garde le dos droit"],
  ["B. Leg curl", "3", "12", "40kg", "2010", "90s", "7", null],
];

describe("import Excel — séances de course à pied", () => {
  it("reconnaît l'en-tête « Exercise » en anglais", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_EN));
    expect(parsed.warnings).toEqual([]);
    expect(parsed.weeks[0].days[0].exercises.length).toBeGreaterThan(0);
  });

  it("garde les consignes du coach", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_FR));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    const bloc = exos.find((e) => e.name.includes("BLOC B"));
    expect(bloc?.coach_notes ?? "").toContain("Sois précis");
  });

  it("garde l'allure et la distance au lieu de les perdre", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_FR));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    const bloc = exos.find((e) => e.name.includes("BLOC B"));
    const all = JSON.stringify(bloc);
    expect(all).toContain("5:00");
    expect(all).toContain("1min travail");
  });

  it("ne prend pas la colonne « Temps » d'une course pour un tempo de muscu", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_FR));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    const bloc = exos.find((e) => e.name.includes("BLOC B"));
    // « 1min travail » n'est pas un tempo (3010) : il ne doit pas atterrir là.
    expect(bloc?.tempo ?? "").not.toContain("1min");
  });

  it("ne crée pas d'exercice fantôme depuis une ligne « OBJECTIF »", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_FR));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    expect(exos.some((e) => /^objectif/i.test(e.name))).toBe(false);
  });

  it("ne crée pas d'exercice depuis une ligne d'échauffement ou de retour au calme", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_FR));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    expect(exos.some((e) => /retour au calme|échauffement$/i.test(e.name))).toBe(false);
  });
});

/** Le vrai fichier du coach : un bloc occupe DEUX lignes (cellules fusionnées),
 *  la seconde portant « OBJECTIF : » avec la récup de l'intervalle. */
const COURSE_MERGED = [
  ["Séance type fractionné (Durée : ~1h15)"],
  ["Exercice", "Reps", "Temps", "Allure", "Recup", "RPE", "Consignes / Explications"],
  ["A. Echauffement & travail de pied", null, null, null, "30'", null, "30s entre chaque exo"],
  ["~2 à 3km échauffement"],
  [
    "BLOC B : 10x1'/1'",
    "10",
    "1min travail",
    "~ 5:00 / km",
    "1'",
    null,
    "Sois précis sur les 10 répétitions",
  ],
  ["OBJECTIF :", null, "1min recup", "~ 7:00 / km", null, null, null],
  ["travail de maintien d'allure"],
  ["1km de recup passive à ~7:00/km"],
];

/** Fichier 2 : les liens vidéo sont dans une colonne SANS en-tête. */
const COURSE_LINKS = [
  ["Séance fractionné (Durée : ~60min)"],
  ["Exercice", "Série(s)", "Reps", "Distance", "Récup", "RPE", "Explanation"],
  [
    "A1. Mouvements balistiques de hanche",
    "2",
    "20 / côté",
    null,
    null,
    null,
    "Échauffe tes hanches",
    "https://www.youtube.com/shorts/so-iEzLAc14",
  ],
];

describe("import Excel — format réel du coach", () => {
  it("ne fait pas un exercice de la ligne « OBJECTIF » qui porte la récup", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_MERGED));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    expect(exos.some((e) => /^objectif/i.test(e.name))).toBe(false);
  });

  it("rattache l'objectif et sa récup au bloc concerné", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_MERGED));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    const bloc = exos.find((e) => e.name.includes("BLOC B"));
    expect(bloc?.coach_notes ?? "").toContain("1min recup");
  });

  it("récupère les liens vidéo même sans en-tête de colonne", async () => {
    const parsed = await parseExcelFile(makeFile(COURSE_LINKS));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    expect(exos[0]?.youtube_id).toBe("so-iEzLAc14");
  });
});

describe("import Excel — muscu (non-régression)", () => {
  it("lit séries, reps, charge, tempo, récup, RPE et notes", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);
    const squat = exos.find((e) => e.name.includes("Back squat"));
    expect(squat?.code).toBe("A1");
    expect(squat?.series).toBe("4");
    expect(squat?.reps).toBe("10");
    expect(squat?.charge).toBe("80kg");
    expect(squat?.tempo).toBe("3010");
    expect(squat?.recup).toBe("2'");
    expect(squat?.rpe_target).toBe("8");
    expect(squat?.coach_notes ?? "").toContain("dos droit");
  });
});
