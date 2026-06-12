import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ---------------------------------------------------------------------------
 * Séance auto-composée par le membre (Feature A).
 * Le coaché pioche des exercices dans la bibliothèque, fixe ses cibles
 * (séries/reps/charge/RPE) puis lance la séance. Les exercices planifiés sont
 * stockés sur la séance (sessions.planned_exercises) et relus par la route
 * d'exécution (LiveSession) — exactement comme une séance créée par le coach.
 * ------------------------------------------------------------------------- */

const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(20).optional().nullable(),
  series: z.union([z.string(), z.number()]).optional().nullable(),
  reps: z.union([z.string(), z.number()]).optional().nullable(),
  charge: z.string().max(80).optional().nullable(),
  tempo: z.string().max(40).optional().nullable(),
  recup: z.string().max(40).optional().nullable(),
  rpe_target: z.union([z.string(), z.number()]).optional().nullable(),
  youtube_url: z.string().max(400).optional().nullable(),
  youtube_id: z.string().max(40).optional().nullable(),
});

export const createComposedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().max(200).optional().nullable(),
        exercises: z.array(exerciseSchema).min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        member_id: context.userId,
        session_type: "self",
        session_label: data.title?.trim() || "Ma séance",
        date: today,
        started_at: new Date().toISOString(),
        status: "in_progress",
        planned_exercises: data.exercises,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: row.id as string };
  });

/* Notifie le coach (message) qu'un membre a réalisé sa propre séance. Non-bloquant. */
export const notifyCoachComposedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { data: sess } = await supabaseAdmin
        .from("sessions")
        .select("session_label, member_id")
        .eq("id", data.sessionId)
        .maybeSingle();
      if (!sess || sess.member_id !== context.userId) return { ok: true };

      const { data: coachRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach")
        .limit(1)
        .maybeSingle();
      if (coachRole?.user_id) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", context.userId)
          .maybeSingle();
        const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Un membre";
        await supabaseAdmin.from("messages").insert({
          from_id: context.userId,
          to_id: coachRole.user_id,
          content: `${name} a réalisé sa propre séance · ${sess.session_label ?? "Ma séance"}`,
        });
      }
    } catch {
      /* non-bloquant */
    }
    return { ok: true };
  });
