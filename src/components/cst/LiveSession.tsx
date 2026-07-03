/* ColosmartTraining — Séance interactive guidée
   Un écran = une action. Chrono auto. Aucun scroll-fest. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProgramBlocks, groupBlocks, type ProgExercise } from "./ProgramBlocks";
import { ExerciseThread } from "./ExerciseThread";
import PainReportDialog from "./PainReportDialog";
import {
  buildExerciseOverview,
  groupExpertRecapByExercise,
  type ExpertSavedStep,
  type SessionProgressStep,
} from "@/lib/live-session-progress";
import {
  ColorDot,
  ColorTooltip,
  TempoBadge,
  TempoExplainer,
  RPEGuidance,
  RPEReferenceSheet,
  rpeFeedbackMessage,
  colorHex,
  type ExerciseColor,
} from "./pedagogy";

/* ───────── Helpers ───────── */

function asColor(c?: string | null): ExerciseColor {
  const v = (c || "").toLowerCase();
  if (v === "red" || v === "green" || v === "yellow" || v === "lime" || v === "blue") return v;
  return null;
}

function parseSeriesCount(s: ProgExercise["series"]): number {
  if (s == null || s === "") return 3;
  const m = String(s).match(/\d+/);
  return m ? Math.max(1, parseInt(m[0], 10)) : 3;
}

