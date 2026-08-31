import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeAssignmentWeeks } from "@/lib/program-weeks";
import {
  currentPlanningWeekNumber,
  normalizeWeekStartsOn,
  planningWeekBounds,
  weekWindowLabel,
} from "@/lib/planning-weeks";
import { attachStravaActivityCardsToSessions } from "@/lib/strava-activity-card";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function frDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

async function notifyCoachPlanning(memberId: string, content: string) {
  try {
    const [{ data: assignment }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("assignments")
        .select("program_id, programs(coach_id)")
        .eq("member_id", memberId)
        .eq("active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", memberId)
        .maybeSingle(),
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

// Convention : `week_number` est 1-based PARTOUT en base (aligné sur
// assignment_weeks et sessions). Les index de tableau (structure.weeks) restent
// 0-based en interne : weekIdx = weekNumber - 1.
export const listWeekPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ weekNumber: z.number().int().min(1).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Find active assignment + program
    const [{ data: assignment }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("assignments")
        .select("id, program_id, start_date, programs(name, structure)")
        .eq("member_id", context.userId)
        .eq("active", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("planning_week_start_day")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    if (!assignment) {
      return { weekNumber: 1, weekStart: null, weekEnd: null, days: [], assignment: null };
    }

    const weekStartsOn = normalizeWeekStartsOn(profile?.planning_week_start_day);
    const currentWeekNumber = currentPlanningWeekNumber(assignment.start_date, undefined, {
      weekStartsOn,
    });
    const weekNumber = data.weekNumber ?? currentWeekNumber;
    const weekIdx = weekNumber - 1;

    const { weekStart: startISO, weekEnd: endISO } = planningWeekBounds(
      assignment.start_date,
      weekNumber,
      { weekStartsOn },
    );

    const program = (assignment as any).programs ?? null;
    // Fusionne les semaines adaptées (assignment_weeks) sur le template : le planning
    // doit proposer les séances réellement assignées au membre (une semaine adaptée
    // peut ne pas exister dans le template), sinon le membre planifie une séance que
    // le lanceur ne retrouvera pas.
    const { data: adaptedWeeks } = await supabaseAdmin
      .from("assignment_weeks")
      .select("week_number, structure")
      .eq("assignment_id", assignment.id)
      .in("status", ["published", "in_progress", "done"]);
    const weeks = mergeAssignmentWeeks(program?.structure, adaptedWeeks ?? []);
    const weekDef = weeks[weekIdx] ?? null;
    // Les écrans ne consomment que label/type : payload épuré et sérialisable.
    const dayDefs = (weekDef?.days ?? []).map((d) => ({
      label: d?.label ?? null,
      type: d?.type ?? null,
    }));

    // Existing planned_sessions for that week — scopé au programme actif pour
    // éviter que le planning d'un ancien programme « fuite » (on garde les nulls par compat).
    const { data: allPlanned } = await supabaseAdmin
      .from("planned_sessions")
      .select("*")
      .eq("member_id", context.userId)
      .or(`program_id.eq.${assignment.program_id},program_id.is.null`);
    const planned = (allPlanned ?? []).filter((row: any) => {
      if (row.planned_date) return row.planned_date >= startISO && row.planned_date <= endISO;
      return row.week_number === weekNumber;
    });

    // Completed sessions for the week
    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, date, session_label, status, duration_minutes, week_number, day_number")
      .eq("member_id", context.userId)
      .gte("date", startISO)
      .lte("date", endISO);
    const sessionIds = (sessions ?? []).map((session) => session.id).filter(Boolean);
    const { data: stravaActivities } = sessionIds.length
      ? await supabaseAdmin
          .from("member_strava_activities")
          .select(
            "session_id, strava_activity_id, activity_type, name, started_at, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, average_heartrate, average_speed_mps, raw_payload",
          )
          .in("session_id", sessionIds)
      : { data: [] };

    return {
      weekNumber,
      weekStart: startISO,
      weekEnd: endISO,
      weekStartsOn,
      weekWindowLabel: weekWindowLabel(weekStartsOn),
      assignment,
      dayDefs,
      planned: planned ?? [],
      sessions: attachStravaActivityCardsToSessions(sessions ?? [], stravaActivities ?? []),
    };
  });

export const upsertPlannedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        programId: z.string().uuid().optional().nullable(),
        weekNumber: z.number().int().min(1),
        dayLabel: z.string().min(1).max(120),
        plannedDate: dateStr.nullable().optional(),
        reminderTime: z
          .string()
          .regex(/^\d{2}:\d{2}(:\d{2})?$/)
          .nullable()
          .optional(),
        status: z.enum(["planned", "done", "skipped", "rest"]).optional(),
      })
      .parse(d),
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

/**
 * Libère une séance restée « en cours ». Sans ça, une séance commencée puis
 * abandonnée occupait son jour ET disparaissait de « À planifier » : le membre
 * n'avait plus aucune porte d'entrée pour la replacer.
 * On ne supprime pas la ligne (les séries déjà loguées restent traçables) : le
 * statut « abandoned » la sort du planning et des compteurs coach, qui ne
 * comptent que completed/in_progress.
 */
export const abandonSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("session_label")
      .eq("id", data.id)
      .eq("member_id", context.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ status: "abandoned" })
      .eq("id", data.id)
      .eq("member_id", context.userId)
      .eq("status", "in_progress");
    if (error) throw new Error(error.message);

    await notifyCoachPlanning(
      context.userId,
      `↩︎ a annulé la séance « ${session?.session_label ?? "sans titre"} » commencée puis abandonnée`,
    );

    return { ok: true };
  });

export const markDayRest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        weekNumber: z.number().int().min(1),
        plannedDate: dateStr,
      })
      .parse(d),
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
