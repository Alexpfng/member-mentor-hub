import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { filterRecentSessionsForCoach } from "@/lib/coach-recent-sessions";
import type { RunMetrics } from "@/lib/run-stats";

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
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

type Member = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

async function listCoachMembers() {
  // membres = users ayant le rôle "member"
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "member");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [] as Member[];
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids);
  return (profs ?? []).map((p) => ({
    user_id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
  })) as Member[];
}

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const memberIds = members.map((m) => m.user_id);

    const weekStart = startOfWeek().toISOString();
    const sevenDaysAgo = daysAgo(7).toISOString();
    // Séance « en retard » : planifiée, jamais faite, date dépassée de 3+ jours (fenêtre 30 j).
    const lateCutoff = daysAgo(3).toISOString().slice(0, 10);
    const lateFloor = daysAgo(30).toISOString().slice(0, 10);

    const weekStartISO = startOfWeek().toISOString().slice(0, 10);

    const [sessionsWeek, painUnresolved, msgsUnread, videosUnreviewed, weekPlanned, weekCompleted] =
      await Promise.all([
        // Scopé aux membres du coach, et seules les séances utiles comptent
        // (les abandonnées/skipped gonflaient le compteur).
        memberIds.length > 0
          ? supabaseAdmin
              .from("sessions")
              .select("id, member_id, status", { count: "exact", head: false })
              .in("member_id", memberIds)
              .in("status", ["completed", "in_progress"])
              .gte("started_at", weekStart)
          : Promise.resolve({ count: 0 }),
        supabaseAdmin
          .from("pain_reports")
          .select("id", { count: "exact", head: true })
          .is("resolved_at", null),
        supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("to_id", context.userId)
          .eq("read", false),
        supabaseAdmin
          .from("technique_videos")
          .select("id", { count: "exact", head: true })
          .eq("coach_reviewed", false),
        // Séances planifiées depuis le début de la semaine (planning des membres)
        memberIds.length > 0
          ? supabaseAdmin
              .from("planned_sessions")
              .select("id", { count: "exact", head: true })
              .in("member_id", memberIds)
              .gte("planned_date", weekStartISO)
              .neq("status", "rest")
          : Promise.resolve({ count: 0 }),
        // Séances terminées cette semaine (tous les membres du coach)
        memberIds.length > 0
          ? supabaseAdmin
              .from("sessions")
              .select("id", { count: "exact", head: true })
              .in("member_id", memberIds)
              .gte("started_at", weekStart)
              .eq("status", "completed")
          : Promise.resolve({ count: 0 }),
      ]);

    // « À traiter » = seulement les vraies alertes (la colonne priorité ne liste plus
    // les séances terminées, qui vivent dans « SÉANCES TERMINÉES »).
    const toTreat =
      (painUnresolved.count || 0) + (msgsUnread.count || 0) + (videosUnreviewed.count || 0);

    return {
      activeMembers: memberIds.length,
      sessionsThisWeek: sessionsWeek.count || 0,
      toTreat,
      todayPlanned: weekPlanned.count || 0,
      todayCompleted: weekCompleted.count || 0,
    };
  });

/* ---------- Séances en retard (planifiées, non faites, 3+ jours de retard) ---------- */

