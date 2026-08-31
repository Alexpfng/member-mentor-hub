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
  /** Colonnes propres aux séances de course : absentes des tableaux de muscu. */
  distanceCol?: number;
  allureCol?: number;
  tempsCol?: number;
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
  // FFF2CC = crème (code « isolation » dans les Excel du coach) : c'est un jaune,
  // il était classé à tort dans le groupe bleu.
  yellow: ["FFE599", "FFD966", "F1C232", "FFF2CC"],
  blue: ["CFE2F3", "9FC5E8", "6FA8DC", "A4C2F4", "C9DAF8"],
};

const SESSION_RE =
  /(full[\s-]?body|lower|upper|push|pull|legs?|jambe|séance|seance|course|cardio|côtes|cotes|fractionn|endurance|renfo|mobilité|sortie|hiit|circuit|bloc)/i;
const AUXILIARY_SECTION_RE =
  /^(répertoire|repertoire|biblioth[eè]que|exercices?\s+rehab|rehab\b|routine\s+rehab)/i;
const EX_CODE_RE = /^([A-H]\d*)[.)]\s*(.*)/i;
const JUNK_RE =
  /^(objectif|obj\.|important|consigne|remarque|note|attention|rappel|\(|on cherche|on peut|pour |~|\d+\s*(min|km|m))/i;

function getCell(ws: XLSX.WorkSheet, row: number, col: number): any {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return (ws as any)[addr];
}

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string | null {
  if (c < 0) return null; // colonne absente du tableau
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

/** Cherche, sous l'en-tête, une colonne contenant des liens vidéo. */
function findLinkColumn(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
  headerRow: number,
  nameCol: number,
): number | null {
  for (let r = headerRow + 1; r <= Math.min(headerRow + 25, range.e.r); r++) {
    for (let c = nameCol + 1; c <= Math.min(nameCol + 14, range.e.c); c++) {
      const cell = getCell(ws, r, c);
      const raw = cell?.v !== undefined && cell?.v !== null ? String(cell.v) : "";
      const link = cell?.l?.Target ? String(cell.l.Target) : raw;
      if (/youtu\.?be|youtube\.com/i.test(link)) return c;
    }
  }
  return null;
}

function findColumnLayout(ws: XLSX.WorkSheet, range: XLSX.Range): ColumnLayout | null {
  for (let r = range.s.r; r <= Math.min(range.s.r + 40, range.e.r); r++) {
    for (let c = 0; c < 6; c++) {
      const cell = getCell(ws, r, c);
      if (!cell || cell.v === undefined) continue;
      // Les tableaux du coach sont tantôt en français, tantôt en anglais.
      if (!/^exerc(ice|ise)$/i.test(String(cell.v).trim())) continue;

      const layout: Partial<ColumnLayout> = { nameCol: c, headerRow: r };
      const taken = new Set<number>([c]);
      const set = (key: keyof ColumnLayout, col: number) => {
        if (layout[key] !== undefined) return; // la première colonne trouvée gagne
        layout[key] = col;
        taken.add(col);
      };

      for (let cc = c; cc < c + 14; cc++) {
        const h = getCell(ws, r, cc);
        if (!h || h.v === undefined) continue;
        const label = String(h.v).trim().toLowerCase();
        if (cc === c) continue; // la colonne du nom
        // « tempo » (muscu, ex. 3010) et « temps » (course, ex. 1min travail) sont
        // deux choses différentes : les confondre collait la durée d'un intervalle
        // dans le champ tempo, et faussait toute la ligne.
        if (/tempo/.test(label)) set("tempoCol", cc);
        else if (/temps|durée|duree/.test(label)) set("tempsCol", cc);
        else if (/série|serie/.test(label)) set("seriesCol", cc);
        else if (/reps|rép|rep\b/.test(label)) set("repsCol", cc);
        else if (/charge|poids/.test(label)) set("chargeCol", cc);
        else if (/distance/.test(label)) set("distanceCol", cc);
        else if (/allure|pace|vitesse/.test(label)) set("allureCol", cc);
        else if (/récup|recup|repos/.test(label)) set("recupCol", cc);
        else if (/rpe/.test(label)) set("rpeCol", cc);
        else if (/consigne|explication|explanation|note|remarque/.test(label)) set("notesCol", cc);
        else if (/vidéo|video|youtube|lien|url/.test(label)) set("youtubeCol", cc);
      }

      // Repli par position UNIQUEMENT pour ce qui n'a pas été nommé, et sans
      // marcher sur une colonne déjà attribuée : sinon « Récup » se retrouvait
      // lu comme une charge et tout le tableau se décalait.
      const fallback = (key: keyof ColumnLayout, col: number) => {
        if (layout[key] !== undefined || taken.has(col)) return;
        layout[key] = col;
        taken.add(col);
      };
      fallback("seriesCol", c + 2);
      fallback("repsCol", c + 3);
      fallback("chargeCol", c + 4);
      fallback("tempoCol", c + 5);
      fallback("recupCol", c + 6);
      fallback("rpeCol", c + 7);
      fallback("notesCol", c + 8);
      // Le coach colle souvent ses liens dans une colonne sans en-tête : on la
      // repère à son contenu plutôt que de parier sur une position fixe.
      if (layout.youtubeCol === undefined) {
        const found = findLinkColumn(ws, range, r, c);
        if (found !== null && !taken.has(found)) {
          layout.youtubeCol = found;
          taken.add(found);
        }
      }
      fallback("youtubeCol", c + 12);
      // Une colonne absente du tableau ne doit rien lire : -1 = « pas de colonne ».
      for (const key of [
        "seriesCol",
        "repsCol",
        "chargeCol",
        "tempoCol",
        "recupCol",
        "rpeCol",
        "notesCol",
        "youtubeCol",
      ] as const) {
        layout[key] ??= -1;
      }
      return layout as ColumnLayout;
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
    const rawReps = cellStr(ws, r, layout.repsCol);
    const rawCharge = cellStr(ws, r, layout.chargeCol);
    const rpe = cellStr(ws, r, layout.rpeCol);
    const tempo = cellStr(ws, r, layout.tempoCol);
    const recup = cellStr(ws, r, layout.recupCol);

    // Séances de course : la distance et le temps jouent le rôle des répétitions,
    // l'allure celui de la charge (c'est l'intensité prescrite). Ce qui ne rentre
    // pas est repris en note plutôt que jeté — le coach ne doit rien perdre.
    const distance = cellStr(ws, r, layout.distanceCol ?? -1);
    const allure = cellStr(ws, r, layout.allureCol ?? -1);
    const temps = cellStr(ws, r, layout.tempsCol ?? -1);
    const reps = rawReps ?? distance ?? temps;
    const charge = rawCharge ?? allure;
    const leftovers = [
      rawReps && distance ? `Distance : ${distance}` : null,
      (rawReps || distance) && temps ? `Temps : ${temps}` : null,
      rawCharge && allure ? `Allure : ${allure}` : null,
    ].filter(Boolean) as string[];

    const hasData = !!(series || reps || charge || rpe);
    const exMatch = name.match(EX_CODE_RE);
    const isAuxiliarySessionTitle = AUXILIARY_SECTION_RE.test(name) && !hasData && !exMatch;
    const isSessionTitle =
      (SESSION_RE.test(name) || isAuxiliarySessionTitle) &&
      !hasData &&
      !exMatch &&
      name.length < 90;

    if (isSessionTitle) {
      dayIndex++;
      currentDay = { number: dayIndex, label: name, exercises: [] };
      week.days.push(currentDay);
      continue;
    }

    // Ligne de consigne (« OBJECTIF : … », fragment de phrase en minuscules…)
    // sans données numériques : on la rattache aux notes de l'exercice précédent
    // au lieu d'en faire un exercice fantôme (« —×— · CONSIGNE » côté membre).
    // Le texte éventuel de la colonne RPE fait partie de la consigne.
    const rpeIsNumeric = !!rpe && !Number.isNaN(Number(rpe.replace(",", ".")));
    const hasNumericData = !!(series || reps || charge || rpeIsNumeric);
    // Un bloc du coach s'étale souvent sur deux lignes (cellules fusionnées) : la
    // seconde porte « OBJECTIF : » ET la récup de l'intervalle (« 1min recup »,
    // « ~7:00/km »). Elle reste une consigne malgré ces valeurs — sinon elle
    // devenait un exercice fantôme. Une ligne qui commence simplement par une
    // minuscule, elle, n'est une consigne que si elle ne porte aucune donnée :
    // un vrai exercice peut s'appeler « développé couché ».
    const isConsigneLabel = JUNK_RE.test(name);
    const looksLikeConsigne =
      !exMatch && (isConsigneLabel || (!hasNumericData && /^[a-zàâäéèêëîïôöùûüç]/.test(name)));
    if (looksLikeConsigne) {
      const prev = currentDay?.exercises[currentDay.exercises.length - 1];
      if (prev) {
        const fragment = [
          name,
          reps && reps !== name ? reps : null,
          charge && charge !== name ? charge : null,
          recup,
          rpe && !rpeIsNumeric ? rpe : null,
          cellStr(ws, r, layout.notesCol),
        ]
          .filter(Boolean)
          .join(" — ");
        prev.coach_notes = prev.coach_notes ? `${prev.coach_notes}\n${fragment}` : fragment;
      }
      continue;
    }

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
      coach_notes:
        [cellStr(ws, r, layout.notesCol), ...leftovers].filter(Boolean).join("\n") || null,
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

export async function listExcelSheets(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.filter((n) => /^S\d+/i.test(n));
}

export async function parseExcelFile(file: File, selectedSheets?: string[]): Promise<ParsedExcel> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellStyles: true });
  const allWeekSheets = wb.SheetNames.filter((n) => /^S\d+/i.test(n));
  const weekSheets = selectedSheets
    ? allWeekSheets.filter((n) => selectedSheets.includes(n))
    : allWeekSheets;
  const warnings: string[] = [];
  if (weekSheets.length === 0) {
    throw new Error("Aucune semaine détectée. Tes feuilles doivent s'appeler S1, S2, S3…");
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
