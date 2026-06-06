import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertCoach(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux coachs");
}

function startOfWeek(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; // monday=0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

type Member = { user_id: string; first_name: string | null; last_name: string | null; email: string | null };

async function listCoachMembers() {
  // membres = users ayant le rôle "member"
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "member");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [] as Member[];
  const { data: profs } = await supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", ids);
  return (profs ?? []).map((p) => ({ user_id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email })) as Member[];
}

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const memberIds = members.map((m) => m.user_id);

    const weekStart = startOfWeek().toISOString();
    const sevenDaysAgo = daysAgo(7).toISOString();

    const [sessionsWeek, painUnresolved, msgsUnread, videosUnreviewed, sessionsUnseen] = await Promise.all([
      supabaseAdmin.from("sessions").select("id, member_id, status", { count: "exact", head: false }).gte("started_at", weekStart),
      supabaseAdmin.from("pain_reports").select("id", { count: "exact", head: true }).is("resolved_at", null),
      supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).eq("to_id", context.userId).eq("read", false),
      supabaseAdmin.from("technique_videos").select("id", { count: "exact", head: true }).eq("coach_reviewed", false),
      supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("coach_seen", false).eq("status", "completed"),
    ]);

    // adhérence 7j : sessions completed dans les 7j / membres actifs (proxy simple)
    const { data: recent7 } = await supabaseAdmin.from("sessions").select("id, status").gte("started_at", sevenDaysAgo);
    const done = (recent7 ?? []).filter((s) => s.status === "completed").length;
    const total = recent7?.length || 0;
    const adherence = total > 0 ? Math.round((done / total) * 100) : 0;

    const toTreat = (painUnresolved.count || 0) + (msgsUnread.count || 0) + (videosUnreviewed.count || 0) + (sessionsUnseen.count || 0);

    return {
      activeMembers: memberIds.length,
      sessionsThisWeek: sessionsWeek.count || 0,
      toTreat,
      adherence7d: adherence,
    };
  });

