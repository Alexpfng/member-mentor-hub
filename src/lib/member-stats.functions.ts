import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAxisIndex, buildMovementProfile, type LoggedSet } from "@/lib/movement-profile";
import { summarizeBadges } from "@/lib/badges";
import { weeklyStreak } from "@/lib/streak";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Bibliothèque d'exercices côté membre (lecture seule) : consignes + vidéos à revoir
// hors séance, groupées par partie du corps. Exclut les exercices archivés.
export const listLibraryForMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("exercises")
      .select("id, name, muscle_group, category, intensity_code, color, default_tempo, equipement, coach_notes, youtube_url, youtube_id, image_url, movement_patterns")
      .or("is_archived.is.null,is_archived.eq.false")
      .order("muscle_group", { ascending: true })
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { exercises: data ?? [] };
  });

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
      { data: activeAssignment },
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
      supabaseAdmin
        .from("assignments")
        .select("program_id, programs(frequency_per_week)")
        .eq("member_id", context.userId)
        .eq("active", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const allDone = (sessions ?? []).filter((s) => s.status === "completed");
    const done = allDone.filter((s) => (s.session_type ?? "program") === "program");
    const freeSessionsThisWeek = allDone.filter((s) => s.session_type === "free").length;
    const volume = allDone.reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0);
    const duration = allDone.reduce((a, s) => a + (s.duration_minutes ?? 0), 0);

    // Semaines consécutives à 3 séances ou plus, semaine en cours tolérée.
    const streak = weeklyStreak(
      (streakSessions ?? []).map((s) => s.date),
      monday,
    );

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
      sessionsTotal: (activeAssignment as any)?.programs?.frequency_per_week ?? 5,
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

/**
 * Profil de mouvement (radar) : réparti le travail réellement logué sur les cinq
 * familles du code couleur, et compare le premier mois au dernier.
 * Le coach peut le demander pour un de ses membres, un membre uniquement pour
 * lui-même.
 */
export const getMovementProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const memberId = data.memberId ?? context.userId;
    if (memberId !== context.userId) {
      // Un membre ne consulte que son propre profil ; le coach, ceux de ses membres.
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "coach")
        .maybeSingle();
      if (!role) throw new Error("Accès refusé");
    }

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, date, ended_at")
      .eq("member_id", memberId)
      .eq("status", "completed")
      .order("date", { ascending: true });

    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length === 0) {
      return buildMovementProfile([], new Map());
    }

    const dateBySession = new Map<string, string | null>();
    for (const s of sessions ?? []) {
      dateBySession.set(s.id, s.date ?? (s.ended_at ? s.ended_at.slice(0, 10) : null));
    }

    // La couleur d'un exercice vit dans la bibliothèque ET dans les programmes
    // (un coach peut coloriser un exercice directement dans le builder sans
    // qu'il soit en bibliothèque) : on croise les deux sources.
    const [{ data: logs }, { data: library }, { data: programs }] = await Promise.all([
      supabaseAdmin
        .from("set_logs")
        .select("session_id, exercise_name, weight_kg, reps")
        .in("session_id", sessionIds),
      supabaseAdmin
        .from("exercises")
        .select("name, color")
        .or("is_archived.is.null,is_archived.eq.false")
        .limit(2000),
      supabaseAdmin
        .from("assignment_weeks")
        .select("structure")
        .eq("member_id", memberId)
        .limit(60),
    ]);

    const fromPrograms: Array<{ name: string | null; color: string | null }> = [];
    for (const week of programs ?? []) {
      const days = (week.structure as { days?: Array<{ exercises?: unknown[] }> } | null)?.days;
      for (const day of days ?? []) {
        for (const exercise of (day.exercises ?? []) as Array<{
          name?: string | null;
          color?: string | null;
        }>) {
          fromPrograms.push({ name: exercise?.name ?? null, color: exercise?.color ?? null });
        }
      }
    }

    const axisIndex = buildAxisIndex([
      ...((library ?? []) as Array<{ name: string | null; color: string | null }>),
      ...fromPrograms,
    ]);

    const sets: LoggedSet[] = (logs ?? []).map((log) => ({
      exerciseName: log.exercise_name,
      weightKg: log.weight_kg != null ? Number(log.weight_kg) : null,
      reps: log.reps,
      date: dateBySession.get(log.session_id) ?? null,
    }));

    return buildMovementProfile(sets, axisIndex);
  });

/**
 * Trophées du membre. Tout est recalculé depuis les séances, séries et records
 * existants : rien n'est stocké, donc rien à migrer ni à resynchroniser.
 */
export const getMemberBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sessions }, { count: prCount }] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("id, date, total_volume_kg")
        .eq("member_id", context.userId)
        .eq("status", "completed"),
      supabaseAdmin
        .from("personal_records")
        .select("id", { count: "exact", head: true })
        .eq("member_id", context.userId),
    ]);

    const sessionIds = (sessions ?? []).map((s) => s.id);
    let fullyRatedSessions = 0;
    if (sessionIds.length > 0) {
      const { data: logs } = await supabaseAdmin
        .from("set_logs")
        .select("session_id, rpe")
        .in("session_id", sessionIds);
      // Une séance ne compte que si TOUTES ses séries portent un ressenti :
      // c'est précisément le comportement qu'on cherche à encourager.
      const rated = new Map<string, { total: number; missing: number }>();
      for (const log of logs ?? []) {
        const current = rated.get(log.session_id) ?? { total: 0, missing: 0 };
        current.total += 1;
        if (log.rpe == null) current.missing += 1;
        rated.set(log.session_id, current);
      }
      for (const entry of rated.values()) {
        if (entry.total > 0 && entry.missing === 0) fullyRatedSessions += 1;
      }
    }

    const stats = {
      sessionsDone: (sessions ?? []).length,
      streakWeeks: weeklyStreak((sessions ?? []).map((s) => s.date)),
      totalVolumeKg: (sessions ?? []).reduce((a, s) => a + Number(s.total_volume_kg ?? 0), 0),
      personalRecords: prCount ?? 0,
      fullyRatedSessions,
    };

    return { stats, ...summarizeBadges(stats) };
  });
