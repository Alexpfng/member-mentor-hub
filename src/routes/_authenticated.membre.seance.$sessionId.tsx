import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MemberNav from "../components/MemberNav";
import { CSTLogo } from "../components/Atoms";
import { type ProgExercise } from "../components/cst/ProgramBlocks";
import { LiveSession } from "../components/cst/LiveSession";

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
};

type ProgramStructure = {
  weeks?: Array<{
    days?: Array<{
      label?: string;
      exercises?: ProgExercise[];
    }>;
  }>;
};

const DEFAULT_EXERCISES: ProgExercise[] = [
  { name: "Tractions pronation", series: 4, reps: "6-10", rpe_target: 8, tempo: "3010", color: "red" },
  { name: "Row barre", series: 4, reps: "8", rpe_target: 8, tempo: "2011", color: "red" },
  { name: "Face pull", series: 3, reps: "15", rpe_target: 7, tempo: "2012", color: "blue" },
  { name: "Curl barre", series: 3, reps: "10", rpe_target: 7, tempo: "3010", color: "green" },
];

function SeancePage() {
  const { sessionId } = useParams({ from: "/_authenticated/membre/seance/$sessionId" });
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ProgExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      const { data: s } = await supabase
        .from("sessions").select("*").eq("id", sessionId).maybeSingle();
      setSession(s as SessionRow | null);

      let exos: ProgExercise[] = [];
      let resolutionError: string | null = null;
      if (s?.program_id) {
        const { data: prog } = await supabase
          .from("programs").select("structure").eq("id", s.program_id).maybeSingle();
        const struct = prog?.structure as ProgramStructure | undefined;
        const w = (s.week_number ?? 1) - 1;
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
      const startedAt = session?.started_at ? new Date(session.started_at).getTime() : Date.now();
      const duration = Math.max(1, Math.round((Date.now() - startedAt) / 60000));

      await supabase.from("sessions").update({
        ended_at: new Date().toISOString(),
        status: "completed",
        total_volume_kg: totalVol,
        average_rpe: rpeCount ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
        duration_minutes: duration,
      }).eq("id", sessionId);

      navigate({ to: "/membre/historique" });
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
            <LiveSession
              sessionId={sessionId}
              userId={userId}
              sessionLabel={session?.session_label ?? null}
              exercises={exercises}
              onFinish={finishSession}
              finishing={finishing}
            />
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}
