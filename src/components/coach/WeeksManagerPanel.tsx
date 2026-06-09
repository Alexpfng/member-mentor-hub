import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listMemberWeekHistory, duplicateWeekTo } from "@/lib/weekly-adaptation.functions";

type WeekRow = {
  id: string;
  week_number: number;
  status: string;
  published_at: string | null;
  start_date: string | null;
  based_on_week: number | null;
  changes_summary: unknown;
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: "BROUILLON", color: "#D4A82E" },
  published: { text: "PUBLIÉE", color: "#5BA85A" },
  in_progress: { text: "EN COURS", color: "#4A8BC4" },
  done: { text: "TERMINÉE", color: "#888" },
};

export default function WeeksManagerPanel({ memberId }: { memberId: string }) {
  const navigate = useNavigate();
  const listFn = useServerFn(listMemberWeekHistory);
  const dupFn = useServerFn(duplicateWeekTo);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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

  function openAdapter(week?: number) {
    navigate({
      to: "/coach/membre/$memberId/adapter",
      params: { memberId },
      search: week != null ? { week } : {},
    });
  }

  const nextWeek = weeks.length > 0 ? Math.max(...weeks.map((w) => w.week_number)) + 1 : 1;

  async function duplicateTo(sourceWeekId: string, targetWeek: number) {
    setBusy(sourceWeekId + targetWeek);
    try {
      await dupFn({ data: { weekId: sourceWeekId, targetWeeks: [targetWeek], progression: "identical" } });
      await load();
      openAdapter(targetWeek);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cst-card-dark" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.6 }}>
            SEMAINES LIVRÉES · {weeks.length}
          </div>
          <div className="cst-display" style={{ fontSize: 16, marginTop: 4 }}>Gestion des semaines</div>
        </div>
        <button
          onClick={() => openAdapter(nextWeek)}
          className="cst-btn cst-btn-primary cst-btn-sm"
          style={{ whiteSpace: "nowrap" }}
        >
          + NOUVELLE SEMAINE S{String(nextWeek).padStart(2, "0")}
        </button>
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
                <button
                  onClick={() => openAdapter(w.week_number)}
                  className={`cst-btn cst-btn-sm ${w.status === "done" ? "cst-btn-ghost-dark" : "cst-btn-primary"}`}
                  title={w.status === "published" || w.status === "in_progress" ? "Modifier la semaine publiée" : "Ouvrir l'éditeur"}
                  style={w.status === "done" ? { opacity: 0.5 } : undefined}
                >
                  {w.status === "published" || w.status === "in_progress" ? "✏ Modifier" : w.status === "done" ? "Consulter" : "Adapter"}
                </button>
                <button
                  onClick={() => duplicateTo(w.id, nextWeek)}
                  disabled={busy === w.id + nextWeek}
                  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                  title={`Dupliquer cette semaine vers S${nextWeek}`}
                  style={{ whiteSpace: "nowrap" }}
                >
                  ⎘ → S{String(nextWeek).padStart(2, "0")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
