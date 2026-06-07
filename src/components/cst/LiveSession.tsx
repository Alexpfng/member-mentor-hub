/* ColosmartTraining — Séance interactive guidée
   Un écran = une action. Chrono auto. Aucun scroll-fest. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProgramBlocks, groupBlocks, type ProgExercise } from "./ProgramBlocks";
import { ExerciseThread } from "./ExerciseThread";
import PainReportDialog from "./PainReportDialog";
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
  if (v === "red" || v === "green" || v === "yellow" || v === "blue") return v;
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
  return BODYWEIGHT_KEYWORDS.some((k) => c.includes(k));
}

function isDurationReps(reps?: string | number | null): boolean {
  if (reps == null) return false;
  const r = String(reps).toLowerCase().trim();
  return /\d+\s*(s|sec|secondes?|"|''|min|m)\b/.test(r) || /\d+\s*['"]/.test(r);
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

function formatRelativeDays(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.round(diff / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days}j`;
}

type LastSet = { weight: number | null; reps: number | null; rpe: number | null; loggedAt: string | null };
type LastByExo = Record<string, Record<number, LastSet> & { _loggedAt?: string | null; _sets?: LastSet[] }>;

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

type Step = Brief | WorkSet;

function buildSteps(exercises: ProgExercise[]): Step[] {
  const blocks = groupBlocks(exercises || []);
  const steps: Step[] = [];

  blocks.forEach((b, blockIdx) => {
    const blockType = b.exercises[0]?.block_type ?? null;
    const isSuperset = b.isSuperset;
    const colorOfBlock = asColor(b.exercises[0]?.color);
    const restSec = parseRecupSeconds(b.exercises[0]?.recup, defaultRestFor(colorOfBlock));

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

/* ───────── Main component ───────── */

type Props = {
  sessionId: string;
  userId: string;
  sessionLabel?: string | null;
  exercises: ProgExercise[];
  onFinish: () => void | Promise<void>;
  finishing?: boolean;
};

export function LiveSession({ sessionId, userId, sessionLabel, exercises, onFinish, finishing }: Props) {
  const steps = useMemo(() => buildSteps(exercises), [exercises]);
  const totalWorkSets = useMemo(() => steps.filter((s) => s.kind === "set").length, [steps]);

  const [phase, setPhase] = useState<"intro" | "step" | "rest" | "recap">("intro");
  const [stepIdx, setStepIdx] = useState(0);
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

  /** Saisies par stepIdx — conservées si on revient en arrière, écrasées si on re-valide. */
  const [savedByStep, setSavedByStep] = useState<
    Record<number, { weight: number | null; reps: number | null; rpe: number | null; exo: string }>
  >({});

  /** Historique de la dernière séance pour le même exercice. */
  const [lastByExo, setLastByExo] = useState<LastByExo>({});

  const startedAtRef = useRef<number>(Date.now());

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

  const current = steps[stepIdx];
  const completedWorkSets = useMemo(() => Object.keys(savedByStep).length, [savedByStep]);

  function goNext() {
    setLogging(null);
    setValidationError(null);
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

  function renderHeader() {
    const pct = totalWorkSets ? (completedWorkSets / totalWorkSets) * 100 : 0;
    return (
      <div style={{ padding: "16px 18px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
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
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            {completedWorkSets}/{totalWorkSets}
          </span>
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
                  PROGRAMME COMPLET
                </h3>
                <button
                  onClick={() => setShowOverview(false)}
                  style={{ background: "none", border: 0, color: "#fff", fontSize: 18, cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
              <ProgramBlocks exercises={exercises} />
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
            onClick={() => setShowQuitConfirm(false)}
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
              onClick={(e) => e.stopPropagation()}
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
                gap: 14,
              }}
            >
              <h3 className="cst-display" style={{ margin: 0, fontSize: 22, color: "#fff" }}>
                QUITTER LA SÉANCE ?
              </h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.8)" }}>
                Tes données sont sauvegardées, tu pourras reprendre où tu en étais depuis ton tableau de bord.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => setShowQuitConfirm(false)}
                  className="cst-btn cst-btn-primary"
                  style={{ width: "100%", padding: "14px 0", fontSize: 13 }}
                >
                  CONTINUER LA SÉANCE
                </button>
                <button
                  onClick={navigateToMember}
                  className="cst-btn cst-btn-ghost-dark"
                  style={{ width: "100%", padding: "12px 0", fontSize: 12 }}
                >
                  QUITTER
                </button>
              </div>
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
              {(["red", "green", "yellow", "blue"] as const).map((c) => (
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
        <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
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
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}
          >
            {savedList.map((l, i) => (
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
            ))}
          </div>
          <button
            onClick={onFinish}
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
                    {ex.reps ?? "—"}
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
                      background: "rgba(45,90,53,0.10)",
                      borderLeft: "2px solid var(--cst-mid-green)",
                      padding: "6px 10px",
                      borderRadius: 3,
                    }}
                  >
                    « {ex.coach_notes} »
                  </div>
                )}
                {(ex.youtube_id || ex.youtube_url) && (
                  <a
                    href={ex.youtube_url || `https://www.youtube.com/watch?v=${ex.youtube_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cst-mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 10,
                      textDecoration: "none",
                      letterSpacing: "0.14em",
                      width: "fit-content",
                    }}
                  >
                    ▶ VOIR LA DÉMO
                  </a>
                )}
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

  // current.kind === "set"
  const setStep = current;
  const exColor = asColor(setStep.exercise.color);
  const accent = colorHex(exColor) || "var(--cst-mid-green)";
  const bodyweight = isBodyweight(setStep.exercise.charge);
  const durationMode = isDurationReps(setStep.exercise.reps);

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
              <>
                OBJECTIF {repPlaceholder}
                {durationMode ? "" : " REPS"}
              </>
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

        {!logging && (
          <button
            onClick={startLogging}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14, marginTop: 4 }}
          >
            ✓ SÉRIE TERMINÉE — LOGGER
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
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
                      }}
                    >
                      {v}
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

/* ───────── Video modal (YouTube embed) ───────── */

function VideoModal({ exercise, onClose }: { exercise: ProgExercise | null; onClose: () => void }) {
  if (!exercise) return null;
  const id =
    exercise.youtube_id || extractYoutubeId(exercise.youtube_url) || extractYoutubeId(exercise.youtube_alt_url);
  const fallbackUrl = exercise.youtube_url || exercise.youtube_alt_url || null;
  return (
    <div
      onClick={onClose}
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
    if (v === "red" || v === "green" || v === "yellow" || v === "blue") return v as ExerciseColor;
    return null;
  })();
  return (
    <div
      onClick={onClose}
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