function parseRecupSeconds(r?: string | null, fallback = 120): number {
  if (!r) return fallback;
  const t = String(r).trim().toLowerCase().replace(/\s+/g, "");
  // 2'30, 2'30", 2:30
  let m = t.match(/^(\d+)[:'](\d{1,2})/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  // 2min, 2 min
  m = t.match(/^(\d+(?:\.\d+)?)m(?:in)?$/);
  if (m) return Math.round(parseFloat(m[1]) * 60);
  // 90s
  m = t.match(/^(\d+)s$/);
  if (m) return parseInt(m[1]);
  // bare number → seconds
  m = t.match(/^(\d+)$/);
  if (m) {
    const n = parseInt(m[1]);
    return n < 15 ? n * 60 : n; // small numbers are probably minutes
  }
  return fallback;
}

function defaultRestFor(color: ExerciseColor): number {
  if (color === "red") return 180;
  if (color === "green") return 90;
  if (color === "yellow") return 150;
  if (color === "lime") return 60;
  if (color === "blue") return 60;
  return 120;
}

function blockExplain(type?: string | null, isSuperset = false): string | null {
  const t = (type || "").toLowerCase();
  if (t === "emom") return "EMOM : 1 série au début de chaque minute. Le temps restant dans la minute = ton repos.";
  if (t === "ladder") return "Ladder : le nombre de reps change à chaque minute (ex : 1, 2, 3, puis on recommence).";
  if (t === "amrap")
    return "AMRAP : autant de tours/reps que possible dans le temps imparti, avec une technique propre.";
  if (t === "dropset") return "Dropset : enchaîne sans repos en baissant la charge jusqu'à l'échec technique.";
  if (t === "circuit") return "Circuit : enchaîne tous les exos du bloc, puis prends la récup et recommence.";
  if (isSuperset) return "Superset : enchaîne les deux exercices sans repos, puis prends la récup commune.";
  return null;
}

/* ───────── Helpers ajoutés (PDC, cibles reps, durée, formats) ───────── */

const BODYWEIGHT_KEYWORDS = ["pdc", "poids du corps", "bodyweight", "corps", "pds de corps"];

function isBodyweight(charge?: string | null): boolean {
  if (charge == null) return false;
  const c = String(charge).toLowerCase().trim();
  if (!c) return false;
  if (c === "-" || c === "—" || c === "/") return true;
  if (c === "bb" || c === "bw") return true; // raccourcis « bodyweight »
  return BODYWEIGHT_KEYWORDS.some((k) => c.includes(k));
}

function isDurationReps(reps?: string | number | null): boolean {
  if (reps == null) return false;
  const r = String(reps).toLowerCase().trim();
  return /\d+\s*(s|sec|secondes?|"|''|min|m)\b/.test(r) || /\d+\s*['"]/.test(r);
}

/** Extracts duration in seconds from a reps string. Returns null if not parseable. */
function parseDurationSeconds(reps?: string | number | null): number | null {
  if (reps == null) return null;
  const r = String(reps).toLowerCase().trim();
  // "30s", "30 sec", "30 secondes"
  let m = r.match(/(\d+)\s*(s|sec|secondes?)/);
  if (m) return parseInt(m[1], 10);
  // "1min", "1 min", "2 minutes"
  m = r.match(/(\d+)\s*(min|minutes?)/);
  if (m) return parseInt(m[1], 10) * 60;
  // "1'30" or "1:30"
  m = r.match(/(\d+)[:'](\d{2})/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

/** Detects timed isometric exercises by name/tempo keywords. */
function isTimedByName(name: string, tempo?: string | null): boolean {
  const t = `${name} ${tempo ?? ""}`.toLowerCase();
  return /gainage|plank|planche|iso\b|hold|tenir|maintien|floating/.test(t);
}

/** True if a timed exercise is performed per side/leg → one chrono per side.
 *  Ex: "30s/côté", "30s par jambe", "30s/jambe", "20s chaque côté". */
function isPerSide(reps?: string | number | null): boolean {
  if (reps == null) return false;
  const r = String(reps).toLowerCase();
  return /(c[ôo]t[ée]|jambe|\bbras\b|\bpied|\bside\b|each\s+(leg|side|arm))/.test(r);
}

/** Strips accents and lowercases for robust keyword matching. */
function normKey(s?: string | null): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** True if the exercise NAME denotes a unilateral movement (one leg/arm at a time)
 *  → its timed holds should run one chrono per side even without a "/côté" marker. */
function isUnilateralByName(name?: string | null): boolean {
  const n = normKey(name);
  return /(fente|split\s*squat|bulgare|pistol|unilat|step[\s-]?up|side\s*plank|lateral|une\s+jambe|single[\s-]?leg)/.test(n);
}

/** Picks the round-label word for a per-side timed exercise (JAMBE / BRAS / PIED / CÔTÉ). */
function sideWord(reps?: string | number | null, name?: string | null): string {
  const r = normKey(`${reps ?? ""} ${name ?? ""}`);
  if (/jambe|\bleg|fente|squat|bulgare|pistol|step/.test(r)) return "JAMBE";
  if (/bras|\barm/.test(r)) return "BRAS";
  if (/pied|foot/.test(r)) return "PIED";
  return "CÔTÉ";
}

/** Number of consecutive chronos for a timed set.
 *  - explicit multiplier "2×30s" / "2x30s" → that many rounds
 *  - per-side text ("30s/côté", "…par jambe") OR unilateral exercise name → 2 rounds
 *  - otherwise → 1 round */
function parseTimedRounds(reps?: string | number | null, name?: string | null): number {
  const r = String(reps ?? "").toLowerCase().trim();
  const m = r.match(/^(\d+)\s*[x×*]\s*\d/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  return isPerSide(reps) || isUnilateralByName(name) ? 2 : 1;
}

/** Parse le pattern de reps d'un Ladder (ex: "2, 3, 4" → [2, 3, 4]).
 *  Retourne un tableau vide si le champ ne ressemble pas à une liste. */
function parseLadderPattern(reps: string | number | null | undefined): number[] {
  if (reps == null || reps === "") return [];
  const raw = String(reps).trim();
  // Doit contenir au moins 2 valeurs séparées par , ; ou /
  if (!/\d+\s*[,;\/]\s*\d+/.test(raw)) return [];
  return raw.split(/[,;\/]/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

/** Découpe une cible reps en une cible par série (15/12/10) ou répète une fourchette (10-8) */
function parseRepsPerSet(repsTarget: string | number | null | undefined, seriesCount: number): string[] {
  const fallback = Array(seriesCount).fill("");
  if (repsTarget == null || repsTarget === "") return fallback;
  const raw = String(repsTarget).trim();

  // Cas "10-8" ou "10 - 8" : fourchette à 2 valeurs → même placeholder partout
  const range = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range && seriesCount !== 2) {
    return Array(seriesCount).fill(raw);
  }

  // Split sur / , ; ou - (mais on a déjà capté la fourchette ci-dessus)
  const parts = raw
    .split(/[\/,;]|\s+[-–]\s+|(?<=\d)\s*[-–]\s*(?=\d)/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === seriesCount) return parts;
  if (parts.length > 1 && parts.length === seriesCount) return parts;
  return Array(seriesCount).fill(parts[0] || raw);
}

/** Extrait le premier nombre d'une chaîne (ex: "60kg" → 60, "12,5kg" → 12.5) */
function extractNumeric(s?: string | null): number | null {
  if (s == null) return null;
  const m = String(s).match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Formats a reps value into a human-readable objective string.
 * Examples:
 *   "20 / jambes"  → "20 par jambe"
 *   "40 en tout"   → "40 au total"
 *   "5 croix/jambes" → "5 croix par jambe"
 *   "8 - 9"        → "8 à 9 reps"
 *   "max"          → "maximum de reps"
 *   "20s / côté"   → "20 secondes par côté"
 *   "8"            → "8 reps"
 */
function formatRepsObjectif(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "—") return null;

  // Duration per side: "20s / côté"
  const durSide = s.match(/^(\d+)\s*['"s]?\s*[s]\s*[/\\]\s*(.+)/i);
  if (durSide) return `${durSide[1]} secondes par ${durSide[2].trim()}`;

  // Per-side reps: "20 / jambe", "6 / côté", "5 croix / jambes"
  const perSide = s.match(/^(.+?)\s*[/\\]\s*(jambes?|côtés?|cotes?|pieds?|bras|mains?)/i);
  if (perSide) {
    const val = perSide[1].trim();
    const side = perSide[2].replace(/s$/i, "").toLowerCase();
    return `${val} par ${side}`;
  }

  // Total: "40 en tout", "40 total"
  const total = s.match(/^([\d\s]+)\s*(en tout|total)/i);
  if (total) return `${total[1].trim()} au total`;

  // "max"
  if (/^max(imum)?$/i.test(s)) return "maximum de reps";

  // Range "8-9" or "8 à 9"
  const range = s.match(/^(\d+)\s*[-à–]\s*(\d+)$/i);
  if (range) return `${range[1]} à ${range[2]} reps`;

  // Duration without per-side: "30s", "1min"
  if (/^\d+\s*(s|sec|secondes?|min|minutes?|'|'')\s*$/.test(s)) return s;

  // Plain number
  if (/^\d+$/.test(s)) return `${s} reps`;

  // Fallback: return raw value (never appends "REPS" if already has special content)
  return s;
}

function formatRelativeDays(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.round(diff / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days}j`;
}

type LastSet = { weight: number | null; reps: number | null; rpe: number | null; loggedAt: string | null };

const RPE_PICKER_VALUES = Array.from({ length: 21 }, (_, index) => index * 0.5);

function formatRpeValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}
type LastByExo = Record<string, Record<number, LastSet> & { _loggedAt?: string | null; _sets?: LastSet[] }>;
type ExpertRecapGroup = ReturnType<typeof groupExpertRecapByExercise>[number];

function YtThumbLink({ vid, href }: { vid: string | null; href: string }) {
  const [imgOk, setImgOk] = React.useState(true);
  const thumbSrc = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ display: "block", textDecoration: "none", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}
      title="Voir la démo sur YouTube"
    >
      {thumbSrc && imgOk ? (
        <div style={{ position: "relative" }}>
          <img
            src={thumbSrc}
            alt="Aperçu vidéo"
            onError={() => setImgOk(false)}
            style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 150, aspectRatio: "16/9" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.25)",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontSize: 16, marginLeft: 3 }}>▶</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 10px", background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.85)", fontSize: 10, letterSpacing: "0.14em",
        }} className="cst-mono">
          ▶ VOIR LA DÉMO
        </div>
      )}
    </a>
  );
}

function ExerciseMediaCard({ exercise }: { exercise: ProgExercise }) {
  const vid = exercise.youtube_id || extractYoutubeId(exercise.youtube_url);
  const href = exercise.youtube_url || (vid ? `https://www.youtube.com/watch?v=${vid}` : null);
  if (exercise.image_url) {
    const inner = (
      <img
        src={exercise.image_url}
        alt=""
        style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 150 }}
      />
    );
    const cardStyle: React.CSSProperties = { display: "block", textDecoration: "none", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" };
    if (href) return <a href={href} target="_blank" rel="noreferrer" style={cardStyle} title="Voir la démo sur YouTube">{inner}</a>;
    return <div style={cardStyle}>{inner}</div>;
  }
  if (!href) return null;
  return <YtThumbLink vid={vid} href={href} />;
}

function rpeTone(value: number | null) {
  if (value == null) return "rgba(255,255,255,0.16)";
  if (value >= 9) return "#C9483A";
  if (value >= 7) return "#4A8BC4";
  return "#6EAB76";
}

function ExpertRecapRpeBadge({
  group,
  value,
  open,
  onToggle,
  onChange,
  onClear,
}: {
  group: ExpertRecapGroup;
  value: number | null;
  open: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const tone = rpeTone(value);
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cst-display" style={{ fontSize: 15, lineHeight: 1.2 }}>
            {group.exerciseName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {group.rows.map((row) => (
              <div key={row.stepIdx} className="cst-mono" style={{ fontSize: 10, opacity: 0.78 }}>
                S{row.setNumber} · {row.weight ?? "—"}kg × {row.reps ?? "—"}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="cst-mono"
          style={{
            minWidth: 78,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${tone}`,
            background: value == null ? "transparent" : `${tone}22`,
            color: value == null ? "rgba(255,255,255,0.78)" : "#fff",
            fontSize: 11,
            letterSpacing: "0.12em",
            cursor: "pointer",
            ...rpeButtonReset(value == null ? "rgba(255,255,255,0.78)" : "#ffffff"),
          }}
        >
          {value == null ? "RPE —" : `RPE ${formatRpeValue(value)}`}
        </button>
      </div>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 10,
            borderRadius: 10,
            background: "rgba(20,32,24,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {RPE_PICKER_VALUES.map((score) => {
              const selected = value === score;
              const scoreTone = rpeTone(score);
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => onChange(score)}
                  className="cst-mono"
                  style={{
                    padding: "12px 0",
                    borderRadius: 8,
                    border: `1px solid ${selected ? scoreTone : "rgba(255,255,255,0.12)"}`,
                    background: selected ? `${scoreTone}40` : "rgba(255,255,255,0.04)",
                    color: selected ? "#fff" : "rgba(255,255,255,0.9)",
                    fontSize: 18,
                    cursor: "pointer",
                    ...rpeButtonReset(selected ? "#ffffff" : "rgba(255,255,255,0.9)"),
                  }}
                >
                  {formatRpeValue(score)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="cst-mono"
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.82)",
              fontSize: 11,
              letterSpacing: "0.14em",
              cursor: "pointer",
              ...rpeButtonReset("rgba(255,255,255,0.82)"),
            }}
          >
            EFFACER LE RPE
          </button>
        </div>
      )}
    </div>
  );
}

function ExpertOverviewRpeBadge({
  value,
  open,
  onToggle,
  onChange,
  onClear,
}: {
  value: number | null;
  open: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const tone = rpeTone(value);
  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={onToggle}
        className="cst-mono"
        style={{
          minWidth: 78,
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${tone}`,
          background: value == null ? "transparent" : `${tone}22`,
          color: value == null ? "rgba(255,255,255,0.78)" : "#fff",
          fontSize: 11,
          letterSpacing: "0.12em",
          cursor: "pointer",
          ...rpeButtonReset(value == null ? "rgba(255,255,255,0.78)" : "#ffffff"),
        }}
      >
        {value == null ? "RPE —" : `RPE ${formatRpeValue(value)}`}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            width: 220,
            padding: 10,
            borderRadius: 10,
            background: "rgba(20,32,24,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {RPE_PICKER_VALUES.map((score) => {
              const selected = value === score;
              const scoreTone = rpeTone(score);
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => onChange(score)}
                  className="cst-mono"
                  style={{
                    padding: "10px 0",
                    borderRadius: 8,
                    border: `1px solid ${selected ? scoreTone : "rgba(255,255,255,0.12)"}`,
                    background: selected ? `${scoreTone}40` : "rgba(255,255,255,0.04)",
                    color: selected ? "#fff" : "rgba(255,255,255,0.9)",
                    fontSize: 16,
                    cursor: "pointer",
                    ...rpeButtonReset(selected ? "#ffffff" : "rgba(255,255,255,0.9)"),
                  }}
                >
                  {formatRpeValue(score)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="cst-mono"
            style={{
              padding: "11px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.82)",
              fontSize: 10,
              letterSpacing: "0.14em",
              cursor: "pointer",
              ...rpeButtonReset("rgba(255,255,255,0.82)"),
            }}
          >
            EFFACER LE RPE
          </button>
        </div>
      )}
    </div>
  );
}

function rpeButtonReset(color: string) {
  return {
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    WebkitTapHighlightColor: "transparent",
    WebkitTextFillColor: color,
    boxShadow: "none",
    fontWeight: 700,
    lineHeight: 1.1,
  };
}

function extractYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function hasVideo(ex?: ProgExercise | null): boolean {
  if (!ex) return false;
  return !!(ex.youtube_id || ex.youtube_url || ex.youtube_alt_url);
}

function hasCues(ex?: ProgExercise | null): boolean {
  if (!ex) return false;
  return !!(ex.coach_notes || ex.tempo || ex.rpe_target || ex.color);
}

/** Parses EMOM params from series or reps fields.
 * Duration formats (coach sets in program):
 *   "EMOM15'"   → 15 min  (apostrophe droit ou typographique)
 *   "EMOM15min" → 15 min
 *   "EMOM15m"   → 15 min
 *   "EMOM3×15'" → 3 reps/min, 15 min  (× ou x ou /)
 *   "EMOM3/15'" → 3 reps/min, 15 min
 * Reps only (durée par défaut 10 min) :
 *   "EMOM3"     → 3 reps/min, 10 min
 */
function parseEmom(series: string | null, reps: string | null): { durationMin: number; repsPerMin: number | null } {
  // Normalise: apostrophe typographique → droit, minuscule
  const src = `${series ?? ""} ${reps ?? ""}`.toLowerCase().replace(/[‘’ʼ]/g, "'");

  // Combined "EMOMreps×dur'" or "EMOMreps/dur'" → e.g. "EMOM3×15'" "EMOM3/10min"
  const combinedMatch = src.match(/emom\s*(\d+)\s*[x×\/]\s*(\d+)\s*(?:'|min\b|m\b)/);
  if (combinedMatch) {
    return { durationMin: parseInt(combinedMatch[2], 10), repsPerMin: parseInt(combinedMatch[1], 10) };
  }

  // Duration-only: "EMOM15'" or "EMOM15min" or "EMOM15m"
  const durMatch = src.match(/emom\s*(\d+)\s*(?:'|min\b|m\b)/);
  if (durMatch) {
    // Reps may come from separate reps field
    const repsVal = reps?.match(/^(\d+)$/)?.[1] ?? reps?.match(/emom\s*(\d+)\s*reps?/i)?.[1];
    return { durationMin: parseInt(durMatch[1], 10), repsPerMin: repsVal ? parseInt(repsVal, 10) : null };
  }

  // Type EMOM explicite (sélecteur builder) : durée = champ Séries (nb de minutes),
  // reps/min = champ Reps — y compris alterné « 3/4 » (paires/impaires).
  const repsFromSeries = series?.match(/emom\s*(\d+)/i)?.[1];
  const repsAlt = reps?.match(/^\s*(\d+)\s*\/\s*\d+\s*$/)?.[1];
  const repsFromReps = reps?.match(/^(\d+)$/)?.[1] ?? repsAlt ?? reps?.match(/emom\s*(\d+)\s*reps?/i)?.[1];
  const repsPerMin = repsFromSeries
    ? parseInt(repsFromSeries, 10)
    : repsFromReps
      ? parseInt(repsFromReps, 10)
      : null;
  const durFromSeries = series?.match(/^\s*(\d+)\s*(?:'|min|m)?\s*$/i)?.[1];
  return { durationMin: durFromSeries ? parseInt(durFromSeries, 10) : 10, repsPerMin };
}

/* ───────── Types : steps ───────── */

type Brief = {
  kind: "brief";
  blockIdx: number;
  blockLetter?: string;
  isSuperset: boolean;
  blockType?: string | null;
  exercises: ProgExercise[]; // 1 (standard) ou plusieurs (superset)
};

type WorkSet = {
  kind: "set";
  blockIdx: number;
  exercise: ProgExercise;
  exerciseIdxInBlock: number; // 0 ou 1 (pour superset B1/B2)
  setNumber: number;
  totalSets: number;
  /** Si true → on prend le repos après ce set (fin de tour superset, ou set standard non-final) */
  restAfter: boolean;
  restSeconds: number;
  isLastSetOfExercise: boolean;
  /** Aperçu de la prochaine étape pendant le repos */
  nextPreview?: { name: string; setNumber: number; totalSets: number } | null;
};

type EmomBlock = {
  kind: "emom";
  blockIdx: number;
  blockLetter?: string;
  exercise: ProgExercise;
  durationMin: number;
  repsPerMin: number | null;
  repsLabel: string | null;   // reps affichées telles quelles (ex. "3/4")
  alternating: boolean;       // reps alternées paires/impaires
};

type CircuitBlock = {
  kind: "circuit";
  blockIdx: number;
  blockLetter?: string;
  exercises: ProgExercise[];
  defaultTotalMin: number;   // total time suggestion (multiple of 5)
  workSecPerStation: number; // 60s default
  restSecBetween: number;    // from recup or 0
};

type Step = Brief | WorkSet | EmomBlock | CircuitBlock;

function buildSteps(exercises: ProgExercise[]): Step[] {
  const blocks = groupBlocks(exercises || []);
  const steps: Step[] = [];

  blocks.forEach((b, blockIdx) => {
    const blockType = b.exercises[0]?.block_type ?? null;
    const isSuperset = b.isSuperset;
    const colorOfBlock = asColor(b.exercises[0]?.color);
    const restSec = parseRecupSeconds(b.exercises[0]?.recup, defaultRestFor(colorOfBlock));

    // EMOM blocks get a dedicated timer step — no brief, no sets
    if (blockType === "emom" && !isSuperset) {
      const ex = b.exercises[0];
      const { durationMin, repsPerMin } = parseEmom(ex.series != null ? String(ex.series) : null, ex.reps != null ? String(ex.reps) : null);
      const repsRaw = ex.reps != null ? String(ex.reps).trim() : "";
      const altMatch = repsRaw.match(/^(\d+)\s*\/\s*(\d+)$/);
      const repsLabel = altMatch ? `${altMatch[1]}/${altMatch[2]}` : (repsPerMin != null ? String(repsPerMin) : null);
      steps.push({ kind: "emom", blockIdx, blockLetter: b.letter, exercise: ex, durationMin, repsPerMin, repsLabel, alternating: !!altMatch });
      return;
    }

    // Circuit blocks get a dedicated multi-station timer — no brief, no sets
    if (blockType === "circuit" && !isSuperset) {
      steps.push({
        kind: "circuit",
        blockIdx,
        blockLetter: b.letter,
        exercises: b.exercises,
        defaultTotalMin: 20,
        workSecPerStation: 60,
        restSecBetween: restSec > 0 ? restSec : 0,
      });
      return;
    }

    // Ladder blocks: generate one WorkSet per minute with the exact rep count for that minute.
    // Supports two notations Léo uses:
    //   A) series="3"          reps="2,3,4"        → pattern from reps, rounds=series
    //   B) series="Ladder 2/3/4"  reps="27 en tout" → pattern from series, rounds inferred (27/(2+3+4)=3)
    if (blockType === "ladder" && !isSuperset) {
      const ex = b.exercises[0];
      // 1. Try to find the pattern (comma/slash-separated numbers)
      let pattern = parseLadderPattern(ex.reps);
      if (pattern.length === 0) {
        // Also check series field: "Ladder 2/3/4" → strip prefix → "2/3/4"
        const seriesStr = ex.series != null ? String(ex.series).replace(/^ladder\s*/i, "").trim() : "";
        if (/\d+\s*[,;\/]\s*\d+/.test(seriesStr)) {
          pattern = seriesStr.split(/[,;\/]/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
        }
      }
      if (pattern.length > 0) {
        // 2. Infer rounds: if reps starts with a total number (e.g. "27 en tout"), divide by pattern sum
        const patternSum = pattern.reduce((a, c) => a + c, 0);
        const totalMatch = ex.reps != null ? String(ex.reps).match(/^(\d+)/) : null;
        const totalReps = totalMatch ? parseInt(totalMatch[1], 10) : null;
        const rounds =
          totalReps && patternSum > 0 && totalReps % patternSum === 0
            ? totalReps / patternSum
            : Math.max(1, parseSeriesCount(ex.series));
        const totalSets = rounds * pattern.length;
        const exRest = parseRecupSeconds(ex.recup, 0);
        steps.push({ kind: "brief", blockIdx, blockLetter: b.letter, isSuperset: false, blockType: "ladder", exercises: [ex] });
        for (let r = 0; r < rounds; r++) {
          pattern.forEach((repCount, i) => {
            const globalIdx = r * pattern.length + i;
            const isLast = globalIdx === totalSets - 1;
            steps.push({
              kind: "set",
              blockIdx,
              exercise: { ...ex, reps: String(repCount) },
              exerciseIdxInBlock: 0,
              setNumber: globalIdx + 1,
              totalSets,
              restAfter: !isLast && exRest > 0,
              restSeconds: exRest,
              isLastSetOfExercise: isLast,
              nextPreview: !isLast ? { name: ex.name, setNumber: globalIdx + 2, totalSets } : null,
            });
          });
        }
        return;
      }
      // No valid pattern → fall through to regular set handling
    }

    steps.push({
      kind: "brief",
      blockIdx,
      blockLetter: b.letter,
      isSuperset,
      blockType,
      exercises: b.exercises,
    });

    if (isSuperset) {
      const rounds = Math.max(...b.exercises.map((e) => parseSeriesCount(e.series)));
      for (let r = 0; r < rounds; r++) {
        b.exercises.forEach((ex, exIdx) => {
          const total = parseSeriesCount(ex.series);
          if (r >= total) return;
          const lastExoOfRound = exIdx === b.exercises.length - 1;
          const lastRound = r === rounds - 1;
          const isLastSetOfExo = r === total - 1;
          steps.push({
            kind: "set",
            blockIdx,
            exercise: ex,
            exerciseIdxInBlock: exIdx,
            setNumber: r + 1,
            totalSets: total,
            restAfter: lastExoOfRound && !lastRound,
            restSeconds: restSec,
            isLastSetOfExercise: isLastSetOfExo && lastExoOfRound,
            nextPreview: !lastRound
              ? {
                  name: b.exercises[0].name,
                  setNumber: r + 2,
                  totalSets: parseSeriesCount(b.exercises[0].series),
                }
              : null,
          });
        });
      }
    } else {
      const ex = b.exercises[0];
      const total = parseSeriesCount(ex.series);
      const exRest = parseRecupSeconds(ex.recup, defaultRestFor(asColor(ex.color)));
      for (let r = 0; r < total; r++) {
        const isLast = r === total - 1;
        steps.push({
          kind: "set",
          blockIdx,
          exercise: ex,
          exerciseIdxInBlock: 0,
          setNumber: r + 1,
          totalSets: total,
          restAfter: !isLast,
          restSeconds: exRest,
          isLastSetOfExercise: isLast,
          nextPreview: !isLast ? { name: ex.name, setNumber: r + 2, totalSets: total } : null,
        });
      }
    }
  });

  return steps;
}

/* ───────── Session persistence helpers ───────── */

const STORAGE_KEY = (id: string) => `cst_session_${id}`;

type SessionSnapshot = {
  sessionId: string;
  stepIdx: number;
  phase: "intro" | "step" | "rest" | "recap";
  savedByStep: Record<number, { weight: number | null; reps: number | null; rpe: number | null; exo: string }>;
  startedAt: number;
  updatedAt: number;
};

function loadSnapshot(sessionId: string): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sessionId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as SessionSnapshot;
    if (snap.sessionId !== sessionId) return null;
    return snap;
  } catch {
    return null;
  }
}

function saveSnapshot(snap: SessionSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY(snap.sessionId), JSON.stringify(snap));
  } catch {
    /* storage quota exceeded — ignore */
  }
}

function clearSnapshot(sessionId: string) {
  try {
    localStorage.removeItem(STORAGE_KEY(sessionId));
  } catch { /* ignore */ }
}

/* ───────── Main component ───────── */

type Props = {
  sessionId: string;
  userId: string;
  sessionLabel?: string | null;
  exercises: ProgExercise[];
  onFinish: () => void | Promise<void>;
  onReset: () => Promise<void>;
  finishing?: boolean;
  initialMode?: "expert" | "debutant";
  quitRef?: React.MutableRefObject<(() => void) | null>;
};

export function LiveSession({ sessionId, userId, sessionLabel, exercises, onFinish, onReset, finishing, initialMode, quitRef }: Props) {
  const steps = useMemo(() => buildSteps(exercises), [exercises]);
  const totalWorkSets = useMemo(() => steps.filter((s) => s.kind === "set" || s.kind === "emom" || s.kind === "circuit").length, [steps]);
  const exerciseNames = useMemo(
    () => Array.from(new Set(exercises.map((exercise) => exercise.name).filter(Boolean))),
    [exercises],
  );

  // Restore from localStorage on first render
  const snap = useMemo(() => loadSnapshot(sessionId), [sessionId]);

  const [phase, setPhase] = useState<"intro" | "step" | "rest" | "recap">(snap?.phase ?? "intro");
  const [sessionMode] = useState<"expert" | "debutant">(initialMode ?? "debutant");
  const [expertRecapRpeByExercise, setExpertRecapRpeByExercise] = useState<Record<string, number | null>>({});
  const [expertRecapPickerFor, setExpertRecapPickerFor] = useState<string | null>(null);
  const [expertOverviewPickerFor, setExpertOverviewPickerFor] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(snap?.stepIdx ?? 0);
  const [logging, setLogging] = useState<null | {
    weight: string;
    reps: string;
    rpe: number | null;
  }>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showThread, setShowThread] = useState<string | null>(null);
  const [painFor, setPainFor] = useState<string | null>(null);
  const [showColor, setShowColor] = useState<ExerciseColor>(null);
  const [showTempo, setShowTempo] = useState<{ tempo?: string | null; name?: string } | null>(null);
  const [showRpeRef, setShowRpeRef] = useState(false);
  const [showVideo, setShowVideo] = useState<ProgExercise | null>(null);
  const [showCues, setShowCues] = useState<ProgExercise | null>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResumeNotice, setShowResumeNotice] = useState(!!snap && Object.keys(snap.savedByStep).length > 0);
  /** For timed exercises: tracks whether the countdown has been completed */
  const [timedDone, setTimedDone] = useState(false);

  /** Saisies par stepIdx — conservées si on revient en arrière, écrasées si on re-valide. */
  const [savedByStep, setSavedByStep] = useState<
    Record<number, ExpertSavedStep>
  >(snap?.savedByStep ?? {});

  /** Historique de la dernière séance pour le même exercice. */
  const [lastByExo, setLastByExo] = useState<LastByExo>({});

  const startedAtRef = useRef<number>(snap?.startedAt ?? Date.now());

  // Charger l'historique pour pré-remplissage intelligent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || !exercises?.length) return;
      const names = Array.from(new Set(exercises.map((e) => e.name).filter(Boolean)));
      if (!names.length) return;
      try {
        // Récupère les set_logs récents pour ce membre via jointure sessions
        const { data: rec } = await supabase
          .from("set_logs")
          .select("exercise_name, set_number, weight_kg, reps, rpe, logged_at, sessions!inner(member_id, status)")
          .eq("sessions.member_id", userId)
          .in("exercise_name", names)
          .order("logged_at", { ascending: false })
          .limit(400);
        if (cancelled || !rec) return;
        const map: LastByExo = {};
        // Pour chaque exercice, ne garder QUE la séance la plus récente (le 1er logged_at rencontré définit la date)
        for (const row of rec as Array<{
          exercise_name: string | null;
          set_number: number | null;
          weight_kg: number | null;
          reps: number | null;
          rpe: number | null;
          logged_at: string | null;
        }>) {
          const name = row.exercise_name;
          if (!name) continue;
          if (!map[name]) {
            map[name] = { _loggedAt: row.logged_at, _sets: [] } as unknown as LastByExo[string];
          }
          const entry = map[name];
          // Ne conserver que les logs de la séance la plus récente (même date à 1 min près)
          const refDate = entry._loggedAt ? new Date(entry._loggedAt).getTime() : 0;
          const rowDate = row.logged_at ? new Date(row.logged_at).getTime() : 0;
          if (Math.abs(refDate - rowDate) > 1000 * 60 * 60 * 6) continue; // > 6h d'écart = autre séance
          const setN = row.set_number ?? 0;
          const lastSet: LastSet = {
            weight: row.weight_kg != null ? Number(row.weight_kg) : null,
            reps: row.reps,
            rpe: row.rpe,
            loggedAt: row.logged_at,
          };
          (entry as Record<string, LastSet | string | null | undefined | LastSet[]>)[String(setN)] = lastSet;
          (entry._sets as LastSet[]).push(lastSet);
        }
        // Trier _sets par numéro de série croissant n'est pas fiable sans set_number, on garde l'ordre d'insertion inverse
        Object.values(map).forEach((e) => {
          if (e._sets) e._sets.reverse();
        });
        setLastByExo(map);
      } catch (e) {
        console.warn("Pré-remplissage historique indisponible", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, exercises]);

  // Persist progress to localStorage after every meaningful state change
  useEffect(() => {
    if (phase === "intro" && Object.keys(savedByStep).length === 0) return;
    if (phase === "recap") return; // recap = finished, will be cleared by onFinish
    saveSnapshot({
      sessionId,
      stepIdx,
      phase,
      savedByStep,
      startedAt: startedAtRef.current,
      updatedAt: Date.now(),
    });
  }, [sessionId, stepIdx, phase, savedByStep]);

  // Expose quit trigger to parent (outer "← QUITTER" button)
  useEffect(() => {
    if (quitRef) quitRef.current = () => setShowQuitConfirm(true);
    return () => { if (quitRef) quitRef.current = null; };
  }, [quitRef]);

  const current = steps[stepIdx];
  const completedWorkSets = useMemo(() => Object.keys(savedByStep).length, [savedByStep]);
  const progressSteps = useMemo<SessionProgressStep[]>(
    () =>
      steps.flatMap((step, index) => {
        if (step.kind === "set") {
          return [{ index, exerciseName: step.exercise.name, kind: "set" }];
        }
        if (step.kind === "emom") {
          return [{ index, exerciseName: step.exercise.name, kind: "emom" }];
        }
        if (step.kind === "circuit") {
          return step.exercises.map((exercise) => ({
            index,
            exerciseName: exercise.name,
            kind: "circuit" as const,
          }));
        }
        return [];
      }),
    [steps],
  );
  const overviewRows = useMemo(
    () => buildExerciseOverview(exerciseNames, progressSteps, savedByStep, stepIdx),
    [exerciseNames, progressSteps, savedByStep, stepIdx],
  );
  const expertRecapGroups = useMemo(() => groupExpertRecapByExercise(savedByStep), [savedByStep]);

  function goNext() {
    setLogging(null);
    setValidationError(null);
    setTimedDone(false);
    if (stepIdx >= steps.length - 1) {
      setPhase("recap");
      return;
    }
    setStepIdx((i) => i + 1);
    setPhase("step");
  }

  function goPrev() {
    setLogging(null);
    setValidationError(null);
    if (phase === "rest") {
      setPhase("step");
      return;
    }
    if (phase === "recap") {
      setStepIdx(Math.max(0, steps.length - 1));
      setPhase("step");
      return;
    }
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
      setPhase("step");
    } else {
      // Premier step : retour intro OU confirmation de quitter selon données saisies
      if (Object.keys(savedByStep).length > 0) {
        setShowQuitConfirm(true);
      } else {
        setPhase("intro");
      }
    }
  }

  function goPrevBlock() {
    setLogging(null);
    setValidationError(null);
    if (!current) return;
    const currentBlockIdx = current.blockIdx;
    // Trouver le step "brief" du bloc précédent
    for (let i = stepIdx - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.kind === "brief" && s.blockIdx < currentBlockIdx) {
        setStepIdx(i);
        setPhase("step");
        return;
      }
    }
    // Sinon, revenir au tout début
    setStepIdx(0);
    setPhase(steps.length ? "step" : "intro");
  }

  // H2 : passer à l'exercice suivant (machine prise) — on pourra y revenir via le navigateur
  function goNextBlock() {
    setLogging(null);
    setValidationError(null);
    setTimedDone(false);
    if (!current) return;
    const currentBlockIdx = current.blockIdx;
    for (let i = stepIdx + 1; i < steps.length; i++) {
      if (steps[i].blockIdx > currentBlockIdx) {
        setStepIdx(i);
        setPhase("step");
        return;
      }
    }
    setPhase("recap");
  }

  function handleHeaderBack() {
    if (phase === "intro") {
      if (Object.keys(savedByStep).length > 0) setShowQuitConfirm(true);
      else navigateToMember();
      return;
    }
    goPrev();
  }

  function navigateToMember() {
    // navigation gérée par parent via "QUITTER" header → on appelle window.history pour rester découplé
    if (typeof window !== "undefined") window.location.href = "/membre";
  }

  async function saveSetAndAdvance(step: WorkSet, l: { weight: string; reps: string; rpe: number | null }) {
    const bodyweight = isBodyweight(step.exercise.charge);
    const durationMode = isDurationReps(step.exercise.reps);

    // Validation contextuelle
    if (l.rpe == null) {
      setValidationError("Choisis ton RPE perçu pour valider la série.");
      return;
    }
    const hasReps = l.reps && l.reps.trim() !== "";
    if (!hasReps) {
      setValidationError(
        durationMode
          ? "Indique au moins la durée (en secondes) pour valider cette série."
          : "Indique au moins le nombre de reps pour valider cette série.",
      );
      return;
    }
    if (!bodyweight && !l.weight) {
      // Poids non obligatoire si non renseigné dans le programme (ex: à vide).
      // On laisse passer si l'exo n'a aucune charge prévue.
      if (step.exercise.charge && !isBodyweight(step.exercise.charge)) {
        // Charge prévue mais champ vide → on laisse quand même passer pour ne pas bloquer (seul le RPE + reps sont durs)
      }
    }

    setValidationError(null);
    const w = parseFloat(l.weight.replace(",", "."));
    const r = parseInt(l.reps, 10);
    const weight_kg = bodyweight ? null : isNaN(w) ? null : w;
    const reps = isNaN(r) ? null : r;

    try {
      await supabase.from("set_logs").insert({
        session_id: sessionId,
        exercise_name: step.exercise.name,
        set_number: step.setNumber,
        weight_kg,
        reps,
        rpe: l.rpe,
        completed: true,
      });
    } catch (e) {
      console.error("set_logs insert failed", e);
    }
    setSavedByStep((m) => ({
      ...m,
      [stepIdx]: { exo: step.exercise.name, weight: weight_kg, reps, rpe: l.rpe },
    }));
    if (step.restAfter) {
      setPhase("rest");
      setLogging(null);
    } else {
      goNext();
    }
  }

  async function advanceExpertSet(step: WorkSet, rpe: number | null) {
    const defaults = computeDefaults(step);
    const parsedWeight = defaults.weight ? parseFloat(defaults.weight.replace(",", ".")) : NaN;
    const repTarget = parseRepsPerSet(step.exercise.reps, step.totalSets)[step.setNumber - 1]
      || (step.exercise.reps ? String(step.exercise.reps) : "");
    const parsedTargetReps = isDurationReps(repTarget)
      ? parseDurationSeconds(repTarget)
      : extractNumeric(repTarget);
    setSavedByStep((m) => ({
      ...m,
      [stepIdx]: {
        exo: step.exercise.name,
        weight: Number.isFinite(parsedWeight) ? parsedWeight : null,
        reps: parsedTargetReps != null ? Math.round(parsedTargetReps) : null,
        rpe,
      },
    }));
    if (step.restAfter) {
      setPhase("rest");
    } else {
      goNext();
    }
  }

  async function finishExpertRecap() {
    const missingExercise = expertRecapGroups.find((group) => expertRecapRpeByExercise[group.exerciseName] == null);
    if (missingExercise) {
      setValidationError(`Renseigne le RPE final de ${missingExercise.exerciseName}.`);
      return;
    }

    setValidationError(null);

    const rows = expertRecapGroups.flatMap((group) =>
      group.rows.map((row) => ({
        session_id: sessionId,
        exercise_name: group.exerciseName,
        set_number: row.setNumber,
        weight_kg: row.weight,
        reps: row.reps,
        rpe: expertRecapRpeByExercise[group.exerciseName],
        completed: true,
      })),
    );

    const { error: deleteError } = await supabase.from("set_logs").delete().eq("session_id", sessionId);
    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("set_logs").insert(rows);
      if (insertError) throw insertError;
    }

    await onFinish();
    clearSnapshot(sessionId);
  }

  /** Calcule les valeurs pré-remplies pour un set donné. */
  function computeDefaults(step: WorkSet): { weight: string; reps: string; rpe: number | null } {
    const bodyweight = isBodyweight(step.exercise.charge);

    // POIDS : 1) historique 2) série précédente même exo dans CETTE séance 3) charge programme 4) vide
    let weight = "";
    if (!bodyweight) {
      const exoHist = lastByExo[step.exercise.name];
      const histSet = exoHist?.[step.setNumber] as LastSet | undefined;
      if (histSet?.weight != null) {
        weight = String(histSet.weight);
      } else {
        // Série précédente dans la séance en cours
        for (let i = stepIdx - 1; i >= 0; i--) {
          const s = steps[i];
          if (s.kind === "set" && s.exercise.name === step.exercise.name) {
            const prev = savedByStep[i];
            if (prev?.weight != null) {
              weight = String(prev.weight);
              break;
            }
          }
        }
        if (!weight && step.exercise.charge) {
          const n = extractNumeric(step.exercise.charge);
          if (n != null) weight = String(n);
        }
      }
    }

    // REPS : on laisse vide, la cible est en placeholder (cf. parseRepsPerSet)
    const reps = "";

    return { weight, reps, rpe: null };
  }

  /* ───────── Header (avec bouton retour permanent) ───────── */

  // Saut direct vers un exercice depuis l'aperçu (ex. machine prise → faire un autre exo).
  // On ne réordonne PAS les étapes (les saisies restent indexées par étape) : on navigue seulement.
  function jumpToExercise(name: string) {
    const idx = steps.findIndex((s) =>
      s.kind === "set" || s.kind === "emom"
        ? s.exercise.name === name
        : s.kind === "brief" || s.kind === "circuit"
          ? s.exercises.some((e) => e.name === name)
          : false,
    );
    setShowOverview(false);
    if (idx < 0) return;
    if (phase === "intro") startedAtRef.current = Date.now();
    setStepIdx(idx);
    setPhase("step");
  }

  function renderHeader() {
    const pct = totalWorkSets ? (completedWorkSets / totalWorkSets) * 100 : 0;
    const doneExercises = overviewRows.filter((row) => row.state === "done").length;
    const remainingExercises = Math.max(0, overviewRows.length - doneExercises);
    return (
      <div style={{ padding: "16px 18px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        {showResumeNotice && (
          <div style={{ padding: "8px 12px", background: "rgba(45,90,53,0.22)", border: "1px solid rgba(45,90,53,0.55)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className="cst-mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em" }}>
              ⏸ SÉANCE REPRISE · {completedWorkSets} série{completedWorkSets > 1 ? "s" : ""} conservée{completedWorkSets > 1 ? "s" : ""}
            </span>
            <button onClick={() => setShowResumeNotice(false)} style={{ background: "none", border: 0, color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>×</button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleHeaderBack}
            aria-label="Retour"
            className="cst-mono"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.85)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 13,
              cursor: "pointer",
              minWidth: 44,
              minHeight: 32,
            }}
          >
            ←
          </button>
          <span
            className="cst-mono"
            style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.22em", flex: 1, textAlign: "center" }}
          >
            — {sessionLabel?.toUpperCase() || "SÉANCE"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              {completedWorkSets}/{totalWorkSets}
            </span>
            {overviewRows.length > 0 && (
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
                {doneExercises} faits · {remainingExercises} restants
              </span>
            )}
            <button
              onClick={() => setShowOverview(true)}
              aria-label={sessionMode === "expert" ? "Voir le résumé de séance" : "Voir toute la séance"}
              title={sessionMode === "expert" ? "Voir le résumé de séance" : "Voir toute la séance"}
              className="cst-mono"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.85)",
                borderRadius: 6,
                padding: sessionMode === "expert" ? "6px 12px" : "6px 10px",
                fontSize: sessionMode === "expert" ? 11 : 13,
                cursor: "pointer",
                minWidth: 44,
                minHeight: 32,
                letterSpacing: sessionMode === "expert" ? "0.12em" : undefined,
              }}
            >
              {sessionMode === "expert" ? "RÉSUMÉ" : "☰"}
            </button>
          </div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--cst-mid-green), #6EAB76)",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>
    );
  }

  /* ───────── Overlays (helper fonction, PAS un composant — évite remount) ───────── */

  function renderOverlays(blockColor?: ExerciseColor) {
    return (
      <>
        <ColorTooltip color={showColor ?? blockColor ?? null} open={!!showColor} onClose={() => setShowColor(null)} />
        <TempoExplainer
          open={!!showTempo}
          onClose={() => setShowTempo(null)}
          tempo={showTempo?.tempo}
          name={showTempo?.name}
        />
        <RPEReferenceSheet open={showRpeRef} onClose={() => setShowRpeRef(false)} />
        <VideoModal exercise={showVideo} onClose={() => setShowVideo(null)} />
        <CuesModal
          exercise={showCues}
          onClose={() => setShowCues(null)}
          onOpenTempo={(ex) => {
            setShowCues(null);
            setShowTempo({ tempo: ex.tempo, name: ex.name });
          }}
          onOpenColor={(c) => {
            setShowCues(null);
            setShowColor(c);
          }}
          onOpenRpeRef={() => {
            setShowCues(null);
            setShowRpeRef(true);
          }}
        />
        {showOverview && (
          <div
            onClick={() => setShowOverview(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
              zIndex: 250,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="cst-hatch"
              style={{
                width: "100%",
                maxWidth: 460,
                maxHeight: "85vh",
                overflowY: "auto",
                background: "#1c2620",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="cst-display" style={{ margin: 0, fontSize: 20 }}>
                  {sessionMode === "expert" ? "RÉSUMÉ DE SÉANCE" : "PROGRAMME COMPLET"}
                </h3>
                <button
                  onClick={() => setShowOverview(false)}
                  style={{ background: "none", border: 0, color: "#fff", fontSize: 18, cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
              <p className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.14em", margin: "0 0 10px" }}>
                {sessionMode === "expert"
                  ? "Touchez un exercice pour y aller directement. ✓ = fait, … = en cours, □ = pas encore fait. Les exos déjà effectués peuvent recevoir leur RPE ici."
                  : "Touche « ALLER → » pour faire un exercice tout de suite (ex. machine déjà prise)."}
              </p>
              {overviewRows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {overviewRows.map((row) => {
                    const tone = row.state === "done" ? "#6EAB76" : row.state === "current" ? "#D4A53B" : "rgba(255,255,255,0.45)";
                    const label = row.state === "done" ? "FAIT" : row.state === "current" ? "EN COURS" : "À FAIRE";
                    const statusIcon = row.state === "done" ? "✓" : row.state === "current" ? "…" : "□";
                    const isClickable = sessionMode === "expert";
                    const canAssignRpe = sessionMode === "expert" && row.completedSteps > 0;
                    return (
                      <div
                        key={row.exerciseName}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <span className="cst-mono" style={{ fontSize: 18, color: tone, width: 16, textAlign: "center" }}>
                            {statusIcon}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isClickable) return;
                                jumpToExercise(row.exerciseName);
                              }}
                              style={{
                                appearance: "none",
                                background: "transparent",
                                border: 0,
                                padding: 0,
                                margin: 0,
                                cursor: isClickable ? "pointer" : "default",
                                textAlign: "left",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {row.exerciseName}
                            </button>
                            <div className="cst-mono" style={{ fontSize: 10, color: tone, letterSpacing: "0.14em", marginTop: 2 }}>
                              {label} · {row.completedSteps}/{row.totalSteps || 1}
                            </div>
                          </div>
                        </div>
                        {canAssignRpe && (
                          <ExpertOverviewRpeBadge
                            value={expertRecapRpeByExercise[row.exerciseName] ?? null}
                            open={expertOverviewPickerFor === row.exerciseName}
                            onToggle={() =>
                              setExpertOverviewPickerFor((current) => (current === row.exerciseName ? null : row.exerciseName))
                            }
                            onChange={(value) => {
                              setExpertRecapRpeByExercise((currentMap) => ({
                                ...currentMap,
                                [row.exerciseName]: value,
                              }));
                              setExpertOverviewPickerFor(null);
                            }}
                            onClear={() => {
                              setExpertRecapRpeByExercise((currentMap) => ({
                                ...currentMap,
                                [row.exerciseName]: null,
                              }));
                              setExpertOverviewPickerFor(null);
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {sessionMode !== "expert" && (
                <ProgramBlocks exercises={exercises} onExerciseClick={(ex) => jumpToExercise(ex.name)} />
              )}
            </div>
          </div>
        )}
        {showThread && (
          <div
            onClick={() => setShowThread(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
              zIndex: 260,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="cst-hatch"
              style={{
                width: "100%",
                maxWidth: 460,
                maxHeight: "85vh",
                overflowY: "auto",
                background: "#1c2620",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="cst-display" style={{ margin: 0, fontSize: 18 }}>
                  {showThread.toUpperCase()}
                </h3>
                <button
                  onClick={() => setShowThread(null)}
                  style={{ background: "none", border: 0, color: "#fff", fontSize: 18, cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
              <ExerciseThread sessionId={sessionId} exerciseName={showThread} userId={userId} viewerRole="member" />
            </div>
          </div>
        )}
        <PainReportDialog
          open={!!painFor}
          onClose={() => setPainFor(null)}
          sessionId={sessionId}
          exerciseName={painFor || ""}
        />
        {showQuitConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(4px)",
              zIndex: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              className="cst-hatch"
              style={{
                width: "100%",
                maxWidth: 380,
                background: "#1c2620",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 className="cst-display" style={{ margin: 0, fontSize: 20, color: "#fff" }}>
                POURQUOI TU SORS ?
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Option 1 — Continuer */}
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  className="cst-btn cst-btn-primary"
                  style={{ width: "100%", padding: "14px 0", fontSize: 13 }}
                >
                  ← CONTINUER LA SÉANCE
                </button>
                {/* Option 2 — Séance terminée */}
                <button
                  onClick={async () => {
                    setShowQuitConfirm(false);
                    await onFinish();
                  }}
                  className="cst-btn"
                  style={{ width: "100%", padding: "13px 0", fontSize: 13, background: "rgba(45,190,120,0.18)", border: "1px solid rgba(45,190,120,0.45)", color: "#2DBE9A" }}
                >
                  ✓ SÉANCE TERMINÉE
                </button>
                {/* Option 3 — Erreur / consulter */}
                <button
                  onClick={async () => {
                    setResetting(true);
                    try {
                      clearSnapshot(sessionId);
                      await onReset();
                    } finally {
                      setResetting(false);
                    }
                  }}
                  disabled={resetting}
                  className="cst-btn cst-btn-ghost-dark"
                  style={{ width: "100%", padding: "12px 0", fontSize: 12, opacity: resetting ? 0.5 : 1 }}
                >
                  {resetting ? "RÉINITIALISATION…" : "ERREUR / JE CONSULTE LE PROGRAMME"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>
                "Erreur / Je consulte" remet la séance à zéro — aucune donnée conservée.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  const shellStyle: React.CSSProperties = { display: "flex", flexDirection: "column", minHeight: 720, flex: 1 };

  /* ───────── INTRO ───────── */

  if (phase === "intro") {
    const blocks = groupBlocks(exercises || []);
    const estMin = Math.max(20, Math.round(totalWorkSets * 2.2));
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          <div>
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.2em" }}>
              ★ PRÊT
            </span>
            <h1 className="cst-display" style={{ fontSize: 34, margin: "6px 0 0", lineHeight: 1 }}>
              {(sessionLabel || "Séance").toUpperCase()}
            </h1>
            <div className="cst-italic" style={{ opacity: 0.65, marginTop: 6 }}>
              {blocks.length} blocs · {totalWorkSets} séries · ~{estMin} min
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.2em" }}>
              CODE COULEUR (clique pour détails)
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["red", "green", "yellow", "lime", "blue"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setShowColor(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    background: `${colorHex(c)}14`,
                    border: `1px solid ${colorHex(c)}55`,
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  className="cst-mono"
                >
                  <ColorDot color={c} size={10} />
                  {c === "red" && "Force"}
                  {c === "green" && "Isolation"}
                  {c === "yellow" && "Explosif"}
                  {c === "lime" && "Mobilité"}
                  {c === "blue" && "Prévention"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              startedAtRef.current = Date.now();
              setPhase(steps.length ? "step" : "recap");
            }}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14 }}
          >
            COMMENCER LA SÉANCE →
          </button>
          <button
            onClick={() => setShowOverview(true)}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ width: "100%" }}
          >
            VOIR TOUT LE PROGRAMME
          </button>
        </div>
        {renderOverlays()}
      </div>
    );
  }

  /* ───────── RECAP ───────── */

  if (phase === "recap") {
    const savedList = Object.values(savedByStep);
    const totalVol = savedList.reduce((s, l) => s + (l.weight && l.reps ? l.weight * l.reps : 0), 0);
    const rpes = savedList.map((l) => l.rpe).filter((v): v is number => v != null);
    const avgRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
    const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 18, flex: 1, overflowY: "auto" }}>
          <div>
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.2em" }}>
              ★ TERMINÉ
            </span>
            <h1 className="cst-display" style={{ fontSize: 32, margin: "6px 0 0" }}>
              BIEN JOUÉ.
            </h1>
            <div className="cst-italic" style={{ opacity: 0.65, marginTop: 6 }}>
              Tes données sont envoyées au coach.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <Stat label="VOLUME" value={`${Math.round(totalVol)}kg`} />
            <Stat label="RPE MOY" value={avgRpe != null ? String(avgRpe) : "—"} />
            <Stat label="DURÉE" value={`${dur}'`} />
          </div>
          <div
            className="cst-scroll"
            style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
          >
            {sessionMode === "expert" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>
                  EXERCICES RÉELLEMENT FAITS · RENSEIGNE LE RPE FINAL
                </div>
                {expertRecapGroups.length === 0 && (
                  <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7 }}>
                    Aucun exercice validé dans cette séance.
                  </div>
                )}
                {expertRecapGroups.map((group) => (
                  <ExpertRecapRpeBadge
                    key={group.exerciseName}
                    group={group}
                    value={expertRecapRpeByExercise[group.exerciseName] ?? null}
                    open={expertRecapPickerFor === group.exerciseName}
                    onToggle={() =>
                      setExpertRecapPickerFor((current) => (current === group.exerciseName ? null : group.exerciseName))
                    }
                    onChange={(value) => {
                      setExpertRecapRpeByExercise((currentMap) => ({
                        ...currentMap,
                        [group.exerciseName]: value,
                      }));
                      setExpertRecapPickerFor(null);
                    }}
                    onClear={() => {
                      setExpertRecapRpeByExercise((currentMap) => ({
                        ...currentMap,
                        [group.exerciseName]: null,
                      }));
                      setExpertRecapPickerFor(null);
                    }}
                  />
                ))}
              </div>
            ) : (
              savedList.map((l, i) => (
                <div
                  key={i}
                  className="cst-mono"
                  style={{
                    fontSize: 11,
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.18)",
                    borderRadius: 4,
                    opacity: 0.85,
                  }}
                >
                  {l.exo} — {l.weight ?? "—"}kg × {l.reps ?? "—"} @ RPE {l.rpe ?? "—"}
                </div>
              ))
            )}
          </div>
          {validationError && (
            <div style={{ fontSize: 12, color: "#ff8a7a" }}>{validationError}</div>
          )}

          {/* Session-level video share */}
          <SessionMediaUploader sessionId={sessionId} userId={userId} />

          <button
            onClick={async () => {
              try {
                if (sessionMode === "expert") {
                  await finishExpertRecap();
                } else {
                  await onFinish();
                  clearSnapshot(sessionId); // seulement si la fin a réussi
                }
              } catch {
                /* échec déjà signalé (toast) ; on garde le snapshot pour réessayer */
              }
            }}
            disabled={finishing}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14, opacity: finishing ? 0.6 : 1 }}
          >
            {finishing ? "ENREGISTREMENT…" : "TERMINER LA SÉANCE ✓"}
          </button>
        </div>
        {renderOverlays()}
      </div>
    );
  }

  /* ───────── REST ───────── */

  if (phase === "rest" && current?.kind === "set") {
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <RestScreen
          seconds={current.restSeconds}
          nextPreview={current.nextPreview ?? null}
          currentExercise={current.exercise}
          onDone={goNext}
          onVideo={() => setShowVideo(current.exercise)}
          onCues={() => setShowCues(current.exercise)}
        />
        {renderOverlays()}
      </div>
    );
  }

  /* ───────── STEP ───────── */

  if (!current) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: 22, opacity: 0.6 }}>Aucune étape.</div>
      </div>
    );
  }

  const canGoPrevBlock = current.blockIdx > 0;
  const canGoNextBlock = steps.some((s) => s.blockIdx > current.blockIdx);

  /* ───────── EMOM step ───────── */

  if (current.kind === "emom") {
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <EmomScreen
          key={`emom-${stepIdx}`}
          exercise={current.exercise}
          durationMin={current.durationMin}
          repsPerMin={current.repsPerMin}
          repsLabel={current.repsLabel}
          alternating={current.alternating}
          sessionId={sessionId}
          onFinish={(logs) => {
            // Persist EMOM result as a single "set_log" entry
            supabase.from("set_logs").insert({
              session_id: sessionId,
              exercise_name: current.exercise.name,
              set_number: 1,
              reps: logs.reduce((s, l) => s + l, 0),
              rpe: null,
              completed: true,
            }).then(() => {});
            setSavedByStep((m) => ({
              ...m,
              [stepIdx]: { exo: current.exercise.name, weight: null, reps: logs.reduce((s, l) => s + l, 0), rpe: null },
            }));
            goNext();
          }}
          onPain={() => setPainFor(current.exercise.name)}
        />
        {renderOverlays()}
      </div>
    );
  }

  /* ───────── Circuit step ───────── */

  if (current.kind === "circuit") {
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <CircuitScreen
          key={`circuit-${stepIdx}`}
          exercises={current.exercises}
          defaultTotalMin={current.defaultTotalMin}
          workSecPerStation={current.workSecPerStation}
          restSecBetween={current.restSecBetween}
          blockLetter={current.blockLetter}
          sessionId={sessionId}
          onFinish={() => {
            setSavedByStep((m) => ({
              ...m,
              [stepIdx]: { exo: current.exercises.map((e) => e.name).join("+"), weight: null, reps: null, rpe: null },
            }));
            goNext();
          }}
          onPain={() => setPainFor(current.exercises[0]?.name ?? "")}
        />
        {renderOverlays()}
      </div>
    );
  }

  if (current.kind === "brief") {
    const blockColor = asColor(current.exercises[0]?.color);
    const explain = blockExplain(current.blockType, current.isSuperset);
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <div
          className="cst-scroll"
          style={{
            padding: "0 22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flex: 1,
            overflowY: "auto",
          }}
        >
          <div>
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>
              ★ BLOC {current.blockLetter || ""}
              {current.isSuperset ? " · SUPERSET" : ""}
              {current.blockType && current.blockType !== "standard" && !current.isSuperset
                ? ` · ${current.blockType.toUpperCase()}`
                : ""}
            </span>
          </div>
          {explain && (
            <div
              style={{
                padding: "10px 12px",
                background: "rgba(45,90,53,0.12)",
                border: "1px solid rgba(45,90,53,0.35)",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {explain}
            </div>
          )}
          {current.exercises.map((ex, i) => {
            const color = asColor(ex.color);
            const bodyweight = isBodyweight(ex.charge);
            return (
              <div
                key={i}
                className="cst-card-dark cst-hatch"
                style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {color && <ColorDot color={color} size={14} onClick={() => setShowColor(color)} />}
                  {ex.code && (
                    <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
                      {ex.code}
                    </span>
                  )}
                  <h2 className="cst-display" style={{ margin: 0, fontSize: 20, flex: 1, color: "#fff" }}>
                    {ex.name.toUpperCase()}
                  </h2>
                  {bodyweight && (
                    <span
                      className="cst-mono"
                      style={{
                        fontSize: 9,
                        padding: "3px 6px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      PDC
                    </span>
                  )}
                  {ex.tempo && (
                    <TempoBadge tempo={ex.tempo} onClick={() => setShowTempo({ tempo: ex.tempo, name: ex.name })} />
                  )}
                </div>
                <div
                  className="cst-mono"
                  style={{
                    fontSize: 11,
                    opacity: 0.85,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))",
                    gap: "4px 10px",
                  }}
                >
                  <span>
                    <span style={{ opacity: 0.5 }}>SÉRIES </span>
                    {ex.series ?? "—"}
                  </span>
                  <span>
                    <span style={{ opacity: 0.5 }}>REPS </span>
                    {ex.reps != null ? (formatRepsObjectif(ex.reps) ?? String(ex.reps)) : "—"}
                  </span>
                  {ex.charge && !bodyweight && (
                    <span>
                      <span style={{ opacity: 0.5 }}>CHARGE </span>
                      {ex.charge}
                    </span>
                  )}
                  {ex.recup && (
                    <span>
                      <span style={{ opacity: 0.5 }}>RÉCUP </span>
                      {ex.recup}
                    </span>
                  )}
                  {ex.rpe_target && (
                    <span>
                      <span style={{ opacity: 0.5 }}>RPE </span>
                      {ex.rpe_target}
                    </span>
                  )}
                </div>
                {color && <RPEGuidance color={color} />}
                {ex.coach_notes && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.85,
                      fontStyle: "italic",
                      whiteSpace: "pre-wrap",
                      background: "rgba(45,90,53,0.10)",
                      borderLeft: "2px solid var(--cst-mid-green)",
                      padding: "6px 10px",
                      borderRadius: 3,
                    }}
                  >
                    « {ex.coach_notes} »
                  </div>
                )}
                <ExerciseMediaCard exercise={ex} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setShowThread(ex.name)} className="cst-btn cst-btn-ghost-dark cst-btn-sm">
                    💬 Échanger / Envoyer une vidéo
                  </button>
                  <button
                    onClick={() => setPainFor(ex.name)}
                    className="cst-btn cst-btn-sm"
                    style={{
                      background: "rgba(192,57,43,0.15)",
                      border: "1px solid rgba(192,57,43,0.5)",
                      color: "#ff8a7a",
                    }}
                  >
                    🔴 Signaler une douleur
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {canGoPrevBlock && (
              <button
                onClick={goPrevBlock}
                className="cst-btn cst-btn-ghost-dark"
                style={{ flex: "0 0 auto", padding: "16px 14px", fontSize: 12 }}
              >
                ← BLOC PRÉCÉDENT
              </button>
            )}
            <button
              onClick={goNext}
              className="cst-btn cst-btn-primary"
              style={{ flex: 1, padding: "16px 0", fontSize: 14 }}
            >
              JE COMMENCE →
            </button>
          </div>
        </div>
        {renderOverlays(blockColor)}
      </div>
    );
  }

  // current.kind === "set"  ── MODE EXPERT : écran simplifié sans saisie
  // Important: les blocs "brief", "emom" et "circuit" ont leur propre rendu.
  // Si on force le mode expert sur une étape non-"set", on caste à tort l'étape
  // en WorkSet et la navigation plante au passage entre deux exercices/blocs.
  if (sessionMode === "expert" && current.kind === "set") {
    const exStep = current as WorkSet;
    const exColor2 = asColor(exStep.exercise.color);
    const accent2 = colorHex(exColor2) || "var(--cst-mid-green)";
    const repPlaceholder2 = parseRepsPerSet(exStep.exercise.reps, exStep.totalSets)[exStep.setNumber - 1]
      || (exStep.exercise.reps ? String(exStep.exercise.reps) : "");
    return (
      <div style={shellStyle}>
        {renderHeader()}
        <div className="cst-scroll" style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
          {/* Mode badge */}
          <div className="cst-mono" style={{ fontSize: 9, opacity: 0.4, letterSpacing: "0.2em" }}>MODE EXPÉRIMENTÉ</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {exColor2 && <ColorDot color={exColor2} size={14} onClick={() => setShowColor(exColor2)} />}
            <h2 className="cst-display" style={{ margin: 0, fontSize: 22, flex: 1, color: "#fff" }}>
              {exStep.exercise.name.toUpperCase()}
            </h2>
            {exStep.exercise.tempo && (
              <TempoBadge
                tempo={exStep.exercise.tempo}
                onClick={() => setShowTempo({ tempo: exStep.exercise.tempo, name: exStep.exercise.name })}
              />
            )}
          </div>

          <div style={{ padding: "22px 16px", background: `${accent2}14`, border: `1px solid ${accent2}55`, borderRadius: 12, textAlign: "center" }}>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.22em" }}>SÉRIE</div>
            <div className="cst-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 4 }}>
              {exStep.setNumber}
              <span style={{ fontSize: 22, opacity: 0.5 }}> / {exStep.totalSets}</span>
            </div>
            {repPlaceholder2 && (
              <div className="cst-mono" style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>
                OBJECTIF {formatRepsObjectif(repPlaceholder2) ?? repPlaceholder2}
              </div>
            )}
            {exStep.exercise.charge && !isBodyweight(exStep.exercise.charge) && (
              <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                CHARGE : {exStep.exercise.charge}
              </div>
            )}
          </div>

          {exColor2 && <RPEGuidance color={exColor2} />}

          {exStep.exercise.coach_notes && (
            <div style={{ fontSize: 12, opacity: 0.85, fontStyle: "italic", whiteSpace: "pre-wrap", background: "rgba(45,90,53,0.10)", borderLeft: "2px solid var(--cst-mid-green)", padding: "6px 10px", borderRadius: 3 }}>
              « {exStep.exercise.coach_notes} »
            </div>
          )}

          <CuesActionBar
            exercise={exStep.exercise}
            onVideo={() => setShowVideo(exStep.exercise)}
            onCues={() => setShowCues(exStep.exercise)}
          />

          <ExerciseMediaCard exercise={exStep.exercise} />

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.18em" }}>
              RPE À RENSEIGNER À LA FIN DE LA SÉANCE
            </div>
            <button
              onClick={() => setShowRpeRef(true)}
              className="cst-mono"
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: 9, padding: "8px 10px", borderRadius: 6, cursor: "pointer", letterSpacing: "0.12em", alignSelf: "flex-start" }}
            >
              ? VOIR L'ÉCHELLE RPE
            </button>
          </div>

          <button
            onClick={() => advanceExpertSet(exStep, null)}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14 }}
          >
            VALIDER {exStep.restAfter ? "→ REPOS" : exStep.isLastSetOfExercise ? "→ EXO SUIVANT" : "→ SUIVANT"}
          </button>

          {canGoNextBlock && (
            <button onClick={goNextBlock} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ width: "100%", borderStyle: "dashed", opacity: 0.9 }}>
              ⤼ Passer cet exercice (j'y reviens via ☰)
            </button>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {canGoPrevBlock && (
              <button onClick={goPrevBlock} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>← BLOC PRÉCÉDENT</button>
            )}
            <button onClick={() => setShowThread(exStep.exercise.name)} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
              💬 Filmer / Échanger
            </button>
            <button onClick={() => setPainFor(exStep.exercise.name)} className="cst-btn cst-btn-sm" style={{ flex: 1, background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.5)", color: "#ff8a7a" }}>
              🔴 Douleur
            </button>
          </div>
        </div>
        {renderOverlays()}
      </div>
    );
  }

  const setStep = current;
  const exColor = asColor(setStep.exercise.color);
  const accent = colorHex(exColor) || "var(--cst-mid-green)";
  const bodyweight = isBodyweight(setStep.exercise.charge);
  const durationMode = isDurationReps(setStep.exercise.reps);
  const isTimed = durationMode || isTimedByName(setStep.exercise.name, setStep.exercise.tempo);
  const timedSecs = parseDurationSeconds(setStep.exercise.reps);
  const timedRounds = isTimed ? parseTimedRounds(setStep.exercise.reps, setStep.exercise.name) : 1;
  const timedSideLabel =
    isPerSide(setStep.exercise.reps) || isUnilateralByName(setStep.exercise.name)
      ? sideWord(setStep.exercise.reps, setStep.exercise.name)
      : "TOUR";

  // Cible reps par série (placeholder)
  const repTargets = parseRepsPerSet(setStep.exercise.reps, setStep.totalSets);
  const repPlaceholder =
    repTargets[setStep.setNumber - 1] || (setStep.exercise.reps ? String(setStep.exercise.reps) : "");

  const fb = logging?.rpe != null ? rpeFeedbackMessage(exColor, logging.rpe, setStep.isLastSetOfExercise) : null;

  // Référence : dernière fois
  const lastExo = lastByExo[setStep.exercise.name];
  const lastSetsArr = (lastExo?._sets as LastSet[] | undefined) || [];
  const lastDate = lastExo?._loggedAt as string | null | undefined;
  const lastRefText = lastSetsArr.length
    ? lastSetsArr
        .slice(0, 4)
        .map((s) => `${s.weight ?? "—"}kg × ${s.reps ?? "—"}`)
        .join(" · ")
    : null;

  function startLogging() {
    const defaults = computeDefaults(setStep);
    setLogging(defaults);
    setValidationError(null);
  }

  function commitWeight(v: string) {
    setLogging((cur) => (cur ? { ...cur, weight: v } : cur));
  }
  function commitReps(v: string) {
    setLogging((cur) => (cur ? { ...cur, reps: v } : cur));
  }

  return (
    <div style={shellStyle}>
      {renderHeader()}
      <div
        className="cst-scroll"
        style={{
          padding: "0 22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          flex: 1,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {exColor && <ColorDot color={exColor} size={14} onClick={() => setShowColor(exColor)} />}
          {setStep.exercise.code && (
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              {setStep.exercise.code}
            </span>
          )}
          <h2 className="cst-display" style={{ margin: 0, fontSize: 22, flex: 1, color: "#fff" }}>
            {setStep.exercise.name.toUpperCase()}
          </h2>
          {bodyweight && (
            <span
              className="cst-mono"
              style={{
                fontSize: 9,
                padding: "3px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.1em",
              }}
            >
              PDC
            </span>
          )}
          {setStep.exercise.tempo && (
            <TempoBadge
              tempo={setStep.exercise.tempo}
              onClick={() => setShowTempo({ tempo: setStep.exercise.tempo, name: setStep.exercise.name })}
            />
          )}
        </div>

        <div
          style={{
            padding: "22px 16px",
            background: `${accent}14`,
            border: `1px solid ${accent}55`,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.22em" }}>
            SÉRIE
          </div>
          <div className="cst-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 4 }}>
            {setStep.setNumber}
            <span style={{ fontSize: 22, opacity: 0.5 }}> / {setStep.totalSets}</span>
          </div>
          <div className="cst-mono" style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>
            {repPlaceholder && (
              <>OBJECTIF {formatRepsObjectif(repPlaceholder) ?? repPlaceholder}</>
            )}
            {setStep.exercise.rpe_target && <> @ RPE {setStep.exercise.rpe_target}</>}
          </div>
          {setStep.exercise.charge && !bodyweight && (
            <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              CHARGE : {setStep.exercise.charge}
            </div>
          )}
        </div>

        {lastRefText && (
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, padding: "4px 0", letterSpacing: "0.04em" }}>
            Dernière fois : {lastRefText} ({formatRelativeDays(lastDate)})
          </div>
        )}

        <CuesActionBar
          exercise={setStep.exercise}
          onVideo={() => setShowVideo(setStep.exercise)}
          onCues={() => setShowCues(setStep.exercise)}
        />

        <ExerciseMediaCard exercise={setStep.exercise} />

        {isTimed && timedSecs && !timedDone && (
          <TimedSetScreen
            key={`timed-${stepIdx}`}
            seconds={timedSecs}
            label={formatRepsObjectif(setStep.exercise.reps) ?? `${timedSecs}s`}
            rounds={timedRounds}
            sideLabel={timedSideLabel}
            onDone={() => {
              setTimedDone(true);
              // Pre-fill the reps field with actual duration for logging
              const defaults = computeDefaults(setStep);
              setLogging({ ...defaults, reps: String(timedSecs) });
            }}
          />
        )}

        {(!isTimed || !timedSecs || timedDone) && !logging && (
          <button
            onClick={startLogging}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14, marginTop: 4 }}
          >
            {isTimed ? "✓ CHRONO TERMINÉ — LOGGER LE RPE" : "✓ SÉRIE TERMINÉE — LOGGER"}
          </button>
        )}

        {logging && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {bodyweight ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em" }}>
                    POIDS
                  </span>
                  <div
                    className="cst-mono"
                    style={{
                      padding: "14px 12px",
                      textAlign: "center",
                      fontSize: 16,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.12em",
                    }}
                  >
                    PDC
                  </div>
                </div>
              ) : (
                <LabeledInput
                  key={`w-${stepIdx}`}
                  label="POIDS (kg) — optionnel"
                  initialValue={logging.weight}
                  placeholder="kg"
                  onCommit={commitWeight}
                  inputMode="decimal"
                  error={false}
                />
              )}
              <LabeledInput
                key={`r-${stepIdx}`}
                label={durationMode ? "DURÉE (s)" : "REPS RÉALISÉES"}
                initialValue={logging.reps}
                placeholder={repPlaceholder || (durationMode ? "sec" : "reps")}
                onCommit={commitReps}
                inputMode="numeric"
                error={validationError && !logging.reps ? true : false}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>
                  RPE PERÇU
                </span>
                <button
                  onClick={() => setShowRpeRef(true)}
                  className="cst-mono"
                  style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    letterSpacing: "0.12em",
                  }}
                >
                  ? ÉCHELLE
                </button>
              </div>
              {exColor && <RPEGuidance color={exColor} />}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                {RPE_PICKER_VALUES.filter((value) => value > 0).map((v) => {
                  const on = logging.rpe === v;
                  const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setLogging({ ...logging, rpe: v });
                        setValidationError(null);
                      }}
                      className="cst-mono"
                      style={{
                        padding: "12px 0",
                        borderRadius: 6,
                        border: `1px solid ${on ? hue : "rgba(255,255,255,0.12)"}`,
                        background: on ? `${hue}33` : "transparent",
                        color: on ? "#fff" : "rgba(255,255,255,0.7)",
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: "pointer",
                        ...rpeButtonReset(on ? "#ffffff" : "rgba(255,255,255,0.7)"),
                      }}
                    >
                      {formatRpeValue(v)}
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <div
                role="alert"
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: "rgba(201,72,58,0.15)",
                  border: "1px solid rgba(201,72,58,0.5)",
                  borderRadius: 8,
                  color: "#FFB8AD",
                }}
              >
                ⚠ {validationError}
              </div>
            )}

            {fb && !validationError && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: "rgba(212,165,59,0.12)",
                  border: "1px solid rgba(212,165,59,0.3)",
                  borderRadius: 8,
                }}
              >
                {fb}
              </div>
            )}

            <button
              onClick={() => saveSetAndAdvance(setStep, logging)}
              className="cst-btn cst-btn-primary"
              style={{ width: "100%", padding: "16px 0", fontSize: 14 }}
            >
              VALIDER {setStep.restAfter ? "→ REPOS" : setStep.isLastSetOfExercise ? "→ EXO SUIVANT" : "→ SUIVANT"}
            </button>
          </div>
        )}

        {canGoNextBlock && (
          <button
            onClick={goNextBlock}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ width: "100%", borderStyle: "dashed", opacity: 0.9 }}
            title="Machine prise ? Passe à l'exercice suivant — tu reviendras via ☰ en haut"
          >
            ⤼ Passer cet exercice (j'y reviens via ☰)
          </button>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {canGoPrevBlock && (
            <button onClick={goPrevBlock} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
              ← BLOC PRÉCÉDENT
            </button>
          )}
          <button
            onClick={() => setShowThread(setStep.exercise.name)}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ flex: 1 }}
          >
            💬 Filmer / Échanger
          </button>
          <button
            onClick={() => setPainFor(setStep.exercise.name)}
            className="cst-btn cst-btn-sm"
            style={{
              flex: 1,
              background: "rgba(192,57,43,0.15)",
              border: "1px solid rgba(192,57,43,0.5)",
              color: "#ff8a7a",
            }}
          >
            🔴 Douleur
          </button>
        </div>
      </div>
      {renderOverlays(exColor)}
    </div>
  );
}

/* ───────── Rest screen (full) ───────── */

function RestScreen({
  seconds,
  nextPreview,
  currentExercise,
  onDone,
  onVideo,
  onCues,
}: {
  seconds: number;
  nextPreview: { name: string; setNumber: number; totalSets: number } | null;
  currentExercise?: ProgExercise;
  onDone: () => void;
  onVideo?: () => void;
  onCues?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const totalRef = useRef(seconds);
  const doneFiredRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      if (!doneFiredRef.current) {
        doneFiredRef.current = true;
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([200, 80, 200]);
          }
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, running]);

  const pct = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const off = circ * (1 - pct);
  const color = pct > 0.5 ? "#3A8A4D" : pct > 0.2 ? "#D4A53B" : "#C9483A";

  return (
    <div
      style={{
        padding: "0 22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        flex: 1,
        alignItems: "center",
      }}
    >
      <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>
        — REPOS
      </span>

      <div style={{ position: "relative", width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={off}
            strokeLinecap="round"
            transform="rotate(-90 110 110)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span className="cst-display" style={{ fontSize: 56, color: "#fff", lineHeight: 1 }}>
            {Math.max(0, Math.floor(remaining / 60))}:{String(Math.max(0, remaining % 60)).padStart(2, "0")}
          </span>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
            / {totalRef.current}s
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, width: "100%" }}>
        <button
          onClick={() => setRemaining((r) => Math.max(0, r - 15))}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ flex: 1 }}
        >
          −15s
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ flex: 1 }}
        >
          {running ? "❚❚ PAUSE" : "▶ REPRENDRE"}
        </button>
        <button
          onClick={() => setRemaining((r) => r + 15)}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ flex: 1 }}
        >
          +15s
        </button>
      </div>

      {currentExercise && (hasVideo(currentExercise) || hasCues(currentExercise)) && (
        <div style={{ display: "flex", gap: 6, width: "100%" }}>
          {hasVideo(currentExercise) && (
            <button onClick={onVideo} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
              ▶ DÉMO
            </button>
          )}
          {hasCues(currentExercise) && (
            <button onClick={onCues} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
              📋 CONSIGNES
            </button>
          )}
        </div>
      )}

      {nextPreview && (
        <div
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
          }}
        >
          <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.2em" }}>
            APRÈS LE REPOS
          </div>
          <div className="cst-display" style={{ fontSize: 16, marginTop: 4, color: "#fff" }}>
            {nextPreview.name.toUpperCase()}
          </div>
          <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            SÉRIE {nextPreview.setNumber} / {nextPreview.totalSets}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={onDone}
        className="cst-btn cst-btn-primary"
        style={{ width: "100%", padding: "16px 0", fontSize: 14 }}
      >
        {remaining <= 0 ? "ON Y RETOURNE →" : "SKIP LE REPOS →"}
      </button>
    </div>
  );
}

