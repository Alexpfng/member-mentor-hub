import { useEffect, useState } from "react";
import { useNavigate as useRRDNavigate } from "@/lib/rrd-shim";
import { useNavigate as useTSNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listWeekPlan, upsertPlannedSession } from "@/lib/planning.functions";
import { createFreeSession } from "@/lib/free-session.functions";
import MemberNav from "../../components/MemberNav";
import { CSTLogo, CSTSectionNum } from "../../components/Atoms";
import { toast } from "sonner";

type PlannedRow = {
  id: string;
  day_label: string;
  status: string;
  planned_date: string | null;
  week_number: number | null;
};

type SessionRow = {
  id: string;
  status: string;
  session_label: string | null;
  date: string | null;
  ended_at: string | null;
};

type DayDef = { label?: string; type?: string };

type PlanResult = {
  weekNumber: number;
  assignment: { program_id?: string | null; programs?: { name?: string | null } | null } | null;
  dayDefs?: DayDef[];
  planned?: PlannedRow[];
  sessions?: SessionRow[];
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d}j`;
  if (d < 30) return `il y a ${Math.floor(d / 7)} sem`;
  return `il y a ${Math.floor(d / 30)} mois`;
}

export default function Commencer() {
  const rrdNav = useRRDNavigate();
  const tsNav = useTSNavigate();
  const fetchPlan = useServerFn(listWeekPlan);
  const upsertPlanned = useServerFn(upsertPlannedSession);
  const createFree = useServerFn(createFreeSession);

  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) {
          rrdNav("/login");
          return;
        }
        const p = (await fetchPlan({ data: {} })) as PlanResult;
        setPlan(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPlan, rrdNav]);

  const programName = plan?.assignment?.programs?.name ?? null;
  const dayDefs = (plan?.dayDefs ?? []).filter((d) => d?.type !== "Repos" && d?.label);
  const sessionsByLabel = new Map<string, SessionRow>();
  for (const s of plan?.sessions ?? []) {
    if (s.session_label) sessionsByLabel.set(s.session_label.toLowerCase(), s);
  }

  // recommandée = première séance non faite
  let recommendedIdx = -1;
  for (let i = 0; i < dayDefs.length; i++) {
    const label = (dayDefs[i].label ?? "").toLowerCase();
    const s = sessionsByLabel.get(label);
    if (!s || s.status !== "completed") {
      recommendedIdx = i;
      break;
    }
  }

  async function startProgramSession(label: string) {
    if (busy) return;
    setBusy(true);
    try {
      await upsertPlanned({
        data: {
          programId: plan?.assignment?.program_id ?? null,
          weekNumber: plan?.weekNumber ?? 1,
          dayLabel: label,
          plannedDate: todayISO(),
        },
      });
      tsNav({ to: "/membre/logger", search: { day: label, week: plan?.weekNumber ?? 1 } });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function startFreeSession() {
    if (busy) return;
    setBusy(true);
    try {
      const r = (await createFree({ data: {} })) as { sessionId: string };
      tsNav({ to: "/membre/seance-libre/$sessionId", params: { sessionId: r.sessionId } });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)" }}>
        <span className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.18em" }}>CHARGEMENT…</span>
      </div>
    );
  }

  const hasProgram = !!plan?.assignment && dayDefs.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen cst-hatch" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 22px 8px" }}>
            <button
              onClick={() => rrdNav("/membre")}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 18, cursor: "pointer", padding: 0 }}
              aria-label="Retour"
            >
              ←
            </button>
            <CSTLogo size={11} />
            <span style={{ width: 18 }} />
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "0 22px 90px" }}>
            <div style={{ paddingTop: 14 }}>
              <CSTSectionNum num={1} label="COMMENCER" sub="UNE SÉANCE" />
              <h1 className="cst-display" style={{ fontSize: 30, margin: "8px 0 4px" }}>QUE FAIS-TU</h1>
              <div className="cst-italic" style={{ fontSize: 26 }}>aujourd'hui&nbsp;?</div>
            </div>

            {hasProgram && (
              <div style={{ marginTop: 22 }}>
                <CSTSectionNum num={2} label="MON PROGRAMME" sub={(programName ?? "").toUpperCase()} />
                <div className="cst-col" style={{ gap: 6, marginTop: 12 }}>
                  {dayDefs.map((d, idx) => {
                    const label = d.label ?? "";
                    const s = sessionsByLabel.get(label.toLowerCase());
                    const done = s?.status === "completed";
                    const inProgress = s?.status === "in_progress";
                    const recommended = idx === recommendedIdx && !done;
                    const icon = done ? "✓" : inProgress ? "⏱" : recommended ? "●" : "○";
                    const iconColor = done ? "var(--cst-mid-green)" : inProgress ? "#F5A623" : recommended ? "#F5A623" : "rgba(255,255,255,0.45)";
                    return (
                      <button
                        key={`${label}-${idx}`}
                        onClick={() => {
                          if (inProgress && s) {
                            tsNav({ to: "/membre/seance/$sessionId", params: { sessionId: s.id } });
                          } else {
                            startProgramSession(label);
                          }
                        }}
                        disabled={busy}
                        className="cst-card-dark"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          textAlign: "left",
                          cursor: busy ? "wait" : "pointer",
                          border: recommended ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.08)",
                          background: done ? "rgba(110,171,118,0.06)" : "rgba(255,255,255,0.03)",
                          width: "100%",
                        }}
                      >
                        <span style={{ fontSize: 16, color: iconColor, width: 18, textAlign: "center" }}>{icon}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div className="cst-display" style={{ fontSize: 14, color: done ? "rgba(255,255,255,0.6)" : "#fff" }}>
                            {label.toUpperCase()}
                          </div>
                          <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, marginTop: 2 }}>
                            {done
                              ? `fait ${timeAgo(s?.ended_at ?? s?.date)}`
                              : inProgress
                                ? "EN COURS"
                                : recommended
                                  ? "RECOMMANDÉE"
                                  : "À FAIRE"}
                          </div>
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 16 }}>▶</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 26 }}>
              {hasProgram && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                  <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.2em" }}>OU</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                </div>
              )}

              <div
                className="cst-card-dark cst-hatch"
                style={{
                  padding: 20,
                  borderColor: "var(--cst-mid-green)",
                  borderWidth: hasProgram ? 1 : 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>✦ SÉANCE LIBRE</span>
                <div className="cst-display" style={{ fontSize: hasProgram ? 18 : 24 }}>
                  HORS PROGRAMME
                </div>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
                  Entraîne-toi librement et raconte à ton coach ce que tu as fait : exercices, photos, vidéos, notes.
                </p>
                <button
                  onClick={startFreeSession}
                  disabled={busy}
                  className="cst-btn cst-btn-primary"
                  style={{ width: "100%", marginTop: 6 }}
                >
                  DÉMARRER UNE SÉANCE LIBRE →
                </button>
              </div>
            </div>
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}
