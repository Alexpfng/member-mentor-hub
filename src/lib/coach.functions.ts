import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertCoach(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux coachs");
}

const programSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  duration_weeks: z.number().int().min(1).max(52).optional().nullable(),
  frequency_per_week: z.number().int().min(1).max(7).optional().nullable(),
  objective: z.string().max(80).optional().nullable(),
  level: z.string().max(80).optional().nullable(),
  structure: z.any().optional(),
});

export const saveProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => programSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const payload = {
      coach_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      duration_weeks: data.duration_weeks ?? null,
      frequency_per_week: data.frequency_per_week ?? null,
      objective: data.objective ?? null,
      level: data.level ?? null,
      structure: data.structure ?? {},
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("programs")
        .update(payload)
        .eq("id", data.id)
        .eq("coach_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { program: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("programs")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { program: row };
  });

export const listPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data, error } = await supabaseAdmin
      .from("programs")
      .select(
        "id, name, description, duration_weeks, frequency_per_week, objective, level, created_at",
      )
      .eq("coach_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { programs: data ?? [] };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "member");
    if (rErr) throw new Error(rErr.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { members: [] };

    const [{ data: profiles }, { data: assignments }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, created_at")
        .in("id", ids),
      supabaseAdmin
        .from("assignments")
        .select("member_id, program_id, active, start_date")
        .in("member_id", ids)
        .eq("active", true),
    ]);

    const programIds = Array.from(
      new Set((assignments ?? []).map((a) => a.program_id).filter(Boolean)),
    );
    let programsById = new Map<string, string>();
    if (programIds.length > 0) {
      const { data: progs } = await supabaseAdmin
        .from("programs")
        .select("id, name")
        .in("id", programIds);
      programsById = new Map((progs ?? []).map((p) => [p.id, p.name]));
    }

    const assignMap = new Map<string, any>();
    (assignments ?? []).forEach((a: any) => {
      assignMap.set(a.member_id, a);
    });

    const members = (profiles ?? []).map((p) => {
      const a = assignMap.get(p.id);
      return {
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        created_at: p.created_at,
        program_name: a ? (programsById.get(a.program_id) ?? null) : null,
        program_id: a?.program_id ?? null,
      };
    });
    return { members };
  });

const inviteSchema = z.object({
  email: z.string().email().max(255),
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  redirect_to: z.string().url(),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: result, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirect_to,
      data: {
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
      },
    });
    if (error) throw new Error(error.message);
    return { user_id: result.user?.id ?? null, email: data.email };
  });

const assignSchema = z.object({
  member_id: z.string().uuid(),
  program_id: z.string().uuid(),
  start_date: z.string().optional(),
});

export const assignProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    // Deactivate previous assignments for this member
    await supabaseAdmin
      .from("assignments")
      .update({ active: false })
      .eq("member_id", data.member_id)
      .eq("active", true);
    const { data: row, error } = await supabaseAdmin
      .from("assignments")
      .insert({
        member_id: data.member_id,
        program_id: data.program_id,
        active: true,
        start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { assignment: row };
  });

// ─── MESSAGES ────────────────────────────────────────────────────────────────

