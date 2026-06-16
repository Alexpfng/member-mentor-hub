import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import MemberNav from "../../components/MemberNav";
import { listLibraryForMember } from "@/lib/member-stats.functions";
import { createComposedSession } from "@/lib/composed-session.functions";

type Ex = {
  id: string;
  name: string;
  muscle_group: string | null;
  color: string | null;
  default_tempo: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
};

type SetRow = { reps: string; charge: string };

type Picked = {
  uid: string;
  name: string;
  color: string | null;
  tempo: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  sets: SetRow[];
  rpe_target: string;
};

const COLOR_MAP: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  lime: "#E8D44A",
  blue: "#4A8BC4",
};
const accentOf = (c: string | null) => COLOR_MAP[(c || "").toLowerCase()] || "var(--cst-mid-green)";

let uidSeq = 0;
const nextUid = () => `p${Date.now()}_${uidSeq++}`;

export default function Composer() {
  const fetchLib = useServerFn(listLibraryForMember);
  const createSession = useServerFn(createComposedSession);
  const navigate = useNavigate();

  const [items, setItems] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tout");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = (await fetchLib()) as { exercises: Ex[] };
        setItems(r.exercises ?? []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [fetchLib]);

  const groupsList = useMemo(() => {
    const set = new Set<string>();
    for (const e of items) set.add(e.muscle_group?.trim() || "Autres");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      const grp = e.muscle_group?.trim() || "Autres";
      if (filter !== "Tout" && grp !== filter) return false;
      if (q && !e.name.toLowerCase().includes(q) && !grp.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter]);

  const addExercise = (ex: Ex) => {
    setPicked((p) => [
      ...p,
      {
        uid: nextUid(),
        name: ex.name,
        color: ex.color,
        tempo: ex.default_tempo,
        youtube_url: ex.youtube_url,
        youtube_id: ex.youtube_id,
        sets: [
          { reps: "8-12", charge: "" },
          { reps: "8-12", charge: "" },
          { reps: "8-12", charge: "" },
        ],
        rpe_target: "",
      },
    ]);
  };

  const updatePicked = (uid: string, patch: Partial<Picked>) =>
    setPicked((p) => p.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));

  const removePicked = (uid: string) => setPicked((p) => p.filter((x) => x.uid !== uid));

  const addSet = (uid: string) =>
    setPicked((p) => p.map((x) => x.uid === uid ? { ...x, sets: [...x.sets, { reps: "", charge: "" }] } : x));

  const removeSet = (uid: string, idx: number) =>
    setPicked((p) => p.map((x) => x.uid === uid && x.sets.length > 1 ? { ...x, sets: x.sets.filter((_, i) => i !== idx) } : x));

  const updateSet = (uid: string, idx: number, patch: Partial<SetRow>) =>
    setPicked((p) => p.map((x) => x.uid === uid ? { ...x, sets: x.sets.map((s, i) => i === idx ? { ...s, ...patch } : s) } : x));

  const move = (uid: string, dir: -1 | 1) =>
    setPicked((p) => {
      const i = p.findIndex((x) => x.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const start = async () => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      const exercises = picked.map((p) => ({
        name: p.name,
        color: p.color,
        series: String(p.sets.length),
        reps: p.sets.map((s) => s.reps || "—").join(" / "),
        charge: p.sets.map((s) => s.charge || "PDC").join(" / "),
        tempo: p.tempo || null,
        rpe_target: p.rpe_target.trim() || null,
        youtube_url: p.youtube_url || null,
        youtube_id: p.youtube_id || null,
      }));
      const r = (await createSession({ data: { title: title.trim() || null, exercises } })) as {
        sessionId: string;
      };
      navigate({ to: "/membre/seance/$sessionId", params: { sessionId: r.sessionId } });
    } catch (err) {
      console.error("[composer]", err);
      toast.error("Impossible de créer la séance. Réessaie.");
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "18px 22px 8px" }}>
            <button
              onClick={() => navigate({ to: "/membre" })}
              className="cst-mono"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", letterSpacing: "0.12em" }}
            >
              ← RETOUR
            </button>
            <h1 className="cst-display" style={{ fontSize: 26, margin: "12px 0 0", color: "#fff" }}>
              CRÉER MA <span style={{ color: "var(--cst-mid-green)" }}>SÉANCE</span>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.7 }}>
              Pioche tes exercices dans la bibliothèque et fixe tes cibles, puis lance ta séance.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de ma séance (optionnel)"
              className="cst-input"
              style={{ width: "100%", marginTop: 12, padding: "10px 12px", fontSize: 14 }}
            />
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "8px 22px 96px" }}>
            {/* Sélection */}
            <div style={{ marginBottom: 8 }}>
              <span className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.2em", opacity: 0.6 }}>
                MA SÉANCE · {picked.length} EXERCICE{picked.length > 1 ? "S" : ""}
              </span>
            </div>
            {picked.length === 0 ? (
              <div className="cst-card-dark" style={{ padding: 18, textAlign: "center", fontSize: 13, opacity: 0.6, marginBottom: 18 }}>
                Aucun exercice pour l'instant. Ajoute-en depuis la bibliothèque ci-dessous.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {picked.map((p, idx) => (
                  <div key={p.uid} className="cst-card-dark" style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: accentOf(p.color), flex: "0 0 10px" }} />
                      <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{p.name}</span>
                      <button onClick={() => move(p.uid, -1)} disabled={idx === 0} title="Monter" style={iconBtn(idx === 0)}>↑</button>
                      <button onClick={() => move(p.uid, 1)} disabled={idx === picked.length - 1} title="Descendre" style={iconBtn(idx === picked.length - 1)}>↓</button>
                      <button onClick={() => removePicked(p.uid)} title="Retirer" style={{ ...iconBtn(false), color: "rgba(255,120,120,0.8)" }}>✕</button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 24px", gap: 4, marginBottom: 4 }}>
                        <span />
                        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45, letterSpacing: "0.12em" }}>REPS</span>
                        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45, letterSpacing: "0.12em" }}>KG / PDC</span>
                        <span />
                      </div>
                      {p.sets.map((s, si) => (
                        <div key={si} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 24px", gap: 4, marginBottom: 4, alignItems: "center" }}>
                          <span className="cst-mono" style={{ fontSize: 10, opacity: 0.4, textAlign: "center" }}>S{si + 1}</span>
                          <input
                            className="cst-input"
                            value={s.reps}
                            onChange={(e) => updateSet(p.uid, si, { reps: e.target.value })}
                            placeholder="8-12"
                            style={{ padding: "6px 8px", fontSize: 13 }}
                          />
                          <input
                            className="cst-input"
                            value={s.charge}
                            onChange={(e) => updateSet(p.uid, si, { charge: e.target.value })}
                            placeholder="PDC / kg"
                            style={{ padding: "6px 8px", fontSize: 13 }}
                          />
                          {p.sets.length > 1 ? (
                            <button onClick={() => removeSet(p.uid, si)} style={{ background: "transparent", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                          ) : <span />}
                        </div>
                      ))}
                      <button
                        onClick={() => addSet(p.uid)}
                        className="cst-mono"
                        style={{ marginTop: 4, background: "transparent", border: "1px dashed rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.45)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", width: "100%", letterSpacing: "0.1em" }}
                      >
                        + SÉRIE
                      </button>
                      <div style={{ marginTop: 8 }}>
                        <Field label="RPE CIBLE" value={p.rpe_target} onChange={(v) => updatePicked(p.uid, { rpe_target: v })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bibliothèque */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0 14px" }} />
            <span className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.2em", opacity: 0.6 }}>
              AJOUTER DEPUIS LA BIBLIOTHÈQUE
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Rechercher un exercice…"
              className="cst-input"
              style={{ width: "100%", margin: "10px 0", padding: "10px 12px", fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {["Tout", ...groupsList].map((g) => {
                const on = filter === g;
                return (
                  <button
                    key={g}
                    onClick={() => setFilter(g)}
                    className="cst-mono"
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--cst-mid-green)" : "rgba(255,255,255,0.15)"}`,
                      background: on ? "var(--cst-mid-green)" : "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div style={{ padding: 24, opacity: 0.6 }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, opacity: 0.6, fontSize: 13 }}>Aucun exercice trouvé.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: accentOf(ex.color), flex: "0 0 9px" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</span>
                    <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45 }}>{(ex.muscle_group || "").toUpperCase()}</span>
                    <span style={{ color: "var(--cst-mid-green)", fontSize: 16, flexShrink: 0 }}>+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Barre d'action fixe */}
          <div style={{ padding: "12px 22px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "var(--cst-dark-green)" }}>
            <button
              className="cst-btn cst-btn-primary"
              style={{ width: "100%", opacity: picked.length === 0 || busy ? 0.5 : 1 }}
              disabled={picked.length === 0 || busy}
              onClick={start}
            >
              {busy ? "CRÉATION…" : `COMMENCER MA SÉANCE (${picked.length}) →`}
            </button>
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)",
    borderRadius: 6,
    width: 26,
    height: 26,
    fontSize: 12,
    cursor: disabled ? "default" : "pointer",
    flexShrink: 0,
  };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "block" }}>
      <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5, letterSpacing: "0.1em" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cst-input"
        style={{ width: "100%", padding: "6px 8px", fontSize: 13, marginTop: 2 }}
      />
    </label>
  );
}
