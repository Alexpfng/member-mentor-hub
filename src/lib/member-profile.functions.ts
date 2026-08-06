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