/* ───────── EMOM screen — minute-by-minute guided timer ───────── */

function EmomScreen({
  exercise,
  durationMin,
  repsPerMin,
  repsLabel,
  alternating,
  sessionId,
  onFinish,
  onPain,
}: {
  exercise: ProgExercise;
  durationMin: number;
  repsPerMin: number | null;
  repsLabel?: string | null;
  alternating?: boolean;
  sessionId: string;
  onFinish: (repsByMinute: number[]) => void;
  onPain: () => void;
}) {
  const [adjustedMin, setAdjustedMin] = useState(Math.max(5, Math.round(durationMin / 5) * 5 || 10));
  const totalSec = adjustedMin * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [repsByMinute, setRepsByMinute] = useState<number[]>(Array(adjustedMin).fill(repsPerMin ?? 0));
  const doneFiredRef = useRef(false);

  const currentMinute = Math.floor(elapsed / 60); // 0-indexed current minute
  const secInMinute = elapsed % 60;
  const secLeftInMinute = 59 - secInMinute;

  useEffect(() => {
    if (!running || elapsed >= totalSec) return;
    const t = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(t);
  }, [running, elapsed, totalSec]);

  useEffect(() => {
    if (elapsed >= totalSec && running && !doneFiredRef.current) {
      doneFiredRef.current = true;
      setRunning(false);
      setDone(true);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([300, 100, 300, 100, 600]);
        }
      } catch { /* ignore */ }
    }
  }, [elapsed, totalSec, running]);

  // Vibrate at start of each minute
  const prevMinRef = useRef(-1);
  useEffect(() => {
    if (!running || currentMinute === prevMinRef.current) return;
    prevMinRef.current = currentMinute;
    if (currentMinute > 0) {
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([150, 50, 150]);
        }
      } catch { /* ignore */ }
    }
  }, [currentMinute, running]);

  const totalProgress = totalSec > 0 ? elapsed / totalSec : 0;
  const minuteProgress = secInMinute / 60;
  const radiusTotal = 90;
  const radiusMin = 64;
  const circTotal = 2 * Math.PI * radiusTotal;
  const circMin = 2 * Math.PI * radiusMin;

  if (!done) {
    return (
      <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
        <div>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>
            EMOM · {exercise.code && `${exercise.code} · `}{adjustedMin} MIN
            {repsLabel ? ` · ${repsLabel} REPS/MIN` : repsPerMin ? ` · ${repsPerMin} REPS/MIN` : ""}
          </span>
          <h2 className="cst-display" style={{ margin: "4px 0 0", fontSize: 22, color: "#fff" }}>
            {exercise.name.toUpperCase()}
          </h2>
          {alternating && (
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 4, color: "#D4A53B" }}>
              ↔ {repsLabel} : minutes paires {repsLabel?.split("/")[0]} reps · impaires {repsLabel?.split("/")[1]} reps
            </div>
          )}
        </div>

        {/* Duration adjustment — only before start */}
        {!running && elapsed === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "10px 0 2px" }}>
            <button
              onClick={() => {
                const next = Math.max(5, adjustedMin - 5);
                setAdjustedMin(next);
                setRepsByMinute(Array(next).fill(repsPerMin ?? 0));
              }}
              className="cst-btn cst-btn-ghost-dark"
              style={{ padding: "8px 14px", fontSize: 16, fontWeight: 700 }}
            >−5 MIN</button>
            <span className="cst-display" style={{ fontSize: 26, minWidth: 80, textAlign: "center" }}>{adjustedMin} MIN</span>
            <button
              onClick={() => {
                const next = adjustedMin + 5;
                setAdjustedMin(next);
                setRepsByMinute(Array(next).fill(repsPerMin ?? 0));
              }}
              className="cst-btn cst-btn-ghost-dark"
              style={{ padding: "8px 14px", fontSize: 16, fontWeight: 700 }}
            >+5 MIN</button>
          </div>
        )}

        <div style={{ position: "relative", width: 220, height: 220, alignSelf: "center" }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            {/* Outer ring: total progress */}
            <circle cx="110" cy="110" r={radiusTotal} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="110" cy="110" r={radiusTotal} fill="none" stroke="#3A8A4D" strokeWidth="8"
              strokeDasharray={circTotal} strokeDashoffset={circTotal * (1 - totalProgress)}
              strokeLinecap="round" transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 1s linear" }} />
            {/* Inner ring: minute progress */}
            <circle cx="110" cy="110" r={radiusMin} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="110" cy="110" r={radiusMin} fill="none"
              stroke={secLeftInMinute < 10 ? "#C9483A" : "#D4A53B"}
              strokeWidth="6"
              strokeDasharray={circMin} strokeDashoffset={circMin * (1 - minuteProgress)}
              strokeLinecap="round" transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            {!running && elapsed === 0 ? (
              <span className="cst-mono" style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>PRÊT</span>
            ) : (
              <>
                <span className="cst-mono" style={{ fontSize: 11, opacity: 0.5 }}>MIN {currentMinute + 1} / {adjustedMin}</span>
                <span className="cst-display" style={{ fontSize: 44, color: "#fff", lineHeight: 1 }}>
                  0:{String(secLeftInMinute).padStart(2, "0")}
                </span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5 }}>dans la minute</span>
              </>
            )}
          </div>
        </div>

        {running && repsPerMin != null && (
          <div style={{ padding: "14px 16px", background: "rgba(45,90,53,0.18)", border: "1px solid rgba(45,90,53,0.45)", borderRadius: 10, textAlign: "center" }}>
            {secInMinute < 15 ? (
              <span className="cst-display" style={{ fontSize: 18, color: "#6EAB76" }}>
                FAIS {repsPerMin} REPS MAINTENANT
              </span>
            ) : (
              <span className="cst-mono" style={{ fontSize: 11, opacity: 0.7 }}>
                repos · prochain signal dans {secLeftInMinute}s
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setRunning((r) => !r)}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2, padding: "14px 0" }}
          >
            {running ? "⏸ PAUSE" : elapsed === 0 ? "▶ DÉMARRER" : "▶ REPRENDRE"}
          </button>
          <button
            onClick={() => { setDone(true); setRunning(false); }}
            className="cst-btn cst-btn-ghost-dark"
            style={{ flex: 1, padding: "14px 0", fontSize: 11 }}
          >
            ARRÊTER
          </button>
        </div>

        {/* Minute-by-minute log */}
        {elapsed > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em" }}>REPS PAR MINUTE</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {repsByMinute.slice(0, Math.min(currentMinute + 1, durationMin)).map((r, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 8, opacity: 0.4 }}>{i + 1}</span>
                  <input
                    type="number"
                    value={r}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setRepsByMinute((prev) => {
                        const next = [...prev];
                        next[i] = isNaN(v) ? 0 : v;
                        return next;
                      });
                    }}
                    className="cst-input"
                    style={{ width: "100%", padding: "6px 4px", fontSize: 14, textAlign: "center", minHeight: 36 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onPain} className="cst-btn cst-btn-sm" style={{ alignSelf: "flex-start", background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.5)", color: "#ff8a7a" }}>
          🔴 Signaler une douleur
        </button>
      </div>
    );
  }

  // Finished — RPE recap
  const totalReps = repsByMinute.reduce((s, r) => s + r, 0);
  return (
    <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
      <div>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>✓ EMOM TERMINÉ</span>
        <h2 className="cst-display" style={{ margin: "4px 0 0", fontSize: 22, color: "#fff" }}>
          {exercise.name.toUpperCase()}
        </h2>
        <div className="cst-mono" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {adjustedMin} min · {totalReps} reps au total
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>RPE GLOBAL SUR CET EMOM</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
          {RPE_PICKER_VALUES.filter((value) => value > 0).map((v) => {
            const on = rpe === v;
            const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
            return (
              <button key={v} onClick={() => setRpe(v)} className="cst-mono" style={{ padding: "12px 0", borderRadius: 6, border: `1px solid ${on ? hue : "rgba(255,255,255,0.12)"}`, background: on ? `${hue}33` : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 700, cursor: "pointer", ...rpeButtonReset(on ? "#ffffff" : "rgba(255,255,255,0.7)") }}>
                {formatRpeValue(v)}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onFinish(repsByMinute)}
        disabled={rpe == null}
        className="cst-btn cst-btn-primary"
        style={{ width: "100%", padding: "16px 0", fontSize: 14, opacity: rpe == null ? 0.5 : 1 }}
      >
        VALIDER L'EMOM →
      </button>
    </div>
  );
}

/* ───────── Circuit screen — multi-station auto-cycling timer ───────── */

function CircuitScreen({
  exercises,
  defaultTotalMin,
  workSecPerStation,
  restSecBetween,
  blockLetter,
  onFinish,
  onPain,
}: {
  exercises: ProgExercise[];
  defaultTotalMin: number;
  workSecPerStation: number;
  restSecBetween: number;
  blockLetter?: string;
  sessionId: string;
  onFinish: () => void;
  onPain: () => void;
}) {
  const [totalMin, setTotalMin] = React.useState(defaultTotalMin);
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [rpe, setRpe] = React.useState<number | null>(null);
  const doneFiredRef = React.useRef(false);

  const n = exercises.length;
  const stationCycle = workSecPerStation + restSecBetween;
  const totalSec = totalMin * 60;

  const stationAbsolute = stationCycle > 0 ? Math.floor(elapsed / stationCycle) : 0;
  const stationInRound = n > 0 ? stationAbsolute % n : 0;
  const round = n > 0 ? Math.floor(stationAbsolute / n) : 0;
  const timeInStation = stationCycle > 0 ? elapsed % stationCycle : 0;
  const isWorking = timeInStation < workSecPerStation;
  const phaseCountdown = isWorking
    ? workSecPerStation - timeInStation
    : stationCycle - timeInStation;
  const nextStationIdx = (stationInRound + 1) % n;
  const nextExercise = exercises[nextStationIdx];
  const totalProgress = totalSec > 0 ? elapsed / totalSec : 0;
  const phaseProgress = (isWorking ? workSecPerStation : restSecBetween) > 0
    ? (isWorking ? timeInStation / workSecPerStation : (timeInStation - workSecPerStation) / restSecBetween)
    : 0;

  const currentExercise = exercises[stationInRound];

  useEffect(() => {
    if (!running || elapsed >= totalSec) return;
    const t = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(t);
  }, [running, elapsed, totalSec]);

  useEffect(() => {
    if (elapsed >= totalSec && running && !doneFiredRef.current) {
      doneFiredRef.current = true;
      setRunning(false);
      setDone(true);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([300, 100, 300, 100, 600]);
        }
      } catch { /* ignore */ }
    }
  }, [elapsed, totalSec, running]);

  // Vibrate at each station change
  const prevStationRef = React.useRef(-1);
  useEffect(() => {
    if (!running || stationAbsolute === prevStationRef.current) return;
    prevStationRef.current = stationAbsolute;
    if (stationAbsolute > 0) {
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([150, 50, 150]);
        }
      } catch { /* ignore */ }
    }
  }, [stationAbsolute, running]);

  const radius = 90;
  const phaseRadius = 64;
  const circ = 2 * Math.PI * radius;
  const phaseCirc = 2 * Math.PI * phaseRadius;

  if (!done) {
    return (
      <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
        <div>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>
            CIRCUIT {blockLetter ? `· BLOC ${blockLetter} ` : ""}· {n} STATIONS · {totalMin} MIN
          </span>
        </div>

        {/* Duration adjustment — only before start */}
        {!running && elapsed === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "10px 0 2px" }}>
            <button
              onClick={() => setTotalMin((m) => Math.max(5, m - 5))}
              className="cst-btn cst-btn-ghost-dark"
              style={{ padding: "8px 14px", fontSize: 16, fontWeight: 700 }}
            >−5 MIN</button>
            <span className="cst-display" style={{ fontSize: 26, minWidth: 80, textAlign: "center" }}>{totalMin} MIN</span>
            <button
              onClick={() => setTotalMin((m) => m + 5)}
              className="cst-btn cst-btn-ghost-dark"
              style={{ padding: "8px 14px", fontSize: 16, fontWeight: 700 }}
            >+5 MIN</button>
          </div>
        )}

        {/* Timer rings */}
        <div style={{ position: "relative", width: 220, height: 220, alignSelf: "center" }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            {/* Outer ring: total progress */}
            <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="110" cy="110" r={radius} fill="none" stroke="#3A8A4D" strokeWidth="8"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - totalProgress)}
              strokeLinecap="round" transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 1s linear" }} />
            {/* Inner ring: current phase */}
            <circle cx="110" cy="110" r={phaseRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="110" cy="110" r={phaseRadius} fill="none"
              stroke={isWorking ? (phaseCountdown < 10 ? "#C9483A" : "#D4A53B") : "rgba(100,160,220,0.8)"}
              strokeWidth="6"
              strokeDasharray={phaseCirc} strokeDashoffset={phaseCirc * (1 - phaseProgress)}
              strokeLinecap="round" transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2 }}>
            {!running && elapsed === 0 ? (
              <span className="cst-mono" style={{ fontSize: 13, opacity: 0.6 }}>PRÊT</span>
            ) : (
              <>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
                  {isWorking ? "TRAVAIL" : "TRANSITION"} · TOUR {round + 1}
                </span>
                <span className="cst-display" style={{ fontSize: 44, color: "#fff", lineHeight: 1 }}>
                  {String(Math.floor(phaseCountdown / 60)).padStart(1, "0")}:{String(phaseCountdown % 60).padStart(2, "0")}
                </span>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
                  STATION {stationInRound + 1} / {n}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Current exercise */}
        {(running || elapsed > 0) && currentExercise && (
          <div style={{
            padding: "14px 16px",
            background: isWorking ? "rgba(45,90,53,0.18)" : "rgba(60,80,140,0.15)",
            border: `1px solid ${isWorking ? "rgba(45,90,53,0.45)" : "rgba(60,80,140,0.45)"}`,
            borderRadius: 10,
          }}>
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.6, marginBottom: 4 }}>
              {isWorking ? "▶ EN COURS" : "⏸ TRANSITION"}
            </div>
            <div className="cst-display" style={{ fontSize: 18, color: "#fff" }}>
              {currentExercise.name.toUpperCase()}
            </div>
            {currentExercise.reps && (
              <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                {currentExercise.reps}
              </div>
            )}
          </div>
        )}

        {/* Next station preview */}
        {running && n > 1 && (
          <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, whiteSpace: "nowrap" }}>SUIVANT →</span>
            <span className="cst-display" style={{ fontSize: 13, opacity: 0.75 }}>{nextExercise?.name.toUpperCase()}</span>
          </div>
        )}

        {/* Stations list before start */}
        {!running && elapsed === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em" }}>STATIONS</span>
            {exercises.map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.45, minWidth: 20 }}>{i + 1}.</span>
                <span className="cst-display" style={{ fontSize: 13 }}>{ex.name.toUpperCase()}</span>
                {ex.reps && <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginLeft: "auto" }}>{ex.reps}</span>}
              </div>
            ))}
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.45, marginTop: 4 }}>
              {workSecPerStation}s travail{restSecBetween > 0 ? ` · ${restSecBetween}s transition` : " · pas de repos"}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setRunning((r) => !r)}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2, padding: "14px 0" }}
          >
            {running ? "⏸ PAUSE" : elapsed === 0 ? "▶ DÉMARRER" : "▶ REPRENDRE"}
          </button>
          <button
            onClick={() => { setDone(true); setRunning(false); }}
            className="cst-btn cst-btn-ghost-dark"
            style={{ flex: 1, padding: "14px 0", fontSize: 11 }}
          >
            TERMINER
          </button>
        </div>

        <button onClick={onPain} className="cst-btn cst-btn-sm" style={{ alignSelf: "flex-start", background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.5)", color: "#ff8a7a" }}>
          🔴 Signaler une douleur
        </button>
      </div>
    );
  }

  // Finished — RPE recap
  const minElapsed = Math.round(elapsed / 60);
  return (
    <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
      <div>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>✓ CIRCUIT TERMINÉ</span>
        <h2 className="cst-display" style={{ margin: "4px 0 0", fontSize: 22, color: "#fff" }}>
          {n} STATIONS · {minElapsed} MIN
        </h2>
        <div className="cst-mono" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {round} tour{round > 1 ? "s" : ""} complété{round > 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>RPE GLOBAL SUR CE CIRCUIT</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
          {RPE_PICKER_VALUES.filter((value) => value > 0).map((v) => {
            const on = rpe === v;
            const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
            return (
              <button key={v} onClick={() => setRpe(v)} className="cst-mono" style={{ padding: "12px 0", borderRadius: 6, border: `1px solid ${on ? hue : "rgba(255,255,255,0.12)"}`, background: on ? `${hue}33` : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 700, cursor: "pointer", ...rpeButtonReset(on ? "#ffffff" : "rgba(255,255,255,0.7)") }}>
                {formatRpeValue(v)}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onFinish}
        disabled={rpe == null}
        className="cst-btn cst-btn-primary"
        style={{ width: "100%", padding: "16px 0", fontSize: 14, opacity: rpe == null ? 0.5 : 1 }}
      >
        VALIDER LE CIRCUIT →
      </button>
    </div>
  );
}

/* ───────── Timed set countdown (gainage, plank, iso, etc.) ───────── */

function TimedSetScreen({
  seconds,
  label,
  rounds = 1,
  sideLabel = "TOUR",
  onDone,
}: {
  seconds: number;
  label: string;
  rounds?: number;
  sideLabel?: string;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [roundIdx, setRoundIdx] = useState(0); // 0-based current round (e.g. côté 1, côté 2)
  const totalRef = useRef(seconds);
  const doneFiredRef = useRef(false);

  const multi = rounds > 1;
  const isLastRound = roundIdx >= rounds - 1;

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, running]);

  useEffect(() => {
    if (remaining <= 0 && running && !doneFiredRef.current) {
      doneFiredRef.current = true;
      setRunning(false);
      setFinished(true);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate([200, 80, 200, 80, 400]);
        }
      } catch { /* ignore */ }
    }
  }, [remaining, running]);

  // Démarre le chrono du côté suivant (enchaîné, prêt à partir).
  function startNextRound() {
    doneFiredRef.current = false;
    setRoundIdx((i) => i + 1);
    setRemaining(seconds);
    setFinished(false);
    setRunning(true);
  }

  const pct = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const off = circ * (1 - pct);
  const color = pct > 0.5 ? "#3A8A4D" : pct > 0.2 ? "#D4A53B" : "#C9483A";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.2em" }}>
        ⏱ {label.toUpperCase()}
      </div>

      {multi && (
        <div
          className="cst-mono"
          style={{
            fontSize: 12,
            letterSpacing: "0.18em",
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {sideLabel} {roundIdx + 1} / {rounds}
        </div>
      )}

      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="100" cy="100" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          {finished ? (
            <span className="cst-display" style={{ fontSize: 40, color: "#3A8A4D" }}>✓</span>
          ) : (
            <>
              <span className="cst-display" style={{ fontSize: 52, color: "#fff", lineHeight: 1 }}>
                {Math.max(0, Math.floor(remaining / 60))}:{String(Math.max(0, remaining % 60)).padStart(2, "0")}
              </span>
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
                / {totalRef.current}s
              </span>
            </>
          )}
        </div>
      </div>

      {!finished && (
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button
            onClick={() => setRunning((r) => !r)}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2, padding: "14px 0" }}
          >
            {running ? "⏸ PAUSE" : remaining === seconds ? "▶ DÉMARRER" : "▶ REPRENDRE"}
          </button>
          <button
            onClick={() => { setFinished(true); setRunning(false); }}
            className="cst-btn cst-btn-ghost-dark"
            style={{ flex: 1, padding: "14px 0", fontSize: 11 }}
          >
            SKIP
          </button>
        </div>
      )}

      {finished && !isLastRound && (
        <button onClick={startNextRound} className="cst-btn cst-btn-primary" style={{ width: "100%", padding: "16px 0", fontSize: 14 }}>
          ✓ {sideLabel} {roundIdx + 1} OK — {sideLabel} {roundIdx + 2} →
        </button>
      )}

      {finished && isLastRound && (
        <button onClick={onDone} className="cst-btn cst-btn-primary" style={{ width: "100%", padding: "16px 0", fontSize: 14 }}>
          ✓ TERMINÉ — NOTER LE RPE →
        </button>
      )}
    </div>
  );
}

