import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import CoachSidebar from "@/components/CoachSidebar";
import ReplaceExerciseModal from "@/components/coach/ReplaceExerciseModal";
import MultiWeekDuplicateModal from "@/components/coach/MultiWeekDuplicateModal";
import {
  getMemberWeekContext,
  saveDraftWeek,
  publishWeek,
  previewWeekChanges,
} from "@/lib/weekly-adaptation.functions";

type ProgExercise = {
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
};
type DayStructure = { label?: string; exercises?: ProgExercise[] };
type WeekStructure = { days?: DayStructure[] };

type Feedback = { rpe: number | null; pain: boolean; tooHard: boolean; tooEasy: boolean; failure: boolean };

type Suggestion =
  | { type: "pain"; actions: { label: string; apply?: (ex: ProgExercise) => ProgExercise }[] }
  | { type: "too_hard" | "high" | "low" | "slightly_low"; actions: { label: string; apply: (ex: ProgExercise) => ProgExercise }[] };

function nextChargeDelta(charge: string | null | undefined, deltaPct: number): string | null {
  const n = Number(charge);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round(n * (1 + deltaPct) * 2) / 2);
}
function nextChargePlus(charge: string | null | undefined, kg: number): string | null {
  const n = Number(charge);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round((n + kg) * 2) / 2);
}

function suggestFor(ex: ProgExercise, fb: Feedback | undefined): Suggestion | null {
  if (!fb) return null;
  const target = Number(ex.rpe_target);
  if (fb.pain) {
    return { type: "pain", actions: [{ label: "Réduire amplitude (note)" }, { label: "Mettre en pause" }] };
  }
  if (fb.failure || (fb.rpe != null && fb.rpe >= 10)) {
    return {
      type: "too_hard",
      actions: [
        { label: `−10% → ${nextChargeDelta(ex.charge, -0.1) ?? "?"} kg`, apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.1) ?? e.charge }) },
        { label: `−5% → ${nextChargeDelta(ex.charge, -0.05) ?? "?"} kg`, apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }) },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe >= target + 1) {
    return {
      type: "high",
      actions: [
        { label: `−5% → ${nextChargeDelta(ex.charge, -0.05) ?? "?"} kg`, apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }) },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe <= target - 2) {
    return {
      type: "low",
      actions: [
        { label: `+2,5 kg → ${nextChargePlus(ex.charge, 2.5) ?? "?"}`, apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }) },
        { label: "+1 rep", apply: (e) => ({ ...e, reps: typeof e.reps === "number" || /^\d+$/.test(String(e.reps ?? "")) ? Number(e.reps) + 1 : e.reps }) },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe <= target - 1) {
    return {
      type: "slightly_low",
      actions: [
        { label: `+2,5 kg → ${nextChargePlus(ex.charge, 2.5) ?? "?"}`, apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }) },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.tooHard) return { type: "high", actions: [{ label: `−5%`, apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }) }, { label: "Garder", apply: (e) => e }] };
  if (fb.tooEasy) return { type: "low", actions: [{ label: `+2,5 kg`, apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }) }, { label: "Garder", apply: (e) => e }] };
  return null;
}

const COLOR_MAP: Record<string, { bg: string; label: string }> = {
  red: { bg: "#C44A3A", label: "Force" },
  green: { bg: "#5BA85A", label: "Cardio" },
  yellow: { bg: "#D4A82E", label: "Mobilité" },
  blue: { bg: "#4A8BC4", label: "Technique" },
};

function ColorDot({ c }: { c?: string | null }) {
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: COLOR_MAP[(c || "").toLowerCase()]?.bg || "#666" }} />;
}

