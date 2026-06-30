import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyCoachComposedSession } from "@/lib/composed-session.functions";
import MemberNav from "../components/MemberNav";
import { CSTLogo } from "../components/Atoms";
import { type ProgExercise } from "../components/cst/ProgramBlocks";
import { LiveSession } from "../components/cst/LiveSession";
import { RunningSession, isRunningSession } from "../components/cst/RunningSession";
import { computeSessionDurationMin } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/membre/seance/$sessionId")({
  component: SeancePage,
});

type SessionRow = {
  id: string;
  member_id: string;
  program_id: string | null;
  session_label: string | null;
  week_number: number | null;
  day_number: number | null;
  started_at: string | null;
  status: string | null;
  session_type: string | null;
  planned_exercises: ProgExercise[] | null;
};

type ProgramStructure = {
  weeks?: Array<{
    days?: Array<{
      label?: string;
      exercises?: ProgExercise[];
    }>;
  }>;
};




function SeancePage() {
  const { sessionId } = useParams({ from: "/_authenticated/membre/seance/$sessionId" });
  const navigate = useNavigate();
  const notifyCoach = useServerFn(notifyCoachComposedSession);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ProgExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"expert" | "debutant">("debutant");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      const { data: s } = await supabase
        .from("sessions").select("*").eq("id", sessionId).maybeSingle();
      setSession(s as SessionRow | null);

      // Fetch session_mode from active assignment
      if (u.user?.id) {
        const { data: asgn } = await supabase
          .from("assignments")
          .select("session_mode")
          .eq("member_id", u.user.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        const mode = (asgn as { session_mode?: string | null } | null)?.session_mode;
        if (mode === "expert" || mode === "debutant") setSessionMode(mode);
      }

      let exos: ProgExercise[] = [];
      let resolutionError: string | null = null;
      if (s?.program_id) {
        const { data: prog } = await supabase
          .from("programs").select("structure").eq("id", s.program_id).maybeSingle();
        const struct = prog?.structure as ProgramStructure | undefined;
        const w = s.week_number ?? 0;
        const d = (s.day_number ?? 1) - 1;
        const day = struct?.weeks?.[w]?.days?.[d];
        if (day?.exercises?.length) {
          exos = day.exercises;
        } else {
          resolutionError = `Aucun exercice trouvé pour ${s.session_label ?? "ce jour"} (semaine ${w + 1}, jour ${d + 1}).`;
          console.warn("[seance] structure lookup failed", {
            sessionId, programId: s.program_id, week: w, day: d, label: s.session_label,
          });
        }
      } else if (s?.planned_exercises) {
        // Séance auto-composée par le membre (session_type 'self') : les exercices
        // planifiés sont portés par la séance elle-même.
        const planned = (s.planned_exercises as ProgExercise[] | null) ?? [];
        if (planned.length) exos = planned;
        else resolutionError = "Cette séance ne contient aucun exercice.";
      } else if (s) {
        resolutionError = "Cette séance n'est rattachée à aucun programme.";
      } else {
        resolutionError = "Séance introuvable.";
      }
      setExercises(exos);
      setLoadError(resolutionError);
      setLoading(false);
    })();
  }, [sessionId]);


  async function finishSession() {
    setFinishing(true);
    try {
      // Compute totals from set_logs
      const { data: logs } = await supabase
        .from("set_logs").select("weight_kg, reps, rpe").eq("session_id", sessionId);
      let totalVol = 0;
      let rpeSum = 0;
      let rpeCount = 0;
      (logs ?? []).forEach((l) => {
        if (l.weight_kg && l.reps) totalVol += Number(l.weight_kg) * l.reps;
        if (l.rpe != null) { rpeSum += l.rpe; rpeCount += 1; }
      });
      // Durée bornée : null si pas de début connu ou séance laissée ouverte (>4 h).
      const duration = computeSessionDurationMin(session?.started_at);

      const { error: updateErr } = await supabase.from("sessions").update({
        ended_at: new Date().toISOString(),
        status: "completed",
        total_volume_kg: totalVol,
        average_rpe: rpeCount ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
        duration_minutes: duration,
      }).eq("id", sessionId);
      if (updateErr) throw new Error(updateErr.message);

      // Séance auto-composée : prévenir le coach (non-bloquant).
      if (session?.session_type === "self") {
        await notifyCoach({ data: { sessionId } }).catch(() => {});
      }

      navigate({ to: "/membre/historique" });
    } catch (err) {
      console.error("[finishSession]", err);
      toast.error("Impossible de terminer la séance. Vérifie ta connexion et réessaie.");
      throw err; // propage : l'appelant garde l'état de reprise (snapshot) pour réessayer
    } finally {
      setFinishing(false);
    }
  }

  if (loading || !userId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)", color: "rgba(255,255,255,0.5)", fontFamily: "var(--cst-mono)", fontSize: 11 }}>
        CHARGEMENT…
      </div>
    );
  }

  const running = isRunningSession(session?.session_label, exercises);

  if ((loadError || exercises.length === 0) && !running) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)", padding: 24 }}>
        <div style={{ maxWidth: 360, textAlign: "center", color: "rgba(255,255,255,0.85)" }}>
          <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#C56A60", marginBottom: 10 }}>
            SÉANCE INDISPONIBLE
          </div>
          <div className="cst-display" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 12 }}>
            {loadError ?? "Aucun exercice n'est défini pour ce jour."}
          </div>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 20 }}>
            Contacte ton coach pour qu'il vérifie ton programme, ou choisis une autre séance.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate({ to: "/membre/commencer" })}
              className="cst-btn cst-btn-primary"
              style={{ padding: "10px 18px" }}
            >
              CHOISIR UNE AUTRE SÉANCE
            </button>
            <button
              onClick={() => navigate({ to: "/membre" })}
              className="cst-mono"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 6, padding: "10px 16px", fontSize: 11, cursor: "pointer", letterSpacing: "0.12em" }}
            >
              ACCUEIL
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
      <div style={{ width: 390, minHeight: 780, position: "relative" }}>
        <div className="cst-screen cst-hatch" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 22px 4px" }}>
            <CSTLogo size={11} />
            <button
              onClick={() => navigate({ to: "/membre" })}
              className="cst-mono"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", letterSpacing: "0.12em" }}
            >
              ← QUITTER
            </button>
          </div>

          <div style={{ flex: 1, paddingBottom: 80, display: "flex", flexDirection: "column" }}>
            {running ? (
              <RunningSession
                sessionId={sessionId}
                userId={userId!}
                sessionLabel={session?.session_label ?? null}
                exercises={exercises}
                onFinish={() => navigate({ to: "/membre/historique" })}
                finishing={finishing}
              />
            ) : (
              <LiveSession
                sessionId={sessionId}
                userId={userId}
                sessionLabel={session?.session_label ?? null}
                exercises={exercises}
                onFinish={finishSession}
                finishing={finishing}
                initialMode={sessionMode}
              />
            )}
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}