export const getPriorityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(members.map((m) => [m.user_id, [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre"]));

    const [pains, videos, msgs, highRpe] = await Promise.all([
      supabaseAdmin.from("pain_reports").select("id, member_id, session_id, exercise_name, zone, intensity, comment, created_at").is("resolved_at", null).order("intensity", { ascending: false }).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("technique_videos").select("id, member_id, session_id, exercise_name, created_at").eq("coach_reviewed", false).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("messages").select("id, from_id, content, created_at").eq("to_id", context.userId).eq("read", false).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("exercise_feedbacks").select("id, session_id, exercise_name, rpe, created_at, sessions!inner(member_id, coach_seen, status)").gte("rpe", 9).eq("sessions.coach_seen", false).eq("sessions.status", "completed").order("created_at", { ascending: false }).limit(30),
    ]);

    type Item =
      | { type: "pain"; id: string; priority: number; memberId: string; memberName: string; sessionId: string | null; exerciseName: string; zone: string; intensity: number; comment: string | null; createdAt: string }
      | { type: "high_rpe"; id: string; priority: number; memberId: string; memberName: string; sessionId: string; exerciseName: string; rpe: number; createdAt: string }
      | { type: "video"; id: string; priority: number; memberId: string; memberName: string; sessionId: string | null; exerciseName: string | null; createdAt: string }
      | { type: "message"; id: string; priority: number; memberId: string; memberName: string; content: string; createdAt: string };

    const items: Item[] = [];
    for (const p of pains ?? []) items.push({ type: "pain", id: p.id, priority: 100 + p.intensity, memberId: p.member_id, memberName: nameOf.get(p.member_id) || "Membre", sessionId: p.session_id, exerciseName: p.exercise_name, zone: p.zone, intensity: p.intensity, comment: p.comment, createdAt: p.created_at });
    // Dedup high RPE per session
    const seenSess = new Set<string>();
    for (const r of (highRpe ?? []) as Array<{ id: string; session_id: string; exercise_name: string | null; rpe: number; created_at: string; sessions: { member_id: string } }>) {
      if (seenSess.has(r.session_id)) continue; seenSess.add(r.session_id);
      items.push({ type: "high_rpe", id: r.id, priority: 80 + r.rpe, memberId: r.sessions.member_id, memberName: nameOf.get(r.sessions.member_id) || "Membre", sessionId: r.session_id, exerciseName: r.exercise_name || "—", rpe: r.rpe, createdAt: r.created_at });
    }
    for (const v of videos ?? []) items.push({ type: "video", id: v.id, priority: 60, memberId: v.member_id, memberName: nameOf.get(v.member_id) || "Membre", sessionId: v.session_id, exerciseName: v.exercise_name, createdAt: v.created_at });
    for (const m of msgs ?? []) items.push({ type: "message", id: m.id, priority: 40, memberId: m.from_id, memberName: nameOf.get(m.from_id) || "Membre", content: m.content, createdAt: m.created_at });

    items.sort((a, b) => b.priority - a.priority || (a.createdAt < b.createdAt ? 1 : -1));
    return items.slice(0, 30);
  });

export const getRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(members.map((m) => [m.user_id, [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre"]));

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, member_id, session_label, week_number, day_number, started_at, ended_at, duration_minutes, average_rpe, member_note, coach_seen, status")
      .eq("status", "completed")
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 10);

    const ids = (sessions ?? []).map((s) => s.id);
    let painsBySession = new Map<string, number>();
    if (ids.length) {
      const { data: pains } = await supabaseAdmin.from("pain_reports").select("session_id").in("session_id", ids);
      for (const p of pains ?? []) if (p.session_id) painsBySession.set(p.session_id, (painsBySession.get(p.session_id) || 0) + 1);
    }

    return (sessions ?? []).map((s) => ({
      id: s.id,
      memberId: s.member_id,
      memberName: nameOf.get(s.member_id) || "Membre",
      label: s.session_label,
      week: s.week_number, day: s.day_number,
      endedAt: s.ended_at,
      durationMinutes: s.duration_minutes,
      averageRpe: s.average_rpe,
      memberNote: s.member_note,
      coachSeen: s.coach_seen,
      painCount: painsBySession.get(s.id) || 0,
    }));
  });

export const getMembersOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    if (!members.length) return [];

    const ids = members.map((m) => m.user_id);
    const sevenDaysAgo = daysAgo(7).toISOString();
    const [assignsR, lastSessionsR, painsR, highRpeR] = await Promise.all([
      supabaseAdmin.from("assignments").select("member_id, program_id, start_date, active, programs(name, duration_weeks)").in("member_id", ids).eq("active", true),
      supabaseAdmin.from("sessions").select("member_id, ended_at, status").in("member_id", ids).order("ended_at", { ascending: false }),
      supabaseAdmin.from("pain_reports").select("member_id").in("member_id", ids).is("resolved_at", null),
      supabaseAdmin.from("exercise_feedbacks").select("rpe, sessions!inner(member_id, ended_at)").gte("rpe", 9).gte("sessions.ended_at", sevenDaysAgo),
    ]);

    const painSet = new Set((painsR.data ?? []).map((p) => p.member_id));
    const highRpeMembers = new Set<string>();
    for (const r of (highRpeR.data ?? []) as Array<{ sessions: { member_id: string } }>) highRpeMembers.add(r.sessions.member_id);

    const lastByMember = new Map<string, string>();
    const sessions7By = new Map<string, { done: number; total: number }>();
    for (const s of lastSessionsR.data ?? []) {
      if (!lastByMember.has(s.member_id) && s.ended_at) lastByMember.set(s.member_id, s.ended_at);
      if (s.ended_at && s.ended_at >= sevenDaysAgo) {
        const cur = sessions7By.get(s.member_id) || { done: 0, total: 0 };
        cur.total += 1; if (s.status === "completed") cur.done += 1;
        sessions7By.set(s.member_id, cur);
      }
    }
    const assignBy = new Map<string, { programName: string | null; durationWeeks: number | null; startDate: string | null }>();
    for (const a of (assignsR.data ?? []) as Array<{ member_id: string; start_date: string | null; programs: { name: string | null; duration_weeks: number | null } | null }>) {
      assignBy.set(a.member_id, { programName: a.programs?.name ?? null, durationWeeks: a.programs?.duration_weeks ?? null, startDate: a.start_date });
    }

    return members.map((m) => {
      const a = assignBy.get(m.user_id);
      let currentWeek: number | null = null;
      if (a?.startDate) {
        const diff = Math.floor((Date.now() - new Date(a.startDate).getTime()) / (7 * 86400000)) + 1;
        currentWeek = Math.max(1, diff);
      }
      const s7 = sessions7By.get(m.user_id) || { done: 0, total: 0 };
      const adherence = s7.total > 0 ? Math.round((s7.done / s7.total) * 100) : null;
      let status: "red" | "orange" | "green" = "green";
      let statusLabel = "OK";
      if (painSet.has(m.user_id)) { status = "red"; statusLabel = "Douleur signalée"; }
      else if (highRpeMembers.has(m.user_id)) { status = "orange"; statusLabel = "RPE élevé"; }

      return {
        memberId: m.user_id,
        name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
        programName: a?.programName ?? null,
        currentWeek,
        durationWeeks: a?.durationWeeks ?? null,
        lastSessionAt: lastByMember.get(m.user_id) ?? null,
        sessionsDone7d: s7.done, sessionsTotal7d: s7.total,
        adherence7d: adherence,
        status, statusLabel,
      };
    }).sort((a, b) => {
      const rank = { red: 0, orange: 1, green: 2 };
      return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
    });
  });

export const markSessionSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin.from("sessions").update({ coach_seen: true }).eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSessionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const [sessR, setsR, fbR, painsR] = await Promise.all([
      supabaseAdmin.from("sessions").select("id, member_id, program_id, session_label, week_number, day_number, started_at, ended_at, duration_minutes, average_rpe, total_volume_kg, overall_feeling, member_note, coach_seen, status").eq("id", data.sessionId).maybeSingle(),
      supabaseAdmin.from("set_logs").select("exercise_name, set_number, weight_kg, reps, rpe, note, completed, logged_at").eq("session_id", data.sessionId).order("logged_at", { ascending: true }),
      supabaseAdmin.from("exercise_feedbacks").select("exercise_name, block_id, rpe, felt_too_hard, felt_too_easy, could_not_do, member_comment, created_at").eq("session_id", data.sessionId),
      supabaseAdmin.from("pain_reports").select("id, exercise_name, zone, intensity, comment, resolved_at, created_at").eq("session_id", data.sessionId),
    ]);
    if (!sessR.data) throw new Error("Séance introuvable");

    let program: { name: string | null; structure: unknown } | null = null;
    if (sessR.data.program_id) {
      const { data: pg } = await supabaseAdmin.from("programs").select("name, structure").eq("id", sessR.data.program_id).maybeSingle();
      program = pg ? { name: pg.name, structure: pg.structure } : null;
    }
    const { data: prof } = await supabaseAdmin.from("profiles").select("first_name, last_name, email").eq("id", sessR.data.member_id).maybeSingle();

    return {
      session: sessR.data,
      member: prof ? { name: [prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.email || "Membre" } : { name: "Membre" },
      program,
      setLogs: setsR.data ?? [],
      feedbacks: fbR.data ?? [],
      pains: painsR.data ?? [],
    };
  });
