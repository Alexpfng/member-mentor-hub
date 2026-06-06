import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const prefSchema = z.object({
  planned_session: z.boolean().optional(),
  weight_reminder: z.boolean().optional(),
  logbook: z.boolean().optional(),
  pr: z.boolean().optional(),
  new_week: z.boolean().optional(),
  coach_msg: z.boolean().optional(),
  streak: z.boolean().optional(),
  weight_reminder_dow: z.number().int().min(0).max(6).optional(),
  weight_reminder_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("member_notification_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data) return data;
    // Default & insert
    const { data: row } = await supabaseAdmin
      .from("member_notification_prefs")
      .insert({ user_id: context.userId })
      .select()
      .single();
    return row;
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prefSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("member_notification_prefs")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!existing) {
      const { data: row, error } = await supabaseAdmin
        .from("member_notification_prefs")
        .insert({ user_id: context.userId, ...data })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin
      .from("member_notification_prefs")
      .update(data)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
