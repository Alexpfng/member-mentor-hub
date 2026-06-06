import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import seedExercises from "@/data/seed-exercises-v2.json";

type SeedRow = {
  id: string;
  nom: string;
  categorie: string | null;
  muscle_group: string | null;
  equipement: string | null;
  tempo_defaut: string | null;
  youtube_url: string | null;
  consignes: string | null;
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

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const VALID_INTENSITY = new Set([
  "epuisant",
  "semi_epuisant",
  "isolation",
  "prevention",
  "plyo",
  "non_classe",
]);

const VALID_PATTERNS = new Set([
  "push", "pull", "legs", "hinge", "core", "cardio", "mobility", "carry", "other",
]);

const exerciseInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  intensity_code: z.string().max(40).optional().nullable(),
  muscle_group: z.string().max(80).optional().nullable(),
  equipement: z.string().max(80).optional().nullable(),
  default_tempo: z.string().max(40).optional().nullable(),
  youtube_url: z.string().trim().max(500).optional().nullable(),
  coach_notes: z.string().max(2000).optional().nullable(),
  is_archived: z.boolean().optional(),
  movement_patterns: z.array(z.string().max(20)).max(8).optional().nullable(),
});

export const listExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exercises")
      .select(
        "id, name, intensity_code, category, color, muscle_group, equipement, default_tempo, youtube_url, youtube_id, coach_notes, is_archived, is_global"
      )
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { exercises: data ?? [] };
  });

export const listIntensityCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("intensity_codes")
      .select("code, label, description, color_hex")
      .order("code");
    if (error) throw new Error(error.message);
    return { codes: data ?? [] };
  });

export const listGlossary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("glossary")
      .select("cle, titre, contenu")
      .order("titre");
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });

export const upsertExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => exerciseInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const intensity =
      data.intensity_code && VALID_INTENSITY.has(data.intensity_code)
        ? data.intensity_code
        : null;
    const payload = {
      name: data.name,
      intensity_code: intensity,
      category: intensity, // keep legacy "category" in sync
      muscle_group: data.muscle_group?.trim() || null,
      equipement: data.equipement?.trim() || null,
      default_tempo: data.default_tempo?.trim() || null,
      youtube_url: data.youtube_url?.trim() || null,
      youtube_id: extractYoutubeId(data.youtube_url),
      coach_notes: data.coach_notes?.trim() || null,
      is_archived: data.is_archived ?? false,
      is_global: true,
      created_by: context.userId,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("exercises")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { exercise: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("exercises")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { exercise: row };
  });

export const setExerciseArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_archived: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("exercises")
      .update({ is_archived: data.is_archived })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedExerciseLibraryV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const rows = (seedExercises as SeedRow[]).map((ex) => ({
      name: ex.nom,
      intensity_code: ex.categorie && VALID_INTENSITY.has(ex.categorie) ? ex.categorie : "non_classe",
      category: ex.categorie && VALID_INTENSITY.has(ex.categorie) ? ex.categorie : "non_classe",
      muscle_group: ex.muscle_group || null,
      equipement: ex.equipement || null,
      default_tempo: ex.tempo_defaut || null,
      youtube_url: ex.youtube_url || null,
      youtube_id: extractYoutubeId(ex.youtube_url),
      coach_notes: ex.consignes || null,
      is_global: true,
      is_archived: false,
      created_by: context.userId,
    }));

    // Fetch existing names to dedupe (case-insensitive by exact name)
    const { data: existing } = await supabaseAdmin
      .from("exercises")
      .select("name")
      .eq("is_global", true);
    const have = new Set((existing ?? []).map((r) => (r.name || "").trim().toLowerCase()));
    const toInsert = rows.filter((r) => !have.has(r.name.trim().toLowerCase()));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabaseAdmin.from("exercises").insert(chunk);
      if (error) throw new Error(`exercises insert failed: ${error.message}`);
      inserted += chunk.length;
    }
    return { inserted, skipped: rows.length - inserted, total: rows.length };
  });
