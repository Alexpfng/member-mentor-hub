import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildChallengeProgress,
  buildFeed,
  type ChallengeContribution,
  type ChallengeMetric,
  type MemberActivity,
} from "@/lib/community";

// Les tables `challenges` / `challenge_participants` et la colonne
// `profiles.share_milestones` sont plus récentes que les types générés — ce
// décalage existe déjà ailleurs dans le projet (cf. `is_archived`). Plutôt
// qu'un `any` disséminé, on décrit ici la forme minimale du client et chaque
// appel déclare la ligne qu'il attend.
type QueryResult<T> = { data: T | null; error: { message: string } | null };

type Query<T> = PromiseLike<QueryResult<T>> & {
  select: (columns?: string) => Query<T>;
  insert: (values: Record<string, unknown>) => Query<T>;
  update: (values: Record<string, unknown>) => Query<T>;
  upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Query<T>;
  delete: () => Query<T>;
  eq: (column: string, value: string | number | boolean) => Query<T>;
  lte: (column: string, value: string) => Query<T>;
  gte: (column: string, value: string) => Query<T>;
  or: (filter: string) => Query<T>;
  in: (column: string, values: readonly string[]) => Query<T>;
  order: (column: string, options?: { ascending?: boolean }) => Query<T>;
  limit: (count: number) => Query<T>;
  single: () => Query<T>;
  maybeSingle: () => Query<T>;
};

const db = supabaseAdmin as unknown as { from: <T>(table: string) => Query<T> };

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  share_milestones: boolean | null;
};

type ChallengeRow = {
  id: string;
  title: string;
  // La contrainte CHECK de la table garantit ces trois valeurs.
  metric: ChallengeMetric;
  target: number;
  starts_on: string;
  ends_on: string;
};

const FEED_WINDOW_DAYS = 120;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nameOf(profile: { first_name?: string | null; last_name?: string | null } | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Un membre";
}

async function assertCoach(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux coachs");
}

/**
 * Fil des jalons. On ne montre que les membres qui ont accepté de partager —
 * plus soi-même, pour que le fil ne soit jamais vide pour celui qui vient de
 * décrocher quelque chose.
 */
export const getCommunityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles } = await db
      .from<ProfileRow[]>("profiles")
      .select("id, first_name, last_name, share_milestones")
      .or(`share_milestones.eq.true,id.eq.${context.userId}`)
      .limit(200);

    const nameById = new Map<string, string>((profiles ?? []).map((p) => [p.id, nameOf(p)]));
    const memberIds = [...nameById.keys()];
    if (memberIds.length === 0) return { milestones: [], sharing: false };

    const since = new Date();
    since.setDate(since.getDate() - FEED_WINDOW_DAYS);
    const sinceISO = since.toISOString().slice(0, 10);

    const [{ data: sessions }, { data: records }] = await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("member_id, date, total_volume_kg")
        .in("member_id", memberIds)
        .eq("status", "completed")
        .order("date", { ascending: true }),
      supabaseAdmin
        .from("personal_records")
        .select("member_id, exercise_name, date")
        .in("member_id", memberIds)
        .gte("date", sinceISO),
    ]);

    const activities = new Map<string, MemberActivity>();
    for (const [memberId, memberName] of nameById) {
      activities.set(memberId, { memberId, memberName, sessions: [], records: [] });
    }
    for (const session of sessions ?? []) {
      activities.get(session.member_id)?.sessions.push({
        date: session.date,
        volumeKg: session.total_volume_kg != null ? Number(session.total_volume_kg) : 0,
      });
    }
    for (const record of records ?? []) {
      activities
        .get(record.member_id)
        ?.records.push({ exerciseName: record.exercise_name, date: record.date });
    }

    const sharing =
      (profiles ?? []).find((p) => p.id === context.userId)?.share_milestones ?? false;

    return {
      milestones: buildFeed([...activities.values()], { since: sinceISO, limit: 20 }),
      sharing: !!sharing,
    };
  });

