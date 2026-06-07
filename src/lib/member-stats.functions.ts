import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const getMemberDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    const dow = today.getDay(); // 0=dim
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const streakStart = new Date(monday);
    streakStart.setDate(monday.getDate() - 25 * 7);

    const [
      { data: sessions },
      { data: weights },
      { data: lastPR },
      { data: planned },
      { data: streakSessions },
    ] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("id, status, date, duration_minutes, total_volume_kg, session_label, session_type")
        .eq("member_id", context.userId)
        .gte("date", isoDay(monday))
        .lte("date", isoDay(sunday)),
      supabaseAdmin
        .from("weight_logs")
        .select("weight_kg, date")
        .eq("member_id", context.userId)
        .order("date", { ascending: false })
        .limit(2),
      supabaseAdmin
        .from("personal_records")
        .select("exercise_name, weight_kg, reps, date")
        .eq("member_id", context.userId)
        .order("date", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("planned_sessions")
        .select("id, day_label, planned_date, status, session_id")
        .eq("member_id", context.userId)
        .gte("planned_date", isoDay(monday))
        .lte("planned_date", isoDay(sunday)),
      supabaseAdmin
        .from("sessions")
        .select("date")
        .eq("member_id", context.userId)
        .eq("status", "completed")
        .gte("date", isoDay(streakStart))
        .lte("date", isoDay(sunday)),
    ]);

    const allDone = (sessions ?? []).filter((s) => s.status === "completed");
    const done = allDone.filter((s) => (s.session_type ?? "program") === "program");
    const freeSessionsThisWeek = allDone.filter((s) => s.session_type === "free").length;
    const volume = allDone.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0);
    const duration = allDone.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);

    // Streak: weeks consécutives avec >= 3 séances done (semaine en cours tolérée)
    const counts = new Map<string, number>();
    for (const s of streakSessions ?? []) {
      if (!s.date) continue;
      const d = new Date(s.date);
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      const k = isoDay(d);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const currentKey = isoDay(monday);
    let streak = 0;
    for (let i = 0; i < 26; i++) {
      const ws = new Date(monday);
      ws.setDate(monday.getDate() - i * 7);
      const k = isoDay(ws);
      const c = counts.get(k) ?? 0;
      if (c >= 3) streak++;
      else if (k === currentKey) continue;
      else break;
    }

    const w0 = weights?.[0];
    const w1 = weights?.[1];
    const deltaWeight = w0 && w1 ? Number(w0.weight_kg) - Number(w1.weight_kg) : null;

    // Coach message: last from messages table from coach
    const { data: coachMsg } = await supabaseAdmin
      .from("messages")
      .select("content, created_at, from_id")
      .eq("to_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      weekStart: isoDay(monday),
      weekEnd: isoDay(sunday),
      sessionsDone: done.length,
      sessionsTotal: 5,
      freeSessionsThisWeek,
      volume,
      duration,
      streak,
      currentWeight: w0?.weight_kg ?? null,
      deltaWeight,
      lastPR: lastPR?.[0] ?? null,
      plannedThisWeek: planned ?? [],
      coachMessage: coachMsg ?? null,
    };
  });

export const getMemberProgression = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 8 * 7);
    const sinceISO = isoDay(sinceDate);

    const [{ data: allSessions }, { count: totalSessions }, { data: prs }, { data: weights }] =
      await Promise.all([
        supabaseAdmin
          .from("sessions")
          .select("id, date, total_volume_kg, duration_minutes")
          .eq("member_id", context.userId)
          .eq("status", "completed"),
        supabaseAdmin
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("member_id", context.userId)
          .eq("status", "completed"),
        supabaseAdmin
          .from("personal_records")
          .select("exercise_name, weight_kg, reps, date")
          .eq("member_id", context.userId)
          .order("date", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("weight_logs")
          .select("weight_kg, date")
          .eq("member_id", context.userId)
          .gte("date", sinceISO)
          .order("date", { ascending: true }),
      ]);

    const totalVolume = (allSessions ?? []).reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0);

    return {
      totalSessions: totalSessions ?? 0,
      totalVolume,
      weights: weights ?? [],
      prs: prs ?? [],
    };
  });

export const listMyExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("member_id", context.userId)
      .eq("status", "completed");
    const ids = (sessions ?? []).map((s) => s.id);
    if (!ids.length) return { exercises: [] as string[] };
    const { data: sets } = await supabaseAdmin
      .from("set_logs")
      .select("exercise_name")
      .in("session_id", ids);
    const exercises = Array.from(
      new Set((sets ?? []).map((s) => s.exercise_name).filter((n): n is string => !!n)),
    ).sort();
    return { exercises };
  });

export const getMyExerciseProgression = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ exerciseName: z.string().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, ended_at, date")
      .eq("member_id", context.userId)
      .eq("status", "completed")
      .order("date", { ascending: true });
    const ids = (sessions ?? []).map((s) => s.id);
    if (!ids.length) return { exercises: [] as string[], series: [], selected: null };

    const { data: sets } = await supabaseAdmin
      .from("set_logs")
      .select("session_id, exercise_name, weight_kg, reps, rpe")
      .in("session_id", ids);

    const exercises = Array.from(
      new Set((sets ?? []).map((s) => s.exercise_name).filter((n): n is string => !!n)),
    ).sort();
    const target = data.exerciseName ?? exercises[0];
    if (!target) return { exercises, series: [], selected: null };

    const dateBySession = new Map<string, string | null>();
    for (const s of sessions ?? []) dateBySession.set(s.id, s.ended_at ?? s.date);

    const bySession = new Map<
      string,
      { date: string; maxWeight: number; topReps: number; rpes: number[] }
    >();
    for (const sl of sets ?? []) {
      if (sl.exercise_name !== target) continue;
      const d = dateBySession.get(sl.session_id);
      if (!d) continue;
      const w = sl.weight_kg != null ? Number(sl.weight_kg) : 0;
      const cur = bySession.get(sl.session_id) ?? { date: d, maxWeight: 0, topReps: 0, rpes: [] };
      if (w > cur.maxWeight) { cur.maxWeight = w; cur.topReps = sl.reps ?? 0; }
      if (sl.rpe != null) cur.rpes.push(sl.rpe);
      bySession.set(sl.session_id, cur);
    }

    const series = [...bySession.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        date: p.date,
        label: new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        weight: p.maxWeight,
        reps: p.topReps,
        rpe: p.rpes.length
          ? Math.round((p.rpes.reduce((a, b) => a + b, 0) / p.rpes.length) * 10) / 10
          : null,
      }));

    return { exercises, series, selected: target };
  });
