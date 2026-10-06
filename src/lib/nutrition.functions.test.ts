import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const functionsSource = () => readFileSync("src/lib/nutrition.functions.ts", "utf8");
const migrationSource = () =>
  readFileSync("supabase/migrations/20261004120000_add_nutrition_module.sql", "utf8");
const permissionsMigrationSource = () =>
  readFileSync(
    "supabase/migrations/20261005102155_fix_nutrition_permissions_and_custom_foods.sql",
    "utf8",
  );

describe("nutrition server module", () => {
  it("utilise des tables nutrition dediees et pas les calories d'activite", () => {
    const source = functionsSource();

    expect(source).toContain("nutrition_goals");
    expect(source).toContain("nutrition_foods");
    expect(source).toContain("nutrition_entries");
    expect(source).not.toContain("activity_logs");
    expect(source).not.toContain("daily_calories_goal");
  });

  it("expose les operations du MVP nutrition", () => {
    const source = functionsSource();

    expect(source).toContain("getMyNutrition");
    expect(source).toContain("addNutritionEntry");
    expect(source).toContain("createNutritionFood");
    expect(source).toContain("deleteNutritionEntry");
    expect(source).toContain("getMemberNutrition");
    expect(source).toContain("setMemberNutritionGoal");
    expect(source).toContain("buildNutritionMacroComparison");
    expect(source).toContain("protein_per_100g, carbs_per_100g, fat_per_100g");
    expect(source).toContain("await assertCoach(context.userId)");
  });

  it("fusionne la base d'aliments par defaut avec la base commune SQL", () => {
    const source = functionsSource();

    expect(source).toContain("DEFAULT_NUTRITION_FOODS");
    expect(source).toContain("mergeNutritionFoods");
    expect(source).toContain("foodsByName.set(foodKey(food.name), food)");
  });
});

describe("nutrition migration", () => {
  it("cree les tables nutrition et les policies RLS attendues", () => {
    const sql = migrationSource();

    expect(sql).toContain("create table if not exists public.nutrition_goals");
    expect(sql).toContain("create table if not exists public.nutrition_foods");
    expect(sql).toContain("create table if not exists public.nutrition_entries");
    expect(sql).toContain("Member manages own nutrition entries");
    expect(sql).toContain("Coach views nutrition entries");
    expect(sql).toContain("Coach manages nutrition goals");
  });

  it("corrige les droits Data API et autorise l'ajout d'aliments communs", () => {
    const sql = permissionsMigrationSource();

    expect(sql).toContain(
      "grant select, insert, update, delete on table public.nutrition_entries to authenticated, service_role",
    );
    expect(sql).toContain(
      "grant select, insert on table public.nutrition_foods to authenticated, service_role",
    );
    expect(sql).toContain("Users create nutrition foods");
  });
});
