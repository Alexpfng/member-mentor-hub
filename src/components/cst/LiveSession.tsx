/* ColosmartTraining — Séance interactive guidée
   Un écran = une action. Chrono auto. Aucun scroll-fest. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProgramBlocks, groupBlocks, type ProgExercise } from "./ProgramBlocks";
import { ExerciseThread } from "./ExerciseThread";
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
  if (t === "emom")
    return "EMOM : 1 série au début de chaque minute. Le temps restant dans la minute = ton repos.";
  if (t === "ladder")
    return "Ladder : le nombre de reps change à chaque minute (ex : 1, 2, 3, puis on recommence).";
  if (t === "amrap")
    return "AMRAP : autant de tours/reps que possible dans le temps imparti, avec une technique propre.";
  if (t === "dropset")
    return "Dropset : enchaîne sans repos en baissant la charge jusqu'à l'échec technique.";
  if (t === "circuit")
    return "Circuit : enchaîne tous les exos du bloc, puis prends la récup et recommence.";
  if (isSuperset)
    return "Superset : enchaîne les deux exercices sans repos, puis prends la récup commune.";
  return null;
}

function extractYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m =
    s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
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
    const restSec = parseRecupSeconds(
      b.exercises[0]?.recup,
      defaultRestFor(colorOfBlock),
    );

    steps.push({
      kind: "brief",
      blockIdx,
      blockLetter: b.letter,
      isSuperset,
      blockType,
      exercises: b.exercises,
    });

    if (isSuperset) {
      const rounds = Math.max(
        ...b.exercises.map((e) => parseSeriesCount(e.series)),
      );
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
          nextPreview: !isLast
            ? { name: ex.name, setNumber: r + 2, totalSets: total }
            : null,
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

export function LiveSession({
  sessionId,
  userId,
  sessionLabel,
  exercises,
  onFinish,
  finishing,
}: Props) {
  const steps = useMemo(() => buildSteps(exercises), [exercises]);
  const totalWorkSets = useMemo(
    () => steps.filter((s) => s.kind === "set").length,
    [steps],
  );

  const [phase, setPhase] = useState<"intro" | "step" | "rest" | "recap">("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [logging, setLogging] = useState<null | {
    weight: string;
    reps: string;
    rpe: number | null;
  }>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showThread, setShowThread] = useState<string | null>(null);
  const [showColor, setShowColor] = useState<ExerciseColor>(null);
  const [showTempo, setShowTempo] = useState<{ tempo?: string | null; name?: string } | null>(null);
  const [showRpeRef, setShowRpeRef] = useState(false);
  const [showVideo, setShowVideo] = useState<ProgExercise | null>(null);
  const [showCues, setShowCues] = useState<ProgExercise | null>(null);
  const [savedLogs, setSavedLogs] = useState<
    { exo: string; weight: number | null; reps: number | null; rpe: number | null }[]
  >([]);

  const startedAtRef = useRef<number>(Date.now());

  const current = steps[stepIdx];
  const completedWorkSets = useMemo(
    () => steps.slice(0, stepIdx).filter((s) => s.kind === "set").length,
    [steps, stepIdx],
  );

  function goNext() {
    setLogging(null);
    if (stepIdx >= steps.length - 1) {
      setPhase("recap");
      return;
    }
    setStepIdx((i) => i + 1);
    setPhase("step");
  }

  async function saveSetAndAdvance(step: WorkSet, l: { weight: string; reps: string; rpe: number | null }) {
    const w = parseFloat(l.weight);
    const r = parseInt(l.reps, 10);
    try {
      await supabase.from("set_logs").insert({
        session_id: sessionId,
        exercise_name: step.exercise.name,
        set_number: step.setNumber,
        weight_kg: isNaN(w) ? null : w,
        reps: isNaN(r) ? null : r,
        rpe: l.rpe,
        completed: true,
      });
    } catch (e) {
      console.error("set_logs insert failed", e);
    }
    setSavedLogs((arr) => [
      ...arr,
      {
        exo: step.exercise.name,
        weight: isNaN(w) ? null : w,
        reps: isNaN(r) ? null : r,
        rpe: l.rpe,
      },
    ]);
    if (step.restAfter) {
      setPhase("rest");
    } else {
      goNext();
    }
  }

  /* ───────── Header ───────── */

  function Header() {
    const pct = totalWorkSets ? (completedWorkSets / totalWorkSets) * 100 : 0;
    return (
      <div style={{ padding: "16px 18px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.22em" }}>
            — {sessionLabel?.toUpperCase() || "SÉANCE"}
          </span>
          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            {completedWorkSets}/{totalWorkSets} séries
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

  /* ───────── INTRO ───────── */

  if (phase === "intro") {
    const blocks = groupBlocks(exercises || []);
    const estMin = Math.max(20, Math.round(totalWorkSets * 2.2));
    return (
      <Shell>
        <Header />
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
        <Overlays />
      </Shell>
    );
  }

  /* ───────── RECAP ───────── */

  if (phase === "recap") {
    const totalVol = savedLogs.reduce(
      (s, l) => s + (l.weight && l.reps ? l.weight * l.reps : 0),
      0,
    );
    const rpes = savedLogs.map((l) => l.rpe).filter((v): v is number => v != null);
    const avgRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
    const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
    return (
      <Shell>
        <Header />
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
            {savedLogs.map((l, i) => (
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
        <Overlays />
      </Shell>
    );
  }

  /* ───────── REST ───────── */

  if (phase === "rest" && current?.kind === "set") {
    return (
      <Shell>
        <Header />
        <RestScreen
          seconds={current.restSeconds}
          nextPreview={current.nextPreview ?? null}
          currentExercise={current.exercise}
          onDone={goNext}
          onVideo={() => setShowVideo(current.exercise)}
          onCues={() => setShowCues(current.exercise)}
        />
        <Overlays />
      </Shell>
    );
  }

  /* ───────── STEP ───────── */

  if (!current) {
    return (
      <Shell>
        <div style={{ padding: 22, opacity: 0.6 }}>Aucune étape.</div>
      </Shell>
    );
  }

  if (current.kind === "brief") {
    const blockColor = asColor(current.exercises[0]?.color);
    const explain = blockExplain(current.blockType, current.isSuperset);
    return (
      <Shell>
        <Header />
        <div
          className="cst-scroll"
          style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}
        >
          <div>
            <span
              className="cst-mono"
              style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}
            >
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
                  {ex.tempo && (
                    <TempoBadge
                      tempo={ex.tempo}
                      onClick={() => setShowTempo({ tempo: ex.tempo, name: ex.name })}
                    />
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
                  <span><span style={{ opacity: 0.5 }}>SÉRIES </span>{ex.series ?? "—"}</span>
                  <span><span style={{ opacity: 0.5 }}>REPS </span>{ex.reps ?? "—"}</span>
                  {ex.charge && <span><span style={{ opacity: 0.5 }}>CHARGE </span>{ex.charge}</span>}
                  {ex.recup && <span><span style={{ opacity: 0.5 }}>RÉCUP </span>{ex.recup}</span>}
                  {ex.rpe_target && <span><span style={{ opacity: 0.5 }}>RPE </span>{ex.rpe_target}</span>}
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
                <button
                  onClick={() => setShowThread(ex.name)}
                  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                  style={{ alignSelf: "flex-start" }}
                >
                  💬 Échanger / Envoyer une vidéo
                </button>
              </div>
            );
          })}

          <div style={{ flex: 1 }} />

          <button
            onClick={goNext}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "16px 0", fontSize: 14 }}
          >
            JE COMMENCE →
          </button>
        </div>
        <Overlays blockColor={blockColor} />
      </Shell>
    );
  }

  // current.kind === "set"
  const setStep = current;
  const exColor = asColor(setStep.exercise.color);
  const accent = colorHex(exColor) || "var(--cst-mid-green)";
  const fb = logging?.rpe != null
    ? rpeFeedbackMessage(exColor, logging.rpe, setStep.isLastSetOfExercise)
    : null;

  return (
    <Shell>
      <Header />
      <div
        className="cst-scroll"
        style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}
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
            {setStep.exercise.reps && <>OBJECTIF {setStep.exercise.reps} REPS</>}
            {setStep.exercise.rpe_target && <> @ RPE {setStep.exercise.rpe_target}</>}
          </div>
          {setStep.exercise.charge && (
            <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              CHARGE : {setStep.exercise.charge}
            </div>
          )}
        </div>

        <CuesActionBar
          exercise={setStep.exercise}
          onVideo={() => setShowVideo(setStep.exercise)}
          onCues={() => setShowCues(setStep.exercise)}
        />



        {!logging && (
          <button
            onClick={() => setLogging({ weight: "", reps: setStep.exercise.reps ? String(setStep.exercise.reps).match(/\d+/)?.[0] ?? "" : "", rpe: null })}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14, marginTop: 4 }}
          >
            ✓ SÉRIE TERMINÉE — LOGGER
          </button>
        )}

        {logging && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <LabeledInput
                label="POIDS (kg)"
                value={logging.weight}
                onChange={(v) => setLogging({ ...logging, weight: v })}
                type="number"
                inputMode="decimal"
              />
              <LabeledInput
                label="REPS RÉALISÉES"
                value={logging.reps}
                onChange={(v) => setLogging({ ...logging, reps: v })}
                type="number"
                inputMode="numeric"
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
                {[6, 7, 8, 9, 10].map((v) => {
                  const on = logging.rpe === v;
                  const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
                  return (
                    <button
                      key={v}
                      onClick={() => setLogging({ ...logging, rpe: v })}
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

            {fb && (
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
              disabled={!logging.weight || !logging.reps || logging.rpe == null}
              className="cst-btn cst-btn-primary"
              style={{
                width: "100%",
                padding: "16px 0",
                fontSize: 14,
                opacity: !logging.weight || !logging.reps || logging.rpe == null ? 0.4 : 1,
              }}
            >
              VALIDER {setStep.restAfter ? "→ REPOS" : setStep.isLastSetOfExercise ? "→ EXO SUIVANT" : "→ SUIVANT"}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowThread(setStep.exercise.name)}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          💬 Filmer / Échanger avec le coach
        </button>
      </div>
      <Overlays blockColor={exColor} />
    </Shell>
  );

  /* ───────── Subcomponents ───────── */

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 720, flex: 1 }}>
        {children}
      </div>
    );
  }

  function Overlays({ blockColor }: { blockColor?: ExerciseColor } = {}) {
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
              <ExerciseThread
                sessionId={sessionId}
                exerciseName={showThread}
                userId={userId}
                viewerRole="member"
              />
            </div>
          </div>
        )}
      </>
    );
  }
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
            (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(
              [200, 80, 200],
            );
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
    <div style={{ padding: "0 22px 24px", display: "flex", flexDirection: "column", gap: 18, flex: 1, alignItems: "center" }}>
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
        <button onClick={() => setRemaining((r) => Math.max(0, r - 15))} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>−15s</button>
        <button onClick={() => setRunning((r) => !r)} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
          {running ? "❚❚ PAUSE" : "▶ REPRENDRE"}
        </button>
        <button onClick={() => setRemaining((r) => r + 15)} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>+15s</button>
      </div>

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

function LabeledInput({
  label,
  value,
  onChange,
  type,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em" }}>
        {label}
      </span>
      <input
        className="cst-input"
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "12px 12px", fontSize: 18, textAlign: "center" }}
      />
    </label>
  );
}
