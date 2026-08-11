import * as XLSX from "xlsx";

/**
 * Export d'un programme (structure JSONB weeks[].days[].exercises[]) vers un
 * classeur Excel qui reprend la MISE EN FORME des feuilles de Léo (celles qu'il
 * envoie à ses clients) et reste lisible par l'import (`excel-import/parser`) :
 *
 *   colonne A : marge · colonne B(+C) : « Exercice » (code + nom)
 *   D : Série(s) · E : Reps · F : Charge (kg) · G : Tempo (s) · H : Récup
 *   I : RPE · J(→M) : Consignes / Explications · N : lien vidéo
 *
 * Un bloc « métadonnées » en haut (NOM / OBJECTIF / SPLIT / REPOS / CARDIO),
 * une ligne-titre par séance, un exercice par ligne (« A1. Squat »).
 *
 * ⚠️ Limite : les COULEURS de fond des exercices (code d'intensité) ne sont PAS
 * réécrites — le paquet `xlsx` communautaire n'écrit pas les remplissages de
 * cellules. La structure et toutes les données round-trip ; il manque juste la
 * couleur. (La couleur nécessiterait la lib `exceljs`.)
 */

type ExportExercise = {
  code?: string | null;
  name?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | number | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
  coach_notes?: string | null;
  youtube_url?: string | null;
};
type ExportDay = { number?: number; label?: string | null; exercises?: ExportExercise[] };
type ExportWeek = { number?: number; label?: string | null; days?: ExportDay[] };
export type ExportProgram = {
  name?: string | null;
  objective?: string | null;
  level?: string | null;
  structure?: { weeks?: ExportWeek[] } | null;
};

// Colonnes (0-based) — calquées sur les feuilles de Léo.
const C = {
  name: 1, // B (fusionnée B:C)
  series: 3, // D
  reps: 4, // E
  charge: 5, // F
  tempo: 6, // G
  recup: 7, // H
  rpe: 8, // I
  notes: 9, // J (fusionnée J:M)
  youtube: 13, // N
} as const;
const LAST_COL = 13; // N

function val(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

type Merge = XLSX.Range;

function weekSheet(week: ExportWeek, program: ExportProgram): XLSX.WorkSheet {
  const rows: string[][] = [];
  const merges: Merge[] = [];
  const push = (cells: Record<number, string>) => {
    const row: string[] = new Array(LAST_COL + 1).fill("");
    for (const [c, v] of Object.entries(cells)) row[Number(c)] = v;
    rows.push(row);
    return rows.length - 1; // index de la ligne ajoutée
  };

  // ── Bloc métadonnées (labels en colonne C, valeurs en D) ──
  push({ 2: "NOM", 3: "" });
  push({ 2: "OBJECTIF DU PROGRAMME", 3: val(program.objective) });
  push({ 2: "SPLIT D'ENTRAINEMENT", 3: val(program.level) });
  push({ 2: "NB JOURS DE REPOS", 3: "-" });
  push({ 2: "CARDIO", 3: "-" });
  push({}); // ligne vide

  for (const day of week.days ?? []) {
    // Ligne-titre de séance (fusionnée B:M)
    const titleRow = push({ [C.name]: val(day.label) || `Séance ${day.number ?? ""}`.trim() });
    merges.push({ s: { r: titleRow, c: C.name }, e: { r: titleRow, c: LAST_COL - 1 } });

    // Ligne d'en-tête
    const headRow = push({
      [C.name]: "Exercice",
      [C.series]: "Série(s)",
      [C.reps]: "Reps",
      [C.charge]: "Charge (kg)",
      [C.tempo]: "Tempo (s)",
      [C.recup]: "Récup",
      [C.rpe]: "RPE",
      [C.notes]: "Consignes / Explications",
    });
    merges.push({ s: { r: headRow, c: C.name }, e: { r: headRow, c: C.name + 1 } }); // Exercice B:C
    merges.push({ s: { r: headRow, c: C.notes }, e: { r: headRow, c: LAST_COL - 1 } }); // Consignes J:M

    for (const ex of day.exercises ?? []) {
      const exRow = push({
        [C.name]: ex.code ? `${ex.code}. ${val(ex.name)}` : val(ex.name),
        [C.series]: val(ex.series),
        [C.reps]: val(ex.reps),
        [C.charge]: val(ex.charge),
        [C.tempo]: val(ex.tempo),
        [C.recup]: val(ex.recup),
        [C.rpe]: val(ex.rpe_target),
        [C.notes]: val(ex.coach_notes),
        [C.youtube]: val(ex.youtube_url),
      });
      merges.push({ s: { r: exRow, c: C.name }, e: { r: exRow, c: C.name + 1 } }); // nom B:C
      merges.push({ s: { r: exRow, c: C.notes }, e: { r: exRow, c: LAST_COL - 1 } }); // notes J:M
    }
    push({}); // séparateur entre séances
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 3 }, // A marge
    { wch: 26 }, // B nom
    { wch: 8 }, // C
    { wch: 9 }, // D série
    { wch: 10 }, // E reps
    { wch: 12 }, // F charge
    { wch: 11 }, // G tempo
    { wch: 8 }, // H récup
    { wch: 6 }, // I rpe
    { wch: 42 }, // J consignes
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 34 }, // N vidéo
  ];
  return ws;
}

export function buildProgramWorkbook(program: ExportProgram): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const weeks = program.structure?.weeks ?? [];
  const used = new Set<string>();
  const append = (sheet: XLSX.WorkSheet, base: string) => {
    let name = base.slice(0, 31);
    let i = 2;
    while (used.has(name)) name = `${base}_${i++}`.slice(0, 31);
    used.add(name);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  };

  if (weeks.length === 0) {
    append(XLSX.utils.aoa_to_sheet([[]]), "S1");
    return wb;
  }
  weeks.forEach((week, i) => append(weekSheet(week, program), `S${week.number ?? i + 1}`));
  return wb;
}

export function downloadProgramXlsx(program: ExportProgram): void {
  const wb = buildProgramWorkbook(program);
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName =
    val(program.name)
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim() || "programme";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