// Returns late sessions grouped by member, with done/total ratio in the same 30-day window.
export const getLateSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(
      members.map((m) => [
        m.user_id,
        [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
      ]),
    );

    const cutoff = daysAgo(3).toISOString().slice(0, 10);
    const floor = daysAgo(30).toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const [{ data: lateRowsRaw }, { data: allRows }] = await Promise.all([
      supabaseAdmin
        .from("planned_sessions")
        .select("id, member_id, day_label, planned_date, week_number, created_at")
        .eq("status", "planned")
        .not("planned_date", "is", null)
        .gte("planned_date", floor)
        .lte("planned_date", cutoff)
        .order("planned_date", { ascending: true })
        .limit(200),
      supabaseAdmin
        .from("planned_sessions")
        .select("id, member_id, status, planned_date")
        .not("planned_date", "is", null)
        .gte("planned_date", floor)
        .lte("planned_date", todayStr)
        .limit(500),
    ]);

    // Exclude retroactive entries: created AFTER planned_date → coach entered old sessions today
    const lateRows = (lateRowsRaw ?? []).filter(
      (r) => r.planned_date! >= r.created_at.slice(0, 10),
    );

    // Per-member totals (done vs all that should have been done by today, also excluding retroactive)
    const totals = new Map<string, { total: number; done: number }>();
    for (const r of allRows ?? []) {
      const e = totals.get(r.member_id) ?? { total: 0, done: 0 };
      e.total++;
      if (r.status === "done") e.done++;
      totals.set(r.member_id, e);
    }

    // Group late sessions by member
    type LateGroup = {
      memberId: string;
      memberName: string;
      lateCount: number;
      doneCount: number;
      totalPlanned: number;
      maxDaysLate: number;
      sessions: Array<{ id: string; dayLabel: string; plannedDate: string; daysLate: number }>;
    };
    const grouped = new Map<string, LateGroup>();
    for (const p of lateRows ?? []) {
      const d = new Date(`${p.planned_date}T00:00:00`);
      const daysLate = Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
      const existing = grouped.get(p.member_id);
      const t = totals.get(p.member_id) ?? { total: 0, done: 0 };
      if (!existing) {
        grouped.set(p.member_id, {
          memberId: p.member_id,
          memberName: nameOf.get(p.member_id) || "Membre",
          lateCount: 1,
          doneCount: t.done,
          totalPlanned: t.total,
          maxDaysLate: daysLate,
          sessions: [
            { id: p.id, dayLabel: p.day_label ?? "", plannedDate: p.planned_date ?? "", daysLate },
          ],
        });
      } else {
        existing.lateCount++;
        existing.maxDaysLate = Math.max(existing.maxDaysLate, daysLate);
        existing.sessions.push({
          id: p.id,
          dayLabel: p.day_label ?? "",
          plannedDate: p.planned_date ?? "",
          daysLate,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.maxDaysLate - a.maxDaysLate);
  });

/* Relance d'un coaché en retard : envoie un message du coach vers le membre. */
export const remindLateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        lateCount: z.number().int().min(1).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const n = data.lateCount ?? 1;
    const content =
      n > 1
        ? `Salut ! Tu as ${n} séances planifiées qui ne sont pas encore faites — où en es-tu ? Dis-moi si on doit les adapter ou reporter 💪`
        : `Salut ! Tu as une séance planifiée qui n'est pas encore faite — où en es-tu ? Dis-moi si on doit l'adapter 💪`;
    const { error } = await supabaseAdmin.from("messages").insert({
      from_id: context.userId,
      to_id: data.memberId,
      content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPriorityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(
      members.map((m) => [
        m.user_id,
        [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
      ]),
    );

    // Les séances terminées « à voir » ne sont plus listées ici : elles vivent dans
    // la colonne « SÉANCES TERMINÉES ». Cette colonne ne garde que les vraies alertes
    // (douleur, RPE élevé, vidéo à revoir, message non lu).
    const [pains, videos, msgs, highRpe] = await Promise.all([
      supabaseAdmin
        .from("pain_reports")
        .select("id, member_id, session_id, exercise_name, zone, intensity, comment, created_at")
        .is("resolved_at", null)
        .order("intensity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("technique_videos")
        .select("id, member_id, session_id, exercise_name, created_at")
        .eq("coach_reviewed", false)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("messages")
        .select("id, from_id, content, created_at")
        .eq("to_id", context.userId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("exercise_feedbacks")
        .select(
          "id, session_id, exercise_name, rpe, created_at, sessions!inner(member_id, coach_seen, coach_hidden_at, status)",
        )
        .gte("rpe", 9)
        .eq("sessions.coach_seen", false)
        .eq("sessions.status", "completed")
        .is("sessions.coach_hidden_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    type Item =
      | {
          type: "pain";
          id: string;
          priority: number;
          memberId: string;
          memberName: string;
          sessionId: string | null;
          exerciseName: string;
          zone: string;
          intensity: number;
          comment: string | null;
          createdAt: string;
        }
      | {
          type: "high_rpe";
          id: string;
          priority: number;
          memberId: string;
          memberName: string;
          sessionId: string;
          exerciseName: string;
          rpe: number;
          createdAt: string;
        }
      | {
          type: "video";
          id: string;
          priority: number;
          memberId: string;
          memberName: string;
          sessionId: string | null;
          exerciseName: string | null;
          createdAt: string;
        }
      | {
          type: "message";
          id: string;
          priority: number;
          memberId: string;
          memberName: string;
          content: string;
          createdAt: string;
        };

    const items: Item[] = [];
    for (const p of pains.data ?? []) {
      items.push({
        type: "pain",
        id: p.id,
        priority: 100 + p.intensity,
        memberId: p.member_id,
        memberName: nameOf.get(p.member_id) || "Membre",
        sessionId: p.session_id,
        exerciseName: p.exercise_name,
        zone: p.zone,
        intensity: p.intensity,
        comment: p.comment,
        createdAt: p.created_at,
      });
    }
    // Dedup high RPE per session
    const seenSess = new Set<string>();
    for (const r of (highRpe.data ?? []) as unknown as Array<{
      id: string;
      session_id: string;
      exercise_name: string | null;
      rpe: number;
      created_at: string;
      sessions: { member_id: string };
    }>) {
      if (seenSess.has(r.session_id)) continue;
      seenSess.add(r.session_id);
      items.push({
        type: "high_rpe",
        id: r.id,
        priority: 80 + r.rpe,
        memberId: r.sessions.member_id,
        memberName: nameOf.get(r.sessions.member_id) || "Membre",
        sessionId: r.session_id,
        exerciseName: r.exercise_name || "—",
        rpe: r.rpe,
        createdAt: r.created_at,
      });
    }
    for (const v of videos.data ?? [])
      items.push({
        type: "video",
        id: v.id,
        priority: 60,
        memberId: v.member_id,
        memberName: nameOf.get(v.member_id) || "Membre",
        sessionId: v.session_id,
        exerciseName: v.exercise_name,
        createdAt: v.created_at ?? new Date().toISOString(),
      });
    for (const m of msgs.data ?? [])
      items.push({
        type: "message",
        id: m.id,
        priority: 40,
        memberId: m.from_id,
        memberName: nameOf.get(m.from_id) || "Membre",
        content: m.content,
        createdAt: m.created_at ?? new Date().toISOString(),
      });

    items.sort((a, b) => b.priority - a.priority || (a.createdAt < b.createdAt ? 1 : -1));
    return items.slice(0, 50);
  });

export const getRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(
      members.map((m) => [
        m.user_id,
        [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
      ]),
    );

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, member_id, session_label, week_number, day_number, started_at, ended_at, duration_minutes, average_rpe, member_note, coach_seen, coach_hidden_at, status, session_type, free_title, free_category",
      )
      .eq("status", "completed")
      .is("coach_hidden_at", null)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 20);

    const ids = (sessions ?? []).map((s) => s.id);
    const painsBySession = new Map<string, number>();
    if (ids.length) {
      const { data: pains } = await supabaseAdmin
        .from("pain_reports")
        .select("session_id")
        .in("session_id", ids);
      for (const p of pains ?? [])
        if (p.session_id)
          painsBySession.set(p.session_id, (painsBySession.get(p.session_id) || 0) + 1);
    }

    return filterRecentSessionsForCoach(sessions ?? []).map((s) => ({
      id: s.id,
      memberId: s.member_id,
      memberName: nameOf.get(s.member_id) || "Membre",
      label: s.session_label,
      week: s.week_number,
      day: s.day_number,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      status: s.status,
      durationMinutes: s.duration_minutes,
      averageRpe: s.average_rpe,
      memberNote: s.member_note,
      coachSeen: s.coach_seen,
      painCount: painsBySession.get(s.id) || 0,
      sessionType: s.session_type ?? "program",
      freeTitle: s.free_title ?? null,
      freeCategory: s.free_category ?? null,
    }));
  });

export const getArchivedCoachSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertCoach(context.userId);
    const members = await listCoachMembers();
    const nameOf = new Map(
      members.map((m) => [
        m.user_id,
        [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
      ]),
    );

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, member_id, session_label, week_number, day_number, started_at, ended_at, duration_minutes, average_rpe, coach_seen, coach_hidden_at, status, session_type, free_title, free_category",
      )
      .eq("status", "completed")
      .not("coach_hidden_at", "is", null)
      .order("coach_hidden_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 30);

    return (sessions ?? []).map((s) => ({
      id: s.id,
      memberId: s.member_id,
      memberName: nameOf.get(s.member_id) || "Membre",
      label: s.session_label,
      week: s.week_number,
      day: s.day_number,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      status: s.status,
      durationMinutes: s.duration_minutes,
      averageRpe: s.average_rpe,
      coachSeen: s.coach_seen,
      archivedAt: s.coach_hidden_at,
      sessionType: s.session_type ?? "program",
      freeTitle: s.free_title ?? null,
      freeCategory: s.free_category ?? null,
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
      supabaseAdmin
        .from("assignments")
        .select("member_id, program_id, start_date, active, programs(name, duration_weeks)")
        .in("member_id", ids)
        .eq("active", true),
      supabaseAdmin
        .from("sessions")
        .select("member_id, ended_at, status, session_type")
        .in("member_id", ids)
        .order("ended_at", { ascending: false }),
      supabaseAdmin
        .from("pain_reports")
        .select("member_id")
        .in("member_id", ids)
        .is("resolved_at", null),
      supabaseAdmin
        .from("exercise_feedbacks")
        .select("rpe, sessions!inner(member_id, ended_at)")
        .gte("rpe", 9)
        .gte("sessions.ended_at", sevenDaysAgo),
    ]);

    const painSet = new Set((painsR.data ?? []).map((p) => p.member_id));
    const highRpeMembers = new Set<string>();
    for (const r of (highRpeR.data ?? []) as Array<{ sessions: { member_id: string } }>)
      highRpeMembers.add(r.sessions.member_id);

    const lastByMember = new Map<string, string>();
    const sessions7By = new Map<string, { done: number; total: number }>();
    for (const s of lastSessionsR.data ?? []) {
      if (!lastByMember.has(s.member_id) && s.ended_at) lastByMember.set(s.member_id, s.ended_at);
      // Adhérence : seulement les séances de programme
      if (s.ended_at && s.ended_at >= sevenDaysAgo && (s.session_type ?? "program") === "program") {
        const cur = sessions7By.get(s.member_id) || { done: 0, total: 0 };
        cur.total += 1;
        if (s.status === "completed") cur.done += 1;
        sessions7By.set(s.member_id, cur);
      }
    }
    const assignBy = new Map<
      string,
      { programName: string | null; durationWeeks: number | null; startDate: string | null }
    >();
    for (const a of (assignsR.data ?? []) as Array<{
      member_id: string;
      start_date: string | null;
      programs: { name: string | null; duration_weeks: number | null } | null;
    }>) {
      assignBy.set(a.member_id, {
        programName: a.programs?.name ?? null,
        durationWeeks: a.programs?.duration_weeks ?? null,
        startDate: a.start_date,
      });
    }

    return members
      .map((m) => {
        const a = assignBy.get(m.user_id);
        let currentWeek: number | null = null;
        if (a?.startDate) {
          const diff =
            Math.floor((Date.now() - new Date(a.startDate).getTime()) / (7 * 86400000)) + 1;
          // Bornée à la durée du programme : un programme de 8 semaines terminé
          // depuis 3 mois ne doit pas afficher « S20 ».
          currentWeek = Math.max(1, a.durationWeeks ? Math.min(diff, a.durationWeeks) : diff);
        }
        const s7 = sessions7By.get(m.user_id) || { done: 0, total: 0 };
        const adherence =
          s7.total > 0 ? Math.min(100, Math.round((s7.done / s7.total) * 100)) : null;
        let status: "red" | "orange" | "green" = "green";
        let statusLabel = "OK";
        if (painSet.has(m.user_id)) {
          status = "red";
          statusLabel = "Douleur signalée";
        } else if (highRpeMembers.has(m.user_id)) {
          status = "orange";
          statusLabel = "RPE élevé";
        }

        return {
          memberId: m.user_id,
          name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Membre",
          programName: a?.programName ?? null,
          currentWeek,
          durationWeeks: a?.durationWeeks ?? null,
          lastSessionAt: lastByMember.get(m.user_id) ?? null,
          sessionsDone7d: s7.done,
          sessionsTotal7d: s7.total,
          adherence7d: adherence,
          status,
          statusLabel,
        };
      })
      .sort((a, b) => {
        const rank = { red: 0, orange: 1, green: 2 };
        return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
      });
  });

export const markSessionSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ coach_seen: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPriorityMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: updated, error } = await supabaseAdmin
      .from("messages")
      .update({ read: true })
      .eq("id", data.messageId)
      .eq("to_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) throw new Error("Message introuvable");
    return { ok: true };
  });

export const hideSessionFromCoachDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ coach_hidden_at: new Date().toISOString(), coach_seen: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreSessionToCoachDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ coach_hidden_at: null, coach_seen: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSessionCoachNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sessionId: z.string().uuid(), note: z.string().max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ coach_note: data.note.trim() || null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSessionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const [sessR, setsR, fbR, painsR, freeActR, mediaR, techVidR, commentsR] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select(
          "id, member_id, program_id, session_label, week_number, day_number, started_at, ended_at, duration_minutes, average_rpe, total_volume_kg, overall_feeling, member_note, coach_note, coach_seen, status, session_type, free_title, free_category",
        )
        .eq("id", data.sessionId)
        .maybeSingle(),
      supabaseAdmin
        .from("set_logs")
        .select("exercise_name, set_number, weight_kg, reps, rpe, note, completed, logged_at")
        .eq("session_id", data.sessionId)
        .order("logged_at", { ascending: true }),
      supabaseAdmin
        .from("exercise_feedbacks")
        .select(
          "exercise_name, block_id, rpe, felt_too_hard, felt_too_easy, could_not_do, member_comment, created_at",
        )
        .eq("session_id", data.sessionId),
      supabaseAdmin
        .from("pain_reports")
        .select("id, exercise_name, zone, intensity, comment, resolved_at, created_at")
        .eq("session_id", data.sessionId),
      supabaseAdmin
        .from("free_activities")
        .select(
          "id, name, category, series, reps, charge, duration_min, distance_km, elevation_m, rpe, note, order_index",
        )
        .eq("session_id", data.sessionId)
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("session_media")
        .select("id, type, storage_path, thumbnail_path, caption, created_at")
        .eq("session_id", data.sessionId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("technique_videos")
        .select("id, exercise_name, storage_path, thumbnail_url, created_at")
        .eq("session_id", data.sessionId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("exercise_comments")
        .select("id, exercise_name, author_role, content, created_at")
        .eq("session_id", data.sessionId)
        .eq("author_role", "member")
        .order("created_at", { ascending: true }),
    ]);
    if (!sessR.data) throw new Error("Séance introuvable");

    let programName: string | null = null;
    let programStructureJson: string | null = null;
    if (sessR.data.program_id) {
      const { data: pg } = await supabaseAdmin
        .from("programs")
        .select("name, structure")
        .eq("id", sessR.data.program_id)
        .maybeSingle();
      if (pg) {
        programName = pg.name;
        programStructureJson = pg.structure == null ? null : JSON.stringify(pg.structure);
      }
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", sessR.data.member_id)
      .maybeSingle();

    // Stats de course structurées + course précédente (pour la comparaison côté coach)
    let runStats: RunMetrics | null = null;
    let runPrevious: RunMetrics | null = null;
    const toRunMetrics = (r: {
      distance_km: number | null;
      duration_sec: number | null;
      elevation_m: number | null;
      avg_hr: number | null;
      pace_sec_per_km: number | null;
      rpe: number | null;
    }): RunMetrics => ({
      distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
      durationSec: r.duration_sec,
      elevationM: r.elevation_m,
      avgHr: r.avg_hr,
      paceSecPerKm: r.pace_sec_per_km,
      rpe: r.rpe,
    });
    {
      const { data: rs } = await supabaseAdmin
        .from("run_stats")
        .select("distance_km, duration_sec, elevation_m, avg_hr, pace_sec_per_km, rpe, created_at")
        .eq("session_id", data.sessionId)
        .maybeSingle();
      if (rs) {
        runStats = toRunMetrics(rs);
        const { data: prev } = await supabaseAdmin
          .from("run_stats")
          .select(
            "distance_km, duration_sec, elevation_m, avg_hr, pace_sec_per_km, rpe, created_at",
          )
          .eq("member_id", sessR.data.member_id)
          .neq("session_id", data.sessionId)
          .lt("created_at", rs.created_at)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prev) runPrevious = toRunMetrics(prev);
      }
    }

    // Signed URLs for private bucket (session_media)
    const mediaWithUrls = await Promise.all(
      (mediaR.data ?? []).map(async (m) => {
        const [signed, signedThumb] = await Promise.all([
          supabaseAdmin.storage.from("session-media").createSignedUrl(m.storage_path, 3600),
          m.thumbnail_path
            ? supabaseAdmin.storage.from("session-media").createSignedUrl(m.thumbnail_path, 3600)
            : Promise.resolve({ data: null }),
        ]);
        return {
          id: m.id,
          type: m.type,
          caption: m.caption,
          isSessionLevel: m.caption === "[SESSION]",
          url: signed.data?.signedUrl ?? null,
          thumbnailUrl: signedThumb?.data?.signedUrl ?? null,
        };
      }),
    );

    // Signed URLs for technique_videos (per-exercise videos from ExerciseThread)
    const techVideosWithUrls = await Promise.all(
      (techVidR.data ?? []).map(async (v) => {
        const signed = v.storage_path
          ? await supabaseAdmin.storage
              .from("technique-videos")
              .createSignedUrl(v.storage_path, 3600)
              .catch(() => ({ data: null }))
          : { data: null };
        return {
          id: v.id,
          exerciseName: v.exercise_name,
          url: (signed as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null,
          thumbnailUrl: v.thumbnail_url ?? null,
        };
      }),
    );

    return {
      session: sessR.data,
      member: prof
        ? {
            name:
              [prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.email || "Membre",
          }
        : { name: "Membre" },
      program: programName ? { name: programName, structureJson: programStructureJson } : null,
      setLogs: setsR.data ?? [],
      feedbacks: fbR.data ?? [],
      pains: painsR.data ?? [],
      freeActivities: freeActR.data ?? [],
      runStats,
      runPrevious,
      media: mediaWithUrls,
      techniqueVideos: techVideosWithUrls,
      exerciseComments: (commentsR.data ?? []).map((c) => ({
        id: c.id,
        exerciseName: c.exercise_name as string,
        content: c.content as string,
        createdAt: c.created_at as string,
      })),
    };
  });

export const getMemberFollowup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const memberId = data.memberId;
    const thirtyDaysAgo = daysAgo(30).toISOString();

    const [sessR, painsR, fbR, assignR] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select(
          "id, status, started_at, ended_at, average_rpe, coach_seen, session_label, week_number, day_number, session_type, free_title, free_category",
        )
        .eq("member_id", memberId)
        .gte("started_at", thirtyDaysAgo)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("pain_reports")
        .select("id, exercise_name, zone, intensity, comment, resolved_at, created_at, session_id")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("exercise_feedbacks")
        .select(
          "id, exercise_name, rpe, felt_too_hard, felt_too_easy, could_not_do, member_comment, created_at, sessions!inner(member_id, ended_at)",
        )
        .eq("sessions.member_id", memberId)
        .gte("sessions.ended_at", thirtyDaysAgo),
      supabaseAdmin
        .from("assignments")
        .select("program_id, start_date, programs(structure, duration_weeks)")
        .eq("member_id", memberId)
        .eq("active", true)
        .maybeSingle(),
    ]);

    const sessions = sessR.data ?? [];
    const completed = sessions.filter((s) => s.status === "completed");
    const completedProgram = completed.filter((s) => (s.session_type ?? "program") === "program");
    const completedFree = completed.filter((s) => s.session_type === "free");
    const rpes = completed.map((s) => Number(s.average_rpe)).filter((n) => !isNaN(n) && n > 0);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const unseenCount = completed.filter((s) => !s.coach_seen).length;

    // Adhérence : SEULEMENT séances de programme (les libres ne comptent pas dans l'adhérence)
    let plannedPerWeek = 0;
    type ProgramShape = {
      structure?: { weeks?: Array<{ days?: Array<{ rest?: boolean }> }> } | null;
      duration_weeks?: number | null;
    };
    const assignTyped = assignR.data as { programs?: ProgramShape | ProgramShape[] | null } | null;
    const prog = Array.isArray(assignTyped?.programs)
      ? assignTyped?.programs[0]
      : assignTyped?.programs;
    const weeks = prog?.structure?.weeks;
    if (weeks && weeks.length > 0) {
      const days = weeks[0]?.days ?? [];
      plannedPerWeek = days.filter((d) => !d?.rest).length;
    }
    const planned30 = plannedPerWeek * 4;
    const done30 = completedProgram.length;
    const free30 = completedFree.length;
    const adherence = planned30 > 0 ? Math.min(100, Math.round((done30 / planned30) * 100)) : null;

    const openPains = (painsR.data ?? []).filter((p) => !p.resolved_at);

    // Exos à surveiller : agrégation feedbacks
    type FbRow = {
      id: string;
      exercise_name: string | null;
      rpe: number | null;
      felt_too_hard: boolean | null;
      felt_too_easy: boolean | null;
      could_not_do: boolean | null;
      created_at: string;
    };
    const fbList = (fbR.data ?? []) as unknown as FbRow[];
    const byEx = new Map<
      string,
      { name: string; tooHard: number; couldNot: number; highRpe: number; total: number }
    >();
    for (const f of fbList) {
      if (!f.exercise_name) continue;
      const cur = byEx.get(f.exercise_name) ?? {
        name: f.exercise_name,
        tooHard: 0,
        couldNot: 0,
        highRpe: 0,
        total: 0,
      };
      cur.total += 1;
      if (f.felt_too_hard) cur.tooHard += 1;
      if (f.could_not_do) cur.couldNot += 1;
      if (f.rpe != null && f.rpe >= 9) cur.highRpe += 1;
      byEx.set(f.exercise_name, cur);
    }
    const watchList = [...byEx.values()]
      .filter((e) => e.tooHard >= 2 || e.couldNot >= 1 || e.highRpe >= 2)
      .sort((a, b) => b.couldNot + b.tooHard + b.highRpe - (a.couldNot + a.tooHard + a.highRpe))
      .slice(0, 6);

    return {
      kpis: {
        sessionsDone: done30,
        sessionsPlanned: planned30,
        adherence,
        freeSessions30: free30,
        avgRpe: avgRpe != null ? Math.round(avgRpe * 10) / 10 : null,
        openPainsCount: openPains.length,
        unseenSessionsCount: unseenCount,
      },
      openPains,
      pastPains: (painsR.data ?? []).filter((p) => p.resolved_at).slice(0, 10),
      watchList,
      recentSessions: completed.slice(0, 8).map((s) => ({
        id: s.id,
        label: s.session_label,
        week: s.week_number,
        day: s.day_number,
        endedAt: s.ended_at,
        averageRpe: s.average_rpe,
        coachSeen: s.coach_seen,
        sessionType: s.session_type ?? "program",
        freeTitle: s.free_title ?? null,
        freeCategory: s.free_category ?? null,
      })),
    };
  });

