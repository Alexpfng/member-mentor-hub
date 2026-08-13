import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { localDateISO } from "@/lib/local-date";

// Accès coach : mono-coach en pratique (listMembers renvoie tous les membres),
// donc on se contente de vérifier le rôle, comme les autres fonctions coach.
async function assertCoach(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux coachs");
}

const stepsSchema = z.number().int().min(0).max(200000).nullable();
const caloriesSchema = z.number().int().min(0).max(30000).nullable();

/**
 * Le membre enregistre ses pas / calories du jour. Un seul des deux suffit :
 * il peut noter ses pas le matin et ses calories le soir sans écraser l'autre.
 * Upsert par (membre, date), comme le poids.
 */
export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        steps: stepsSchema.optional(),
        calories: caloriesSchema.optional(),
        note: z.string().max(500).optional().nullable(),
      })
      .refine((v) => v.steps !== undefined || v.calories !== undefined, {
        message: "Indique au moins tes pas ou tes calories.",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const date = data.date ?? localDateISO();
    const { data: existing } = await supabaseAdmin
      .from("activity_logs")
      .select("id, steps, calories")
      .eq("member_id", context.userId)
      .eq("date", date)
      .maybeSingle();

    // On ne met à jour que les champs fournis (préserve l'autre valeur du jour).
    const patch: { steps?: number | null; calories?: number | null; note?: string | null } = {};
    if (data.steps !== undefined) patch.steps = data.steps;
    if (data.calories !== undefined) patch.calories = data.calories;
    if (data.note !== undefined) patch.note = data.note ?? null;

    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("activity_logs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id, date, steps, calories, note")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await supabaseAdmin
      .from("activity_logs")
      .insert({
        member_id: context.userId,
        date,
        steps: data.steps ?? null,
        calories: data.calories ?? null,
        note: data.note ?? null,
      })
      .select("id, date, steps, calories, note")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

async function readActivity(memberId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);

  const { data: rows } = await supabaseAdmin
    .from("activity_logs")
    .select("date, steps, calories, note")
    .eq("member_id", memberId)
    .gte("date", sinceISO)
    .order("date", { ascending: true });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("daily_steps_goal, daily_calories_goal")
    .eq("id", memberId)
    .maybeSingle();

  const list = rows ?? [];
  const today = localDateISO();
  const todayRow = list.find((r) => r.date === today) ?? null;

  const avg = (key: "steps" | "calories") => {
    const vals = list.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return {
    list,
    today: todayRow,
    goals: {
      steps: profile?.daily_steps_goal ?? null,
      calories: profile?.daily_calories_goal ?? null,
    },
    averages: { steps: avg("steps"), calories: avg("calories") },
  };
}

/** Le membre relit sa propre activité + l'objectif fixé par le coach. */
export const getMyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    return readActivity(context.userId, data.days ?? 30);
  });

/** Le coach consulte l'activité d'un coaché + son objectif. */
export const getMemberActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        days: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    return readActivity(data.memberId, data.days ?? 30);
  });

/** Le coach fixe l'objectif quotidien (pas / calories) d'un coaché. */
export const setMemberActivityGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        stepsGoal: stepsSchema,
        caloriesGoal: caloriesSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .update({
        daily_steps_goal: data.stepsGoal,
        daily_calories_goal: data.caloriesGoal,
      })
      .eq("id", data.memberId)
      .select("id, daily_steps_goal, daily_calories_goal")
      .single();
    if (error) throw new Error(error.message);
    return {
      steps: row.daily_steps_goal ?? null,
      calories: row.daily_calories_goal ?? null,
    };
  });

/**
 * Vue « tracking » d'un coaché pour le coach : historique COMPLET du poids
 * (nécessaire pour la courbe de fluctuation et le « % depuis le départ », que les
 * 30 dernières pesées de getMemberDetail ne couvrent pas) + l'activité (pas /
 * calories) sur ~1 an, pour calculer les moyennes hebdo / mensuelles côté client.
 */
export const getMemberTracking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const since = new Date(Date.now() - 366 * 86400000).toISOString().slice(0, 10);
    const [{ data: weights }, { data: acts }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("weight_logs")
        .select("date, weight_kg")
        .eq("member_id", data.memberId)
        .order("date", { ascending: true }),
      supabaseAdmin
        .from("activity_logs")
        .select("date, steps, calories")
        .eq("member_id", data.memberId)
        .gte("date", since)
        .order("date", { ascending: true }),
      supabaseAdmin
        .from("profiles")
        .select("daily_steps_goal, daily_calories_goal")
        .eq("id", data.memberId)
        .maybeSingle(),
    ]);
    return {
      weights: (weights ?? []).map((w) => ({
        date: w.date as string,
        weight_kg: Number(w.weight_kg),
      })),
      activity: (acts ?? []).map((a) => ({
        date: a.date as string,
        steps: a.steps as number | null,
        calories: a.calories as number | null,
      })),
      goals: {
        steps: profile?.daily_steps_goal ?? null,
        calories: profile?.daily_calories_goal ?? null,
      },
    };
  });
