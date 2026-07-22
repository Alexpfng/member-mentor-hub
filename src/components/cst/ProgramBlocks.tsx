import { useState } from "react";
import { parseRpeCell } from "@/lib/rpe-cell";

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
  film_requested?: boolean | null;
  youtube_url?: string | null;
  youtube_id?: string | null;
  youtube_alt_url?: string | null;
  image_url?: string | null;
};

const COLOR_MAP: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  lime: "#E8D44A",
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

/** Charges au poids du corps (raccourcis coach / imports) → affichées « PDC », jamais suffixées « kg ». */
export const BW_CHARGE = /^(pdc|bb|bw|poids du corps|pds de corps|corps|bodyweight|[-—/])$/i;
export function fmtCharge(charge?: string | null): string {
  const c = String(charge ?? "").trim();
  if (!c) return "—";
  if (BW_CHARGE.test(c)) return "PDC";
  return /^[\d.,]+$/.test(c) ? `${val(c)}kg` : c; // "kg" uniquement si numérique
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
    const letter = ex.code?.match(/^([A-Z])/)?.[1];
    const hasNumber = /^[A-Z]\d/.test(ex.code || "");
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

function isCardioExercise(ex: ProgExercise): boolean {
  if (ex.block_type === "cardio") return true;
  // Consigne texte libre = cardio. « 10 (10kg trop lourd) » est un RPE + commentaire,
  // pas une consigne → parseRpeCell.consigne est null, donc pas classé cardio à tort.
  const consigne = parseRpeCell(ex.rpe_target).consigne;
  return !!(consigne && consigne.length > 3);
}

function cardioConsignes(ex: ProgExercise): string | null {
  return parseRpeCell(ex.rpe_target).consigne;
}

/** Carte cardio fusionnée : tous les blocs cardio consécutifs en une seule carte. */
function MergedCardioRow({
  exercises,
  threadSlot,
  onExerciseClick,
}: {
  exercises: ProgExercise[];
  threadSlot?: (ex: ProgExercise) => React.ReactNode;
  onExerciseClick?: (ex: ProgExercise) => void;
}) {
  const main = exercises[0];
  const col = exCardColor(main.color);

  // Sections : première sans titre, suivantes avec le nom de l'exercice comme sous-titre
  type Section = { title: string | null; consignes: string | null; notes: string | null };
  const sections: Section[] = [
    { title: null, consignes: cardioConsignes(main), notes: main.coach_notes ?? null },
    ...exercises.slice(1).map((ex) => ({
      title: ex.name ?? null,
      consignes: cardioConsignes(ex),
      notes: ex.coach_notes ?? null,
    })),
  ];

  const hasContent = sections.some((s) => s.consignes || s.notes || (s.title && s.title.trim()));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        gap: 8,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        ...(col ? { borderLeft: `3px solid ${col}`, background: `${col}0a` } : {}),
      }}
    >
      {/* Nom + bouton */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {colorDot(main.color)}
        {main.code && (
          <span className="cst-mono" style={{ fontSize: 11, opacity: 0.7, minWidth: 24 }}>
            {main.code}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{main.name}</span>
        <YouTubeButton id={main.youtube_id} url={main.youtube_url} />
        {onExerciseClick && (
          <button
            onClick={() => onExerciseClick(main)}
            style={{
              background: "var(--cst-mid-green)",
              border: "none",
              color: "#fff",
              fontFamily: "var(--cst-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              padding: "5px 9px",
              borderRadius: 6,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ALLER →
          </button>
        )}
      </div>
      {/* Métriques du premier exercice */}
      <div
        className="cst-mono"
        style={{ fontSize: 11, opacity: 0.85, display: "flex", gap: 16, flexWrap: "wrap" }}
      >
        {main.tempo && (
          <span>
            <span style={{ opacity: 0.5 }}>DURÉE </span>
            {val(main.tempo)}
          </span>
        )}
        {main.charge && (
          <span>
            <span style={{ opacity: 0.5 }}>INTENSITÉ </span>
            {fmtCharge(main.charge)}
          </span>
        )}
        {main.reps && (
          <span>
            <span style={{ opacity: 0.5 }}>FRÉQUENCE </span>
            {val(main.reps)}
          </span>
        )}
        {main.recup && (
          <span>
            <span style={{ opacity: 0.5 }}>RÉCUP </span>
            {val(main.recup)}
          </span>
        )}
      </div>
      {/* Bloc OBJECTIF / CONSIGNES fusionné */}
      {hasContent && (
        <div
          style={{
            background: "rgba(45,90,53,0.10)",
            border: "1px solid rgba(45,90,53,0.25)",
            borderLeft: "3px solid var(--cst-mid-green)",
            borderRadius: 4,
            padding: "8px 12px",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6, letterSpacing: "0.14em" }}>
            OBJECTIF / CONSIGNES
          </span>
          {sections.map((s, i) =>
            s.title || s.consignes || s.notes ? (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {s.title && i > 0 && (
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      opacity: 0.9,
                      marginTop: i > 0 ? 4 : 0,
                    }}
                  >
                    {s.title}
                  </div>
                )}
                {s.consignes && <div style={{ whiteSpace: "pre-wrap" }}>{s.consignes}</div>}
                {s.notes && (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      fontStyle: "italic",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {s.notes}
                  </div>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}
      {threadSlot && threadSlot(main)}
    </div>
  );
}

const EXERCISE_COLOR_MAP: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  lime: "#E8D44A",
  blue: "#4A8BC4",
};
function exCardColor(c?: string | null): string {
  return EXERCISE_COLOR_MAP[(c || "").toLowerCase()] || "";
}

function ExerciseRow({
  ex,
  threadSlot,
  onExerciseClick,
}: {
  ex: ProgExercise;
  threadSlot?: (ex: ProgExercise) => React.ReactNode;
  onExerciseClick?: (ex: ProgExercise) => void;
}) {
  if (isCardioExercise(ex)) {
    return (
      <MergedCardioRow exercises={[ex]} threadSlot={threadSlot} onExerciseClick={onExerciseClick} />
    );
  }
  const col = exCardColor(ex.color);
  // « 10 (10kg trop lourd) » → RPE 10 dans la case RPE + commentaire sur sa ligne dédiée.
  const parsedRpe = parseRpeCell(ex.rpe_target);
  const rpeCellDisplay = parsedRpe.rpe != null ? parsedRpe.rpe.replace(".", ",") : parsedRpe.isFailure ? "échec" : "—";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        gap: 6,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        ...(col ? { borderLeft: `3px solid ${col}`, background: `${col}0a` } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {colorDot(ex.color)}
        {ex.code && (
          <span className="cst-mono" style={{ fontSize: 11, opacity: 0.7, minWidth: 24 }}>
            {ex.code}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{ex.name}</span>
        <YouTubeButton id={ex.youtube_id} url={ex.youtube_url} />
        {onExerciseClick && (
          <button
            onClick={() => onExerciseClick(ex)}
            style={{
              background: "var(--cst-mid-green)",
              border: "none",
              color: "#fff",
              fontFamily: "var(--cst-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              padding: "5px 9px",
              borderRadius: 6,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ALLER →
          </button>
        )}
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
        <span>
          <span style={{ opacity: 0.5 }}>SÉRIES </span>
          {val(ex.series)}
        </span>
        <span>
          <span style={{ opacity: 0.5 }}>REPS </span>
          {val(ex.reps)}
        </span>
        <span>
          <span style={{ opacity: 0.5 }}>CHARGE </span>
          {fmtCharge(ex.charge)}
        </span>
        <span>
          <span style={{ opacity: 0.5 }}>TEMPO </span>
          {val(ex.tempo)}
        </span>
        <span>
          <span style={{ opacity: 0.5 }}>RÉCUP </span>
          {val(ex.recup)}
        </span>
        <span>
          <span style={{ opacity: 0.5 }}>RPE </span>
          {rpeCellDisplay}
        </span>
      </div>
      {parsedRpe.comment && (
        <div
          className="cst-mono"
          style={{ fontSize: 11, display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", opacity: 0.9 }}
        >
          <span style={{ opacity: 0.55, letterSpacing: "0.06em" }}>RPE ·</span>
          <span style={{ fontStyle: "italic" }}>{parsedRpe.comment}</span>
        </div>
      )}
      {ex.coach_notes && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.75,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
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

/** Fusionne les blocs cardio consécutifs en un seul bloc pour l'affichage. */
function mergeCardioBlocks(blocks: Block[]): Array<Block & { mergedCardio?: boolean }> {
  const result: Array<Block & { mergedCardio?: boolean }> = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.exercises.length > 0 && block.exercises.every(isCardioExercise)) {
      // Absorbe tous les blocs cardio consécutifs
      const mergedExercises = [...block.exercises];
      while (i + 1 < blocks.length && blocks[i + 1].exercises.every(isCardioExercise)) {
        i++;
        mergedExercises.push(...blocks[i].exercises);
      }
      result.push({
        letter: block.letter,
        exercises: mergedExercises,
        isSuperset: false,
        mergedCardio: true,
      });
    } else {
      result.push(block);
    }
    i++;
  }
  return result;
}

export function ProgramBlocks({
  exercises,
  threadSlot,
  onExerciseClick,
}: {
  exercises: ProgExercise[];
  threadSlot?: (ex: ProgExercise) => React.ReactNode;
  onExerciseClick?: (ex: ProgExercise) => void;
}) {
  const blocks = mergeCardioBlocks(groupBlocks(exercises || []));
  if (blocks.length === 0) {
    return <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>Aucun exercice.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((b, i) => {
        // Bloc cardio fusionné → une seule carte
        if (b.mergedCardio) {
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
              <MergedCardioRow
                exercises={b.exercises}
                threadSlot={threadSlot}
                onExerciseClick={onExerciseClick}
              />
            </div>
          );
        }

        const firstType = b.exercises[0]?.block_type;
        const badge = blockBadge(firstType) ?? (b.isSuperset ? "SUPERSET" : null);
        const supersetRest = b.isSuperset
          ? ([...b.exercises]
              .reverse()
              .map((e) => e.recup)
              .find((r) => r != null && String(r).trim() !== "") ?? null)
          : null;
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
              <ExerciseRow
                key={j}
                ex={ex}
                threadSlot={threadSlot}
                onExerciseClick={onExerciseClick}
              />
            ))}
            {b.isSuperset && (
              <div
                className="cst-mono"
                style={{
                  fontSize: 11,
                  color: "var(--cst-text-muted)",
                  padding: "8px 12px",
                  background: "rgba(45,90,53,0.06)",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                ↻ Enchaîner sans repos entre les exercices
                {supersetRest ? ` · récup ${val(supersetRest)} après le tour` : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
