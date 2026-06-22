import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExercises } from "@/lib/exercises.functions";
import { replaceExercise } from "@/lib/weekly-adaptation.functions";

type Exercise = {
  id: string;
  name: string;
  color: string | null;
  muscle_group: string | null;
  equipement: string | null;
  movement_patterns: string[] | null;
  is_archived?: boolean | null;
  youtube_url?: string | null;
};

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function ReplaceExerciseModal({
  weekId,
  dayIndex,
  exoIndex,
  currentName,
  currentPatterns,
  currentMuscleGroup,
  onClose,
  onReplaced,
}: {
  weekId: string;
  dayIndex: number;
  exoIndex: number;
  currentName: string;
  currentPatterns?: string[] | null;
  currentMuscleGroup?: string | null;
  onClose: () => void;
  onReplaced: (newStructure: unknown) => void;
}) {
  const listFn = useServerFn(listExercises);
  const replaceFn = useServerFn(replaceExercise);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [matchPattern, setMatchPattern] = useState(true);
  const [matchMuscle, setMatchMuscle] = useState(false);
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const overlayDownRef = useRef(false); // ferme seulement si clic commencé ET fini sur le fond

  useEffect(() => {
    listFn()
      .then((r) => setExercises((r.exercises ?? []).filter((e: Exercise) => !e.is_archived)))
      .finally(() => setLoading(false));
  }, [listFn]);

  const patterns = useMemo(() => currentPatterns ?? [], [currentPatterns]);

  const filtered = useMemo(() => {
    const q = norm(query);
    return exercises
      .filter((e) => norm(e.name) !== norm(currentName))
      .filter((e) => {
        if (matchPattern && patterns.length > 0) {
          const ep = e.movement_patterns ?? [];
          if (!ep.some((p) => patterns.includes(p))) return false;
        }
        if (matchMuscle && currentMuscleGroup) {
          if (norm(e.muscle_group) !== norm(currentMuscleGroup)) return false;
        }
        if (q && !norm(e.name).includes(q)) return false;
        return true;
      })
      .slice(0, 80);
  }, [exercises, query, matchPattern, matchMuscle, patterns, currentMuscleGroup, currentName]);

  async function doReplace() {
    if (!picked) return;
    setBusy(true);
    try {
      const r = await replaceFn({
        data: { weekId, dayIndex, exoIndex, newExerciseId: picked.id, memberNote: note || undefined },
      });
      onReplaced(r.structure);
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onMouseDown={(e) => { overlayDownRef.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (overlayDownRef.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 560, maxHeight: "88vh", overflow: "auto", padding: 24, borderRadius: 12 }}
      >
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>REMPLACER</div>
        <h2 className="cst-display" style={{ fontSize: 20, margin: "4px 0 14px" }}>« {currentName} » par…</h2>

        <input
          autoFocus
          placeholder="Chercher un exercice…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="cst-input"
          style={{ width: "100%", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, fontSize: 12 }}>
          {patterns.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={matchPattern} onChange={(e) => setMatchPattern(e.target.checked)} />
              Même pattern ({patterns.join(", ")})
            </label>
          )}
          {currentMuscleGroup && (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={matchMuscle} onChange={(e) => setMatchMuscle(e.target.checked)} />
              Même groupe ({currentMuscleGroup})
            </label>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, maxHeight: 280, overflow: "auto", marginBottom: 14 }}>
          {loading ? (
            <div style={{ padding: 14, opacity: 0.6, fontSize: 12 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14, opacity: 0.6, fontSize: 12 }}>Aucun exercice — élargis les filtres.</div>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setPicked(e)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: picked?.id === e.id ? "rgba(91,168,90,0.18)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  color: "var(--cst-text)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
                  {[e.muscle_group, e.equipement, (e.movement_patterns ?? []).join("/")].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))
          )}
        </div>

        {picked && (
          <div style={{ marginBottom: 14 }}>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>NOTE POUR LE MEMBRE (optionnelle)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="cst-input"
              style={{ width: "100%" }}
              placeholder={`Pourquoi ce changement ? (ex: alternative sans douleur épaule)`}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" disabled={busy}>Annuler</button>
          <button onClick={doReplace} className="cst-btn cst-btn-primary" disabled={!picked || busy}>
            {busy ? "Remplacement…" : "Remplacer"}
          </button>
        </div>
      </div>
    </div>
  );
}
