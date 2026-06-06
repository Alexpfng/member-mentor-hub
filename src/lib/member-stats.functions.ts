import { createServerFn } from "@tanstack/react-start";
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

    const [{ data: sessions }, { data: weights }, { data: lastPR }, { data: planned }] =
      await Promise.all([
        supabaseAdmin
          .from("sessions")
          .select("id, status, date, duration_minutes, total_volume_kg, session_label")
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
      ]);

    const done = (sessions ?? []).filter((s) => s.status === "completed");
    const volume = done.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0);
    const duration = done.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);

    // Streak: weeks consecutives with >= 3 done sessions, going back from current week
    const startStreak = new Date(monday);
    let streak = 0;
    for (let i = 0; i < 26; i++) {
      const ws = new Date(startStreak);
      ws.setDate(startStreak.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      const { count } = await supabaseAdmin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("member_id", context.userId)
        .eq("status", "completed")
        .gte("date", isoDay(ws))
        .lte("date", isoDay(we));
      if ((count ?? 0) >= 3) streak++;
      else if (i === 0) {
        // current week not yet validated — keep checking previous weeks
        continue;
      } else break;
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
