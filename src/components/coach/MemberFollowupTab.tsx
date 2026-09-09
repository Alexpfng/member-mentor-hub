import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMemberFollowup, getMemberCharts, markSessionSeen } from "@/lib/coach-dashboard.functions";
import { getMovementProfile } from "@/lib/member-stats.functions";
import MovementRadar from "@/components/cst/MovementRadar";
import { resolvePainReport } from "@/lib/pain-reports.functions";
import { timeAgo } from "@/lib/format";
import AdherenceChart from "./AdherenceChart";
import RpeChart from "./RpeChart";
import ExerciseProgressionChart from "./ExerciseProgressionChart";
import { toast } from "sonner";
import { getFollowupSessionsAccessCopy } from "@/lib/coach-session-flags";

const kpiCard: React.CSSProperties = {
  background: "#1F2D24", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
  padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
};

export default function MemberFollowupTab({ memberId }: { memberId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const followupFn = useServerFn(getMemberFollowup);
  const chartsFn = useServerFn(getMemberCharts);
  const profileFn = useServerFn(getMovementProfile);
  const resolveFn = useServerFn(resolvePainReport);
  const markSeenFn = useServerFn(markSessionSeen);

  const { data: followup, isLoading } = useQuery({
    queryKey: ["coach", "member-followup", memberId],
    queryFn: () => followupFn({ data: { memberId } }),
  });
  const { data: profile } = useQuery({
    queryKey: ["coach", "member-movement-profile", memberId],
    queryFn: () => profileFn({ data: { memberId } }),
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
  const sessionsAccess = getFollowupSessionsAccessCopy(followup.recentSessions.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Quick action: adapter S+1 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="cst-btn cst-btn-primary"
          onClick={() =>
            navigate({
              to: "/coach/membre/$memberId/adapter",
              params: { memberId },
              search: followup.currentWeek != null ? { week: followup.currentWeek + 1 } : {},
            })
          }
        >
          ADAPTER S+1 →
        </button>
      </div>

      {/* Direct session access: kept high in the follow-up tab so desktop mirrors mobile. */}
      <div
        className="cst-card-dark"
        style={{
          padding: 16,
          border: "1px solid rgba(90,168,90,0.32)",
          boxShadow: "0 0 0 1px rgba(90,168,90,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div
              className="cst-mono"
              style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7 }}
            >
              SUIVI
            </div>
            <div className="cst-display" style={{ fontSize: 20, marginTop: 2 }}>
              {sessionsAccess.title}
            </div>
          </div>
          <span className="cst-mono" style={{ fontSize: 10, color: "#5BA85A" }}>
            {sessionsAccess.subtitle}
          </span>
        </div>
        {sessionsAccess.empty ? (
          <div style={{ fontSize: 13, opacity: 0.65 }}>
            Dès qu'une séance sera lancée ou terminée, Léo pourra l'ouvrir directement ici.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {followup.recentSessions.map((s) => {
              const title = s.label || `S${s.week ?? "-"} · J${s.day ?? "-"}`;
              const isFree = s.sessionType === "free";
              const freeLabel = s.freeTitle || "Séance libre";
              const isInProgress = s.status === "in_progress";
              return (
                <div
                  key={s.id}
                  className="cst-card-dark"
                  role="button"
                  tabIndex={0}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: "1px solid rgba(255,255,255,0.09)",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                    background: "rgba(255,255,255,0.025)",
                  }}
                  onClick={() =>
                    navigate({ to: "/coach/seance/$sessionId", params: { sessionId: s.id } })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    navigate({ to: "/coach/seance/$sessionId", params: { sessionId: s.id } });
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{isFree ? freeLabel : title}</strong>
                      {!s.coachSeen && (
                        <span
                          className="cst-mono"
                          style={{
                            marginLeft: 8,
                            fontSize: 9,
                            padding: "1px 5px",
                            background: "#E07B39",
                            color: "#fff",
                            borderRadius: 3,
                          }}
                        >
                          NOUVEAU
                        </span>
                      )}
                    </div>
                    <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
                      {isInProgress ? "EN COURS" : timeAgo(s.endedAt ?? s.startedAt)} · RPE{" "}
                      {s.averageRpe != null ? Number(s.averageRpe).toFixed(1) : "—"}
                      {isFree ? " · LIBRE" : ""}
                    </span>
                  </div>
                  <span
                    className="cst-btn cst-btn-primary cst-btn-sm"
                    style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
                  >
                    VOIR LA SÉANCE →
                  </span>
                  {!s.coachSeen && (
                    <button
                      type="button"
                      className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onMarkSeen(s.id);
                      }}
                    >
                      ✓ VU
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* Profil coach */}
      {followup.athleteSummary && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div>
              <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7 }}>
                PROFIL ATHLÈTE
              </div>
              <div className="cst-display" style={{ fontSize: 20, marginTop: 2 }}>
                {followup.athleteSummary.tone}
              </div>
            </div>
            <span className="cst-mono" style={{ fontSize: 10, color: "#5BA85A" }}>
              résumé coach
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <div className="cst-mono" style={{ fontSize: 10, color: "#5BA85A", marginBottom: 6 }}>
                FORCES
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.55, opacity: 0.84 }}>
                {followup.athleteSummary.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="cst-mono" style={{ fontSize: 10, color: "#E07B39", marginBottom: 6 }}>
                POINTS À SURVEILLER
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.55, opacity: 0.84 }}>
                {followup.athleteSummary.watchPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="cst-mono" style={{ fontSize: 10, color: "#D9B45A", marginBottom: 6 }}>
                PISTES LÉO
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.55, opacity: 0.84 }}>
                {followup.athleteSummary.coachMoves.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Douleurs encore presentes dans le programme actif */}
      {followup.painProgramAlerts.length > 0 && (
        <div
          className="cst-card-dark"
          style={{
            padding: 16,
            border: "1px solid rgba(192,57,43,0.35)",
            boxShadow: "0 0 0 1px rgba(192,57,43,0.08)",
          }}
        >
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#ff8a7a", marginBottom: 10 }}>
            EXOS DOULOUREUX ENCORE AU PROGRAMME
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {followup.painProgramAlerts.map((alert) => (
              <div
                key={alert.exerciseName}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "start",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  paddingBottom: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{alert.exerciseName}</strong>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {alert.zone || "Zone non précisée"} · {alert.reportCount} signalement
                    {alert.reportCount > 1 ? "s" : ""} · max {alert.maxIntensity}/5
                  </div>
                  <div className="cst-mono" style={{ fontSize: 10, opacity: 0.62, marginTop: 5 }}>
                    {alert.locations.join(" · ")}
                  </div>
                  {alert.latestComment && (
                    <div style={{ fontSize: 12, opacity: 0.76, fontStyle: "italic", marginTop: 5 }}>
                      « {alert.latestComment} »
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() =>
                    navigate({
                      to: "/coach/membre/$memberId/adapter",
                      params: { memberId },
                      search: followup.currentWeek != null ? { week: followup.currentWeek } : {},
                    })
                  }
                >
                  ADAPTER →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Toile d'araignée : support de discussion avec le membre, et argument
          visuel en rendez-vous commercial. */}
      {profile && !profile.empty && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <MovementRadar profile={profile} title="Profil de mouvement" />
        </div>
      )}

      <ExerciseProgressionChart memberId={memberId} />
    </div>
  );
}