const sendMsgSchema = z.object({
  to_user_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  pinned: z.boolean().optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendMsgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("messages")
      .insert({
        from_id: context.userId,
        to_id: data.to_user_id,
        content: data.body,
        pinned: data.pinned ?? false,
        read: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { message: row };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("from_id, to_id, content, created_at, read")
      .or(`from_id.eq.${context.userId},to_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const partnerIds = new Set<string>();
    (data ?? []).forEach((m) => {
      if (m.from_id !== context.userId) partnerIds.add(m.from_id);
      if (m.to_id !== context.userId) partnerIds.add(m.to_id);
    });

    const ids = Array.from(partnerIds);
    let profiles: any[] = [];
    if (ids.length > 0) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      profiles = p ?? [];
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const seen = new Set<string>();
    const conversations: any[] = [];
    for (const m of data ?? []) {
      const partnerId = m.from_id === context.userId ? m.to_id : m.from_id;
      if (seen.has(partnerId)) continue;
      seen.add(partnerId);
      conversations.push({
        partner: profileMap.get(partnerId) ?? {
          id: partnerId,
          first_name: "?",
          last_name: "",
          email: "",
        },
        last_message: m.content,
        last_at: m.created_at,
        unread: !m.read && m.to_id === context.userId,
      });
    }
    return { conversations };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partner_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .or(
        `and(from_id.eq.${context.userId},to_id.eq.${data.partner_id}),and(from_id.eq.${data.partner_id},to_id.eq.${context.userId})`,
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // mark as read
    await supabaseAdmin
      .from("messages")
      .update({ read: true })
      .eq("to_id", context.userId)
      .eq("from_id", data.partner_id)
      .eq("read", false);
    return { messages: msgs ?? [] };
  });

export const pinMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ message_id: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Ownership check: only the sender or recipient may pin/unpin a message.
    // supabaseAdmin bypasses RLS, so we must scope the update ourselves.
    const { data: updated, error } = await supabaseAdmin
      .from("messages")
      .update({ pinned: data.pinned })
      .eq("id", data.message_id)
      .or(`from_id.eq.${context.userId},to_id.eq.${context.userId}`)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error("Not allowed to pin this message");
    }
    return { ok: true };
  });


// ─── EXERCISES ────────────────────────────────────────────────────────────────

const exerciseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  category: z.string().max(40).optional(),
  color: z.string().max(10).optional(),
  youtube_url: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const saveExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => exerciseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const db = supabaseAdmin as any;
    if (data.id) {
      const { data: row, error } = await db
        .from("exercises")
        .update({ ...data })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { exercise: row };
    }
    const { data: row, error } = await db
      .from("exercises")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { exercise: row };
  });

export const listExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data, error } = await (supabaseAdmin as any)
      .from("exercises")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { exercises: data ?? [] };
  });

export const getProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("programs")
      .select("*")
      .eq("id", data.id)
      .eq("coach_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Programme introuvable");
    return { program: row };
  });

export const duplicateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: src, error: e1 } = await supabaseAdmin
      .from("programs")
      .select("*")
      .eq("id", data.id)
      .eq("coach_id", context.userId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!src) throw new Error("Programme introuvable");
    const { data: row, error } = await supabaseAdmin
      .from("programs")
      .insert({
        coach_id: context.userId,
        name: `${src.name} (copie)`,
        description: src.description,
        objective: src.objective,
        duration_weeks: src.duration_weeks,
        frequency_per_week: src.frequency_per_week,
        level: src.level,
        structure: src.structure as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { program: row };
  });


// ─── MEMBER DETAIL ────────────────────────────────────────────────────────────

export const getMemberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ member_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const memberId = data.member_id;

    const [
      { data: profile },
      { data: memberProfile },
      { data: assignment },
      { data: sessions },
      { data: weightLogs },
      { count: unreadCount },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, avatar_url, created_at")
        .eq("id", memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("member_profiles")
        .select("weight_kg, height_cm, level, goal, injuries, coach_private_notes")
        .eq("user_id", memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("assignments")
        .select("id, program_id, start_date, end_date, active")
        .eq("member_id", memberId)
        .eq("active", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("sessions")
        .select(
          "id, date, status, session_label, week_number, day_number, duration_minutes, average_rpe, started_at, ended_at",
        )
        .eq("member_id", memberId)
        .order("date", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("weight_logs")
        .select("date, weight_kg")
        .eq("member_id", memberId)
        .order("date", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("from_id", memberId)
        .eq("to_id", context.userId)
        .eq("read", false),
    ]);

    if (!profile) throw new Error("Adhérent introuvable");

    const sessionIds = (sessions ?? []).map((s) => s.id);
    let setLogs: any[] = [];
    if (sessionIds.length > 0) {
      const { data: sl } = await supabaseAdmin
        .from("set_logs")
        .select("exercise_name, weight_kg, reps, logged_at, session_id")
        .in("session_id", sessionIds)
        .order("logged_at", { ascending: false })
        .limit(200);
      setLogs = sl ?? [];
    }

    let program: any = null;
    if (assignment?.program_id) {
      const { data: p } = await supabaseAdmin
        .from("programs")
        .select(
          "id, name, description, duration_weeks, frequency_per_week, objective, level, structure",
        )
        .eq("id", assignment.program_id)
        .maybeSingle();
      program = p;
    }

    const lastWeight = (weightLogs ?? [])[0]?.weight_kg ?? memberProfile?.weight_kg ?? null;

    return {
      profile,
      member_profile: memberProfile ?? null,
      assignment: assignment ?? null,
      program,
      sessions: sessions ?? [],
      set_logs: setLogs,
      weight_logs: weightLogs ?? [],
      unread_messages_count: unreadCount ?? 0,
      last_weight_kg: lastWeight,
    };
  });

export const updateMemberNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        member_id: z.string().uuid(),
        coach_private_notes: z.string().max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("member_profiles")
      .select("id")
      .eq("user_id", data.member_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("member_profiles")
        .update({ coach_private_notes: data.coach_private_notes })
        .eq("user_id", data.member_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("member_profiles")
        .insert({ user_id: data.member_id, coach_private_notes: data.coach_private_notes });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        member_id: z.string().uuid(),
        first_name: z.string().trim().max(80).optional().nullable(),
        last_name: z.string().trim().max(80).optional().nullable(),
        weight_kg: z.number().min(20).max(400).optional().nullable(),
        height_cm: z.number().int().min(80).max(260).optional().nullable(),
        level: z.string().trim().max(40).optional().nullable(),
        goal: z.string().trim().max(200).optional().nullable(),
        injuries: z.string().trim().max(2000).optional().nullable(),
        log_weight: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);

    // 1. profiles (first/last name)
    if (data.first_name !== undefined || data.last_name !== undefined) {
      const patch: { first_name?: string | null; last_name?: string | null } = {};
      if (data.first_name !== undefined) patch.first_name = data.first_name || null;
      if (data.last_name !== undefined) patch.last_name = data.last_name || null;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(patch)
        .eq("id", data.member_id);
      if (error) throw new Error(error.message);
    }

    // 2. member_profiles upsert
    const mpPatch: { weight_kg?: number | null; height_cm?: number | null; level?: string | null; goal?: string | null; injuries?: string | null } = {};
    if (data.weight_kg !== undefined) mpPatch.weight_kg = data.weight_kg;
    if (data.height_cm !== undefined) mpPatch.height_cm = data.height_cm;
    if (data.level !== undefined) mpPatch.level = data.level || null;
    if (data.goal !== undefined) mpPatch.goal = data.goal || null;
    if (data.injuries !== undefined) mpPatch.injuries = data.injuries || null;

    if (Object.keys(mpPatch).length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("member_profiles")
        .select("id")
        .eq("user_id", data.member_id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabaseAdmin
          .from("member_profiles")
          .update(mpPatch)
          .eq("user_id", data.member_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("member_profiles")
          .insert({ user_id: data.member_id, ...mpPatch });
        if (error) throw new Error(error.message);
      }
    }

    // 3. optional weight log
    if (data.log_weight && data.weight_kg) {
      const { error } = await supabaseAdmin
        .from("weight_logs")
        .insert({ member_id: data.member_id, weight_kg: data.weight_kg });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });







// ─── ELEVATION PROXY (server-side → no CORS/rate-limit issues) ───────────────

export const getElevation = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ locs: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(data.locs)}`,
    );
    if (!res.ok) throw new Error(`OpenTopoData ${res.status}`);
    const json = (await res.json()) as { results: Array<{ elevation: number | null }> };
    return { elevations: json.results.map((r) => r.elevation ?? 300) };
  });

// ─── SAVE RUNNING ROUTE ───────────────────────────────────────────────────────

export const saveRunningRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        difficulty: z.string().min(1),
        distance_km: z.number(),
        dplus_m: z.number(),
        dminus_m: z.number(),
        points: z.array(
          z.object({
            lat: z.number(),
            lng: z.number(),
            ele: z.number(),
          }),
        ),
        gpx_url: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { data: row, error } = await (supabaseAdmin as any)
      .from("running_routes")
      .insert({
        coach_id: context.userId,
        name: data.name,
        difficulty: data.difficulty,
        distance_km: data.distance_km,
        dplus_m: data.dplus_m,
        dminus_m: data.dminus_m,
        points: data.points,
        gpx_url: data.gpx_url ?? null,
      })
      .select("id, short_id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, short_id: row.short_id };
  });

export const deleteRunningRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const { error } = await (supabaseAdmin as any)
      .from("running_routes")
      .delete()
      .eq("id", data.id)
      .eq("coach_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRunningRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.userId);
    const { data, error } = await (supabaseAdmin as any)
      .from("running_routes")
      .select("*")
      .eq("coach_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { routes: data ?? [] };
  });


// ─── PROGRAM FOR CURRENT MEMBER ───────────────────────────────────────────────

export const getMyAssignedProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id, program_id, start_date, end_date, active")
      .eq("member_id", context.userId)
      .eq("active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!assignment) return { assignment: null, program: null };
    const { data: program } = await supabaseAdmin
      .from("programs")
      .select(
        "id, name, description, duration_weeks, frequency_per_week, objective, level, structure",
      )
      .eq("id", assignment.program_id)
      .maybeSingle();
    return { assignment, program: program ?? null };
  });

export const deleteProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    await supabaseAdmin.from("assignments").delete().eq("program_id", data.id);
    const { error } = await supabaseAdmin
      .from("programs")
      .delete()
      .eq("id", data.id)
      .eq("coach_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
