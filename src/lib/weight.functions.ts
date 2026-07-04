import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { localDateISO } from "@/lib/local-date";

export const logWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weightKg: z.number().min(20).max(400),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const date = data.date ?? localDateISO();
    // Upsert by member+date
    const { data: existing } = await supabaseAdmin
      .from("weight_logs")
      .select("id")
      .eq("member_id", context.userId)
      .eq("date", date)
      .maybeSingle();
    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("weight_logs")
        .update({ weight_kg: data.weightKg, note: data.note ?? null })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin
      .from("weight_logs")
      .insert({
        member_id: context.userId,
        weight_kg: data.weightKg,
        date,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weeks: z.number().int().min(1).max(104).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const weeks = data.weeks ?? 12;
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);
    const sinceISO = since.toISOString().slice(0, 10);

    const { data: rows } = await supabaseAdmin
      .from("weight_logs")
      .select("id, weight_kg, date, note")
      .eq("member_id", context.userId)
      .gte("date", sinceISO)
      .order("date", { ascending: true });

    const list = rows ?? [];
    const last = list[list.length - 1] ?? null;
    const first = list[0] ?? null;
    let delta7: number | null = null;
    if (last) {
      const ref = new Date(last.date as string);
      ref.setDate(ref.getDate() - 7);
      const refISO = ref.toISOString().slice(0, 10);
      const previous = [...list].reverse().find((r) => (r.date as string) <= refISO);
      if (previous) delta7 = Number(last.weight_kg) - Number(previous.weight_kg);
    }
    return {
      list,
      current: last,
      first,
      delta7,
      totalDelta: first && last ? Number(last.weight_kg) - Number(first.weight_kg) : null,
    };
  });
