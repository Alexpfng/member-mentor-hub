import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMemberFollowup, getMemberCharts, markSessionSeen } from "@/lib/coach-dashboard.functions";
import { resolvePainReport } from "@/lib/pain-reports.functions";
import { timeAgo } from "@/lib/format";
import AdherenceChart from "./AdherenceChart";
import RpeChart from "./RpeChart";
import ExerciseProgressionChart from "./ExerciseProgressionChart";
import { toast } from "sonner";

const kpiCard: React.CSSProperties = {
  background: "#1F2D24", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
  padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
};

export default function MemberFollowupTab({ memberId }: { memberId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const followupFn = useServerFn(getMemberFollowup);
  const chartsFn = useServerFn(getMemberCharts);
  const resolveFn = useServerFn(resolvePainReport);
  const markSeenFn = useServerFn(markSessionSeen);

  const { data: followup, isLoading } = useQuery({
    queryKey: ["coach", "member-followup", memberId],
    queryFn: () => followupFn({ data: { memberId } }),
  });
  const { data: charts } = useQuery({
    queryKey: ["coach", "member-charts", memberId],
    queryFn: () => chartsFn({ data: { memberId } }),
  });

  async function onResolve(id: string) {
    try {
      await resolveFn({ data: { id } });
      toast.success("Douleur marquée comme résolue");
      qc.invalidateQueries({ queryKey: ["coach"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }
  async function onMarkSeen(sid: string) {
    try {
      await markSeenFn({ data: { sessionId: sid } });
      qc.invalidateQueries({ queryKey: ["coach"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  if (isLoading || !followup) return <div className="cst-card-dark" style={{ padding: 20, opacity: 0.6 }}>Chargement…</div>;
  const k = followup.kpis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <div style={kpiCard}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>SÉANCES 30J</span>
          <span className="cst-display" style={{ fontSize: 26 }}>{k.sessionsDone}<span style={{ fontSize: 14, opacity: 0.5 }}> / {k.sessionsPlanned || "—"}</span></span>
        </div>
        <div style={kpiCard}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>ADHÉRENCE</span>
          <span className="cst-display" style={{ fontSize: 26, color: k.adherence != null && k.adherence < 70 ? "#E07B39" : "#fff" }}>{k.adherence != null ? `${k.adherence}%` : "—"}</span>
        </div>
        <div style={kpiCard}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>RPE MOYEN</span>
          <span className="cst-display" style={{ fontSize: 26, color: k.avgRpe != null && k.avgRpe >= 8.5 ? "#E07B39" : "#fff" }}>{k.avgRpe != null ? k.avgRpe.toFixed(1) : "—"}</span>
        </div>
        <div style={kpiCard}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>DOULEURS OUVERTES</span>
          <span className="cst-display" style={{ fontSize: 26, color: k.openPainsCount > 0 ? "#C0392B" : "#fff" }}>{k.openPainsCount}</span>
        </div>
        <div style={kpiCard}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>SÉANCES À REVOIR</span>
          <span className="cst-display" style={{ fontSize: 26, color: k.unseenSessionsCount > 0 ? "#E07B39" : "#fff" }}>{k.unseenSessionsCount}</span>
        </div>
      </div>

      {/* Douleurs */}
      {followup.openPains.length > 0 && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#C0392B", marginBottom: 10 }}>🔴 DOULEURS À TRAITER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {followup.openPains.map((p) => (
              <div key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{p.exercise_name}</strong>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>· {p.zone}</span>
                  <span className="cst-mono" style={{ fontSize: 10, color: "#C0392B" }}>{p.intensity}/5</span>
                  <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5, marginLeft: "auto" }}>{timeAgo(p.created_at)}</span>
                </div>
                {p.comment && <div style={{ fontSize: 12, opacity: 0.75, fontStyle: "italic", marginTop: 4 }}>« {p.comment} »</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {p.session_id && <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: p.session_id! } })}>Voir la séance</button>}
                  <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => onResolve(p.id)}>✓ Résoudre</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watch list */}
      {followup.watchList.length > 0 && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", marginBottom: 10, color: "#E07B39" }}>⚠ EXOS À SURVEILLER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {followup.watchList.map((e) => (
              <div key={e.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                <strong>{e.name}</strong>
                <span style={{ opacity: 0.8 }}>
                  {e.tooHard > 0 && <span style={{ marginLeft: 8 }}>🥵 {e.tooHard}× trop dur</span>}
                  {e.couldNot > 0 && <span style={{ marginLeft: 8, color: "#C0392B" }}>✕ {e.couldNot}× n'a pas pu</span>}
                  {e.highRpe > 0 && <span style={{ marginLeft: 8, color: "#E07B39" }}>⚡ {e.highRpe}× RPE 9+</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7, marginBottom: 8 }}>ADHÉRENCE — 8 SEMAINES</div>
          <AdherenceChart data={charts?.adherence ?? []} />
        </div>
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7, marginBottom: 8 }}>RPE — 7 DERNIERS JOURS</div>
          <RpeChart data={charts?.rpe7 ?? []} />
        </div>
      </div>

      <ExerciseProgressionChart memberId={memberId} />

      {/* Recent sessions */}
      {followup.recentSessions.length > 0 && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7, marginBottom: 10 }}>SÉANCES RÉCENTES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {followup.recentSessions.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{s.label || `S${s.week ?? "-"} · J${s.day ?? "-"}`}</strong>
                    {!s.coachSeen && <span className="cst-mono" style={{ marginLeft: 8, fontSize: 9, padding: "1px 5px", background: "#E07B39", color: "#fff", borderRadius: 3 }}>NOUVEAU</span>}
                  </div>
                  <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>{timeAgo(s.endedAt)} · RPE {s.averageRpe != null ? Number(s.averageRpe).toFixed(1) : "—"}</span>
                </div>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: s.id } })}>VOIR</button>
                {!s.coachSeen && <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => onMarkSeen(s.id)}>✓ VU</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
