import * as XLSX from "xlsx";

/**
 * Export d'un programme (structure JSONB weeks[].days[].exercises[]) vers un
 * classeur Excel au MÊME format que celui lu par l'import (`excel-import/parser`),
 * pour que Léo ait un backup Sheets et que ça puisse se ré-importer :
 * - une feuille par semaine, nommée S1, S2, S3…
 * - une ligne d'en-tête « Exercice | Série | Reps | Charge | Tempo | Récup | RPE |
 *   Notes(col 8) | Vidéo(col 12) »
 * - une ligne titre par séance, un exercice par ligne (« A1. Squat »).
 *
 * Limite connue : les COULEURS de cellules ne sont pas réécrites (le paquet xlsx
 * communautaire n'écrit pas les remplissages) — le reste des données round-trip.
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
type ExportWeek = { number?: number; days?: ExportDay[] };
export type ExportProgram = {
  name?: string | null;
  objective?: string | null;
  structure?: { weeks?: ExportWeek[] } | null;
};

// En-tête : « Notes » en colonne 8 et « Vidéo » en colonne 12 — positions
// attendues en dur par l'import (notesCol = nameCol+8, youtubeCol = nameCol+12).
const HEADER = [
  "Exercice",
  "Série",
  "Reps",
  "Charge",
  "Tempo",
  "Récup",
  "RPE",
  "",
  "Notes",
  "",
  "",
  "",
  "Vidéo",
];

// Mots-clés que l'import reconnaît comme un titre de séance. Si le label du jour
// n'en contient pas, on le préfixe par « Séance N — » pour qu'il soit bien
// détecté comme une nouvelle séance à la ré-import (et pas fondu dans la précédente).
const SESSION_KEYWORDS =
  /(s[ée]ance|full[\s-]?body|lower|upper|push|pull|legs?|jambe|course|cardio|c[ôo]tes|fractionn|endurance|renfo|mobilit[ée]|sortie|hiit|circuit|bloc)/i;

function val(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function dayHeader(day: ExportDay, index: number): string {
  const label = val(day.label).trim();
  const n = day.number ?? index + 1;
  if (!label) return `Séance ${n}`;
  return SESSION_KEYWORDS.test(label) ? label : `Séance ${n} — ${label}`;
}

function weekSheet(week: ExportWeek, program: ExportProgram): XLSX.WorkSheet {
  const rows: string[][] = [];
  rows.push(["PROGRAMME", val(program.name)]);
  if (program.objective) rows.push(["OBJECTIF", val(program.objective)]);
  rows.push([]);
  rows.push([...HEADER]);

  (week.days ?? []).forEach((day, di) => {
    rows.push([dayHeader(day, di)]);
    for (const ex of day.exercises ?? []) {
      const row = new Array(13).fill("");
      row[0] = ex.code ? `${ex.code}. ${val(ex.name)}` : val(ex.name);
      row[1] = val(ex.series);
      row[2] = val(ex.reps);
      row[3] = val(ex.charge);
      row[4] = val(ex.tempo);
      row[5] = val(ex.recup);
      row[6] = val(ex.rpe_target);
      row[8] = val(ex.coach_notes);
      row[12] = val(ex.youtube_url);
      rows.push(row);
    }
    rows.push([]); // séparateur entre séances
  });

  return XLSX.utils.aoa_to_sheet(rows);
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
    append(XLSX.utils.aoa_to_sheet([[...HEADER]]), "S1");
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
