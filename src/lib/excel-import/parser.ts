/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";

export type ImportedExercise = {
  code: string | null;
  name: string;
  series: string | null;
  reps: string | null;
  charge: string | null;
  tempo: string | null;
  recup: string | null;
  rpe_target: string | null;
  coach_notes: string | null;
  color: "red" | "green" | "yellow" | "blue" | null;
  youtube_url: string | null;
  youtube_id: string | null;
  block_type: "standard" | "emom" | "ladder" | "amrap" | "dropset" | "iso" | "circuit";
};

export type ImportedDay = {
  number: number;
  label: string;
  exercises: ImportedExercise[];
};

export type ImportedWeek = {
  number: number;
  sheet: string;
  days: ImportedDay[];
};

export type ImportedMetadata = {
  athlete?: string | null;
  objective?: string | null;
  split?: string | null;
  race_date?: string | null;
  race_profile?: string | null;
  raw?: Record<string, string>;
};

export type ColumnLayout = {
  nameCol: number;
  headerRow: number;
  seriesCol: number;
  repsCol: number;
  chargeCol: number;
  tempoCol: number;
  recupCol: number;
  rpeCol: number;
  notesCol: number;
  youtubeCol: number;
};

export type ParsedExcel = {
  metadata: ImportedMetadata;
  weeks: ImportedWeek[];
  stats: {
    weeks: number;
    days: number;
    exercises: number;
    videos: number;
    colored: number;
    uncolored: number;
  };
  layout: ColumnLayout | null;
  warnings: string[];
};

const COLOR_MAP: Record<string, string[]> = {
  red: ["F4CCCC", "EA9999", "E06666", "CC0000", "DD7E6B"],
  green: ["D9EAD3", "B6D7A8", "93C47D", "6AA84F"],
  yellow: ["FFE599", "FFD966", "F1C232"],
  blue: ["FFF2CC", "CFE2F3", "9FC5E8", "6FA8DC", "A4C2F4", "C9DAF8"],
};

const SESSION_RE =
  /(full[\s-]?body|lower|upper|push|pull|legs?|jambe|séance|seance|course|cardio|côtes|cotes|fractionn|endurance|renfo|mobilité|sortie|hiit|circuit|bloc)/i;