/* ───────── Atoms ───────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 8px",
        background: "rgba(0,0,0,0.22)",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.2em" }}>
        {label}
      </div>
      <div className="cst-display" style={{ fontSize: 22, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

const LabeledInput = React.memo(function LabeledInput({
  label,
  initialValue,
  onCommit,
  placeholder,
  inputMode,
  error,
}: {
  label: string;
  initialValue: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
  error?: boolean;
}) {
  const [local, setLocal] = useState(initialValue ?? "");
  const focusedRef = useRef(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync externe (changement de step/pré-remplissage) — uniquement quand le champ n'a pas le focus
  useEffect(() => {
    if (!focusedRef.current && initialValue !== local) {
      setLocal(initialValue ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  function scheduleCommit(v: string) {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onCommit(v), 300);
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em" }}>
        {label}
      </span>
      <input
        className="cst-input"
        type="text"
        inputMode={inputMode}
        pattern={inputMode === "decimal" ? "[0-9]*[.,]?[0-9]*" : inputMode === "numeric" ? "[0-9]*" : undefined}
        value={local}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="next"
        onFocus={(e) => {
          focusedRef.current = true;
          try {
            e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch {
            /* ignore */
          }
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (commitTimer.current) {
            clearTimeout(commitTimer.current);
            commitTimer.current = null;
          }
          onCommit(local);
        }}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          scheduleCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          padding: "14px 12px",
          fontSize: 24,
          textAlign: "center",
          minHeight: 56,
          borderColor: error ? "rgba(201,72,58,0.7)" : undefined,
          background: error ? "rgba(201,72,58,0.08)" : undefined,
        }}
      />
    </label>
  );
});

