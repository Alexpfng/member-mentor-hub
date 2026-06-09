import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  listMemberWeekHistory,
  duplicateWeekTo,
  listMemberPastSessions,
  generateWeekFromSessions,
  deleteWeek,
} from "@/lib/weekly-adaptation.functions";
import { normalizeWeekId } from "@/lib/coach-navigation";

type WeekRow = {
  id: string;
  week_number: number;
  status: string;
  published_at: string | null;
  start_date: string | null;
  based_on_week: number | null;
  changes_summary: unknown;
};

type PastSession = {
  id: string;
  label: string;
  weekNumber: number | null;
  dayNumber: number | null;
  endedAt: string | null;
  averageRpe: number | null;
  exerciseCount: number;
  sessionType: string;
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: "BROUILLON", color: "#D4A82E" },
  published: { text: "PUBLIÉE", color: "#5BA85A" },
  in_progress: { text: "EN COURS", color: "#4A8BC4" },
  done: { text: "TERMINÉE", color: "#888" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── Generate from history modal ────────────────────────────────────────────

function GenerateModal({
  memberId,
  nextWeek,
  onClose,
  onGenerated,
}: {
  memberId: string;
  nextWeek: number;
  onClose: () => void;
  onGenerated: (weekNumber: number, weekId?: string) => void;
}) {
  const listFn = useServerFn(listMemberPastSessions);
  const genFn = useServerFn(generateWeekFromSessions);

  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFn({ data: { memberId, limit: 20 } })
      .then((r) => setSessions((r as PastSession[]) ?? []))
      .catch(() => setError("Impossible de charger les séances."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 7) next.add(id);
      return next;
    });
  }

  async function generate() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await genFn({ data: { memberId, sessionIds: Array.from(selected) } });
      onGenerated((r as { weekNumber: number; weekId?: string }).weekNumber, (r as { weekNumber: number; weekId?: string }).weekId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.7)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--cst-card-bg, #1a1f1e)",
          border: "1px solid var(--cst-card-border, rgba(255,255,255,0.08))",
          borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 540,
          padding: "24px 20px 32px",
          maxHeight: "85vh", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.18em", opacity: 0.5, marginBottom: 4 }}>
              NOUVELLE SEMAINE S{String(nextWeek).padStart(2, "0")}
            </div>
            <div className="cst-display" style={{ fontSize: 18 }}>Générer depuis séances</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, lineHeight: 1.4 }}>
              Sélectionne jusqu'à 7 séances · chaque séance devient une séance adaptée
            </div>
          </div>
          <button
            onClick={onClose}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ marginLeft: 12, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Session list */}
        {loading ? (
          <div style={{ opacity: 0.5, fontSize: 12, padding: "16px 0" }}>Chargement…</div>
        ) : sessions.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12, padding: "16px 0", textAlign: "center" }}>
            Aucune séance terminée pour ce membre.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {sessions.map((s) => {
              const isSelected = selected.has(s.id);
              const disabled = !isSelected && selected.size >= 7;
              return (
                <button
                  key={s.id}
                  onClick={() => !disabled && toggle(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
                    background: isSelected
                      ? "rgba(var(--cst-mid-green-rgb, 90, 168, 90), 0.12)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? "var(--cst-mid-green, #5BA85A)" : "rgba(255,255,255,0.06)"}`,
                    opacity: disabled ? 0.4 : 1,
                    textAlign: "left",
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSelected ? "var(--cst-mid-green, #5BA85A)" : "rgba(255,255,255,0.2)"}`,
                      background: isSelected ? "var(--cst-mid-green, #5BA85A)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {isSelected && <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </div>
                    <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>
                      {fmtDate(s.endedAt)}
                      {s.exerciseCount > 0 && ` · ${s.exerciseCount} exercice${s.exerciseCount > 1 ? "s" : ""}`}
                      {s.averageRpe != null && ` · RPE ${s.averageRpe}`}
                    </div>
                  </div>
                  {/* Tag */}
                  <div
                    className="cst-mono"
                    style={{
                      fontSize: 9, letterSpacing: "0.12em", flexShrink: 0,
                      padding: "2px 6px", borderRadius: 4,
                      background: s.sessionType === "free" ? "rgba(74,139,196,0.15)" : "rgba(90,168,90,0.12)",
                      color: s.sessionType === "free" ? "#4A8BC4" : "#5BA85A",
                    }}
                  >
                    {s.sessionType === "free" ? "LIBRE" : "PROGRAMME"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ color: "#C44A3A", fontSize: 12, marginBottom: 12, padding: "8px 10px", background: "rgba(196,74,58,0.08)", borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1 }}>
            Annuler
          </button>
          <button
            onClick={generate}
            disabled={selected.size === 0 || busy}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2 }}
          >
            {busy
              ? "Génération…"
              : `Générer S${String(nextWeek).padStart(2, "0")} (${selected.size} séance${selected.size > 1 ? "s" : ""}) →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function WeeksManagerPanel({ memberId }: { memberId: string }) {
  const navigate = useNavigate();
  const listFn = useServerFn(listMemberWeekHistory);
  const dupFn = useServerFn(duplicateWeekTo);
  const delFn = useServerFn(deleteWeek);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listFn({ data: { memberId } });
      setWeeks((r.weeks ?? []) as WeekRow[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [memberId]);

  // Client-side navigation (no full reload — avoids the auth beforeLoad race)
  function openAdapter(week?: number, weekId?: string) {
    const safeWeekId = normalizeWeekId(weekId);
    navigate({
      to: "/coach/membre/$memberId/adapter",
      params: { memberId },
      search: { ...(week != null ? { week } : {}), ...(safeWeekId ? { weekId: safeWeekId } : {}) },
    });
  }

  const nextWeek = weeks.length > 0 ? Math.max(...weeks.map((w) => w.week_number)) + 1 : 1;

  async function doDeleteWeek(weekId: string) {
    setBusy("del-" + weekId);
    try {
      await delFn({ data: { weekId } });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function duplicateTo(sourceWeekId: string, targetWeek: number) {
    setBusy(sourceWeekId + targetWeek);
    try {
      const r = await dupFn({ data: { weekId: sourceWeekId, targetWeeks: [targetWeek], progression: "identical" } });
      const created = r.created?.[0];
      await load();
      openAdapter(created?.weekNumber ?? targetWeek, created?.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="cst-card-dark" style={{ padding: 16, marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.6 }}>
              SEMAINES LIVRÉES · {weeks.length}
            </div>
            <div className="cst-display" style={{ fontSize: 16, marginTop: 4 }}>Gestion des semaines</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="cst-btn cst-btn-ghost-dark cst-btn-sm"
              style={{ whiteSpace: "nowrap" }}
              title="Créer une semaine à partir des séances passées"
            >
              📊 Depuis séances
            </button>
            <button
              onClick={() => openAdapter(nextWeek)}
              className="cst-btn cst-btn-primary cst-btn-sm"
              style={{ whiteSpace: "nowrap" }}
            >
              + SEMAINE S{String(nextWeek).padStart(2, "0")}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ opacity: 0.5, fontSize: 12, padding: 8 }}>Chargement…</div>
        ) : weeks.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 12, padding: 10, textAlign: "center" }}>
            Aucune semaine versionnée. Crée la première pour démarrer l'adaptation hebdo.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {weeks.map((w) => {
              const s = STATUS_LABEL[w.status] ?? { text: w.status.toUpperCase(), color: "#888" };
              return (
                <div
                  key={w.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                  }}
                >
                  <div className="cst-display" style={{ width: 60, fontSize: 18 }}>
                    S{String(w.week_number).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cst-mono" style={{ fontSize: 10, color: s.color, letterSpacing: "0.15em" }}>
                      {s.text}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                      {w.based_on_week != null && `copiée de S${String(w.based_on_week).padStart(2, "0")} · `}
                      {w.published_at
                        ? `publiée le ${new Date(w.published_at).toLocaleDateString("fr-FR")}`
                        : w.start_date
                          ? `démarre le ${new Date(w.start_date).toLocaleDateString("fr-FR")}`
                          : "—"}
                    </div>
                  </div>
                  {/* Adapt / consult button */}
                  <button
                    onClick={() => openAdapter(w.week_number, w.id)}
                    className={`cst-btn cst-btn-sm ${w.status === "done" ? "cst-btn-ghost-dark" : "cst-btn-primary"}`}
                    title={w.status === "published" || w.status === "in_progress" ? "Modifier la semaine publiée" : "Ouvrir l'éditeur"}
                    style={w.status === "done" ? { opacity: 0.5 } : undefined}
                  >
                    {w.status === "published" || w.status === "in_progress" ? "✏ Modifier" : w.status === "done" ? "Consulter" : "Adapter"}
                  </button>
                  {/* Duplicate button */}
                  <button
                    onClick={() => duplicateTo(w.id, nextWeek)}
                    disabled={busy === w.id + nextWeek}
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    title={`Dupliquer vers S${String(nextWeek).padStart(2, "0")}`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {busy === w.id + nextWeek ? "…" : `⎘ S${String(nextWeek).padStart(2, "0")}`}
                  </button>
                  {/* Delete button — draft only */}
                  {w.status === "draft" && (
                    confirmDelete === w.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, opacity: 0.7, whiteSpace: "nowrap" }}>Supprimer ?</span>
                        <button
                          onClick={() => doDeleteWeek(w.id)}
                          disabled={busy === "del-" + w.id}
                          style={{ background: "#C44A3A", border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                        >
                          {busy === "del-" + w.id ? "…" : "Oui"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "var(--cst-text-soft)", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(w.id)}
                        style={{ background: "transparent", border: "1px solid rgba(196,74,58,0.4)", color: "#C44A3A", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                        title="Supprimer cette semaine brouillon"
                      >
                        🗑
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showGenerateModal && (
        <GenerateModal
          memberId={memberId}
          nextWeek={nextWeek}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(weekNum, weekId) => {
            setShowGenerateModal(false);
            openAdapter(weekNum, weekId);
          }}
        />
      )}
    </>
  );
}