const EX_CODE_RE = /^([A-H]\d*)[.)]\s*(.*)/i;
const JUNK_RE =
  /^(objectif|important|consigne|remarque|note|attention|rappel|\(|on cherche|on peut|pour |~|\d+\s*(min|km|m))/i;

function getCell(ws: XLSX.WorkSheet, row: number, col: number): any {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return (ws as any)[addr];
}

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string | null {
  const cell = getCell(ws, r, c);
  if (!cell || cell.v === undefined || cell.v === null) return null;
  const s = String(cell.v).trim();
  if (!s || s === "-") return null;
  return s;
}

function detectColor(cell: any): ImportedExercise["color"] {
  const rgb = cell?.s?.fgColor?.rgb || cell?.s?.bgColor?.rgb;
  if (!rgb) return null;
  const hex = String(rgb).slice(-6).toUpperCase();
  for (const [color, hexes] of Object.entries(COLOR_MAP)) {
    if (hexes.includes(hex)) return color as ImportedExercise["color"];
  }
  return null;
}

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getYoutubeUrl(ws: XLSX.WorkSheet, row: number, col: number): string | null {
  const cell = getCell(ws, row, col);
  if (!cell) return null;
  if (cell.l?.Target) return String(cell.l.Target);
  const v = String(cell.v || "");
  const m = v.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

function findColumnLayout(ws: XLSX.WorkSheet, range: XLSX.Range): ColumnLayout | null {
  for (let r = range.s.r; r <= Math.min(range.s.r + 40, range.e.r); r++) {
    for (let c = 0; c < 6; c++) {
      const cell = getCell(ws, r, c);
      if (!cell || cell.v === undefined) continue;
      if (String(cell.v).trim().toLowerCase() === "exercice") {
        const layout: Partial<ColumnLayout> = { nameCol: c, headerRow: r };
        for (let cc = c; cc < c + 14; cc++) {
          const h = getCell(ws, r, cc);
          if (!h) continue;
          const label = String(h.v).trim().toLowerCase();
          if (/série|serie/.test(label)) layout.seriesCol = cc;
          else if (/reps|rép|rep/.test(label)) layout.repsCol = cc;
          else if (/charge/.test(label)) layout.chargeCol = cc;
          else if (/tempo|temps/.test(label)) layout.tempoCol = cc;
          else if (/récup|recup/.test(label)) layout.recupCol = cc;
          else if (/rpe/.test(label)) layout.rpeCol = cc;
        }
        layout.seriesCol ??= c + 2;
        layout.repsCol ??= c + 3;
        layout.chargeCol ??= c + 4;
        layout.tempoCol ??= c + 5;
        layout.recupCol ??= c + 6;
        layout.rpeCol ??= c + 7;
        layout.notesCol = c + 8;
        layout.youtubeCol = c + 12;
        return layout as ColumnLayout;
      }
    }
  }
  return null;
}

/**
 * In a superset (A1, A2, A3…), series count is defined by the first exercise.
 * If later exercises have no series value, they inherit from the first in the block.
 * Never invents a default — only inherits from an explicit value.
 */
function propagateBlockSeries(exercises: ImportedExercise[]): void {
  // Group by block letter (first char of code, e.g. "A" for A1/A2/A3)
  const groups = new Map<string, ImportedExercise[]>();
  for (const ex of exercises) {
    if (!ex.code) continue;
    const letter = ex.code[0].toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(ex);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const blockSeries = group.find((ex) => ex.series != null && ex.series !== "")?.series ?? null;
    if (!blockSeries) continue;
    for (const ex of group) {
      if (!ex.series || ex.series === "") ex.series = blockSeries;
    }
  }
}

function detectBlockType(
  series: string | null,
  reps: string | null,
  tempo: string | null,
): ImportedExercise["block_type"] {
  const s = (series || "").toLowerCase();
  const rp = (reps || "").toLowerCase();
  const t = (tempo || "").toLowerCase();
  if (/emom/.test(s) || /emom/.test(rp)) return "emom";
  if (/ladder/.test(s)) return "ladder";
  if (/amrap/.test(s) || /amrap/.test(rp)) return "amrap";
  if (/dropset/.test(s)) return "dropset";
  if (/iso/.test(t)) return "iso";
  if (/round|circuit/.test(s)) return "circuit";
  return "standard";
}

function extractMetadata(ws: XLSX.WorkSheet): ImportedMetadata {
  const raw: Record<string, string> = {};
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.s.r + 25, range.e.r); r++) {
    for (let c = 0; c < 6; c++) {
      const lc = getCell(ws, r, c);
      if (!lc?.v) continue;
      const label = String(lc.v).trim().toUpperCase();
      if (!/[A-Z]/.test(label) || label.length > 50) continue;
      // value is in a nearby right cell
      for (let cc = c + 1; cc <= c + 4 && cc <= range.e.c; cc++) {
        const vc = getCell(ws, r, cc);
        if (vc?.v !== undefined && vc?.v !== null && String(vc.v).trim()) {
          raw[label] = String(vc.v).trim();
          break;
        }
      }
    }
  }
  const find = (re: RegExp) => {
    for (const k of Object.keys(raw)) if (re.test(k)) return raw[k];
    return null;
  };
  return {
    athlete: find(/^NOM\b|ATHL/),
    objective: find(/OBJECTIF/),
    split: find(/SPLIT|FREQUENCE|FRÉQUENCE/),
    race_date: find(/DATE.*COURSE|COURSE.*DATE/),
    race_profile: find(/PROFIL/),
    raw,
  };
}

