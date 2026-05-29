/* ColosmartTraining — Session live components */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseThread } from "./ExerciseThread";
import {
  ColorDot,
  ColorTooltip,
  TempoBadge,
  TempoExplainer,
  RPEGuidance,
  rpeFeedbackMessage,
  type ExerciseColor,
} from "./pedagogy";

/* ───────── RPE Selector ───────── */

export function RPESelector({
  value,
  onChange,
  color,
}: {
  value: number | null;
  onChange: (v: number) => void;
  color?: ExerciseColor;
}) {
  return (
    <div className="cst-col" style={{ gap: 6 }}>
      <RPEGuidance color={color} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {[6, 7, 8, 9, 10].map((v) => {
          const on = value === v;
          const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="cst-mono"
              style={{
                padding: "10px 0",
                borderRadius: 6,
                border: `1px solid ${on ? hue : "rgba(255,255,255,0.12)"}`,
                background: on ? `${hue}33` : "transparent",
                color: on ? "#fff" : "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Rest Timer ───────── */

export function RestTimer({
  seconds,
  onDone,
  onSkip,
}: {
  seconds: number;
  onDone?: () => void;
  onSkip?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const total = useRef(seconds);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, running, onDone]);

  const pct = total.current > 0 ? remaining / total.current : 0;
  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const dashoff = circ * (1 - pct);
  const color = pct > 0.5 ? "#3A8A4D" : pct > 0.2 ? "#D4A53B" : "#C9483A";

  return (
    <div
      className="cst-card-dark cst-hatch"
      style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
    >
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6, letterSpacing: "0.2em" }}>
        — REPOS
      </span>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={dashoff} strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span className="cst-display" style={{ fontSize: 36, color: "#fff" }}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </span>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>/ {total.current}s</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, width: "100%" }}>
        <button type="button" onClick={() => setRemaining((r) => Math.max(0, r - 15))} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>−15s</button>
        <button type="button" onClick={() => setRunning((r) => !r)} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>
          {running ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => setRemaining((r) => r + 15)} className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }}>+15s</button>
        <button type="button" onClick={onSkip} className="cst-btn cst-btn-primary cst-btn-sm" style={{ flex: 1.5 }}>SKIP →</button>
      </div>
    </div>
  );
}

/* ───────── Set Logger ───────── */

export type SetState = {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: number | null;
  completed: boolean;
};

