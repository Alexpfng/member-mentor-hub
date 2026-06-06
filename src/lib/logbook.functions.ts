import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AnyRow = Record<string, any>;

async function buildLogbook(memberId: string, weekNumber: number) {
  // Active assignment for context
  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select("program_id, start_date, programs(name, structure)")
    .eq("member_id", memberId)
    .eq("active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const start = assignment?.start_date ? new Date(assignment.start_date) : new Date();
  const periodStart = new Date(start);
  periodStart.setDate(start.getDate() + weekNumber * 7);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 6);
  const psISO = periodStart.toISOString().slice(0, 10);
  const peISO = periodEnd.toISOString().slice(0, 10);

  const program = (assignment as AnyRow | null)?.programs;
  const weekDef = program?.structure?.weeks?.[weekNumber];
  const sessionsPlanned = weekDef?.days?.filter((d: AnyRow) => d.type !== "Repos").length ?? 0;

  const [{ data: sessions }, { data: weights }, { data: pains }, { data: prs }, { data: feedbacks }] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, status, duration_minutes, total_volume_kg, average_rpe, overall_feeling, session_label")
      .eq("member_id", memberId)
      .gte("date", psISO)
      .lte("date", peISO),
    supabaseAdmin
      .from("weight_logs")
      .select("weight_kg, date")
      .eq("member_id", memberId)
      .gte("date", psISO)
      .lte("date", peISO)
      .order("date", { ascending: true }),
    supabaseAdmin
      .from("pain_reports")
      .select("zone, exercise_name, intensity, resolved_at")
      .eq("member_id", memberId)
      .gte("created_at", psISO)
      .lte("created_at", peISO + "T23:59:59"),
    supabaseAdmin
      .from("personal_records")
      .select("exercise_name, weight_kg, reps, date")
      .eq("member_id", memberId)
      .gte("date", psISO)
      .lte("date", peISO),
    supabaseAdmin
      .from("exercise_feedbacks")
      .select("rpe, session_id, created_at")
      .gte("created_at", psISO)
      .lte("created_at", peISO + "T23:59:59"),
  ]);

  const doneSessions = (sessions ?? []).filter((s) => s.status === "completed");
  const totalVolume = doneSessions.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0);
  const totalDuration = doneSessions.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);
  const rpes = doneSessions.map((s) => Number(s.average_rpe ?? 0)).filter((r) => r > 0);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  const feelings: Record<string, number> = {};
  for (const s of doneSessions) {
    const f = String(s.overall_feeling ?? "");
    if (!f) continue;
    feelings[f] = (feelings[f] ?? 0) + 1;
  }

  const painSummary = (pains ?? []).length
    ? (pains ?? [])
        .map((p) => `${p.zone} (${p.exercise_name ?? "—"}) intensité ${p.intensity}${p.resolved_at ? " · résolue" : ""}`)
        .join(" ; ")
    : null;

  const weightStart = weights?.[0]?.weight_kg ?? null;
  const weightEnd = weights?.[weights.length - 1]?.weight_kg ?? null;

  return {
    member_id: memberId,
    program_id: assignment?.program_id ?? null,
    week_number: weekNumber,
    period_start: psISO,
    period_end: peISO,
    sessions_done: doneSessions.length,
    sessions_planned: sessionsPlanned,
    total_volume_kg: totalVolume,
    total_duration_min: totalDuration,
    avg_rpe: avgRpe,
    weight_start: weightStart,
    weight_end: weightEnd,
    new_prs: prs ?? [],
    feelings,
    pain_summary: painSummary,
  };
}

async function upsertLogbook(memberId: string, weekNumber: number) {
  const payload = await buildLogbook(memberId, weekNumber);
  const existingQuery = supabaseAdmin
    .from("weekly_logbooks")
    .select("id, coach_message")
    .eq("member_id", memberId)
    .eq("week_number", weekNumber);
  const { data: existing } = payload.program_id
    ? await existingQuery.eq("program_id", payload.program_id).maybeSingle()
    : await existingQuery.is("program_id", null).maybeSingle();

  if (existing) {
    const { data: row, error } = await supabaseAdmin
      .from("weekly_logbooks")
      .update({ ...payload, coach_message: existing.coach_message })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  }
  const { data: row, error } = await supabaseAdmin
    .from("weekly_logbooks")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export const getLogbook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weekNumber: z.number().int().min(0).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Determine current week
    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("start_date, program_id")
      .eq("member_id", context.userId)
      .eq("active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!assignment) return null;
    const start = assignment.start_date ? new Date(assignment.start_date) : new Date();
    const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
    const currentWeek = Math.max(0, Math.floor(diff / 7));
    const weekNumber = data.weekNumber ?? Math.max(0, currentWeek - 1);

    // Try existing first
    const { data: existing } = await supabaseAdmin
      .from("weekly_logbooks")
      .select("*")
      .eq("member_id", context.userId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (existing) return existing;

    // Generate on the fly
    return upsertLogbook(context.userId, weekNumber);
  });

export const setCoachLogbookMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ logbookId: z.string().uuid(), message: z.string().max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Check role coach
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "coach")
      .maybeSingle();
    if (!role) throw new Error("Réservé au coach");

    const { data: row, error } = await supabaseAdmin
      .from("weekly_logbooks")
      .update({ coach_message: data.message })
      .eq("id", data.logbookId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const generateLogbooksForAll = async () => {
  // Find all active members
  const { data: assigns } = await supabaseAdmin
    .from("assignments")
    .select("member_id, start_date")
    .eq("active", true);
  const results: AnyRow[] = [];
  for (const a of assigns ?? []) {
    if (!a.start_date) continue;
    const start = new Date(a.start_date);
    const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
    const finishedWeek = Math.max(0, Math.floor(diff / 7) - 1);
    try {
      const row = await upsertLogbook(a.member_id as string, finishedWeek);
      results.push({ member_id: a.member_id, week: finishedWeek, ok: true, id: row?.id });
    } catch (e: any) {
      results.push({ member_id: a.member_id, week: finishedWeek, ok: false, error: e.message });
    }
  }
  return results;
};