/** Consentement de partage : opt-in, révocable à tout moment par le membre. */
export const setShareMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ share: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db
      .from<ProfileRow>("profiles")
      .update({ share_milestones: data.share })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function contributionsFor(
  metric: ChallengeMetric,
  memberIds: string[],
  nameById: Map<string, string>,
  startsOn: string,
  endsOn: string,
): Promise<ChallengeContribution[]> {
  if (memberIds.length === 0) return [];

  const { data: sessions } = await supabaseAdmin
    .from("sessions")
    .select("id, member_id, date, total_volume_kg")
    .in("member_id", memberIds)
    .eq("status", "completed")
    .gte("date", startsOn)
    .lte("date", endsOn);

  const totals = new Map<string, number>(memberIds.map((id) => [id, 0]));

  if (metric === "distance_km") {
    // La distance vit dans run_stats, rattachée à une séance : on ne compte que
    // les sorties de la période, via les séances déjà filtrées.
    const sessionIds = (sessions ?? []).map((s) => s.id);
    const memberBySession = new Map((sessions ?? []).map((s) => [s.id, s.member_id]));
    if (sessionIds.length > 0) {
      const { data: runs } = await supabaseAdmin
        .from("run_stats")
        .select("session_id, distance_km")
        .in("session_id", sessionIds);
      for (const run of runs ?? []) {
        const memberId = memberBySession.get(run.session_id);
        if (!memberId) continue;
        totals.set(memberId, (totals.get(memberId) ?? 0) + Number(run.distance_km ?? 0));
      }
    }
  } else {
    for (const session of sessions ?? []) {
      const add = metric === "sessions" ? 1 : Number(session.total_volume_kg ?? 0);
      totals.set(session.member_id, (totals.get(session.member_id) ?? 0) + add);
    }
  }

  return memberIds.map((memberId) => ({
    memberId,
    memberName: nameById.get(memberId) ?? "Un membre",
    value: totals.get(memberId) ?? 0,
  }));
}

/** Défi en cours : celui dont la période couvre aujourd'hui. */
export const getActiveChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = todayISO();
    const { data: challenge } = await db
      .from<ChallengeRow>("challenges")
      .select("id, title, metric, target, starts_on, ends_on")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) return { challenge: null, progress: null, joined: false };

    const { data: participants } = await db
      .from<Array<{ member_id: string }>>("challenge_participants")
      .select("member_id")
      .eq("challenge_id", challenge.id);

    const memberIds = (participants ?? []).map((p) => p.member_id);
    const { data: profiles } =
      memberIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", memberIds)
        : { data: [] };
    const nameById = new Map<string, string>((profiles ?? []).map((p) => [p.id, nameOf(p)]));

    const contributions = await contributionsFor(
      challenge.metric,
      memberIds,
      nameById,
      challenge.starts_on,
      challenge.ends_on,
    );

    return {
      challenge,
      progress: buildChallengeProgress(contributions, Number(challenge.target), context.userId),
      joined: memberIds.includes(context.userId),
    };
  });

export const joinChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db
      .from<{ challenge_id: string; member_id: string }>("challenge_participants")
      .upsert(
        { challenge_id: data.challengeId, member_id: context.userId },
        { onConflict: "challenge_id,member_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db
      .from<{ challenge_id: string; member_id: string }>("challenge_participants")
      .delete()
      .eq("challenge_id", data.challengeId)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Création ou mise à jour du défi, réservée au coach. */
export const upsertChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        metric: z.enum(["sessions", "volume_kg", "distance_km"]),
        target: z.number().positive().max(10_000_000),
        startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .refine((v) => v.endsOn >= v.startsOn, {
        message: "La date de fin doit suivre la date de début",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);
    const payload = {
      coach_id: context.userId,
      title: data.title,
      metric: data.metric,
      target: data.target,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? db.from<ChallengeRow>("challenges").update(payload).eq("id", data.id).select().single()
      : db.from<ChallengeRow>("challenges").insert(payload).select().single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    return row;
  });
