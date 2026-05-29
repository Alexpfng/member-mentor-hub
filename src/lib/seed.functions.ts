import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import seedExercises from "@/data/seed-exercises.json";
import seedPrograms from "@/data/seed-programs.json";

type SeedExercise = {
  name: string;
  color: string | null;
  category: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  default_tempo: string | null;
  sample_notes: string | null;
};

type SeedProgram = {
  program_id: string;
  title: string;
  objective: string | null;
  split: string | null;
  duration_weeks: number | null;
  weeks: Array<{ number: number; days: Array<{ number: number; label: string; exercises: unknown[] }> }>;
};

async function assertCoach(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux coachs");
}

export const seedColosmartData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const coachId = context.userId;

    let exercisesInserted = 0;
    let programsInserted = 0;

    // Library — only seed if no global exercises yet
    const { count: exCount } = await supabaseAdmin
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("is_global", true);

    if ((exCount ?? 0) === 0) {
      const rows = (seedExercises as SeedExercise[]).map((ex) => ({
        name: ex.name,
        category: ex.category || null,
        color: ex.color || null,
        youtube_url: ex.youtube_url || null,
        youtube_id: ex.youtube_id || null,
        default_tempo: ex.default_tempo || null,
        coach_notes: ex.sample_notes || null,
        created_by: coachId,
        is_global: true,
      }));
      // Batch insert in chunks of 200
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin.from("exercises").insert(chunk);
        if (error) throw new Error(`exercises insert failed: ${error.message}`);
        exercisesInserted += chunk.length;
      }
    }

    // Programs — only seed if coach has none
    const { count: progCount } = await supabaseAdmin
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId);

    if ((progCount ?? 0) === 0) {
      const rows = (seedPrograms as SeedProgram[]).map((p) => ({
        coach_id: coachId,
        name: p.title,
        description: [p.objective, p.split].filter(Boolean).join(" · ") || null,
        objective: p.objective ?? null,
        duration_weeks: p.duration_weeks ?? null,
        frequency_per_week: p.weeks?.[0]?.days?.length ?? null,
        level: "intermediate",
        structure: { weeks: p.weeks ?? [] } as unknown as Record<string, unknown>,
      }));
      for (let i = 0; i < rows.length; i += 4) {
        const chunk = rows.slice(i, i + 4);
        const { error } = await supabaseAdmin.from("programs").insert(chunk as never);
        if (error) throw new Error(`programs insert failed: ${error.message}`);
        programsInserted += chunk.length;
      }
    }

    return { exercisesInserted, programsInserted };
  });
