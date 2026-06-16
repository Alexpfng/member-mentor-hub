import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Adaptation hebdomadaire des programmes (coach).
 *
 * Chaque semaine livrée à un membre est versionnée dans `assignment_weeks`.
 * Le coach duplique la semaine précédente, ajuste, puis publie.
 */

type ProgExercise = {
  code?: string | null;
  name: string;
  block_type?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
  color?: string | null;
  coach_notes?: string | null;
  youtube_url?: string | null;
  youtube_id?: string | null;
};

type DayStructure = { label?: string; exercises?: ProgExercise[] };
type WeekStructure = { days?: DayStructure[] };
type ProgramStructure = { weeks?: WeekStructure[] };

async function requireCoach(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: coach role required");
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve the source week structure for a member at a given week number.
// Priority: latest published assignment_weeks for that week, else program.structure.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveSourceWeek(
  assignmentId: string,
  weekNumber: number,
): Promise<{ structure: WeekStructure; basedOn: number | null }> {
  // Try previous published assignment_week
  const { data: prev } = await supabaseAdmin
    .from("assignment_weeks")
    .select("structure, week_number")
    .eq("assignment_id", assignmentId)
    .lt("week_number", weekNumber)
    .in("status", ["published", "in_progress", "done"])
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prev && prev.structure) {
    return { structure: prev.structure as WeekStructure, basedOn: prev.week_number };
  }

  // Fallback: program structure
  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select("program_id, programs(structure)")
    .eq("id", assignmentId)
    .maybeSingle();
  const structure = (assignment as { programs?: { structure?: ProgramStructure } } | null)
    ?.programs?.structure;
  const fallbackWeek =
    structure?.weeks?.[Math.max(0, weekNumber - 1)] ??
    structure?.weeks?.[0] ??
    { days: [] };
  return { structure: fallbackWeek as WeekStructure, basedOn: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate feedback from previous week to feed suggestions
// ─────────────────────────────────────────────────────────────────────────────
async function aggregateFeedback(
  memberId: string,
  basedOnWeek: number | null,
): Promise<Record<string, { rpe: number | null; pain: boolean; tooHard: boolean; tooEasy: boolean; failure: boolean }>> {
  if (basedOnWeek == null) return {};

  // Sessions of that week_number
  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("member_id", memberId)
    .eq("week_number", basedOnWeek);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return {};

  const [{ data: logs }, { data: feedbacks }, { data: pains }] = await Promise.all([
    supabaseAdmin.from("set_logs").select("exercise_name, rpe, reps, completed").in("session_id", sessionIds),
    supabaseAdmin.from("exercise_feedbacks").select("exercise_name, felt_too_hard, felt_too_easy, could_not_do, rpe").in("session_id", sessionIds),
    supabaseAdmin.from("pain_reports").select("exercise_name").in("session_id", sessionIds),
  ]);

  const acc: Record<string, { rpeSum: number; rpeCount: number; pain: boolean; tooHard: boolean; tooEasy: boolean; failure: boolean }> = {};
  function bucket(name: string | null | undefined) {
    if (!name) return null;
    if (!acc[name]) acc[name] = { rpeSum: 0, rpeCount: 0, pain: false, tooHard: false, tooEasy: false, failure: false };
    return acc[name];
  }
  (logs ?? []).forEach((l) => {
    const b = bucket(l.exercise_name);
    if (b && l.rpe != null) { b.rpeSum += Number(l.rpe); b.rpeCount += 1; }
    if (b && l.completed === false) b.failure = true;
  });
  (feedbacks ?? []).forEach((f) => {
    const b = bucket(f.exercise_name);
    if (!b) return;
    if (f.felt_too_hard) b.tooHard = true;
    if (f.felt_too_easy) b.tooEasy = true;
    if (f.could_not_do) b.failure = true;
    if (f.rpe != null) { b.rpeSum += Number(f.rpe); b.rpeCount += 1; }
  });
  (pains ?? []).forEach((p) => {
    const b = bucket(p.exercise_name);
    if (b) b.pain = true;
  });

  const out: Record<string, { rpe: number | null; pain: boolean; tooHard: boolean; tooEasy: boolean; failure: boolean }> = {};
  for (const [name, v] of Object.entries(acc)) {
    out[name] = {
      rpe: v.rpeCount ? Math.round((v.rpeSum / v.rpeCount) * 10) / 10 : null,
      pain: v.pain,
      tooHard: v.tooHard,
      tooEasy: v.tooEasy,
      failure: v.failure,
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get or create draft week + feedback context
// ─────────────────────────────────────────────────────────────────────────────
export const getMemberWeekContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      memberId: z.string().uuid(),
      weekNumber: z.number().int().min(0).max(200).optional(),
      weekId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);

    // Active assignment (optional — only needed to create a brand-new week)
    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id, program_id, start_date, programs(name, duration_weeks, structure)")
      .eq("member_id", data.memberId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Step 1: resolve the target week row ─────────────────────────────────
    // Priority A — direct UUID lookup (never fails due to assignment mismatch)
    const byIdResult = data.weekId
      ? await supabaseAdmin.from("assignment_weeks").select("*").eq("id", data.weekId).eq("member_id", data.memberId).maybeSingle()
      : { data: null };

    // Priority B — find by member + week_number
    let targetWeek: number = data.weekNumber ?? -1;
    if (!byIdResult.data && targetWeek === -1) {
      const { data: last } = await supabaseAdmin
        .from("assignment_weeks").select("week_number").eq("member_id", data.memberId)
        .in("status", ["published", "in_progress", "done"]).order("week_number", { ascending: false }).limit(1).maybeSingle();
      targetWeek = (last?.week_number ?? 0) + 1;
      if (targetWeek === 0) targetWeek = 1;
    } else if (!byIdResult.data) {
      // targetWeek already set from data.weekNumber
    } else {
      targetWeek = byIdResult.data.week_number;
    }

    const byNumberResult = !byIdResult.data
      ? await supabaseAdmin.from("assignment_weeks").select("*").eq("member_id", data.memberId).eq("week_number", targetWeek).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };

    let weekRow = byIdResult.data ?? byNumberResult.data;

    // Priority C — create new week (needs active assignment)
    if (!weekRow) {
      if (!assignment) throw new Error("Aucun programme actif pour ce membre. Assigne d'abord un programme.");
      const src = await resolveSourceWeek(assignment.id, targetWeek);
      const { data: created, error } = await supabaseAdmin
        .from("assignment_weeks")
        .insert({
          assignment_id: assignment.id,
          member_id: data.memberId,
          program_id: assignment.program_id,
          week_number: targetWeek,
          based_on_week: src.basedOn,
          structure: src.structure as unknown as never,
          status: "draft",
          created_by: context.userId,
        })
        .select("*").single();
      if (error) throw new Error(error.message);
      weekRow = created;
    } else {
      // Auto-populate empty structure from program
      const hasContent = (weekRow.structure as WeekStructure)?.days?.some((d) => (d.exercises ?? []).length > 0);
      if (!hasContent && assignment) {
        const src = await resolveSourceWeek(assignment.id, targetWeek);
        if ((src.structure.days ?? []).some((d) => (d.exercises ?? []).length > 0)) {
          await supabaseAdmin.from("assignment_weeks")
            .update({ structure: src.structure as unknown as never, based_on_week: src.basedOn })
            .eq("id", weekRow.id);
          weekRow = { ...weekRow, structure: src.structure as unknown as never, based_on_week: src.basedOn };
        }
      }
    }

    // Profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", data.memberId)
      .maybeSingle();

    // Feedback for source week
    const feedback = await aggregateFeedback(data.memberId, weekRow.based_on_week ?? null);

    // Quick metrics for source week
    let adherence: { done: number; total: number } | null = null;
    let avgRpe: number | null = null;
    let painCount = 0;
    if (weekRow.based_on_week != null) {
      const { data: srcSessions } = await supabaseAdmin
        .from("sessions")
        .select("id, status, average_rpe")
        .eq("member_id", data.memberId)
        .eq("week_number", weekRow.based_on_week);
      const total = srcSessions?.length ?? 0;
      const done = (srcSessions ?? []).filter((s) => s.status === "completed").length;
      const rpes = (srcSessions ?? []).map((s) => s.average_rpe).filter((v): v is number => v != null);
      adherence = { done, total };
      avgRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
      const { count } = await supabaseAdmin
        .from("pain_reports")
        .select("id", { count: "exact", head: true })
        .eq("member_id", data.memberId)
        .in("session_id", (srcSessions ?? []).map((s) => s.id));
      painCount = count ?? 0;
    }

    // Resolve program name/weeks — prefer active assignment, fallback to week's own program
    let programName = (assignment as { programs?: { name?: string } } | null)?.programs?.name ?? null;
    let durationWeeks = (assignment as { programs?: { duration_weeks?: number } } | null)?.programs?.duration_weeks ?? null;
    if (!programName && weekRow.program_id) {
      const { data: prog } = await supabaseAdmin.from("programs").select("name, duration_weeks").eq("id", weekRow.program_id).maybeSingle();
      programName = prog?.name ?? null;
      durationWeeks = prog?.duration_weeks ?? null;
    }

    // Max week number that already exists for this member (to prevent nav into unborn weeks)
    const { data: allWeeks } = await supabaseAdmin
      .from("assignment_weeks")
      .select("week_number")
      .eq("member_id", data.memberId);
    const maxWeekNumber = allWeeks?.length
      ? Math.max(...allWeeks.map((w) => w.week_number))
      : weekRow.week_number;

    return {
      week: weekRow,
      assignment: {
        id: assignment?.id ?? weekRow.assignment_id,
        program_id: assignment?.program_id ?? weekRow.program_id,
        program_name: programName ?? "Programme",
        duration_weeks: durationWeeks,
      },
      member: {
        id: data.memberId,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Membre",
      },
      feedback,
      sourceSummary: { adherence, avgRpe, painCount, weekNumber: weekRow.based_on_week },
      maxWeekNumber,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Save draft structure (autosave)
// ─────────────────────────────────────────────────────────────────────────────
export const saveDraftWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weekId: z.string().uuid(),
      structure: z.any(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { error } = await supabaseAdmin
      .from("assignment_weeks")
      .update({ structure: data.structure })
      .eq("id", data.weekId)
      .neq("status", "done");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Compute diff vs based_on week
// ─────────────────────────────────────────────────────────────────────────────
function computeChanges(prev: WeekStructure | null, next: WeekStructure): Array<{ type: string; label: string }> {
  if (!prev) return [{ type: "new", label: "Première semaine du programme" }];
  const changes: Array<{ type: string; label: string }> = [];
  const prevDays = prev.days ?? [];
  const nextDays = next.days ?? [];

  for (let i = 0; i < Math.max(prevDays.length, nextDays.length); i++) {
    const pd = prevDays[i];
    const nd = nextDays[i];
    if (!pd && nd) { changes.push({ type: "day_added", label: `Séance ajoutée : ${nd.label ?? `Séance ${i + 1}`}` }); continue; }
    if (pd && !nd) { changes.push({ type: "day_removed", label: `Séance retirée : ${pd.label ?? `Séance ${i + 1}`}` }); continue; }
    if (!pd || !nd) continue;

    const prevByName = new Map((pd.exercises ?? []).map((e) => [e.name, e]));
    const nextByName = new Map((nd.exercises ?? []).map((e) => [e.name, e]));

    for (const [name, ex] of nextByName) {
      const old = prevByName.get(name);
      if (!old) {
        changes.push({ type: "exo_added", label: `${nd.label ?? `Séance ${i + 1}`} : + ${name}` });
        continue;
      }
      if (String(ex.charge ?? "") !== String(old.charge ?? "")) {
        changes.push({ type: "charge", label: `${name} : ${old.charge ?? "—"} → ${ex.charge ?? "—"}` });
      }
      if (String(ex.series ?? "") !== String(old.series ?? "") || String(ex.reps ?? "") !== String(old.reps ?? "")) {
        changes.push({ type: "volume", label: `${name} : ${old.series ?? "—"}×${old.reps ?? "—"} → ${ex.series ?? "—"}×${ex.reps ?? "—"}` });
      }
      if (String(ex.rpe_target ?? "") !== String(old.rpe_target ?? "")) {
        changes.push({ type: "rpe", label: `${name} : RPE ${old.rpe_target ?? "—"} → ${ex.rpe_target ?? "—"}` });
      }
    }
    for (const [name] of prevByName) {
      if (!nextByName.has(name)) {
        changes.push({ type: "exo_removed", label: `${nd.label ?? `Séance ${i + 1}`} : − ${name}` });
      }
    }
  }
  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview diff (without publishing)
// ─────────────────────────────────────────────────────────────────────────────
export const previewWeekChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ weekId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: week } = await supabaseAdmin
      .from("assignment_weeks").select("*").eq("id", data.weekId).maybeSingle();
    if (!week) throw new Error("Semaine introuvable.");
    let prev: WeekStructure | null = null;
    if (week.based_on_week != null) {
      const { data: src } = await supabaseAdmin
        .from("assignment_weeks")
        .select("structure")
        .eq("assignment_id", week.assignment_id)
        .eq("week_number", week.based_on_week)
        .in("status", ["published", "in_progress", "done"])
        .maybeSingle();
      prev = (src?.structure as WeekStructure) ?? null;
    }
    return { changes: computeChanges(prev, week.structure as WeekStructure) };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Publish week
// ─────────────────────────────────────────────────────────────────────────────
export const publishWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weekId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      notify: z.boolean().optional(),
      message: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: week } = await supabaseAdmin
      .from("assignment_weeks").select("*").eq("id", data.weekId).maybeSingle();
    if (!week) throw new Error("Semaine introuvable.");

    let prev: WeekStructure | null = null;
    if (week.based_on_week != null) {
      const { data: src } = await supabaseAdmin
        .from("assignment_weeks")
        .select("structure")
        .eq("assignment_id", week.assignment_id)
        .eq("week_number", week.based_on_week)
        .in("status", ["published", "in_progress", "done"])
        .maybeSingle();
      prev = (src?.structure as WeekStructure) ?? null;
    }
    const changes = computeChanges(prev, week.structure as WeekStructure);

    const { error } = await supabaseAdmin
      .from("assignment_weeks")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        start_date: data.startDate ?? week.start_date ?? null,
        changes_summary: changes,
      })
      .eq("id", data.weekId);
    if (error) throw new Error(error.message);

    if (data.notify && data.message && data.message.trim()) {
      await supabaseAdmin.from("messages").insert({
        from_id: context.userId,
        to_id: week.member_id,
        content: data.message.trim(),
      });
    }
    return { ok: true, changes };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate this week into N future weeks (drafts)
// ─────────────────────────────────────────────────────────────────────────────
export const duplicateWeekTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weekId: z.string().uuid(),
      targetWeeks: z.array(z.number().int().min(0).max(200)).min(1).max(12),
      progression: z.enum(["identical", "plus5_cumulative", "deload_last"]).default("identical"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: week } = await supabaseAdmin
      .from("assignment_weeks").select("*").eq("id", data.weekId).maybeSingle();
    if (!week) throw new Error("Semaine introuvable.");

    const sorted = [...data.targetWeeks].sort((a, b) => a - b);
    const lastIdx = sorted.length - 1;
    const out: Array<{ weekNumber: number; id: string }> = [];

    for (let i = 0; i < sorted.length; i++) {
      const tw = sorted[i];
      const structure = JSON.parse(JSON.stringify(week.structure ?? {})) as WeekStructure;
      let factor = 1;
      if (data.progression === "plus5_cumulative") factor = 1 + 0.05 * (i + 1);
      if (data.progression === "deload_last" && i === lastIdx) factor = 0.6;
      if (factor !== 1) {
        for (const day of structure.days ?? []) {
          for (const ex of day.exercises ?? []) {
            if (ex.color !== "red") continue;
            const n = Number(ex.charge);
            if (!Number.isNaN(n) && n > 0) ex.charge = String(Math.round(n * factor * 2) / 2);
          }
        }
      }
      const { data: existing } = await supabaseAdmin
        .from("assignment_weeks")
        .select("id")
        .eq("assignment_id", week.assignment_id)
        .eq("week_number", tw)
        .maybeSingle();
      if (existing) continue;

      const { data: created, error } = await supabaseAdmin
        .from("assignment_weeks")
        .insert({
          assignment_id: week.assignment_id,
          member_id: week.member_id,
          program_id: week.program_id,
          week_number: tw,
          based_on_week: week.week_number,
          structure: structure as unknown as never,
          status: "draft",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      out.push({ weekNumber: tw, id: created.id });
    }
    return { created: out };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate an entire program to another member
// ─────────────────────────────────────────────────────────────────────────────
export const duplicateProgramForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      programId: z.string().uuid(),
      memberId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: src } = await supabaseAdmin
      .from("programs").select("*").eq("id", data.programId).maybeSingle();
    if (!src) throw new Error("Programme introuvable.");
    const { data: created, error } = await supabaseAdmin
      .from("programs").insert({
        coach_id: context.userId,
        name: `${src.name} (copie)`,
        description: src.description,
        duration_weeks: src.duration_weeks,
        frequency_per_week: src.frequency_per_week,
        level: src.level,
        objective: src.objective,
        structure: src.structure as unknown as never,
      }).select("id").single();
    if (error) throw new Error(error.message);

    // Deactivate other assignments for that member
    await supabaseAdmin.from("assignments").update({ active: false }).eq("member_id", data.memberId).eq("active", true);
    const { data: assign, error: aErr } = await supabaseAdmin.from("assignments").insert({
      member_id: data.memberId,
      program_id: created.id,
      active: true,
      start_date: new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);

    return { programId: created.id, assignmentId: assign.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// List past completed sessions for history-based generation
// ─────────────────────────────────────────────────────────────────────────────
export const listMemberPastSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().uuid(), limit: z.number().int().min(1).max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, session_label, week_number, day_number, ended_at, session_type, free_title, average_rpe")
      .eq("member_id", data.memberId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(data.limit ?? 20);

    const ids = (sessions ?? []).map((s) => s.id);
    const exoCountBySession = new Map<string, number>();

    if (ids.length) {
      const { data: sets } = await supabaseAdmin
        .from("set_logs")
        .select("session_id, exercise_name")
        .in("session_id", ids);

      const exosBySession = new Map<string, Set<string>>();
      for (const s of sets ?? []) {
        if (!s.session_id || !s.exercise_name) continue;
        if (!exosBySession.has(s.session_id)) exosBySession.set(s.session_id, new Set());
        exosBySession.get(s.session_id)!.add(s.exercise_name);
      }
      for (const [sid, exos] of exosBySession) exoCountBySession.set(sid, exos.size);
    }

    return (sessions ?? []).map((s) => ({
      id: s.id,
      label: s.session_type === "free" ? (s.free_title ?? "Séance libre") : (s.session_label ?? "Séance"),
      weekNumber: s.week_number,
      dayNumber: s.day_number,
      endedAt: s.ended_at,
      averageRpe: s.average_rpe,
      exerciseCount: exoCountBySession.get(s.id) ?? 0,
      sessionType: s.session_type ?? "program",
    }));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Generate a new draft week from selected past sessions (each session = 1 day)
// ─────────────────────────────────────────────────────────────────────────────
export const generateWeekFromSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      memberId: z.string().uuid(),
      sessionIds: z.array(z.string().uuid()).min(1).max(7),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);

    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id, program_id")
      .eq("member_id", data.memberId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!assignment) throw new Error("Aucun programme actif pour ce membre.");

    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("id, session_label, free_title, session_type, week_number, day_number, ended_at")
      .in("id", data.sessionIds)
      .order("ended_at", { ascending: true });

    const { data: setLogs } = await supabaseAdmin
      .from("set_logs")
      .select("session_id, exercise_name, set_number, weight_kg, reps")
      .in("session_id", data.sessionIds)
      .order("logged_at", { ascending: true });

    // Group logs by session
    const logsBySession = new Map<string, typeof setLogs>();
    for (const log of setLogs ?? []) {
      if (!logsBySession.has(log.session_id)) logsBySession.set(log.session_id, []);
      logsBySession.get(log.session_id)!.push(log);
    }

    // Build structure: each session becomes a day
    const orderedSessions = (sessions ?? []).filter((s) => data.sessionIds.includes(s.id));
    const days: DayStructure[] = orderedSessions.map((s) => {
      const logs = logsBySession.get(s.id) ?? [];

      const exoOrder: string[] = [];
      const exoData = new Map<string, { maxSets: number; maxReps: number; maxWeight: number }>();

      for (const log of logs) {
        if (!log.exercise_name) continue;
        if (!exoData.has(log.exercise_name)) {
          exoOrder.push(log.exercise_name);
          exoData.set(log.exercise_name, { maxSets: 0, maxReps: 0, maxWeight: 0 });
        }
        const cur = exoData.get(log.exercise_name)!;
        if ((log.set_number ?? 1) > cur.maxSets) cur.maxSets = log.set_number ?? 1;
        if ((log.reps ?? 0) > cur.maxReps) cur.maxReps = log.reps ?? 0;
        if (Number(log.weight_kg ?? 0) > cur.maxWeight) cur.maxWeight = Number(log.weight_kg ?? 0);
      }

      const exercises: ProgExercise[] = exoOrder.map((name) => {
        const d = exoData.get(name)!;
        return {
          name,
          series: d.maxSets > 0 ? String(d.maxSets) : null,
          reps: d.maxReps > 0 ? String(d.maxReps) : null,
          charge: d.maxWeight > 0 ? String(d.maxWeight) : null,
          color: "red",
        };
      });

      const label =
        s.session_type === "free"
          ? (s.free_title ?? "Séance libre")
          : (s.session_label ?? `Séance ${s.day_number ?? "?"}`);

      return { label, exercises };
    });

    const { data: lastWeek } = await supabaseAdmin
      .from("assignment_weeks")
      .select("week_number")
      .eq("assignment_id", assignment.id)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextWeekNum = (lastWeek?.week_number ?? 0) + 1;

    const { data: created, error } = await supabaseAdmin
      .from("assignment_weeks")
      .insert({
        assignment_id: assignment.id,
        member_id: data.memberId,
        program_id: assignment.program_id,
        week_number: nextWeekNum,
        based_on_week: null,
        structure: { days } as unknown as never,
        status: "draft",
        created_by: context.userId,
      })
      .select("id, week_number")
      .single();
    if (error) throw new Error(error.message);

    return { weekNumber: created.week_number, weekId: created.id };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Delete a draft week (only brouillon weeks can be deleted)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ weekId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: week } = await supabaseAdmin
      .from("assignment_weeks").select("status, member_id").eq("id", data.weekId).maybeSingle();
    if (!week) throw new Error("Semaine introuvable.");
    if (week.status !== "draft") throw new Error("Seules les semaines BROUILLON peuvent être supprimées.");
    const { error } = await supabaseAdmin.from("assignment_weeks").delete().eq("id", data.weekId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// List versioned weeks history for a member
// ─────────────────────────────────────────────────────────────────────────────
export const listMemberWeekHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("assignment_weeks")
      .select("id, week_number, status, published_at, start_date, changes_summary, based_on_week")
      .eq("member_id", data.memberId)
      .order("week_number", { ascending: false });
    return { weeks: rows ?? [] };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Replace a single exercise inside a draft week's structure
// Keeps series/reps/charge/rpe_target/tempo/recup from the source exercise.
// ─────────────────────────────────────────────────────────────────────────────
export const replaceExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      weekId: z.string().uuid(),
      dayIndex: z.number().int().min(0).max(20),
      exoIndex: z.number().int().min(0).max(50),
      newExerciseId: z.string().uuid(),
      memberNote: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCoach(context.userId);
    const { data: week } = await supabaseAdmin
      .from("assignment_weeks").select("*").eq("id", data.weekId).maybeSingle();
    if (!week) throw new Error("Semaine introuvable.");
    if (week.status === "done") throw new Error("Semaine terminée, non modifiable.");

    const { data: exo, error: exErr } = await supabaseAdmin
      .from("exercises")
      .select("name, color, default_tempo, youtube_url, youtube_id, coach_notes, intensity_code")
      .eq("id", data.newExerciseId)
      .maybeSingle();
    if (exErr || !exo) throw new Error("Exercice introuvable.");

    const structure = JSON.parse(JSON.stringify(week.structure ?? {})) as WeekStructure;
    const day = (structure.days ?? [])[data.dayIndex];
    const source = day?.exercises?.[data.exoIndex];
    if (!day || !source) throw new Error("Exercice source introuvable dans la semaine.");

    const replaced: ProgExercise = {
      ...source,
      name: exo.name,
      color: exo.color ?? source.color ?? null,
      tempo: source.tempo ?? exo.default_tempo ?? null,
      youtube_url: exo.youtube_url ?? null,
      youtube_id: exo.youtube_id ?? null,
      coach_notes: data.memberNote?.trim() || source.coach_notes || exo.coach_notes || null,
      code: exo.intensity_code ?? source.code ?? null,
    };
    day.exercises![data.exoIndex] = replaced;

    const { error } = await supabaseAdmin
      .from("assignment_weeks")
      .update({ structure: structure as unknown as never })
      .eq("id", data.weekId);
    if (error) throw new Error(error.message);
    return { ok: true, structure };
  });
