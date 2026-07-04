import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { mergeAssignmentWeeks } from "@/lib/program-weeks";
import { localDateISO } from "@/lib/local-date";

const searchSchema = z.object({
  day: z.string().min(1).max(120).optional(),
  week: z.coerce.number().int().min(0).optional(),
});

export const Route = createFileRoute("/_authenticated/membre/logger")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SessionLauncher,
});

type ProgramStructure = {
  weeks?: Array<{ days?: Array<{ label?: string }> }>;
};

/**
 * Entry point that creates (or resumes/updates) an in-progress session for
 * the current member, then redirects to /membre/seance/$id.
 *
 * Accepts ?day=<label>&week=<n> so the member can start the specific session
 * picked from the planning. When `day` is provided we resolve the matching
 * `day_number` from the program structure and force the in-progress session
 * to reflect that choice (so the séance page loads the right exercises).
 */
function SessionLauncher() {
  const navigate = useNavigate();
  const search = useSearch({ from: Route.id }) as { day?: string; week?: number };
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          navigate({ to: "/login" } as any);
          return;
        }
        const uid = u.user.id;

        // Active assignment (for program_id + structure)
        const { data: assignment } = await supabase
          .from("assignments")
          .select("id, program_id, start_date, programs(structure)")
          .eq("member_id", uid)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const programId = assignment?.program_id ?? null;
        const structure = (assignment as { programs?: { structure?: ProgramStructure } } | null)
          ?.programs?.structure;

        // Compute current week index from assignment start
        let currentWeek = 0;
        if (assignment?.start_date) {
          const start = new Date(assignment.start_date);
          const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
          currentWeek = Math.max(0, Math.floor(diff / 7));
        }
        // `?week=` est le numéro de semaine 1-based (convention DB unifiée).
        // Math.max tolère d'anciennes URLs 0-based en les rabattant sur la semaine 1.
        const weekIndex = Math.max(0, (search.week ?? currentWeek + 1) - 1);
        const sessionWeekNumber = weekIndex + 1;

        // Fusionne les semaines adaptées (assignment_weeks) sur le template, pour que le
        // jour choisi soit résolu contre la structure RÉELLEMENT assignée au membre (une
        // semaine adaptée peut ne pas exister dans le template). Le membre peut lire ses
        // propres semaines publiées (RLS).
        let awQuery = supabase
          .from("assignment_weeks")
          .select("week_number, structure")
          .eq("member_id", uid)
          .in("status", ["published", "in_progress", "done"]);
        if (assignment?.id) awQuery = awQuery.eq("assignment_id", assignment.id);
        else if (programId) awQuery = awQuery.eq("program_id", programId);
        const { data: adaptedWeeks } = await awQuery;
        const weeks = mergeAssignmentWeeks(structure, adaptedWeeks ?? []);

        // Resolve day_number (1-based) from day_label within the program week
        const normalize = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        let dayNumber: number | null = null;
        let sessionLabel: string | null = search.day ?? null;
        const weekDays = weeks[weekIndex]?.days ?? null;
        if (search.day && weekDays) {
          const target = normalize(search.day);
          const idx = weekDays.findIndex((d) => normalize(d?.label ?? "") === target);
          if (idx >= 0) {
            dayNumber = idx + 1;
            sessionLabel = weekDays[idx].label ?? search.day;
          }
        }

        // Existing in-progress session for this member (most recent)
        const { data: existing } = await supabase
          .from("sessions")
          .select("id, session_label, program_id, week_number, day_number")
          .eq("member_id", uid)
          .eq("status", "in_progress")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Case A: a specific session was picked
        if (search.day) {
          if (dayNumber == null) {
            // Label didn't match the program structure — don't create a stub session.
            setError(
              `Le jour « ${search.day} » n'existe pas dans le programme (semaine ${weekIndex + 1}). Choisis une séance du programme ou demande à ton coach.`,
            );
            return;
          }

          if (existing?.id) {
            // Realign the existing in-progress session to the chosen one.
            const isDifferentSession =
              existing.week_number !== sessionWeekNumber ||
              existing.day_number !== dayNumber ||
              existing.program_id !== programId;
            if (isDifferentSession) {
              // La session change de séance : on purge les séries déjà loguées et le
              // snapshot local de l'ancienne séance, sinon elles se retrouvent
              // rattachées (volume/RPE/historique) à la nouvelle et le snapshot
              // restaure la position de l'ancienne par-dessus les nouveaux exercices.
              await supabase.from("set_logs").delete().eq("session_id", existing.id);
              await supabase.from("exercise_feedbacks").delete().eq("session_id", existing.id);
              try {
                localStorage.removeItem(`cst_session_${existing.id}`);
              } catch {
                /* stockage local indisponible : le garde-fou serveur suffit */
              }
            }
            await supabase
              .from("sessions")
              .update({
                program_id: programId,
                week_number: sessionWeekNumber,
                day_number: dayNumber,
                session_label: sessionLabel,
              })
              .eq("id", existing.id)
              .eq("member_id", uid);
            navigate({ to: "/membre/seance/$sessionId", params: { sessionId: existing.id } });
            return;
          }

          const today = localDateISO();
          const { data: created, error: err } = await supabase
            .from("sessions")
            .insert({
              member_id: uid,
              program_id: programId,
              date: today,
              started_at: new Date().toISOString(),
              status: "in_progress",
              session_label: sessionLabel,
              week_number: sessionWeekNumber,
              day_number: dayNumber,
            })
            .select("id")
            .single();
          if (err) throw err;
          navigate({ to: "/membre/seance/$sessionId", params: { sessionId: created.id } });
          return;
        }


        // Case B: no explicit choice → resume in-progress if any, else go to choice screen.
        if (existing?.id) {
          navigate({ to: "/membre/seance/$sessionId", params: { sessionId: existing.id } });
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: "/membre/commencer" } as any);
        return;
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [navigate, search.day, search.week]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)", color: "rgba(255,255,255,0.6)" }}>
      <div className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.18em" }}>
        {error ? `ERREUR · ${error}` : "PRÉPARATION DE LA SÉANCE…"}
      </div>
    </div>
  );
}
