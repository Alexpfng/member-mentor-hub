import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";

import { parseExcelFile } from "./parser";

/** Construit un fichier Excel en mémoire à partir de lignes brutes. */
function makeFile(
  rows: (string | number | null)[][],
  sheet = "S1",
  merges: XLSX.Range[] = [],
): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
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

const MUSCU_WITH_SHEET_NAME_ONLY = [
  ["Exercice", "Séries", "Reps", "Charge", "Tempo", "Récup", "RPE", "Notes"],
  ["A1. Chest press couché", "3", "8", "25kg", "2010", "2'", "8", null],
  ["B. Rowing bûcheron", "3", "10", "20kg", "2110", "90s", "8", null],
];

const MUSCU_WITH_GENERIC_HEADER = [
  ["Séance 1"],
  ["Exercice", "Séries", "Reps", "Charge", "Tempo", "Récup", "RPE", "Notes"],
  ["A1. Chest press couché", "3", "8", "25kg", "2010", "2'", "8", null],
];

/** Le coach ajoute parfois un répertoire annexe sous la séance dans le même onglet. */
const MUSCU_WITH_REHAB_REPERTOIRE = [
  ["Full-body 3 (Durée : ~70min)"],
  ["Exercice", "Série(s)", "Reps", "Charge (kg)", "Tempo (s)", "Récup", "RPE", "Notes"],
  [
    "E2. Extensions triceps à la corde",
    "3",
    "10 - 8",
    "40 - 50",
    "2110",
    null,
    null,
    "Rotation externe",
  ],
  ["F. Star plank", "2", "20s/côté", "pdc", "iso", "2'", null, "Garde la hanche orientée"],
  [],
  ["Répertoire exercices rehab tendon d'achille"],
  ["Exercice", "Série(s)", "Reps", "Charge (kg)", "Tempo (s)", "Récup", "RPE", "Notes"],
  [
    "A1. Elevations du soléaire avec poids",
    "2",
    "12 / jambes",
    "disque 20kg",
    "21X0",
    "1'",
    null,
    "Plan incliné",
  ],
  [
    "A2. Foot circle",
    "2",
    "3 tours / pied",
    "pdc",
    "iso",
    "1'",
    null,
    "Ton talon doit plus ou moins toucher",
  ],
];