function ColorPicker({ value, onChange }: { value: string | null | undefined; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>COULEUR</span>
      {Object.entries(COLOR_MAP).map(([key, { bg, label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          style={{
            width: 20, height: 20, borderRadius: "50%", background: bg, border: "none", cursor: "pointer",
            outline: (value || "").toLowerCase() === key ? `2px solid #fff` : "2px solid transparent",
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}



export default function AdapterSemaine() {
  const { memberId } = useParams({ from: "/_authenticated/coach/membre/$memberId/adapter" });
  const search = useSearch({ from: "/_authenticated/coach/membre/$memberId/adapter" }) as { week?: number };
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMemberWeekContext);
  const saveFn = useServerFn(saveDraftWeek);
  const publishFn = useServerFn(publishWeek);
  const previewFn = useServerFn(previewWeekChanges);
  

  type Ctx = Awaited<ReturnType<typeof getMemberWeekContext>>;
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [structure, setStructure] = useState<WeekStructure>({ days: [] });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [changes, setChanges] = useState<Array<{ type: string; label: string }>>([]);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<{ dayIdx: number; exoIdx: number; ex: ProgExercise } | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [expandedExos, setExpandedExos] = useState<Set<string>>(new Set());
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const c = await fetchCtx({ data: { memberId, weekNumber: search.week } });
      setCtx(c);
      setStructure((c.week.structure as WeekStructure) ?? { days: [] });
      const isAlreadyPublished = ["published", "in_progress"].includes(c.week.status);
      setMessage(
        isAlreadyPublished
          ? `Mise à jour de ta semaine ${c.week.week_number}, ${c.member.name.split(" ")[0]}. Vérifie les changements 👀`
          : `Nouvelle semaine prête, ${c.member.name.split(" ")[0]}. À toi de jouer 💪`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [memberId, search.week]);

  // Auto-save with debounce
  useEffect(() => {
    if (!ctx?.week.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveFn({ data: { weekId: ctx.week.id, structure } });
        setSavedAt(Date.now());
      } catch (e) {
        console.error("[autosave]", e);
      }
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [structure, ctx?.week.id, saveFn]);

  function updateExo(dayIdx: number, exoIdx: number, fn: (ex: ProgExercise) => ProgExercise) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      const exos = [...(day.exercises ?? [])];
      exos[exoIdx] = fn(exos[exoIdx]);
      day.exercises = exos;
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  function removeExo(dayIdx: number, exoIdx: number) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      day.exercises = (day.exercises ?? []).filter((_, i) => i !== exoIdx);
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  function addExo(dayIdx: number) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      day.exercises = [...(day.exercises ?? []), { name: "Nouvel exercice", series: 3, reps: 10, charge: null, rpe_target: 8, color: "green" }];
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  function removeDay(dayIdx: number) {
    setStructure((s) => ({ ...s, days: (s.days ?? []).filter((_, i) => i !== dayIdx) }));
    setConfirmDeleteDay(null);
  }
  function toggleExoExpand(key: string) {
    setExpandedExos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function applyGlobalProgression(mode: "identical" | "plus2_5" | "plus5" | "deload") {
    if (mode === "identical") return;
    const factor = mode === "plus2_5" ? 1.025 : mode === "plus5" ? 1.05 : 0.6;
    setStructure((s) => {
      const days = (s.days ?? []).map((d) => ({
        ...d,
        exercises: (d.exercises ?? []).map((e) => {
          if ((e.color ?? "").toLowerCase() !== "red") return e;
          const fb = ctx?.feedback?.[e.name];
          if (fb?.pain) return e; // protect injured
          const next = nextChargeDelta(e.charge, factor - 1);
          return next ? { ...e, charge: next } : e;
        }),
      }));
      return { ...s, days };
    });
  }

  async function openPublish() {
    if (!ctx?.week.id) return;
    try {
      const { changes } = await previewFn({ data: { weekId: ctx.week.id } });
      setChanges(changes);
      setShowPublish(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function doPublish() {
    if (!ctx?.week.id) return;
    setPublishing(true);
    try {
      await publishFn({ data: { weekId: ctx.week.id, notify, message: notify ? message : undefined } });
      setShowPublish(false);
      navigate({ to: "/coach/membre/$memberId", params: { memberId } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Shell><div style={{ opacity: 0.6, padding: 40 }}>Chargement…</div></Shell>;
  if (err || !ctx) return (
    <Shell>
      <div style={{ padding: 40 }}>
        <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.5, marginBottom: 8 }}>ERREUR · ADAPTER SEMAINE</div>
        <div style={{ color: "#C44A3A", fontSize: 15, marginBottom: 20 }}>{err ?? "Erreur inconnue"}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} className="cst-btn cst-btn-primary">Réessayer</button>
          <button onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })} className="cst-btn cst-btn-ghost-dark">← Retour fiche membre</button>
        </div>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div style={{ padding: 20, maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })} className="cst-mono" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer" }}>
            ← FICHE MEMBRE
          </button>
          {ctx && ctx.week.week_number > 0 && (
            <button onClick={() => navigate({ to: "/coach/membre/$memberId/adapter", params: { memberId }, search: { week: ctx.week.week_number - 1 } })} className="cst-mono" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer" }}>
              ← S{String(ctx.week.week_number - 1).padStart(2, "0")}
            </button>
          )}
          {ctx && (
            <button onClick={() => navigate({ to: "/coach/membre/$memberId/adapter", params: { memberId }, search: { week: ctx.week.week_number + 1 } })} className="cst-mono" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer" }}>
              S{String(ctx.week.week_number + 1).padStart(2, "0")} →
            </button>
          )}
        </div>

        <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.55, marginBottom: 4 }}>
          ADAPTER · {ctx.member.name} · {ctx.assignment.program_name}
        </div>
        <h1 className="cst-display" style={{ fontSize: 28, marginBottom: 6 }}>
          Semaine {ctx.week.week_number}
          {ctx.week.based_on_week != null && <span style={{ opacity: 0.5, fontSize: 16 }}> · copiée de S{ctx.week.based_on_week}</span>}
        </h1>

        {(ctx.week.status === "published" || ctx.week.status === "in_progress") && (
          <div style={{ padding: "12px 16px", background: "rgba(212,168,46,0.12)", border: "1px solid rgba(212,168,46,0.35)", borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <div>
              <div className="cst-mono" style={{ fontSize: 10, color: "#D4A82E", letterSpacing: "0.15em" }}>
                SEMAINE {ctx.week.status === "in_progress" ? "EN COURS" : "DÉJÀ PUBLIÉE"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                Tes modifications seront visibles par le membre après republication. Un message de notification lui sera envoyé.
              </div>
            </div>
          </div>
        )}

        {ctx.sourceSummary.weekNumber != null && (
          <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginBottom: 20 }}>
            RÉSUMÉ S{ctx.sourceSummary.weekNumber} ·
            {ctx.sourceSummary.adherence && ` Adhérence ${ctx.sourceSummary.adherence.done}/${ctx.sourceSummary.adherence.total} · `}
            {ctx.sourceSummary.avgRpe != null && `RPE moy. ${ctx.sourceSummary.avgRpe} · `}
            {ctx.sourceSummary.painCount > 0 ? `${ctx.sourceSummary.painCount} douleur(s) signalée(s)` : "aucune douleur"}
          </div>
        )}

        {/* Progression globale */}
        <div className="cst-card-dark" style={{ padding: 14, marginBottom: 20 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.15em", opacity: 0.6, marginBottom: 8 }}>
            PROGRESSION GLOBALE (exos force, hors douleur)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="cst-btn cst-btn-sm cst-btn-ghost-dark" onClick={() => applyGlobalProgression("identical")}>Identique</button>
            <button className="cst-btn cst-btn-sm cst-btn-ghost-dark" onClick={() => applyGlobalProgression("plus2_5")}>+2,5% force</button>
            <button className="cst-btn cst-btn-sm cst-btn-ghost-dark" onClick={() => applyGlobalProgression("plus5")}>+5% force</button>
            <button className="cst-btn cst-btn-sm cst-btn-ghost-dark" onClick={() => applyGlobalProgression("deload")}>Déload −40%</button>
          </div>
        </div>

        {/* Jours */}
        {(structure.days ?? []).length === 0 && (
          <div className="cst-card-dark" style={{ padding: 28, textAlign: "center" }}>
            <div className="cst-display" style={{ fontSize: 18, marginBottom: 8 }}>Semaine vide</div>
            <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 20, lineHeight: 1.5 }}>
              Cette semaine n'a pas encore de séances.<br />
              Commence en ajoutant un jour, ou génère depuis les séances passées.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setStructure((s) => ({ ...s, days: [{ label: "Jour 1", exercises: [] }] }))}
                className="cst-btn cst-btn-primary"
              >
                + Ajouter un premier jour
              </button>
              <button
                onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })}
                className="cst-btn cst-btn-ghost-dark"
              >
                ← Retour fiche membre
              </button>
            </div>
          </div>
        )}

        {(structure.days ?? []).map((day, di) => (
          <div key={di} className="cst-card-dark" style={{ padding: 16, marginBottom: 14 }}>
            {/* Day header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input
                value={day.label ?? ""}
                onChange={(e) => setStructure((s) => {
                  const days = [...(s.days ?? [])];
                  days[di] = { ...days[di], label: e.target.value };
                  return { ...s, days };
                })}
                className="cst-display"
                style={{ flex: 1, background: "transparent", border: "none", color: "var(--cst-text)", fontSize: 18 }}
              />
              {confirmDeleteDay === di ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>Supprimer ce jour ?</span>
                  <button onClick={() => removeDay(di)} style={{ background: "#C44A3A", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Oui</button>
                  <button onClick={() => setConfirmDeleteDay(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "var(--cst-text-soft)", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Non</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteDay(di)}
                  style={{ background: "transparent", border: "1px solid rgba(196,74,58,0.3)", color: "#C44A3A", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                  title="Supprimer ce jour"
                >
                  🗑 Jour
                </button>
              )}
            </div>

            {/* Exercises */}
            {(day.exercises ?? []).map((ex, ei) => {
              const fb = ctx.feedback[ex.name];
              const sugg = suggestFor(ex, fb);
              const exoKey = `${di}-${ei}`;
              const isExpanded = expandedExos.has(exoKey);
              return (
                <div key={ei} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 0" }}>
                  {/* Main row */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <ColorDot c={ex.color} />
                    <input
                      value={ex.name}
                      onChange={(e) => updateExo(di, ei, (x) => ({ ...x, name: e.target.value }))}
                      style={{ flex: 1, minWidth: 100, background: "transparent", border: "none", color: "var(--cst-text)", fontSize: 14, fontWeight: 600 }}
                    />
                    {ex.block_type === "emom" ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                        <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5, letterSpacing: "0.1em" }}>DURÉE (min)</span>
                        <input
                          type="number" min={1} max={60}
                          value={String(ex.series ?? "").replace(/[^0-9]/g, "") || "10"}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v > 0) updateExo(di, ei, (x) => ({ ...x, series: `EMOM${v}'` }));
                          }}
                          className="cst-input" style={{ width: 70, textAlign: "center" }}
                        />
                      </label>
                    ) : (
                      <input value={String(ex.series ?? "")} onChange={(e) => updateExo(di, ei, (x) => ({ ...x, series: e.target.value }))} placeholder="séries" style={{ width: 55 }} className="cst-input" />
                    )}
                    <input value={String(ex.reps ?? "")} onChange={(e) => updateExo(di, ei, (x) => ({ ...x, reps: e.target.value }))} placeholder={ex.block_type === "emom" ? "reps/min" : "reps"} style={{ width: 55 }} className="cst-input" />
                    <input value={ex.charge ?? ""} onChange={(e) => updateExo(di, ei, (x) => ({ ...x, charge: e.target.value }))} placeholder="kg" style={{ width: 65 }} className="cst-input" />
                    <input value={String(ex.rpe_target ?? "")} onChange={(e) => updateExo(di, ei, (x) => ({ ...x, rpe_target: e.target.value }))} placeholder="RPE" style={{ width: 45 }} className="cst-input" />
                    <button
                      onClick={() => toggleExoExpand(exoKey)}
                      title="Tempo / Récup / Notes"
                      style={{ background: isExpanded ? "rgba(255,255,255,0.1)" : "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "var(--cst-text-soft)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    <button onClick={() => setReplaceTarget({ dayIdx: di, exoIdx: ei, ex })} title="Remplacer l'exercice" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "var(--cst-text-soft)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>⇄</button>
                    <button onClick={() => removeExo(di, ei)} title="Supprimer l'exercice" style={{ background: "transparent", border: "1px solid rgba(196,74,58,0.4)", color: "#C44A3A", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>🗑</button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ marginTop: 10, padding: "12px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>TEMPO</span>
                          <input
                            value={ex.tempo ?? ""}
                            onChange={(e) => updateExo(di, ei, (x) => ({ ...x, tempo: e.target.value || null }))}
                            placeholder="ex: 3-1-2"
                            className="cst-input"
                            style={{ width: 90 }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>RÉCUP</span>
                          <input
                            value={ex.recup ?? ""}
                            onChange={(e) => updateExo(di, ei, (x) => ({ ...x, recup: e.target.value || null }))}
                            placeholder="ex: 90s"
                            className="cst-input"
                            style={{ width: 90 }}
                          />
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <ColorPicker value={ex.color} onChange={(c) => updateExo(di, ei, (x) => ({ ...x, color: c }))} />
                        </div>
                      </div>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>NOTE POUR LE MEMBRE</span>
                        <input
                          value={ex.coach_notes ?? ""}
                          onChange={(e) => updateExo(di, ei, (x) => ({ ...x, coach_notes: e.target.value || null }))}
                          placeholder="Conseil technique, consigne particulière…"
                          className="cst-input"
                          style={{ width: "100%" }}
                        />
                      </label>
                    </div>
                  )}

                  {/* Suggestions */}
                  {sugg && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(212,168,46,0.08)", border: "1px solid rgba(212,168,46,0.25)", borderRadius: 6 }}>
                      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.8, marginBottom: 6 }}>
                        {sugg.type === "pain" && `🔴 Douleur signalée en S${ctx.sourceSummary.weekNumber}`}
                        {sugg.type === "too_hard" && `⚠ Trop dur (RPE ${fb?.rpe ?? "?"} en S${ctx.sourceSummary.weekNumber})`}
                        {sugg.type === "high" && `⚠ RPE haut (${fb?.rpe} vs cible ${ex.rpe_target})`}
                        {sugg.type === "low" && `↓ Marge de progression (RPE ${fb?.rpe} vs cible ${ex.rpe_target})`}
                        {sugg.type === "slightly_low" && `↓ Légèrement sous la cible (RPE ${fb?.rpe})`}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {sugg.actions.map((a, ai) => (
                          <button
                            key={ai}
                            onClick={() => { if (a.apply) updateExo(di, ei, a.apply); }}
                            className="cst-btn cst-btn-sm"
                            style={{ background: "rgba(212,168,46,0.2)", border: "1px solid rgba(212,168,46,0.4)", color: "var(--cst-text)", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => addExo(di)} style={{ marginTop: 10, background: "transparent", border: "1px dashed rgba(255,255,255,0.2)", color: "var(--cst-text-soft)", borderRadius: 6, padding: "8px 14px", fontSize: 12, cursor: "pointer", width: "100%" }}>
              + Ajouter un exercice
            </button>
          </div>
        ))}

        <button
          onClick={() => setStructure((s) => ({ ...s, days: [...(s.days ?? []), { label: `Jour ${(s.days?.length ?? 0) + 1}`, exercises: [] }] }))}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ marginBottom: 24 }}
        >
          + Ajouter un jour
        </button>

        {/* Footer actions */}
        <div style={{ position: "sticky", bottom: 0, background: "var(--cst-dark-green)", borderTop: "1px solid rgba(255,255,255,0.1)", padding: "14px 0", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            {savedAt ? `✓ Sauvegardé ${new Date(savedAt).toLocaleTimeString("fr-FR")}` : "—"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowDuplicate(true)} className="cst-btn cst-btn-ghost-dark">Dupliquer vers…</button>
            <button onClick={() => setShowPreview(true)} className="cst-btn cst-btn-ghost-dark">Aperçu membre</button>
            <button onClick={openPublish} className="cst-btn cst-btn-primary">
              {ctx.week.status === "published" || ctx.week.status === "in_progress"
                ? `Republier la semaine ${ctx.week.week_number} →`
                : `Publier la semaine ${ctx.week.week_number} →`}
            </button>
          </div>
        </div>
      </div>

      {showPreview && <PreviewModal structure={structure} weekNumber={ctx.week.week_number} onClose={() => setShowPreview(false)} />}
      {showPublish && (
        <PublishModal
          weekNumber={ctx.week.week_number}
          memberName={ctx.member.name}
          isRepublish={ctx.week.status === "published" || ctx.week.status === "in_progress"}
          changes={changes}
          notify={notify}
          setNotify={setNotify}
          message={message}
          setMessage={setMessage}
          publishing={publishing}
          onCancel={() => setShowPublish(false)}
          onPublish={doPublish}
        />
      )}
      {replaceTarget && ctx && (
        <ReplaceExerciseModal
          weekId={ctx.week.id}
          dayIndex={replaceTarget.dayIdx}
          exoIndex={replaceTarget.exoIdx}
          currentName={replaceTarget.ex.name}
          currentPatterns={null}
          currentMuscleGroup={null}
          onClose={() => setReplaceTarget(null)}
          onReplaced={(s) => setStructure(s as WeekStructure)}
        />
      )}
      {showDuplicate && ctx && (
        <MultiWeekDuplicateModal
          weekId={ctx.week.id}
          currentWeek={ctx.week.week_number}
          onClose={() => setShowDuplicate(false)}
          onCreated={(firstWeek) => navigate({ to: "/coach/membre/$memberId/adapter", params: { memberId }, search: { week: firstWeek } })}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--cst-dark-green)", color: "var(--cst-text)" }}>
      <CoachSidebar />
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}

function PreviewModal({ structure, weekNumber, onClose }: { structure: WeekStructure; weekNumber: number; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="cst-screen cst-hatch" style={{ width: 480, maxHeight: "85vh", overflow: "auto", padding: 24, borderRadius: 12 }}>
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em", marginBottom: 6 }}>APERÇU MEMBRE</div>
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 16 }}>Semaine {weekNumber}</h2>
        {(structure.days ?? []).map((d, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="cst-display" style={{ fontSize: 14, marginBottom: 6 }}>{d.label ?? `Jour ${i + 1}`}</div>
            {(d.exercises ?? []).map((e, j) => (
              <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                <span>
                  <ColorDot c={e.color} /> {e.name}
                </span>
                <span style={{ opacity: 0.7, fontFamily: "var(--cst-mono)", fontSize: 11 }}>{e.series ?? "—"} × {e.reps ?? "—"}{e.charge ? ` · ${e.charge}kg` : ""}{e.rpe_target ? ` · RPE ${e.rpe_target}` : ""}</span>
              </div>
            ))}
          </div>
        ))}
        <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ marginTop: 16 }}>Fermer</button>
      </div>
    </div>
  );
}

function PublishModal(props: {
  weekNumber: number;
  memberName: string;
  isRepublish?: boolean;
  changes: Array<{ type: string; label: string }>;
  notify: boolean;
  setNotify: (b: boolean) => void;
  message: string;
  setMessage: (s: string) => void;
  publishing: boolean;
  onCancel: () => void;
  onPublish: () => void;
}) {
  return (
    <div onClick={props.onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="cst-screen cst-hatch" style={{ width: 500, maxHeight: "85vh", overflow: "auto", padding: 28, borderRadius: 12 }}>
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 4 }}>
          {props.isRepublish ? `Republier la semaine ${props.weekNumber}` : `Publier la semaine ${props.weekNumber}`}
        </h2>
        <div className="cst-italic" style={{ fontSize: 13, color: "var(--cst-mid-green)", marginBottom: 16 }}>pour {props.memberName}</div>

        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.7, marginBottom: 8, letterSpacing: "0.15em" }}>RÉCAP DES CHANGEMENTS</div>
        <div style={{ marginBottom: 18, maxHeight: 200, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: 10, fontSize: 12 }}>
          {props.changes.length === 0 ? <div style={{ opacity: 0.6 }}>Aucun changement détecté.</div> : props.changes.map((c, i) => (
            <div key={i} style={{ padding: "3px 0" }}>• {c.label}</div>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 }}>
          <input type="checkbox" checked={props.notify} onChange={(e) => props.setNotify(e.target.checked)} /> Notifier le membre + message
        </label>
        {props.notify && (
          <textarea value={props.message} onChange={(e) => props.setMessage(e.target.value)} rows={3} className="cst-input" style={{ width: "100%", marginBottom: 16 }} />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={props.onCancel} className="cst-btn cst-btn-ghost-dark" disabled={props.publishing}>Annuler</button>
          <button onClick={props.onPublish} className="cst-btn cst-btn-primary" disabled={props.publishing}>
            {props.publishing ? "Publication…" : props.isRepublish ? "Republier et notifier" : "Publier et envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