export const getMemberCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const memberId = data.memberId;
    const eightWeeksAgo = daysAgo(56).toISOString();
    const sevenDaysAgo = daysAgo(7).toISOString();

    const [adhR, rpeR, assignR] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("status, started_at, ended_at, session_type")
        .eq("member_id", memberId)
        .gte("started_at", eightWeeksAgo),
      supabaseAdmin
        .from("sessions")
        .select("ended_at, average_rpe")
        .eq("member_id", memberId)
        .eq("status", "completed")
        .gte("ended_at", sevenDaysAgo)
        .order("ended_at", { ascending: true }),
      supabaseAdmin
        .from("assignments")
        .select("programs(structure)")
        .eq("member_id", memberId)
        .eq("active", true)
        .maybeSingle(),
    ]);

    // Compute weekly buckets
    const weekStartOf = (d: Date) => {
      const x = new Date(d);
      const day = (x.getDay() + 6) % 7;
      x.setDate(x.getDate() - day);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const buckets: Array<{ weekLabel: string; weekKey: string; done: number; planned: number }> =
      [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const ws = weekStartOf(new Date(now.getTime() - i * 7 * 86400000));
      buckets.push({ weekKey: ws.toISOString(), weekLabel: `S${52 - i}`, done: 0, planned: 0 });
    }
    type ProgramShape = {
      structure?: { weeks?: Array<{ days?: Array<{ rest?: boolean }> }> } | null;
    };
    const assignTyped = assignR.data as { programs?: ProgramShape | ProgramShape[] | null } | null;
    const prog = Array.isArray(assignTyped?.programs)
      ? assignTyped?.programs[0]
      : assignTyped?.programs;
    const weeks = prog?.structure?.weeks;
    const plannedPerWeek = weeks?.[0]?.days?.filter((d) => !d?.rest).length ?? 0;
    for (const b of buckets) b.planned = plannedPerWeek;

    for (const s of adhR.data ?? []) {
      if (!s.ended_at || s.status !== "completed") continue;
      // Adhérence : seulement les séances de programme
      if ((s.session_type ?? "program") !== "program") continue;
      const ws = weekStartOf(new Date(s.ended_at)).toISOString();
      const b = buckets.find((x) => x.weekKey === ws);
      if (b) b.done += 1;
    }

    const rpe7 = (rpeR.data ?? [])
      .map((s) => ({
        date: s.ended_at,
        rpe: s.average_rpe != null ? Number(s.average_rpe) : null,
      }))
      .filter((p) => p.rpe != null);

    return {
      adherence: buckets.map((b, i) => ({ week: `S-${7 - i}`, done: b.done, planned: b.planned })),
      rpe7,
    };
  });

