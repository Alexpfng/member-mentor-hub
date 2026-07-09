/* ColosmartTraining — Séance de course
   Format "consulter → rapporter → résultat", pas de logger exercice par exercice. */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { type ProgExercise } from "./ProgramBlocks";
import { ProgramBlocks } from "./ProgramBlocks";
import { RunStatsCapture } from "./RunStatsCapture";
import { RunComparisonCard } from "./RunComparisonCard";
import { finishRunningSession } from "@/lib/run.functions";
import { formValuesToMetrics, type RunExtraction, type RunMetrics } from "@/lib/run-stats";

const RUNNING_RE = /course|run|endurance|côtes|cotes|fractionn|sortie|footing/i;

export function isRunningSession(label?: string | null, exercises?: ProgExercise[]): boolean {
  if (label && RUNNING_RE.test(label)) return true;
  if (exercises?.length && exercises.every((e) => RUNNING_RE.test(e.name))) return true;
  return false;
}

type Phase = "view" | "report" | "result";

type Report = {
  distanceKm: string;
  durationMin: string;
  elevationM: string;
  avgHr: string;
  pace: string;
  rpe: number | null;
  note: string;
  feeling: number | null;
};

type Props = {
  sessionId: string;
  userId: string;
  sessionLabel?: string | null;
  exercises: ProgExercise[];
  onFinish: () => void | Promise<void>;
  finishing?: boolean;
};