export function SetLogger({
  set,
  onChange,
  onValidate,
  color,
}: {
  set: SetState;
  onChange: (s: SetState) => void;
  onValidate: () => void;
  color?: ExerciseColor;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 1fr 60px",
        gap: 8,
        alignItems: "center",
        padding: "8px 10px",
        background: set.completed ? "rgba(45,90,53,0.18)" : "rgba(0,0,0,0.20)",
        border: `1px solid ${set.completed ? "rgba(45,90,53,0.4)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 8,
      }}
    >
      <span className="cst-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        S{set.setNumber}
      </span>
      <input
        className="cst-input"
        type="number" inputMode="decimal" placeholder="kg" value={set.weight}
        onChange={(e) => onChange({ ...set, weight: e.target.value })}
        style={{ padding: "8px 10px", fontSize: 13, textAlign: "center" }}
      />
      <input
        className="cst-input"
        type="number" inputMode="numeric" placeholder="reps" value={set.reps}
        onChange={(e) => onChange({ ...set, reps: e.target.value })}
        style={{ padding: "8px 10px", fontSize: 13, textAlign: "center" }}
      />
      <button
        type="button"
        onClick={onValidate}
        disabled={!set.weight || !set.reps || set.rpe == null}
        style={{
          padding: "8px 0",
          borderRadius: 6,
          border: "none",
          background: set.completed ? "var(--cst-mid-green)" : (set.weight && set.reps && set.rpe != null) ? "var(--cst-mid-green)" : "rgba(255,255,255,0.06)",
          color: set.completed ? "#fff" : (set.weight && set.reps && set.rpe != null) ? "#fff" : "rgba(255,255,255,0.3)",
          cursor: set.completed ? "default" : "pointer",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {set.completed ? "✓" : "OK"}
      </button>
      {!set.completed && (
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <RPESelector value={set.rpe} onChange={(v) => onChange({ ...set, rpe: v })} color={color} />
        </div>
      )}
      {set.completed && set.rpe != null && (
        <div style={{ gridColumn: "1 / -1", marginTop: 4 }} className="cst-mono">
          <span style={{ fontSize: 10, opacity: 0.6 }}>
            {set.weight}kg × {set.reps} @ RPE {set.rpe}
          </span>
        </div>
      )}
    </div>
  );
}

/* ───────── Technique Video Capture ───────── */

export function TechniqueVideoCapture({
  sessionId,
  exerciseName,
  userId,
}: {
  sessionId: string;
  exerciseName: string;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ts = Date.now();
      const safeName = exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${userId}/${sessionId}/${safeName}-${ts}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("technique-videos")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("technique_videos").insert({
        member_id: userId,
        session_id: sessionId,
        exercise_name: exerciseName,
        storage_path: path,
      });
      if (insErr) throw insErr;
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="cst-mono" style={{ fontSize: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(45,90,53,0.18)", color: "#6EAB76", textAlign: "center" }}>
        ✓ VIDÉO ENVOYÉE AU COACH
      </div>
    );
  }

  return (
    <label
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px 12px", borderRadius: 6, cursor: "pointer",
        background: "rgba(255,255,255,0.04)",
        border: "1px dashed rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.7)",
        fontSize: 11, fontFamily: "var(--cst-mono)", letterSpacing: "0.14em",
      }}
    >
      <span>🎬</span>
      <span>{uploading ? "ENVOI…" : "FILMER / CHOISIR UNE VIDÉO"}</span>
      <input
        type="file" accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        disabled={uploading}
      />
      {error && <span style={{ color: "#C56A60" }}>{error}</span>}
    </label>
  );
}

/* ───────── Exercise Block ───────── */

export type ExerciseDef = {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  rpe?: string | number;
  tempo?: string | null;
  color?: ExerciseColor;
  starts_at_top?: boolean;
  requires_pelvis_cue?: boolean;
  rest_seconds?: number;
};

export function ExerciseBlock({
  index,
  ex,
  sessionId,
  userId,
  initialSets,
  onSetLogged,
}: {
  index: number;
  ex: ExerciseDef;
  sessionId: string;
  userId: string;
  initialSets?: SetState[];
  onSetLogged?: (set: SetState) => void;
}) {
  const [sets, setSets] = useState<SetState[]>(() =>
    initialSets ??
    Array.from({ length: ex.sets || 3 }, (_, i) => ({
      setNumber: i + 1, weight: "", reps: "", rpe: null, completed: false,
    }))
  );
  const [showColor, setShowColor] = useState(false);
  const [showTempo, setShowTempo] = useState(false);
  const [showRest, setShowRest] = useState<number | null>(null); // index of just-completed set
  const [feedback, setFeedback] = useState<string | null>(null);

  async function validateSet(i: number) {
    const s = sets[i];
    if (!s.weight || !s.reps || s.rpe == null) return;
    const w = parseFloat(s.weight);
    const r = parseInt(s.reps, 10);
    try {
      const { error: insErr } = await supabase.from("set_logs").insert({
        session_id: sessionId,
        exercise_id: ex.id ?? null,
        exercise_name: ex.name,
        set_number: s.setNumber,
        weight_kg: isNaN(w) ? null : w,
        reps: isNaN(r) ? null : r,
        rpe: s.rpe,
        completed: true,
      });
      if (insErr) throw insErr;
    } catch (e) {
      console.error(e);
      return;
    }
    const next = [...sets];
    next[i] = { ...s, completed: true };
    setSets(next);
    onSetLogged?.(next[i]);
    const msg = rpeFeedbackMessage(ex.color, s.rpe, i === sets.length - 1);
    if (msg) setFeedback(msg);
    if (i < sets.length - 1) setShowRest(i);
  }

  const restSec = ex.rest_seconds ?? (ex.color === "red" ? 180 : ex.color === "green" ? 90 : 120);

  return (
    <div className="cst-card-dark cst-hatch" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        {ex.color && <ColorDot color={ex.color} size={12} onClick={() => setShowColor(true)} />}
        <h3 className="cst-display" style={{ margin: 0, fontSize: 17, flex: 1, color: "#fff" }}>
          {ex.name.toUpperCase()}
        </h3>
        {ex.tempo && <TempoBadge tempo={ex.tempo} onClick={() => setShowTempo(true)} />}
      </div>
      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
        {ex.sets}×{ex.reps} {ex.rpe != null && <>@ RPE {ex.rpe}</>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sets.map((s, i) => (
          <SetLogger
            key={i}
            set={s}
            color={ex.color}
            onChange={(ns) => {
              const arr = [...sets];
              arr[i] = ns;
              setSets(arr);
            }}
            onValidate={() => validateSet(i)}
          />
        ))}
      </div>

      {showRest !== null && (
        <RestTimer
          seconds={restSec}
          onDone={() => setShowRest(null)}
          onSkip={() => setShowRest(null)}
        />
      )}

      {feedback && (
        <div style={{ padding: 10, fontSize: 12, lineHeight: 1.5, background: "rgba(212,165,59,0.12)", border: "1px solid rgba(212,165,59,0.3)", borderRadius: 8 }}>
          {feedback}
          <button onClick={() => setFeedback(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 11 }}>×</button>
        </div>
      )}

      <ExerciseThread sessionId={sessionId} exerciseName={ex.name} userId={userId} viewerRole="member" />

      <ColorTooltip color={ex.color} open={showColor} onClose={() => setShowColor(false)} />
      <TempoExplainer
        open={showTempo} onClose={() => setShowTempo(false)}
        tempo={ex.tempo} startsAtTop={ex.starts_at_top ?? true} name={ex.name}
      />
    </div>
  );
}
