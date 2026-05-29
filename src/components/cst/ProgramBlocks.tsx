import { useState } from "react";

export type ProgExercise = {
  code?: string | null;
  name: string;
  block_type?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
  color?: string | null;
  coach_notes?: string | null;
  youtube_url?: string | null;
  youtube_id?: string | null;
  youtube_alt_url?: string | null;
};

const COLOR_MAP: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  blue: "#4A8BC4",
};

function colorDot(c?: string | null) {
  const col = COLOR_MAP[(c || "").toLowerCase()] || "#666";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: col,
        flex: "0 0 10px",
      }}
    />
  );
}

function val(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  // Pretty up "2.0" -> "2"
  if (/^\d+\.0+$/.test(s)) return s.split(".")[0];
  return s;
}

function blockBadge(type?: string | null): string | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === "standard") return null;
  if (t === "superset") return "SUPERSET";
  if (t === "emom") return "EMOM";
  if (t === "ladder") return "LADDER";
  if (t === "amrap") return "AMRAP";
  if (t === "dropset") return "DROPSET";
  if (t === "iso") return "ISO";
  if (t === "circuit") return "CIRCUIT";
  return type.toUpperCase();
}

type Block = {
  letter: string | undefined;
  exercises: ProgExercise[];
  isSuperset: boolean;
};

export function groupBlocks(exercises: ProgExercise[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const ex of exercises) {
    const letter = ex.code?.match(/^([A-H])/)?.[1];
    const hasNumber = /^[A-H]\d/.test(ex.code || "");
    if (!current || current.letter !== letter || !letter) {
      current = { letter, exercises: [ex], isSuperset: hasNumber };
      blocks.push(current);
    } else {
      current.exercises.push(ex);
      current.isSuperset = true;
    }
  }
  return blocks;
}

function YouTubeButton({ id, url }: { id?: string | null; url?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!id && !url) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "var(--cst-mono)",
          fontSize: 10,
          padding: "4px 8px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        ▶ DÉMO
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 100%)",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {id ? (
              <iframe
                src={`https://www.youtube.com/embed/${id}?autoplay=1`}
                title="Démo"
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <a href={url || "#"} target="_blank" rel="noreferrer" style={{ color: "#fff" }}>
                Ouvrir la vidéo
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ExerciseRow({ ex, threadSlot }: { ex: ProgExercise; threadSlot?: (ex: ProgExercise) => React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        gap: 6,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {colorDot(ex.color)}
        {ex.code && (
          <span
            className="cst-mono"
            style={{ fontSize: 11, opacity: 0.7, minWidth: 24 }}
          >
            {ex.code}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{ex.name}</span>
        <YouTubeButton id={ex.youtube_id} url={ex.youtube_url} />
      </div>
      <div
        className="cst-mono"
        style={{
          fontSize: 11,
          opacity: 0.85,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "4px 12px",
        }}
      >
        <span><span style={{ opacity: 0.5 }}>SÉRIES </span>{val(ex.series)}</span>
        <span><span style={{ opacity: 0.5 }}>REPS </span>{val(ex.reps)}</span>
        <span><span style={{ opacity: 0.5 }}>CHARGE </span>{val(ex.charge)}</span>
        <span><span style={{ opacity: 0.5 }}>TEMPO </span>{val(ex.tempo)}</span>
        <span><span style={{ opacity: 0.5 }}>RÉCUP </span>{val(ex.recup)}</span>
        <span><span style={{ opacity: 0.5 }}>RPE </span>{val(ex.rpe_target)}</span>
      </div>
      {ex.coach_notes && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.75,
            fontStyle: "italic",
            background: "rgba(45,90,53,0.08)",
            borderLeft: "2px solid var(--cst-mid-green)",
            padding: "6px 10px",
            borderRadius: 3,
          }}
        >
          {ex.coach_notes}
        </div>
      )}
      {threadSlot && threadSlot(ex)}
    </div>
  );
}

export function ProgramBlocks({
  exercises,
  threadSlot,
}: {
  exercises: ProgExercise[];
  threadSlot?: (ex: ProgExercise) => React.ReactNode;
}) {
  const blocks = groupBlocks(exercises || []);
  if (blocks.length === 0) {
    return (
      <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>Aucun exercice.</div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((b, i) => {
        const firstType = b.exercises[0]?.block_type;
        const badge = b.isSuperset && firstType !== "emom" ? "SUPERSET" : blockBadge(firstType);
        return (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {badge && (
              <div
                className="cst-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "var(--cst-mid-green)",
                  padding: "6px 12px",
                  background: "rgba(45,90,53,0.12)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                ★ {b.letter || ""} · {badge}
              </div>
            )}
            {b.exercises.map((ex, j) => (
              <ExerciseRow key={j} ex={ex} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
