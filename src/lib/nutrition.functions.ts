import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { localDateISO } from "@/lib/local-date";
import {
  DEFAULT_NUTRITION_FOODS,
  buildNutritionMacroComparison,
  buildNutritionSummary,
  type MealSlot,
  type NutritionEntry,
  type NutritionFood,
  type NutritionMacroEntry,
} from "@/lib/nutrition";

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

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mealSchema = z.enum(["breakfast", "lunch", "snack", "dinner"]);
const gramsSchema = z.number().int().min(1).max(5000);
const kcalSchema = z.number().int().min(0).max(1000);
const dailyGoalSchema = z.number().int().min(0).max(10000).nullable();
const foodCategorySchema = z.string().trim().min(1).max(80);

type NutritionFoodRow = NutritionFood;

type NutritionEntryRow = {
  id: string;
  date: string;
  meal: MealSlot;
  food_name: string;
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  created_at: string | null;
};

function foodKey(foodName: string) {
  return foodName.trim().toLocaleLowerCase("fr");
}

function mergeNutritionFoods(dbFoods: NutritionFoodRow[]): NutritionFoodRow[] {
  const foodsByName = new Map<string, NutritionFoodRow>();

  for (const food of DEFAULT_NUTRITION_FOODS) {
    foodsByName.set(foodKey(food.name), food);
  }

  for (const food of dbFoods) {
    foodsByName.set(foodKey(food.name), food);
  }

  return [...foodsByName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function mapEntry(row: NutritionEntryRow): NutritionEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    foodName: row.food_name,
    grams: row.grams,
    kcalPer100g: row.kcal_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    createdAt: row.created_at,
  };
}

async function readNutrition(memberId: string, date: string, days = 7) {
  const since = new Date(`${date}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - Math.max(0, days - 1));
  const sinceISO = since.toISOString().slice(0, 10);

  const [{ data: goal }, foodsResult, { data: entries }, { data: recentEntries }] =
    await Promise.all([
      supabaseAdmin
        .from("nutrition_goals")
        .select("daily_kcal_goal, coach_note")
        .eq("member_id", memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("nutrition_foods")
        .select("id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        .order("name", { ascending: true })
        .limit(80),
      supabaseAdmin
        .from("nutrition_entries")
        .select(
          "id, date, meal, food_name, grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_at",
        )
        .eq("member_id", memberId)
        .eq("date", date)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("nutrition_entries")
        .select("date, grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        .eq("member_id", memberId)
        .gte("date", sinceISO)
        .lte("date", date),
    ]);
  const dbFoods = foodsResult.error ? [] : ((foodsResult.data ?? []) as NutritionFoodRow[]);
  const foods = mergeNutritionFoods(dbFoods);

  const summary = buildNutritionSummary({
    date,
    goalKcal: goal?.daily_kcal_goal ?? null,
    entries: ((entries ?? []) as NutritionEntryRow[]).map(mapEntry),
  });

  const totalsByDate = new Map<string, number>();
  for (const row of recentEntries ?? []) {
    const total = Math.round(
      (Math.max(0, row.grams ?? 0) * Math.max(0, row.kcal_per_100g ?? 0)) / 100,
    );
    totalsByDate.set(row.date, (totalsByDate.get(row.date) ?? 0) + total);
  }
  const averageKcal7d =
    totalsByDate.size > 0
      ? Math.round(
          [...totalsByDate.values()].reduce((sum, value) => sum + value, 0) / totalsByDate.size,
        )
      : null;
  const macroComparison = buildNutritionMacroComparison(
    date,
    (
      (recentEntries ?? []) as Array<{
        date: string;
        grams: number;
        protein_per_100g: number | null;
        carbs_per_100g: number | null;
        fat_per_100g: number | null;
      }>
    ).map(
      (row): NutritionMacroEntry => ({
        date: row.date,
        grams: row.grams,
        proteinPer100g: row.protein_per_100g,
        carbsPer100g: row.carbs_per_100g,
        fatPer100g: row.fat_per_100g,
      }),
    ),
  );

  return {
    goal: {
      dailyKcal: goal?.daily_kcal_goal ?? null,
      coachNote: goal?.coach_note ?? null,
    },
    foods,
    summary,
    averageKcal7d,
    macroComparison,
  };
}

export const getMyNutrition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ date: dateSchema.optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    return readNutrition(context.userId, data.date ?? localDateISO(), 7);
  });

export const getMemberNutrition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().uuid(), date: dateSchema.optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    return readNutrition(data.memberId, data.date ?? localDateISO(), 7);
  });

export const addNutritionEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        date: dateSchema.optional(),
        meal: mealSchema,
        foodId: z.string().uuid().nullable().optional(),
        foodName: z.string().trim().min(1).max(120),
        grams: gramsSchema,
        kcalPer100g: kcalSchema,
        proteinPer100g: z.number().min(0).max(200).nullable().optional(),
        carbsPer100g: z.number().min(0).max(200).nullable().optional(),
        fatPer100g: z.number().min(0).max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("nutrition_entries")
      .insert({
        member_id: context.userId,
        date: data.date ?? localDateISO(),
        meal: data.meal,
        food_id: data.foodId ?? null,
        food_name: data.foodName,
        grams: data.grams,
        kcal_per_100g: data.kcalPer100g,
        protein_per_100g: data.proteinPer100g ?? null,
        carbs_per_100g: data.carbsPer100g ?? null,
        fat_per_100g: data.fatPer100g ?? null,
      })
      .select(
        "id, date, meal, food_name, grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return mapEntry(row as NutritionEntryRow);
  });

export const createNutritionFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        category: foodCategorySchema.default("Plats simples"),
        kcalPer100g: kcalSchema,
        proteinPer100g: z.number().min(0).max(200).nullable().optional(),
        carbsPer100g: z.number().min(0).max(200).nullable().optional(),
        fatPer100g: z.number().min(0).max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      category: data.category,
      kcal_per_100g: data.kcalPer100g,
      protein_per_100g: data.proteinPer100g ?? null,
      carbs_per_100g: data.carbsPer100g ?? null,
      fat_per_100g: data.fatPer100g ?? null,
      is_default: false,
      created_by: context.userId,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("nutrition_foods")
      .insert(payload)
      .select("id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .single();

    if (!error && inserted) return inserted as NutritionFoodRow;

    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("nutrition_foods")
        .select("id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
        .eq("name", data.name)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) return existing as NutritionFoodRow;
    }

    throw new Error(error?.message ?? "Impossible d'ajouter cet aliment");
  });

export const deleteNutritionEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("nutrition_entries")
      .delete()
      .eq("id", data.entryId)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMemberNutritionGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        dailyKcalGoal: dailyGoalSchema,
        coachNote: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("nutrition_goals")
      .upsert(
        {
          member_id: data.memberId,
          daily_kcal_goal: data.dailyKcalGoal,
          coach_note: data.coachNote ?? null,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      )
      .select("daily_kcal_goal, coach_note")
      .single();
    if (error) throw new Error(error.message);
    return {
      dailyKcal: row.daily_kcal_goal ?? null,
      coachNote: row.coach_note ?? null,
    };
  });