export function RunningSession({
  sessionId,
  userId,
  sessionLabel,
  exercises,
  onFinish,
  finishing,
}: Props) {
  const finishRun = useServerFn(finishRunningSession);
  const [phase, setPhase] = useState<Phase>("view");
  const [report, setReport] = useState<Report>({
    distanceKm: "",
    durationMin: "",
    elevationM: "",
    avgHr: "",
    pace: "",
    rpe: null,
    note: "",
    feeling: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaNames, setMediaNames] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Provenance des stats (pour run_stats) + résultat de la comparaison instantanée.
  const [source, setSource] = useState<"manual" | "screenshot">("manual");
  const [screenshotMediaId, setScreenshotMediaId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [rawExtraction, setRawExtraction] = useState<RunExtraction | null>(null);
  const [comparison, setComparison] = useState<{
    previous: RunMetrics | null;
    current: RunMetrics;
  } | null>(null);

  const set = <K extends keyof Report>(k: K, v: Report[K]) => setReport((r) => ({ ...r, [k]: v }));

  async function handleMedia(files: FileList | null) {
    if (!files?.length) return;
    setMediaUploading(true);
    const names: string[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "bin").toLowerCase();
      const path = `${userId}/${sessionId}/run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("session-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!error) {
        await supabase
          .from("session_media")
          .insert({
            session_id: sessionId,
            member_id: userId,
            type: isVideo ? "video" : "photo",
            storage_path: path,
            caption: "[SESSION]",
          });
        names.push(file.name);
      }
    }
    setMediaNames((prev) => [...prev, ...names]);
    setMediaUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const metrics = formValuesToMetrics({
        distanceKm: report.distanceKm,
        durationMin: report.durationMin,
        elevationM: report.elevationM,
        avgHr: report.avgHr,
        pace: report.pace,
        rpe: report.rpe,
      });
      const res = await finishRun({
        data: {
          sessionId,
          metrics,
          feeling: report.feeling,
          note: report.note || null,
          source,
          confidence,
          screenshotMediaId,
          rawExtraction: rawExtraction ?? undefined,
        },
      });
      setComparison({ previous: res.previous, current: res.current });
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--cst-dark-green)",
    color: "#fff",
  };

  if (phase === "view") {
    return (
      <div style={shellStyle}>
        <div
          style={{
            padding: "22px 22px 8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            className="cst-mono"
            style={{ fontSize: 9, letterSpacing: "0.22em", opacity: 0.55 }}
          >
            🏃 SÉANCE COURSE
          </span>
        </div>
        <div
          style={{
            padding: "0 22px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            overflowY: "auto",
          }}
        >
          <div>
            <h1 className="cst-display" style={{ fontSize: 28, margin: 0, lineHeight: 1.1 }}>
              {(sessionLabel || "Séance course").toUpperCase()}
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
              Consulte ton programme, puis reviens ici après ta course pour enregistrer tes stats.
            </p>
          </div>

          {exercises.length > 0 && (
            <div className="cst-card-dark" style={{ padding: 16, borderRadius: 10 }}>
              <div
                className="cst-mono"
                style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em", marginBottom: 10 }}
              >
                PROGRAMME DE LA SÉANCE
              </div>
              <ProgramBlocks exercises={exercises} />
            </div>
          )}

          <div style={{ flex: 1 }} />
          <button
            onClick={() => setPhase("report")}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14, marginBottom: 24 }}
          >
            J'AI FAIT MA COURSE — RAPPORTER →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result" && comparison) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: "22px 22px 8px" }}>
          <span
            className="cst-mono"
            style={{ fontSize: 9, letterSpacing: "0.22em", opacity: 0.55 }}
          >
            ✓ COURSE ENREGISTRÉE
          </span>
        </div>
        <div
          style={{
            padding: "0 22px 32px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
        >
          <h1 className="cst-display" style={{ fontSize: 26, margin: 0, lineHeight: 1.1 }}>
            BEAU BOULOT 👏
          </h1>
          <RunComparisonCard previous={comparison.previous} current={comparison.current} />
          <div
            className="cst-card-dark"
            style={{ padding: 14, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}
          >
            💬 Léo va analyser ta course et te laisser un retour perso. Tu le retrouveras sur ta
            séance.
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => onFinish()}
            className="cst-btn cst-btn-primary"
            style={{ width: "100%", padding: "18px 0", fontSize: 14 }}
          >
            TERMINÉ →
          </button>
        </div>
      </div>
    );
  }

  // Report phase
  return (
    <div style={shellStyle}>
      <div style={{ padding: "22px 22px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setPhase("view")}
          className="cst-mono"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.85)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <span className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.22em", opacity: 0.55 }}>
          RAPPORTE TA COURSE
        </span>
      </div>

      <div
        style={{
          padding: "0 22px 32px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
        }}
      >
        <RunStatsCapture
          sessionId={sessionId}
          userId={userId}
          disabled={submitting}
          onExtracted={(form, meta) => {
            setReport((r) => ({
              ...r,
              distanceKm: form.distanceKm || r.distanceKm,
              durationMin: form.durationMin || r.durationMin,
              elevationM: form.elevationM || r.elevationM,
              avgHr: form.avgHr || r.avgHr,
              pace: form.pace || r.pace,
            }));
            setSource("screenshot");
            setScreenshotMediaId(meta.screenshotMediaId);
            setConfidence(meta.confidence);
            setRawExtraction(meta.raw);
          }}
        />

        <div
          className="cst-mono"
          style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em", marginTop: 4 }}
        >
          STATS DEPUIS TA MONTRE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <RunInput
            label="Distance (km)"
            value={report.distanceKm}
            onChange={(v) => set("distanceKm", v)}
            placeholder="8,2"
          />
          <RunInput
            label="Durée (min)"
            value={report.durationMin}
            onChange={(v) => set("durationMin", v)}
            placeholder="48"
          />
          <RunInput
            label="Dénivelé D+ (m)"
            value={report.elevationM}
            onChange={(v) => set("elevationM", v)}
            placeholder="120"
          />
          <RunInput
            label="FC moyenne (bpm)"
            value={report.avgHr}
            onChange={(v) => set("avgHr", v)}
            placeholder="142"
          />
          <RunInput
            label="Allure (/km)"
            value={report.pace}
            onChange={(v) => set("pace", v)}
            placeholder="5:50"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>
            RPE GLOBAL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
              const on = report.rpe === v;
              const hue = v >= 9 ? "#C9483A" : v >= 7 ? "#D4A53B" : "#3A8A4D";
              return (
                <button
                  key={v}
                  onClick={() => set("rpe", v)}
                  className="cst-mono"
                  style={{
                    padding: "10px 0",
                    borderRadius: 6,
                    border: `1px solid ${on ? hue : "rgba(255,255,255,0.12)"}`,
                    background: on ? `${hue}33` : "transparent",
                    color: on ? "#fff" : "rgba(255,255,255,0.7)",
                    fontSize: 14,
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

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>
            RESSENTI
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              ["😴", "1"],
              ["🙂", "2"],
              ["⚡", "3"],
              ["🔥", "4"],
              ["💪", "5"],
            ].map(([emoji, val]) => (
              <button
                key={val}
                onClick={() => set("feeling", parseInt(val))}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 20,
                  borderRadius: 8,
                  border: `1px solid ${report.feeling === parseInt(val) ? "#3A8A4D" : "rgba(255,255,255,0.12)"}`,
                  background:
                    report.feeling === parseInt(val) ? "rgba(45,90,53,0.3)" : "transparent",
                  cursor: "pointer",
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>
            NOTE POUR LE COACH
          </div>
          <textarea
            value={report.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Sensation, terrain, ressenti génou…"
            rows={3}
            className="cst-input"
            style={{ padding: "12px", fontSize: 13, resize: "none", lineHeight: 1.5 }}
          />
        </div>

        <div
          style={{
            padding: "14px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            className="cst-mono"
            style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.18em" }}
          >
            📷 PHOTOS / 🎥 VIDÉOS
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
            Photo du parcours, vidéo… Ouvre la galerie — pas de caméra en direct.
          </div>
          {mediaNames.map((n, i) => (
            <div
              key={i}
              className="cst-mono"
              style={{
                fontSize: 10,
                opacity: 0.8,
                padding: "3px 8px",
                background: "rgba(45,90,53,0.18)",
                borderRadius: 4,
              }}
            >
              ✓ {n}
            </div>
          ))}
          {mediaUploading && (
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              Envoi en cours…
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={mediaUploading}
            className="cst-btn cst-btn-ghost-dark"
            style={{ fontSize: 12, padding: "10px 0" }}
          >
            + IMPORTER UN FICHIER
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleMedia(e.target.files)}
          />
        </div>

        {error && (
          <div
            className="cst-mono"
            style={{
              fontSize: 11,
              color: "#E0857B",
              padding: "8px 12px",
              background: "rgba(224,133,123,0.12)",
              borderRadius: 6,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || finishing}
          className="cst-btn cst-btn-primary"
          style={{ width: "100%", padding: "18px 0", fontSize: 14 }}
        >
          {submitting || finishing ? "ENVOI…" : "ENVOYER À LÉO ET TERMINER →"}
        </button>
      </div>
    </div>
  );
}

function RunInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.14em" }}>
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="cst-input"
        style={{ padding: "12px", fontSize: 18, textAlign: "center" }}
      />
    </label>
  );
}