export const getExerciseProgression = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ memberId: z.string().uuid(), exerciseName: z.string().min(1).max(200).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const memberId = data.memberId;

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, ended_at")
      .eq("member_id", memberId)
      .eq("status", "completed")
      .order("ended_at", { ascending: true });
    const ids = (sessions ?? []).map((s) => s.id);
    if (!ids.length) return { exercises: [], series: [] };

    const { data: sets } = await supabaseAdmin
      .from("set_logs")
      .select("session_id, exercise_name, weight_kg, reps, rpe")
      .in("session_id", ids);

    const exercises = Array.from(
      new Set((sets ?? []).map((s) => s.exercise_name).filter((n): n is string => !!n)),
    ).sort();
    const target = data.exerciseName ?? exercises[0];
    if (!target) return { exercises, series: [] };

    const dateBySession = new Map<string, string | null>();
    for (const s of sessions ?? []) dateBySession.set(s.id, s.ended_at);

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
      if (w > cur.maxWeight) {
        cur.maxWeight = w;
        cur.topReps = sl.reps ?? 0;
      }
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

/* ---------- Planning hebdomadaire (vue coach : tous les membres) ---------- */

type DayCell = {
  date: string;
  status: "done" | "in_progress" | "planned" | "rest";
  label: string | null;
  sessionId: string | null;
};

