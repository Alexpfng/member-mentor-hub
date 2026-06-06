import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createSchema = z.object({
  session_id: z.string().uuid().nullable().optional(),
  exercise_name: z.string().min(1).max(200),
  zone: z.string().min(1).max(120),
  intensity: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export const createPainReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await supabaseAdmin
      .from("pain_reports")
      .insert({
        member_id: context.userId,
        session_id: data.session_id ?? null,
        exercise_name: data.exercise_name,
        zone: data.zone,
        intensity: data.intensity,
        comment: data.comment ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

async function assertCoach(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux coachs");
}

export const resolvePainReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("pain_reports")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
