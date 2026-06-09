import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { duplicateWeekTo } from "@/lib/weekly-adaptation.functions";

type Progression = "identical" | "plus5_cumulative" | "deload_last";

export default function MultiWeekDuplicateModal({
  weekId,
  currentWeek,
  onClose,
  onCreated,
}: {
  weekId: string;
  currentWeek: number;
  onClose: () => void;
  onCreated: (firstWeekNumber: number, firstWeekId?: string) => void;
}) {
  const dupFn = useServerFn(duplicateWeekTo);
  const choices = [1, 2, 3, 4, 5];
  const [selected, setSelected] = useState<number[]>([1]);
  const [prog, setProg] = useState<Progression>("identical");
  const [busy, setBusy] = useState(false);

  function toggle(offset: number) {
    setSelected((s) => (s.includes(offset) ? s.filter((x) => x !== offset) : [...s, offset].sort((a, b) => a - b)));
  }

  const preview = useMemo(() => {
    return selected.map((off, i) => {
      const target = currentWeek + off;
      let label = "identique";
      if (prog === "plus5_cumulative") label = `+${5 * (i + 1)}% force`;
      if (prog === "deload_last" && i === selected.length - 1) label = "déload −40%";
      return `S${String(target).padStart(2, "0")} · ${label}`;
    });
  }, [selected, currentWeek, prog]);

  async function run() {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const targetWeeks = selected.map((o) => currentWeek + o);
      const r = await dupFn({ data: { weekId, targetWeeks, progression: prog } });
      if (r.created.length === 0) {
        alert("Toutes les semaines ciblées existent déjà.");
      } else {
        onCreated(r.created[0].weekNumber, r.created[0].id);
      }
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 460, padding: 26, borderRadius: 12 }}
      >
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em" }}>DUPLIQUER VERS…</div>
        <h2 className="cst-display" style={{ fontSize: 20, margin: "4px 0 14px" }}>
          À partir de S{String(currentWeek).padStart(2, "0")}
        </h2>

        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.7, marginBottom: 8 }}>SEMAINES À CRÉER</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {choices.map((off) => {
            const active = selected.includes(off);
            const target = currentWeek + off;
            return (
              <button
                key={off}
                onClick={() => toggle(off)}
                className="cst-mono"
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: active ? "1px solid var(--cst-mid-green)" : "1px solid rgba(255,255,255,0.15)",
                  background: active ? "rgba(91,168,90,0.2)" : "transparent",
                  color: "var(--cst-text)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                S{String(target).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.7, marginBottom: 8 }}>PROGRESSION</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {[
            { v: "identical", label: "Identique (copie conforme)" },
            { v: "plus5_cumulative", label: "+5% force cumulatif" },
            { v: "deload_last", label: "Déload −40% sur la dernière" },
          ].map((opt) => (
            <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="radio" checked={prog === opt.v} onChange={() => setProg(opt.v as Progression)} />
              {opt.label}
            </label>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="cst-card-dark" style={{ padding: 12, marginBottom: 16, fontSize: 12 }}>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 6 }}>APERÇU</div>
            {preview.map((p, i) => (
              <div key={i} style={{ padding: "2px 0" }}>• {p}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" disabled={busy}>Annuler</button>
          <button onClick={run} className="cst-btn cst-btn-primary" disabled={selected.length === 0 || busy}>
            {busy ? "Création…" : `Créer ${selected.length} semaine${selected.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