export const getCoachWeeklyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);

    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const weekStart = localDate(monday);
    const weekEnd = localDate(sunday);

    const members = await listCoachMembers();
    const memberIds = members.map((m) => m.user_id);

    if (!memberIds.length)
      return { members: [] as { id: string; name: string; days: DayCell[] }[], weekStart, weekEnd };

    const [{ data: planned }, { data: sessions }] = await Promise.all([
      supabaseAdmin
        .from("planned_sessions")
        .select("id, member_id, day_label, planned_date, status, session_id")
        .in("member_id", memberIds)
        .gte("planned_date", weekStart)
        .lte("planned_date", weekEnd),
      supabaseAdmin
        .from("sessions")
        .select("id, member_id, status, date, session_label")
        .in("member_id", memberIds)
        .gte("date", weekStart)
        .lte("date", weekEnd),
    ]);

    const sessionById = new Map<string, { status: string | null; session_label: string | null }>();
    for (const s of sessions ?? []) sessionById.set(s.id, s);

    const result = members.map((m) => {
      const memberPlanned = (planned ?? []).filter((p) => p.member_id === m.user_id);
      const memberSessions = (sessions ?? []).filter((s) => s.member_id === m.user_id);

      const dayMap = new Map<string, DayCell>();

      for (const p of memberPlanned) {
        if (!p.planned_date) continue;
        const linked = p.session_id
          ? sessionById.get(p.session_id)
          : (memberSessions.find((s) => s.date?.slice(0, 10) === p.planned_date) ?? null);
        let cellStatus: DayCell["status"];
        if (p.status === "done") cellStatus = "done";
        else if (p.status === "rest") cellStatus = "rest";
        else if (linked?.status === "in_progress") cellStatus = "in_progress";
        else if (linked?.status === "completed") cellStatus = "done";
        else cellStatus = "planned";
        dayMap.set(p.planned_date, {
          date: p.planned_date,
          status: cellStatus,
          label: p.day_label,
          sessionId: p.session_id,
        });
      }

      for (const s of memberSessions) {
        if (!s.date || dayMap.has(s.date)) continue;
        const cellStatus: DayCell["status"] = s.status === "in_progress" ? "in_progress" : "done";
        dayMap.set(s.date, {
          date: s.date,
          status: cellStatus,
          label: s.session_label,
          sessionId: s.id,
        });
      }

      const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email || "?";
      return {
        id: m.user_id,
        name,
        days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    return { members: result, weekStart, weekEnd };
  });
