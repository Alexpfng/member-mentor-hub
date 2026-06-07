import { useEffect, useState } from "react";

export type FreeActivityValues = {
  name: string;
  category: string;
  series?: number | null;
  reps?: string | null;
  charge?: string | null;
  distance_km?: number | null;
  duration_min?: number | null;
  elevation_m?: number | null;
  rpe?: number | null;
  note?: string | null;
};

const CATS: { key: string; label: string }[] = [
  { key: "muscu", label: "Muscu" },
  { key: "course", label: "Course" },
  { key: "cardio", label: "Cardio" },
  { key: "sport", label: "Sport" },
  { key: "mobilite", label: "Mobilité" },
  { key: "autre", label: "Autre" },
];

type Props = {
  open: boolean;
  defaultCategory?: string | null;
  initial?: Partial<FreeActivityValues>;
  onClose: () => void;
  onSubmit: (v: FreeActivityValues) => Promise<void> | void;
};

export default function FreeActivityDialog({ open, defaultCategory, initial, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("muscu");
  const [series, setSeries] = useState("");
  const [reps, setReps] = useState("");
  const [charge, setCharge] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [elevation, setElevation] = useState("");
  const [rpe, setRpe] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category || defaultCategory || "muscu");
    setSeries(initial?.series != null ? String(initial.series) : "");
    setReps(initial?.reps ?? "");
    setCharge(initial?.charge ?? "");
    setDistance(initial?.distance_km != null ? String(initial.distance_km) : "");
    setDuration(initial?.duration_min != null ? String(initial.duration_min) : "");
    setElevation(initial?.elevation_m != null ? String(initial.elevation_m) : "");
    setRpe(initial?.rpe != null ? String(initial.rpe) : "");
    setNote(initial?.note ?? "");
  }, [open, initial, defaultCategory]);

  if (!open) return null;

  const numOrNull = (s: string) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || isNaN(n) ? null : n;
  };
  const intOrNull = (s: string) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  };

  async function handle() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        series: intOrNull(series),
        reps: reps.trim() || null,
        charge: charge.trim() || null,
        distance_km: numOrNull(distance),
        duration_min: intOrNull(duration),
        elevation_m: intOrNull(elevation),
        rpe: intOrNull(rpe),
        note: note.trim() || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const isMuscu = category === "muscu";
  const isRun = category === "course";
  const isCardio = category === "cardio";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "#1B2E1F", color: "#fff", borderRadius: "16px 16px 0 0", padding: 22, display: "flex", flexDirection: "column", gap: 12, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.22em" }}>
          + AJOUTER UNE ACTIVITÉ
        </div>

        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Squat hôtel, Footing nature…"
            style={inputStyle}
            autoFocus
          />
        </Field>

        <Field label="Type">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className="cst-btn cst-btn-sm"
                style={{
                  padding: "8px 6px",
                  fontSize: 11,
                  background: category === c.key ? "var(--cst-mid-green)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        {isMuscu && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Field label="Séries">
              <input value={series} onChange={(e) => setSeries(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="4" />
            </Field>
            <Field label="Reps">
              <input value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} placeholder="8" />
            </Field>
            <Field label="Charge">
              <input value={charge} onChange={(e) => setCharge(e.target.value)} style={inputStyle} placeholder="80 kg" />
            </Field>
          </div>
        )}

        {(isRun || isCardio) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {isRun && (
              <Field label="Distance (km)">
                <input value={distance} onChange={(e) => setDistance(e.target.value)} inputMode="decimal" style={inputStyle} placeholder="8" />
              </Field>
            )}
            <Field label="Durée (min)">
              <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="48" />
            </Field>
            {isRun && (
              <Field label="D+ (m)">
                <input value={elevation} onChange={(e) => setElevation(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="120" />
              </Field>
            )}
            {isCardio && (
              <Field label="RPE">
                <input value={rpe} onChange={(e) => setRpe(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="6" />
              </Field>
            )}
          </div>
        )}

        {!isMuscu && !isRun && !isCardio && (
          <Field label="Durée (min)">
            <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="60" />
          </Field>
        )}

        {(isMuscu || isRun) && (
          <Field label="RPE (optionnel)">
            <input value={rpe} onChange={(e) => setRpe(e.target.value)} inputMode="numeric" style={inputStyle} placeholder="7" />
          </Field>
        )}

        <Field label="Note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Détails libres…"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1, padding: "12px 0" }}>
            ANNULER
          </button>
          <button
            type="button"
            disabled={submitting || !name.trim()}
            onClick={handle}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2, padding: "12px 0", opacity: submitting || !name.trim() ? 0.5 : 1 }}
          >
            {submitting ? "AJOUT…" : "AJOUTER ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "#fff",
  fontSize: 14,
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.15em", marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
