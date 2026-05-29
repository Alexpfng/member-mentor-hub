import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ENABLED } from "@/lib/app-mode";
import MemberNav from "../../components/MemberNav";
import { CSTLogo, CSTSectionNum, CSTAvatar } from "../../components/Atoms";

const DAYS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const today = new Date();
const todayISO = today.toISOString().slice(0, 10);

function getInitials(firstName, lastName) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "??";
}

function getWeekDates() {
  const day = today.getDay(); // 0=dim
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function MemberDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [weekSessions, setWeekSessions] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [lastPR, setLastPR] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPABASE_ENABLED) { setLoading(false); return; }
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { navigate("/login"); return; }
        const uid = u.user.id;

        const [{ data: prof }, { data: assigns }, { data: sessions }, { data: prs }] = await Promise.all([
          supabase.from("profiles").select("first_name,last_name").eq("id", uid).maybeSingle(),
          supabase.from("assignments").select("program_id,programs(name,description)").eq("member_id", uid).eq("active", true).order("created_at", { ascending: false }).limit(1),
          supabase.from("sessions").select("id,date,status,session_label,duration_minutes").eq("member_id", uid).gte("date", getWeekDates()[0]).lte("date", getWeekDates()[6]).order("date"),
          supabase.from("personal_records").select("exercise_name,value_kg,achieved_at").eq("member_id", uid).order("achieved_at", { ascending: false }).limit(1),
        ]);

        setProfile(prof);
        setAssignment(assigns?.[0] ?? null);
        setWeekSessions(sessions ?? []);
        setLastPR(prs?.[0] ?? null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const firstName = profile?.first_name ?? "Athlete";
  const lastName = profile?.last_name ?? "";
  const initials = getInitials(firstName, lastName);
  const programName = assignment?.programs?.name ?? "Aucun programme";

  const weekDates = getWeekDates();
  const dayLabels = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

  const doneSessions = weekSessions.filter((s) => s.status === "completed").length;
  const adherencePct = weekDates.length ? Math.round((doneSessions / 5) * 100) : 0;

  const todaySession = weekSessions.find((s) => s.date === todayISO);
  const inProgress = weekSessions.find((s) => s.status === "in_progress");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)", color: "rgba(255,255,255,0.4)", fontFamily: "var(--cst-mono)", fontSize: 11, letterSpacing: "0.18em" }}>
        CHARGEMENT…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen cst-hatch" style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Top nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 22px 8px" }}>
            <CSTLogo size={11} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CSTAvatar initials={initials} size={28} />
              <ThemeToggle variant="icon" />
              <button

                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/login");
                }}
                className="cst-mono"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.75)",
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  cursor: "pointer",
                }}
                aria-label="Se déconnecter"
              >
                DÉCONNEXION
              </button>
            </div>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "0 22px 90px" }}>
            {/* Header */}
            <div style={{ paddingTop: 14 }}>
              <CSTSectionNum
                num={1}
                label={today.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
                sub={programName.toUpperCase()}
              />
              <div style={{ marginTop: 14 }}>
                <h1 className="cst-display" style={{ fontSize: 38, margin: 0 }}>
                  {today.getHours() < 12 ? "BON MATIN," : today.getHours() < 18 ? "BONNE APRÈS-MIDI," : "BONNE SOIRÉE,"}
                </h1>
                <div className="cst-italic" style={{ fontSize: 30, marginTop: -2 }}>{firstName}.</div>
              </div>
            </div>

            {/* Hero session card */}
            <div
              className="cst-card-dark cst-hatch"
              style={{ marginTop: 18, padding: 20, borderColor: "var(--cst-mid-green)", borderWidth: 2 }}
            >
              {inProgress ? (
                <>
                  <div className="cst-col" style={{ gap: 2 }}>
                    <span className="cst-mono" style={{ fontSize: 9, color: "#F5A623" }}>⏱ SÉANCE EN COURS</span>
                    <div className="cst-display" style={{ fontSize: 22, marginTop: 6 }}>{inProgress.session_label ?? "SÉANCE LIBRE"}</div>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
                  <button
                    className="cst-btn cst-btn-primary"
                    style={{ width: "100%" }}
                    onClick={() => navigate(`/membre/seance/${inProgress.id}`)}
                  >
                    REPRENDRE →
                  </button>
                </>
              ) : todaySession?.status === "completed" ? (
                <>
                  <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>✓ SÉANCE DU JOUR TERMINÉE</span>
                  <div className="cst-display" style={{ fontSize: 20, marginTop: 8 }}>{todaySession.session_label ?? "SÉANCE LIBRE"}</div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
                    {todaySession.duration_minutes ? `${todaySession.duration_minutes} min` : "Durée non enregistrée"}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="cst-col" style={{ gap: 2 }}>
                      <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>★ AUJOURD'HUI</span>
                      <div className="cst-display" style={{ fontSize: 22, marginTop: 6 }}>
                        {assignment ? programName.toUpperCase() : "SÉANCE LIBRE"}
                      </div>
                      {assignment?.programs?.description && (
                        <div className="cst-italic" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                          {assignment.programs.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
                  <button
                    className="cst-btn cst-btn-primary"
                    style={{ width: "100%" }}
                    onClick={() => navigate("/membre/logger")}
                  >
                    COMMENCER →
                  </button>
                </>
              )}
            </div>

            {/* Week strip */}
            <div style={{ marginTop: 22 }}>
              <CSTSectionNum num={2} label="MA SEMAINE" sub={`${doneSessions} / 5 SÉANCES`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginTop: 12 }}>
                {weekDates.map((date, i) => {
                  const sess = weekSessions.find((s) => s.date === date);
                  const isToday = date === todayISO;
                  const isDone = sess?.status === "completed";
                  const isInProgress = sess?.status === "in_progress";
                  return (
                    <div
                      key={date}
                      style={{
                        padding: "10px 4px",
                        textAlign: "center",
                        borderRadius: 8,
                        background: isToday ? "var(--cst-mid-green)" : "rgba(255,255,255,0.03)",
                        border: isToday ? "none" : "1px solid rgba(255,255,255,0.06)",
                        cursor: sess ? "pointer" : "default",
                      }}
                      onClick={() => sess && navigate(isInProgress ? `/membre/seance/${sess.id}` : "/membre/historique")}
                    >
                      <div className="cst-mono" style={{ fontSize: 8, color: isToday ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" }}>
                        {dayLabels[i]}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 14, color: isToday ? "#fff" : isDone ? "var(--cst-mid-green)" : isInProgress ? "#F5A623" : "rgba(255,255,255,0.5)" }}>
                        {isDone ? "✓" : isToday ? "●" : isInProgress ? "⏱" : "○"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="cst-card-dark" style={{ padding: 14 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>ADHÉRENCE · SEMAINE</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                  <span className="cst-display" style={{ fontSize: 28 }}>
                    {doneSessions}<span style={{ opacity: 0.4 }}>/5</span>
                  </span>
                  <span className="cst-mono" style={{ fontSize: 10, color: "var(--cst-mid-green)" }}>
                    {adherencePct}%
                  </span>
                </div>
              </div>
              <div className="cst-card-dark" style={{ padding: 14 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>DERNIER PR</span>
                {lastPR ? (
                  <>
                    <div className="cst-display" style={{ fontSize: 16, marginTop: 6, lineHeight: 1.2 }}>
                      {lastPR.exercise_name?.toUpperCase() ?? "—"}
                    </div>
                    <div className="cst-mono" style={{ fontSize: 10, color: "var(--cst-mid-green)", marginTop: 2 }}>
                      {lastPR.value_kg}KG
                    </div>
                    <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                      {new Date(lastPR.achieved_at).toLocaleDateString("fr-FR")}
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8 }}>Aucun PR encore</div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate("/membre/programme")}
                style={{ fontSize: 11 }}
              >
                MON PROGRAMME →
              </button>
              <button
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate("/membre/historique")}
                style={{ fontSize: 11 }}
              >
                HISTORIQUE →
              </button>
            </div>
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}
