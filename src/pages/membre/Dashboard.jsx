import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigate as useTsNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ENABLED } from "@/lib/app-mode";
import MemberNav from "../../components/MemberNav";
import { CSTLogo, CSTSectionNum, CSTAvatar } from "../../components/Atoms";
import ThemeToggle from "../../components/ThemeToggle";
import { WeightLogDialog } from "../../components/cst/WeightLogDialog";
import { usePRConfetti } from "@/hooks/usePRConfetti";
import { getMemberDashboard } from "@/lib/member-stats.functions";
import { listWeekPlan, upsertPlannedSession } from "@/lib/planning.functions";
import { sanitizeDurationMin } from "@/lib/format";

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
  const tsNavigate = useTsNavigate();
  const [profile, setProfile] = useState(null);
  const [weekSessions, setWeekSessions] = useState([]);
  const [plan, setPlan] = useState(null); // { planned, sessions, dayDefs, weekNumber, assignment }
  const [assignment, setAssignment] = useState(null);
  const [lastPR, setLastPR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [currentWeight, setCurrentWeight] = useState(null);
  const [weightDelta, setWeightDelta] = useState(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightRefresh, setWeightRefresh] = useState(0);
  const [streak, setStreak] = useState(0);
  const [coachMessage, setCoachMessage] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  usePRConfetti(userId);

  const fetchDashboard = useServerFn(getMemberDashboard);
  const fetchPlan = useServerFn(listWeekPlan);
  const upsertPlanned = useServerFn(upsertPlannedSession);

  useEffect(() => {
    if (!SUPABASE_ENABLED) { setLoading(false); return; }
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { navigate("/login"); return; }
        const uid = u.user.id;
        setUserId(uid);

        const [{ data: prof }, { data: assigns }, { data: sessions }] = await Promise.all([
          supabase.from("profiles").select("first_name,last_name").eq("id", uid).maybeSingle(),
          supabase.from("assignments").select("program_id,programs(name,description)").eq("member_id", uid).eq("active", true).order("created_at", { ascending: false }).limit(1),
          supabase.from("sessions").select("id,date,status,session_label,duration_minutes,session_type").eq("member_id", uid).gte("date", getWeekDates()[0]).lte("date", getWeekDates()[6]).order("date"),
        ]);

        setProfile(prof);
        setAssignment(assigns?.[0] ?? null);
        setWeekSessions(sessions ?? []);

        try {
          const p = await fetchPlan({ data: {} });
          setPlan(p);
        } catch (err) {
          console.error("listWeekPlan failed", err);
        }

        try {
          const dash = await fetchDashboard();
          setStreak(dash.streak ?? 0);
          setCurrentWeight(dash.currentWeight != null ? Number(dash.currentWeight) : null);
          setWeightDelta(dash.deltaWeight != null ? Number(dash.deltaWeight) : null);
          setLastPR(dash.lastPR ?? null);
          setCoachMessage(dash.coachMessage ?? null);
        } catch (err) {
          console.error("getMemberDashboard failed", err);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, weightRefresh]);

  const firstName = profile?.first_name ?? "Athlete";
  const lastName = profile?.last_name ?? "";
  const initials = getInitials(firstName, lastName);
  const programName = assignment?.programs?.name ?? "Aucun programme";

  const weekDates = getWeekDates();
  const dayLabels = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

  // Adhérence : séances PROGRAMME terminées / séances prévues cette semaine
  // (les séances libres ne comptent pas, et le dénominateur suit le programme —
  // un plan 3×/semaine complété doit afficher 100 %, pas 60 %).
  const dayDefs = (plan?.dayDefs ?? []).filter((d) => d?.type !== "Repos");
  const doneSessions = weekSessions.filter(
    (s) => s.status === "completed" && (s.session_type ?? "program") === "program",
  ).length;
  const plannedPerWeek = dayDefs.length || 5;
  const adherencePct = weekDates.length
    ? Math.min(100, Math.round((doneSessions / plannedPerWeek) * 100))
    : 0;

  const todaySession = weekSessions.find((s) => s.date === todayISO);
  const inProgress = weekSessions.find((s) => s.status === "in_progress");

  // Plan-derived
  const plannedByDate = new Map();
  (plan?.planned ?? []).forEach((p) => {
    if (p.planned_date) plannedByDate.set(p.planned_date, p);
  });
  const todayPlanned = plannedByDate.get(todayISO) ?? null;

  // « À faire » : exclut le planifié, le terminé ET l'en-cours (sinon une séance
  // commencée réapparaît comme à faire alors qu'elle est reprise ailleurs).
  const usedLabels = new Set(
    (plan?.planned ?? []).map((p) => p.day_label).concat(
      (plan?.sessions ?? [])
        .filter((s) => s.status === "completed" || s.status === "in_progress")
        .map((s) => s.session_label)
        .filter(Boolean),
    ),
  );
  const availableDayDefs = dayDefs.filter((d) => !usedLabels.has(d.label));

  const startSession = (dayLabel) => {
    tsNavigate({
      to: "/membre/logger",
      search: dayLabel ? { day: dayLabel, week: plan?.weekNumber ?? 1 } : {},
    });
  };

  const chooseAndStart = async (def) => {
    if (busy) return;
    setBusy(true);
    try {
      await upsertPlanned({
        data: {
          programId: plan?.assignment?.program_id ?? null,
          weekNumber: plan?.weekNumber ?? 1,
          dayLabel: def.label,
          plannedDate: todayISO,
        },
      });
      startSession(def.label);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)", color: "rgba(255,255,255,0.4)", fontFamily: "var(--cst-mono)", fontSize: 11, letterSpacing: "0.18em" }}>
        CHARGEMENT…
      </div>
    );
  }

  // Hero header label: prefer today's real session/planned label
  const headerSubLabel = (
    inProgress?.session_label
    ?? todaySession?.session_label
    ?? todayPlanned?.day_label
    ?? programName
  ).toUpperCase();

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
                sub={headerSubLabel}
              />
              <div style={{ marginTop: 14 }}>
                <h1 className="cst-display" style={{ fontSize: 38, margin: 0 }}>
                  {today.getHours() < 12 ? "BON MATIN," : today.getHours() < 18 ? "BONNE APRÈS-MIDI," : "BONNE SOIRÉE,"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -2 }}>
                  <div className="cst-italic" style={{ fontSize: 30 }}>{firstName}.</div>
                  {streak > 0 && (
                    <span className="cst-mono" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.35)" }}>
                      🔥 {streak} SEM
                    </span>
                  )}
                </div>
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
                    {sanitizeDurationMin(todaySession.duration_minutes) ? `${sanitizeDurationMin(todaySession.duration_minutes)} min` : "Durée non enregistrée"}
                  </div>
                </>
              ) : todayPlanned ? (
                <>
                  <div className="cst-col" style={{ gap: 2 }}>
                    <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>★ AUJOURD'HUI · PLANIFIÉ</span>
                    <div className="cst-display" style={{ fontSize: 22, marginTop: 6 }}>
                      {todayPlanned.day_label?.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="cst-btn cst-btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => startSession(todayPlanned.day_label)}
                    >
                      COMMENCER →
                    </button>
                    {availableDayDefs.length > 0 && (
                      <button
                        className="cst-btn cst-btn-ghost-dark"
                        style={{ fontSize: 10 }}
                        onClick={() => setChoosing((v) => !v)}
                      >
                        CHANGER
                      </button>
                    )}
                  </div>
                  {choosing && availableDayDefs.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>AUTRES SÉANCES DE LA SEMAINE</span>
                      {availableDayDefs.map((d) => (
                        <button
                          key={d.label}
                          disabled={busy}
                          onClick={() => chooseAndStart(d)}
                          className="cst-btn cst-btn-ghost-dark"
                          style={{ fontSize: 11, justifyContent: "flex-start", textAlign: "left" }}
                        >
                          → {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : availableDayDefs.length > 0 ? (
                <>
                  <div className="cst-col" style={{ gap: 2 }}>
                    <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>★ CHOISIR MA SÉANCE</span>
                    <div className="cst-display" style={{ fontSize: 18, marginTop: 6 }}>
                      QUE FAIS-TU AUJOURD'HUI ?
                    </div>
                    <div className="cst-italic" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                      {programName}
                    </div>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {availableDayDefs.map((d) => (
                      <button
                        key={d.label}
                        disabled={busy}
                        onClick={() => chooseAndStart(d)}
                        className="cst-btn cst-btn-primary"
                        style={{ fontSize: 12, justifyContent: "space-between", display: "flex", alignItems: "center", gap: 8, height: "auto", minHeight: 44, padding: "10px 16px" }}
                      >
                        <span style={{ flex: 1, textAlign: "left", whiteSpace: "normal", wordBreak: "break-word" }}>{d.label}</span>
                        <span style={{ flexShrink: 0 }}>→</span>
                      </button>
                    ))}
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
                    onClick={() => navigate(assignment ? "/membre/commencer" : "/membre/composer")}
                  >
                    {assignment ? "COMMENCER →" : "CRÉER MA SÉANCE →"}
                  </button>
                </>
              )}
            </div>

            <button
              className="cst-btn cst-btn-ghost-dark"
              onClick={() => navigate("/membre/commencer")}
              style={{ width: "100%", marginTop: 10, fontSize: 11 }}
            >
              CHOISIR UNE AUTRE SÉANCE →
            </button>

            <button
              className="cst-btn cst-btn-ghost-dark"
              onClick={() => navigate("/membre/composer")}
              style={{ width: "100%", marginTop: 8, fontSize: 11 }}
            >
              ✏️ CRÉER MA SÉANCE →
            </button>

            <button
              className="cst-btn cst-btn-ghost-dark"
              onClick={() => navigate("/membre/bibliotheque")}
              style={{ width: "100%", marginTop: 8, fontSize: 11 }}
            >
              📚 BIBLIOTHÈQUE D'EXERCICES →
            </button>



            {/* Week strip */}
            <div style={{ marginTop: 22 }}>
              <CSTSectionNum num={2} label="MA SEMAINE" sub={`${doneSessions} / ${plannedPerWeek} SÉANCES`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginTop: 12 }}>
                {weekDates.map((date, i) => {
                  const sess = weekSessions.find((s) => s.date === date);
                  const planned = plannedByDate.get(date);
                  const isToday = date === todayISO;
                  const isDone = sess?.status === "completed";
                  const isInProgress = sess?.status === "in_progress";
                  const label = sess?.session_label ?? planned?.day_label ?? null;
                  const clickable = !!(sess || planned);
                  return (
                    <div
                      key={date}
                      style={{
                        padding: "10px 4px",
                        minWidth: 0,
                        overflow: "hidden",
                        textAlign: "center",
                        borderRadius: 8,
                        background: isToday ? "var(--cst-mid-green)" : "rgba(255,255,255,0.03)",
                        border: isToday ? "none" : "1px solid rgba(255,255,255,0.06)",
                        cursor: clickable ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (isInProgress) navigate(`/membre/seance/${sess.id}`);
                        else if (isDone) navigate("/membre/historique");
                        else if (planned && isToday) startSession(planned.day_label);
                        else if (planned || sess) navigate("/membre/planning");
                      }}
                    >
                      <div className="cst-mono" style={{ fontSize: 8, color: isToday ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" }}>
                        {dayLabels[i]}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 14, color: isToday ? "#fff" : isDone ? "var(--cst-mid-green)" : isInProgress ? "#F5A623" : planned ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>
                        {isDone ? "✓" : isInProgress ? "⏱" : planned ? "●" : isToday ? "●" : "○"}
                      </div>
                      {label && (
                        <div
                          className="cst-mono"
                          style={{
                            marginTop: 4,
                            fontSize: 7,
                            lineHeight: 1.1,
                            color: isToday ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={label}
                        >
                          {label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <div className="cst-card-dark" style={{ padding: 14 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>ADHÉRENCE · SEMAINE</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                  <span className="cst-display" style={{ fontSize: 28 }}>
                    {doneSessions}<span style={{ opacity: 0.4 }}>/{plannedPerWeek}</span>
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
                      {lastPR.weight_kg != null ? `${lastPR.weight_kg}KG` : lastPR.reps != null ? `${lastPR.reps} REPS` : "—"}
                    </div>
                    {lastPR.date && (
                      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                        {new Date(lastPR.date).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8 }}>Aucun PR encore</div>
                )}
              </div>
            </div>

            {/* Weight card */}
            <div className="cst-card-dark" style={{ marginTop: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>POIDS DU CORPS</span>
                {currentWeight != null ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="cst-display" style={{ fontSize: 24 }}>{currentWeight} <span style={{ fontSize: 12, opacity: 0.5 }}>KG</span></span>
                    {weightDelta != null && weightDelta !== 0 && (
                      <span className="cst-mono" style={{ fontSize: 10, color: weightDelta < 0 ? "var(--cst-mid-green)" : "#F5A623" }}>
                        {weightDelta > 0 ? "▲" : "▼"} {Math.abs(weightDelta).toFixed(1)} KG
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.5 }}>Pas encore noté</div>
                )}
              </div>
              <button className="cst-btn cst-btn-ghost-dark" style={{ fontSize: 10 }} onClick={() => setWeightOpen(true)}>
                + NOTER
              </button>
            </div>

            {/* Coach message */}
            {coachMessage?.content && (
              <button
                onClick={() => navigate("/membre/messages")}
                style={{ all: "unset", cursor: "pointer", marginTop: 14, padding: 14, display: "block", borderRadius: 10, border: "1px solid rgba(110,171,118,0.35)", background: "rgba(110,171,118,0.08)", width: "100%", boxSizing: "border-box" }}
              >
                <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-mid-green)" }}>💬 MESSAGE COACH</span>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.4, color: "rgba(255,255,255,0.85)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {coachMessage.content}
                </div>
              </button>
            )}

            {/* Quick links */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <button
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate("/membre/programme")}
                style={{ fontSize: 11 }}
              >
                MON PROGRAMME →
              </button>
              <button
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate("/membre/carnet")}
                style={{ fontSize: 11 }}
              >
                MON CARNET →
              </button>
              <button
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate("/membre/planning")}
                style={{ fontSize: 11 }}
              >
                PLANNING →
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

      <WeightLogDialog
        open={weightOpen}
        onOpenChange={(o) => { setWeightOpen(o); if (!o) setWeightRefresh((n) => n + 1); }}
      />
    </div>
  );
}
