import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPainReport } from "@/lib/pain-reports.functions";
import { toast } from "sonner";

const ZONES = [
  "Genou droit", "Genou gauche",
  "Épaule droite", "Épaule gauche",
  "Dos bas", "Dos haut",
  "Hanche", "Poignet", "Coude",
  "Cheville", "Cou", "Autre",
];

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  exerciseName: string;
};

export default function PainReportDialog({ open, onClose, sessionId, exerciseName }: Props) {
  const [zone, setZone] = useState<string>("");
  const [customZone, setCustomZone] = useState("");
  const [intensity, setIntensity] = useState<number>(3);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = useServerFn(createPainReport);

  if (!open) return null;

  const finalZone = zone === "Autre" ? customZone.trim() : zone;

  async function handleSubmit() {
    if (!finalZone) { toast.error("Indique la zone touchée"); return; }
    setSubmitting(true);
    try {
      await submit({ data: { session_id: sessionId, exercise_name: exerciseName, zone: finalZone, intensity, comment: comment.trim() || null } });
      toast.success("Signalement envoyé à ton coach");
      onClose();
      setZone(""); setCustomZone(""); setIntensity(3); setComment("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#1B2E1F", color: "#fff", borderRadius: "16px 16px 0 0", padding: 22, display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>🔴 SIGNALER UNE DOULEUR</div>
        <h2 className="cst-display" style={{ margin: 0, fontSize: 20 }}>{exerciseName.toUpperCase()}</h2>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Ton coach est alerté immédiatement et pourra adapter l'exercice.</p>

        <div>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 8, letterSpacing: "0.15em" }}>ZONE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {ZONES.map((z) => (
              <button key={z} onClick={() => setZone(z)} className="cst-btn cst-btn-sm" style={{ padding: "10px 8px", fontSize: 12, background: zone === z ? "#E07B39" : "rgba(255,255,255,0.06)", color: zone === z ? "#fff" : "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6 }}>{z}</button>
            ))}
          </div>
          {zone === "Autre" && (
            <input value={customZone} onChange={(e) => setCustomZone(e.target.value)} placeholder="Précise la zone" style={{ marginTop: 8, width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", fontSize: 14 }} />
          )}
        </div>

        <div>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 8, letterSpacing: "0.15em" }}>INTENSITÉ · {intensity}/5</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setIntensity(n)} style={{ flex: 1, padding: "14px 0", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: intensity >= n ? (n >= 4 ? "#C0392B" : "#E07B39") : "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 600, fontSize: 16 }}>{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, opacity: 0.5 }}>
            <span>Gêne légère</span><span>Très douloureux</span>
          </div>
        </div>

        <div>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 6, letterSpacing: "0.15em" }}>COMMENTAIRE (optionnel)</div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Quand ça arrive, le mouvement précis…" style={{ width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1, padding: "14px 0" }}>ANNULER</button>
          <button onClick={handleSubmit} disabled={submitting} className="cst-btn" style={{ flex: 2, padding: "14px 0", background: "#C0392B", color: "#fff", fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "ENVOI…" : "ENVOYER AU COACH"}
          </button>
        </div>
      </div>
    </div>
  );
}
