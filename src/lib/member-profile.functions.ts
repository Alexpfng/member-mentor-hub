import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeWeekStartsOn } from "@/lib/planning-weeks";

const weekStartSchema = z.object({
  planning_week_start_day: z.number().int().min(1).max(7),
});

export const getMemberPlanningSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("planning_week_start_day")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      planning_week_start_day: normalizeWeekStartsOn(data?.planning_week_start_day),
    };
  });

export const updateMemberPlanningSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => weekStartSchema.parse(d))
  .handler(async ({ data, context }) => {
    const planningWeekStartDay = normalizeWeekStartsOn(data.planning_week_start_day);
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .update({ planning_week_start_day: planningWeekStartDay })
      .eq("id", context.userId)
      .select("planning_week_start_day")
      .single();
    if (error) throw new Error(error.message);
    return {
      planning_week_start_day: normalizeWeekStartsOn(row?.planning_week_start_day),
    };
  });

// Le coaché remplit / met à jour lui-même ses infos (niveau, taille, poids, objectif) :
// c'est au membre de compléter cet onglet, pas au coach. Les mêmes champs sont
// éditables côté coach (updateMemberProfile), mais ici tout est scopé à l'utilisateur
// connecté (context.userId) — impossible d'écrire sur le profil d'un autre.
export const getMyProfileInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: mp }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("member_profiles")
        .select("weight_kg, height_cm, level, goal")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    return {
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      email: profile?.email ?? "",
      weight_kg: mp?.weight_kg ?? null,
      height_cm: mp?.height_cm ?? null,
      level: mp?.level ?? "",
      goal: mp?.goal ?? "",
    };
  });

const myProfileSchema = z.object({
  first_name: z.string().trim().max(80).optional().nullable(),
  last_name: z.string().trim().max(80).optional().nullable(),
  weight_kg: z.number().min(20).max(400).optional().nullable(),
  height_cm: z.number().int().min(80).max(260).optional().nullable(),
  level: z.string().trim().max(40).optional().nullable(),
  goal: z.string().trim().max(200).optional().nullable(),
});

export const updateMyProfileInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => myProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 1. profiles : identité (prénom / nom)
    if (data.first_name !== undefined || data.last_name !== undefined) {
      const patch: { first_name?: string | null; last_name?: string | null } = {};
      if (data.first_name !== undefined) patch.first_name = data.first_name || null;
      if (data.last_name !== undefined) patch.last_name = data.last_name || null;
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", context.userId);
      if (error) throw new Error(error.message);
    }

    // 2. member_profiles : upsert des infos d'entraînement
    const mpPatch: {
      weight_kg?: number | null;
      height_cm?: number | null;
      level?: string | null;
      goal?: string | null;
    } = {};
    if (data.weight_kg !== undefined) mpPatch.weight_kg = data.weight_kg;
    if (data.height_cm !== undefined) mpPatch.height_cm = data.height_cm;
    if (data.level !== undefined) mpPatch.level = data.level || null;
    if (data.goal !== undefined) mpPatch.goal = data.goal || null;

    if (Object.keys(mpPatch).length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("member_profiles")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabaseAdmin
          .from("member_profiles")
          .update(mpPatch)
          .eq("user_id", context.userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("member_profiles")
          .insert({ user_id: context.userId, ...mpPatch });
        if (error) throw new Error(error.message);
      }
    }

    return { ok: true };
  });