function parseWeekSheet(ws: XLSX.WorkSheet, sheetName: string): ImportedWeek | null {
  if (!ws["!ref"]) return null;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const layout = findColumnLayout(ws, range);
  if (!layout) return null;
  const weekNum = parseInt(sheetName.match(/\d+/)?.[0] || "0", 10);
  const week: ImportedWeek = { number: weekNum, sheet: sheetName, days: [] };
  let currentDay: ImportedDay | null = null;
  let dayIndex = 0;

  for (let r = layout.headerRow + 1; r <= range.e.r; r++) {
    const nameCell = getCell(ws, r, layout.nameCol);
    const name = nameCell?.v !== undefined && nameCell?.v !== null ? String(nameCell.v).trim() : "";
    if (!name || name.toLowerCase() === "exercice") continue;

    const series = cellStr(ws, r, layout.seriesCol);
    const reps = cellStr(ws, r, layout.repsCol);
    const charge = cellStr(ws, r, layout.chargeCol);
    const rpe = cellStr(ws, r, layout.rpeCol);
    const tempo = cellStr(ws, r, layout.tempoCol);
    const recup = cellStr(ws, r, layout.recupCol);
    const hasData = !!(series || reps || charge || rpe);
    const exMatch = name.match(EX_CODE_RE);

    if (SESSION_RE.test(name) && !hasData && !exMatch && name.length < 90) {
      dayIndex++;
      currentDay = { number: dayIndex, label: name, exercises: [] };
      week.days.push(currentDay);
      continue;
    }

    if (JUNK_RE.test(name) && !hasData) continue;
    if (!hasData && !exMatch) continue;
    if (!currentDay) {
      dayIndex++;
      currentDay = { number: dayIndex, label: `Séance ${dayIndex}`, exercises: [] };
      week.days.push(currentDay);
    }

    const code = exMatch ? exMatch[1].toUpperCase() : null;
    const exName = (exMatch ? exMatch[2] : name).trim() || name;
    const url = getYoutubeUrl(ws, r, layout.youtubeCol);

    currentDay.exercises.push({
      code,
      name: exName,
      series,
      reps,
      charge,
      tempo,
      recup,
      rpe_target: rpe,
      coach_notes: cellStr(ws, r, layout.notesCol),
      color: detectColor(nameCell),
      youtube_url: url,
      youtube_id: extractYoutubeId(url),
      block_type: detectBlockType(series, reps, tempo),
    });
  }

  week.days = week.days.filter((d) => d.exercises.length > 0);
  for (const day of week.days) propagateBlockSeries(day.exercises);
  return week;
}

export async function parseExcelFile(file: File): Promise<ParsedExcel> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellStyles: true });
  const weekSheets = wb.SheetNames.filter((n) => /^S\d+/i.test(n));
  const warnings: string[] = [];
  if (weekSheets.length === 0) {
    throw new Error(
      "Aucune semaine détectée. Tes feuilles doivent s'appeler S1, S2, S3…",
    );
  }
  const metadata = extractMetadata(wb.Sheets[weekSheets[0]]);
  const weeks: ImportedWeek[] = [];
  let layout: ColumnLayout | null = null;

  for (const sheetName of weekSheets) {
    const ws = wb.Sheets[sheetName];
    const wk = parseWeekSheet(ws, sheetName);
    if (!wk) {
      warnings.push(`Feuille « ${sheetName} » ignorée (aucune ligne d'en-tête "Exercice").`);
      continue;
    }
    if (!layout) layout = findColumnLayout(ws, XLSX.utils.decode_range(ws["!ref"]!));
    weeks.push(wk);
  }

  if (weeks.length === 0) {
    throw new Error(
      "Aucun exercice détecté. Vérifie que tes feuilles ont une ligne d'en-tête contenant « Exercice ».",
    );
  }

  let exCount = 0;
  let videos = 0;
  let colored = 0;
  let dayCount = 0;
  for (const w of weeks) {
    dayCount += w.days.length;
    for (const d of w.days) {
      for (const ex of d.exercises) {
        exCount++;
        if (ex.youtube_url) videos++;
        if (ex.color) colored++;
      }
    }
  }

  return {
    metadata,
    weeks,
    layout,
    warnings,
    stats: {
      weeks: weeks.length,
      days: dayCount,
      exercises: exCount,
      videos,
      colored,
      uncolored: exCount - colored,
    },
  };
}
