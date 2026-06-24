import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function frDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
}

async function notifyCoachPlanning(memberId: string, content: string) {
  try {
    const [{ data: assignment }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("assignments").select("program_id, programs(coach_id)").eq("member_id", memberId).eq("active", true).maybeSingle(),
      supabaseAdmin.from("profiles").select("first_name, last_name").eq("id", memberId).maybeSingle(),
    ]);
    const coachId = (assignment as any)?.programs?.coach_id as string | undefined;
    if (!coachId) return;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Le membre";
    await supabaseAdmin.from("messages").insert({
      from_id: memberId,
      to_id: coachId,
      content: `${name} ${content}`,
    });
  } catch {
    // Notification failure must never block the planning action
  }
}

export const listWeekPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weekNumber: z.number().int().min(0).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Find active assignment + program
    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id, program_id, start_date, programs(name, structure)")
      .eq("member_id", context.userId)
      .eq("active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!assignment) {
      return { weekNumber: 0, weekStart: null, weekEnd: null, days: [], assignment: null };
    }

    const start = assignment.start_date ? new Date(assignment.start_date) : new Date();
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const currentWeek = Math.max(0, Math.floor(diffDays / 7));
    const weekNumber = data.weekNumber ?? currentWeek;

    // Week monday/sunday
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + weekNumber * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const program = (assignment as any).programs ?? null;
    const weeks = program?.structure?.weeks ?? [];
    const weekDef = weeks[weekNumber] ?? null;
    const dayDefs = weekDef?.days ?? [];

    // Existing planned_sessions for that week — scopé au programme actif pour
    // éviter que le planning d'un ancien programme « fuite » (on garde les nulls par compat).
    const { data: planned } = await supabaseAdmin
      .from("planned_sessions")
      .select("*")
      .eq("member_id", context.userId)
      .eq("week_number", weekNumber)
      .or(`program_id.eq.${assignment.program_id},program_id.is.null`);

    // Completed sessions for the week
    const startISO = weekStart.toISOString().slice(0, 10);
    const endISO = weekEnd.toISOString().slice(0, 10);
    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, date, session_label, status, duration_minutes, week_number, day_number")
      .eq("member_id", context.userId)
      .gte("date", startISO)
      .lte("date", endISO);

    return {
      weekNumber,
      weekStart: startISO,
      weekEnd: endISO,
      assignment,
      dayDefs,
      planned: planned ?? [],
      sessions: sessions ?? [],
    };
  });

export const upsertPlannedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      programId: z.string().uuid().optional().nullable(),
      weekNumber: z.number().int().min(0),
      dayLabel: z.string().min(1).max(120),
      plannedDate: dateStr.nullable().optional(),
      reminderTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
      status: z.enum(["planned", "done", "skipped", "rest"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      member_id: context.userId,
      program_id: data.programId ?? null,
      week_number: data.weekNumber,
      day_label: data.dayLabel,
      planned_date: data.plannedDate ?? null,
      reminder_time: data.reminderTime ?? null,
      status: data.status ?? "planned",
    };

    if (data.id) {
      // Fetch old date to build the "moved" notification
      const { data: old } = await supabaseAdmin
        .from("planned_sessions")
        .select("planned_date, day_label")
        .eq("id", data.id)
        .eq("member_id", context.userId)
        .maybeSingle();

      const { data: row, error } = await supabaseAdmin
        .from("planned_sessions")
        .update(payload)
        .eq("id", data.id)
        .eq("member_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);

      if (old?.planned_date && data.plannedDate && old.planned_date !== data.plannedDate) {
        const label = old.day_label ?? "une séance";
        await notifyCoachPlanning(
          context.userId,
          `📅 a déplacé « ${label} » : ${frDate(old.planned_date)} → ${frDate(data.plannedDate)}`,
        );
      }
      return row;
    }
    const { data: row, error } = await supabaseAdmin
      .from("planned_sessions")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePlannedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Fetch before delete to build notification
    const { data: planned } = await supabaseAdmin
      .from("planned_sessions")
      .select("day_label, planned_date")
      .eq("id", data.id)
      .eq("member_id", context.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("planned_sessions")
      .delete()
      .eq("id", data.id)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);

    const label = planned?.day_label ?? "une séance";
    const dateLabel = planned?.planned_date ? ` prévue le ${frDate(planned.planned_date)}` : "";
    await notifyCoachPlanning(
      context.userId,
      `🗑 a supprimé « ${label} »${dateLabel} de son planning`,
    );

    return { ok: true };
  });

export const markDayRest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weekNumber: z.number().int().min(0),
      plannedDate: dateStr,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("planned_sessions")
      .insert({
        member_id: context.userId,
        week_number: data.weekNumber,
        day_label: "Repos",
        planned_date: data.plannedDate,
        status: "rest",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