/* ───────── Cues / Video action bar (used in SET phase) ───────── */

function CuesActionBar({
  exercise,
  onVideo,
  onCues,
}: {
  exercise: ProgExercise;
  onVideo: () => void;
  onCues: () => void;
}) {
  const v = hasVideo(exercise);
  const c = hasCues(exercise);
  if (!v && !c) return null;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {v && (
        <button onClick={onVideo} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
          ▶ DÉMO
        </button>
      )}
      {c && (
        <button onClick={onCues} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
          📋 CONSIGNES
        </button>
      )}
    </div>
  );
}

/* ───────── Session-level media uploader (end of session) ───────── */

function SessionMediaUploader({ sessionId, userId }: { sessionId: string; userId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]); // display names
  const [progress, setProgress] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setProgress(0);
    const names: string[] = [];
    try {
      let i = 0;
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "bin").toLowerCase();
        const path = `${userId}/${sessionId}/session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("session-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        await supabase.from("session_media").insert({
          session_id: sessionId,
          member_id: userId,
          type: isVideo ? "video" : "photo",
          storage_path: path,
          caption: "[SESSION]", // marks session-level media for coach view
        });
        names.push(file.name);
        i += 1;
        setProgress(Math.round((i / files.length) * 100));
      }
      setUploaded((prev) => [...prev, ...names]);
    } catch (e) {
      console.error("Session media upload failed", e);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.18em" }}>
        🎥 PARTAGER DES VIDÉOS DE LA SÉANCE
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
        En plus des vidéos par exercice, partage ici des vidéos ou photos globales sur ta séance. Ouvre le sélecteur de fichiers — pas de caméra en direct.
      </div>

      {uploaded.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {uploaded.map((name, i) => (
            <div key={i} className="cst-mono" style={{ fontSize: 10, opacity: 0.8, padding: "4px 8px", background: "rgba(45,90,53,0.18)", borderRadius: 4 }}>
              ✓ {name}
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>ENVOI… {progress}%</div>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="cst-btn cst-btn-ghost-dark"
        style={{ fontSize: 12, padding: "10px 0" }}
      >
        + PARTAGER UNE VIDÉO / PHOTO
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

/* ───────── Video modal (YouTube embed) ───────── */

function VideoModal({ exercise, onClose }: { exercise: ProgExercise | null; onClose: () => void }) {
  if (!exercise) return null;
  const id =
    exercise.youtube_id || extractYoutubeId(exercise.youtube_url) || extractYoutubeId(exercise.youtube_alt_url);
  const fallbackUrl = exercise.youtube_url || exercise.youtube_alt_url || null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.75, letterSpacing: "0.2em", color: "#fff" }}>
            ▶ {exercise.name?.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#fff", fontSize: 22, cursor: "pointer" }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {id ? (
            <iframe
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
              title={`Démo ${exercise.name}`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <a
                href={fallbackUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="cst-mono"
                style={{ color: "#fff", textDecoration: "underline", fontSize: 12 }}
              >
                OUVRIR LA VIDÉO ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Cues modal (notes coach, tempo, RPE, couleur) ───────── */

function CuesModal({
  exercise,
  onClose,
  onOpenTempo,
  onOpenColor,
  onOpenRpeRef,
}: {
  exercise: ProgExercise | null;
  onClose: () => void;
  onOpenTempo: (ex: ProgExercise) => void;
  onOpenColor: (c: ExerciseColor) => void;
  onOpenRpeRef: () => void;
}) {
  if (!exercise) return null;
  const color = (() => {
    const v = (exercise.color || "").toLowerCase();
    if (v === "red" || v === "green" || v === "yellow" || v === "lime" || v === "blue") return v as ExerciseColor;
    return null;
  })();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        zIndex: 270,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-hatch"
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#1c2620",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="cst-display" style={{ margin: 0, fontSize: 18 }}>
            CONSIGNES — {exercise.name?.toUpperCase()}
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: 0, color: "#fff", fontSize: 18, cursor: "pointer" }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {color && (
          <button
            onClick={() => onOpenColor(color)}
            className="cst-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "8px 10px",
              color: "rgba(255,255,255,0.85)",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <ColorDot color={color} size={12} />
            CODE COULEUR — {color.toUpperCase()} (voir détail)
          </button>
        )}

        {exercise.tempo && (
          <button
            onClick={() => onOpenTempo(exercise)}
            className="cst-mono"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "8px 10px",
              color: "rgba(255,255,255,0.85)",
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            TEMPO — {exercise.tempo} (voir explication)
          </button>
        )}

        {(exercise.rpe_target || color) && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(212,165,59,0.10)",
              border: "1px solid rgba(212,165,59,0.25)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {exercise.rpe_target && (
              <div className="cst-mono" style={{ fontSize: 11, color: "#fff" }}>
                <span style={{ opacity: 0.55 }}>RPE CIBLE </span>
                {exercise.rpe_target}
              </div>
            )}
            {color && <RPEGuidance color={color} />}
            <button
              onClick={onOpenRpeRef}
              className="cst-mono"
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 9,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                letterSpacing: "0.12em",
              }}
            >
              ? ÉCHELLE RPE
            </button>
          </div>
        )}

        {exercise.coach_notes && (
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              fontStyle: "italic",
              whiteSpace: "pre-wrap",
              background: "rgba(45,90,53,0.12)",
              borderLeft: "2px solid var(--cst-mid-green)",
              padding: "10px 12px",
              borderRadius: 4,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            « {exercise.coach_notes} »
          </div>
        )}

        {hasVideo(exercise) && (
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.18em" }}>
            ASTUCE — bouton ▶ DÉMO pour la vidéo
          </div>
        )}
      </div>
    </div>
  );
}
