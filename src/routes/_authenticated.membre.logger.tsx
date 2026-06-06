import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  day: z.string().min(1).max(120).optional(),
  week: z.coerce.number().int().min(0).optional(),
});

export const Route = createFileRoute("/_authenticated/membre/logger")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SessionLauncher,
});

/**
 * Entry point that creates (or resumes) an in-progress session for the
 * current member, then redirects to /membre/seance/$id.
 *
 * Accepts ?day=<label>&week=<n> so the member can start a specific session
 * picked from the planning.
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

        // Resume any in-progress session
        const { data: existing } = await supabase
          .from("sessions")
          .select("id")
          .eq("member_id", u.user.id)
          .eq("status", "in_progress")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          navigate({ to: "/membre/seance/$sessionId", params: { sessionId: existing.id } });
          return;
        }

        // Otherwise create a new one. Pick first active assignment if any.
        const { data: assignment } = await supabase
          .from("assignments")
          .select("program_id")
          .eq("member_id", u.user.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const today = new Date().toISOString().slice(0, 10);
        const { data: created, error: err } = await supabase
          .from("sessions")
          .insert({
            member_id: u.user.id,
            program_id: assignment?.program_id ?? null,
            date: today,
            started_at: new Date().toISOString(),
            status: "in_progress",
            session_label: search.day ?? "Séance libre",
            week_number: search.week ?? null,
          })
          .select("id")
          .single();
        if (err) throw err;
        navigate({ to: "/membre/seance/$sessionId", params: { sessionId: created.id } });
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