const MUSCU_WITH_SPECIAL_FORMATS = [
  ["Circuit training sans matériel"],
  ["Exercice", "Série(s)", "Reps", "Charge (kg)", "Tempo (s)", "Récup", "RPE", "Notes"],
  [
    "B. Tractions pronation EMOM3'",
    "EMOM3'",
    "30 en tout",
    "pdc",
    "312",
    "1'",
    null,
    "Travail d'endurance, 3 reps / min, toutes les minutes sur 10min",
  ],
  ["C1. Pompes en tempo", "3", "10", "pdc", "21X0", null, "8", "Circuit sans matériel"],
  ["C2. Squat jumps", "3", "12", "pdc", "explosif", null, "8", "Circuit sans matériel"],
  ["D. AMRAP gainage", "12", "max", "pdc", "iso", null, null, "AMRAP 12 minutes"],
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

describe("import Excel — plusieurs tableaux et cellules fusionnées", () => {
  it("reprend les prescriptions fusionnées et change de colonnes entre muscu et course", async () => {
    const rows = [
      ["Full-body 1"],
      ["Exercice", null, "Série(s)", "Reps", "Charge (kg)", "Tempo (s)", "Récup", "RPE", null, "Consignes"],
      ["A1. CARs hanches", null, 2, "5 - 6", "-", "très lent", 0],
      ["A2. CARs épaules couché", null, null, null, "-"],
      ["Séance type fractionné (~1h)"],
      ["Exercice", null, "Série(s)", "Reps", "Temps", "Allure", "Recup", null, "Consignes / Explications"],
      ["A1. Échauffement", null, 2, 1, "-", "30''", "-", null, "Dynamique"],
      ["BLOC B : 10x1'/1'", null, 1, 10, "1min travail", "5:30/km", "1'", null, "Répétitions régulières"],
      [null, null, null, null, null, null, null, null, "Garde la même allure"],
      ["travail de maintien d'allure", null, null, null, "1min recup", "7:30/km", null, null, "Pas de marche"],
      ["BLOC C : 6x30s", null, 1, 6, "30s", "5:00/km", "1'", null, "Puissance"],
      ["~1km retour au calme"],
      [],
      [],
      ["ECHAUFFEMENT"],
      ["A1. Note générale", null, 3, 10, "30kg", "3010"],
    ];
    const parsed = await parseExcelFile(makeFile(rows, "S1", [
      { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } },
      { s: { r: 2, c: 5 }, e: { r: 3, c: 5 } },
    ]));
    const [muscu, course] = parsed.weeks[0].days;
    const cars = muscu.exercises.find((e) => e.name.includes("épaules"));
    expect(cars?.series).toBe("2");
    expect(cars?.reps).toBe("5 - 6");
    expect(cars?.tempo).toBe("très lent");

    const blocB = course.exercises.find((e) => e.name.startsWith("BLOC B"));
    expect(blocB?.series).toBe("1");
    expect(blocB?.reps).toBe("10");
    expect(blocB?.charge).toBeNull();
    expect(blocB?.coach_notes).toContain("Allure : 5:30/km");
    expect(blocB?.coach_notes).toContain("Garde la même allure");
    expect(blocB?.coach_notes).toContain("1min recup");
    expect(course.exercises.some((e) => e.name.includes("maintien d'allure"))).toBe(false);
    expect(course.exercises.some((e) => e.name.startsWith("BLOC C"))).toBe(true);
    expect(course.exercises.some((e) => e.name.includes("Note générale"))).toBe(false);
    expect(parsed.weeks[0].days.map((day) => day.number)).toEqual([1, 2]);
  });

  it("accepte un autre coach sans codes, avec un en-tête tardif et des colonnes renommées", async () => {
    const rows: (string | number | null)[][] = Array.from({ length: 45 }, () => []);
    rows[44] = ["Séance haut du corps"];
    rows[45] = ["Mouvement", "Séries", "Répétitions", "Charge", "Tempo", "Repos", "Consigne coach"];
    rows[46] = ["CARs épaules", 2, "5-6", "-", "lent", "0", "Contrôle le mouvement"];
    rows[47] = ["Rotation externe", null, null, "-", null, null, "Sans douleur"];
    rows[48] = ["garde la respiration", null, null, null, null, null, "Reste relâché"];
    rows[49] = [];
    rows[50] = [];
    rows[51] = ["Notes complémentaires"];
    rows[52] = ["A1. Conseil général", 3, 10, "30kg", "3010"];

    const parsed = await parseExcelFile(makeFile(rows, "S1", [
      { s: { r: 46, c: 1 }, e: { r: 48, c: 1 } },
      { s: { r: 46, c: 2 }, e: { r: 48, c: 2 } },
      { s: { r: 46, c: 4 }, e: { r: 47, c: 4 } },
      { s: { r: 46, c: 5 }, e: { r: 47, c: 5 } },
    ]));
    const day = parsed.weeks[0].days[0];
    expect(day.exercises).toHaveLength(2);
    expect(day.exercises[1]).toMatchObject({ series: "2", reps: "5-6", tempo: "lent", recup: "0" });
    expect(day.exercises[1]?.coach_notes).toContain("Sans douleur");
    expect(day.exercises[1]?.coach_notes).toContain("Reste relâché");
    expect(day.exercises.some((exercise) => exercise.name.includes("Conseil général"))).toBe(false);
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

  it("utilise le nom de feuille comme nom de séance quand aucune ligne titre n'existe", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU_WITH_SHEET_NAME_ONLY, "Full-body 1"));
    expect(parsed.weeks[0].days[0].label).toBe("Full-body 1");
  });

  it("utilise le titre placé au-dessus de l'en-tête même quand la feuille s'appelle S1", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU));
    expect(parsed.weeks[0].days[0].label).toBe("Séance Lower Body");
  });

  it("n'écrase pas un vrai nom d'onglet par un titre générique « Séance 1 »", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU_WITH_GENERIC_HEADER, "Full-body 1"));
    expect(parsed.weeks[0].days[0].label).toBe("Full-body 1");
  });

  it("affiche un warning à corriger quand aucun vrai nom de séance n'existe", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU_WITH_SHEET_NAME_ONLY, "S1"));
    expect(parsed.weeks[0].days[0].label).toBe("MET LE NOM QUI CONVIENT");
    expect(parsed.weeks[0].days[0].label).not.toBe("Séance 1");
  });

  it("importe un répertoire rehab placé sous la séance comme une séance distincte", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU_WITH_REHAB_REPERTOIRE));
    expect(parsed.weeks[0].days).toHaveLength(2);

    const names = parsed.weeks[0].days[0].exercises.map((e) => e.name);
    expect(names).toEqual(["Extensions triceps à la corde", "Star plank"]);

    expect(parsed.weeks[0].days[1].label).toBe("Répertoire exercices rehab tendon d'achille");
    expect(parsed.weeks[0].days[1].exercises.map((e) => e.name)).toEqual([
      "Elevations du soléaire avec poids",
      "Foot circle",
    ]);
  });

  it("normalise les formats EMOM, Circuit et AMRAP depuis la fiche Sheet", async () => {
    const parsed = await parseExcelFile(makeFile(MUSCU_WITH_SPECIAL_FORMATS));
    const exos = parsed.weeks[0].days.flatMap((d) => d.exercises);

    const emom = exos.find((e) => e.name.includes("Tractions pronation"));
    expect(emom?.name).toBe("Tractions pronation");
    expect(emom?.block_type).toBe("emom");
    expect(emom?.series).toBe("10");
    expect(emom?.reps).toBe("3");

    const circuit = exos.filter((e) => e.code?.startsWith("C"));
    expect(circuit.map((e) => e.block_type)).toEqual(["circuit", "circuit"]);

    const amrap = exos.find((e) => e.name.includes("gainage"));
    expect(amrap?.block_type).toBe("amrap");
  });
});
