import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { RunMetrics } from "@/lib/run-stats";
import { upsertRunStats } from "@/lib/run.functions";
import { mergeAssignmentWeeks } from "@/lib/program-weeks";
import { matchStravaActivityToSession, type StravaSessionCandidate } from "./strava-match";

type StravaActivityLike = {
  id?: number | null;
  type?: string | null;
  sport_type?: string | null;
  name?: string | null;
  start_date?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  average_speed?: number | null;
  start_date_local?: string | null;
};

const STRAVA_SUPPORTED_SPORTS = new Set(["Run", "TrailRun"]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function baseUrl(): string {
  const appUrl =
    process.env.APP_URL ??
    process.env.VITE_APP_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.URL;
  if (!appUrl) throw new Error("APP_URL manquant pour construire le callback Strava");
  return appUrl.replace(/\/+$/, "");
}

function stateSecret(): string {
  return requireEnv("STRAVA_STATE_SECRET");
}

function stravaClientId(): string {
  return requireEnv("STRAVA_CLIENT_ID");
}

function stravaClientSecret(): string {
  return requireEnv("STRAVA_CLIENT_SECRET");
}

function oauthRedirectUri(): string {
  return `${baseUrl()}/api/strava/callback`;
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function activityDateISO(activity: StravaActivityLike): string | null {
  const raw = activity.start_date_local ?? activity.start_date ?? null;
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function isSupportedStravaActivity(activity: Pick<StravaActivityLike, "sport_type" | "type">): boolean {
  const sport = activity.sport_type ?? activity.type ?? "";
  return STRAVA_SUPPORTED_SPORTS.has(sport);
}

export function mapStravaActivityToRunMetrics(activity: StravaActivityLike): RunMetrics {
  const distanceKm =
    activity.distance != null ? Math.round((Number(activity.distance) / 1000) * 100) / 100 : null;
  const durationSec = activity.moving_time != null ? Number(activity.moving_time) : null;
  const elevationM =
    activity.total_elevation_gain != null ? Math.round(Number(activity.total_elevation_gain)) : null;
  const avgHr =
    activity.average_heartrate != null ? Math.round(Number(activity.average_heartrate)) : null;

  let paceSecPerKm: number | null = null;
  if (activity.average_speed != null && Number(activity.average_speed) > 0) {
    paceSecPerKm = Math.round(1000 / Number(activity.average_speed));
  } else if (distanceKm && durationSec) {
    paceSecPerKm = Math.round(durationSec / distanceKm);
  }

  return {
    distanceKm,
    durationSec,
    elevationM,
    avgHr,
    paceSecPerKm,
    rpe: null,
  };
}

function signState(memberId: string, issuedAtMs: number): string {
  const payload = `${memberId}.${issuedAtMs}`;
  const signature = Bun.CryptoHasher.hash("sha256", `${payload}.${stateSecret()}`, "hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyStateToken(token: string, maxAgeMs = 1000 * 60 * 15): { memberId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [memberId, issuedAtStr, signature] = decoded.split(".");
    if (!memberId || !issuedAtStr || !signature) return null;
    const issuedAtMs = Number(issuedAtStr);
    if (!Number.isFinite(issuedAtMs)) return null;
    if (Date.now() - issuedAtMs > maxAgeMs) return null;
    const expected = Bun.CryptoHasher.hash(
      "sha256",
      `${memberId}.${issuedAtMs}.${stateSecret()}`,
      "hex",
    );
    if (expected !== signature) return null;
    return { memberId };
  } catch {
    return null;
  }
}

export async function exchangeStravaCode(code: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: stravaClientId(),
      client_secret: stravaClientSecret(),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Échange OAuth Strava impossible");
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: { id: number };
    scope?: string;
  };
}

export async function refreshStravaToken(refreshToken: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: stravaClientId(),
      client_secret: stravaClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Refresh token Strava impossible");
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete?: { id: number };
    scope?: string;
  };
}

export async function fetchStravaActivity(accessToken: string, activityId: number) {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Lecture activité Strava impossible");
  return (await res.json()) as StravaActivityLike;
}

async function upsertMemberStravaConnection(input: {
  memberId: string;
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}) {
  const { error } = await supabaseAdmin.from("member_strava_connections").upsert(
    {
      member_id: input.memberId,
      strava_athlete_id: input.athleteId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_at: new Date(input.expiresAt * 1000).toISOString(),
      scope: input.scope,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "member_id" },
  );
  if (error) throw new Error(error.message);
}

async function getFreshConnectionByAthleteId(athleteId: number) {
  const { data, error } = await supabaseAdmin
    .from("member_strava_connections")
    .select("*")
    .eq("strava_athlete_id", athleteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const expiresAtMs = new Date(data.expires_at).getTime();
  if (expiresAtMs > Date.now() + 60_000) return data;

  const refreshed = await refreshStravaToken(data.refresh_token);
  await upsertMemberStravaConnection({
    memberId: data.member_id,
    athleteId: data.strava_athlete_id,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at,
    scope: (refreshed.scope ?? "").split(",").filter(Boolean),
  });

  return {
    ...data,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
  };
}

async function collectSessionCandidates(memberId: string, activityDate: string) {
  const [{ data: sessions }, { data: planned }, { data: runStats }] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, date, status, session_label, session_type, program_id, week_number, day_number")
      .eq("member_id", memberId)
      .eq("date", activityDate),
    supabaseAdmin
      .from("planned_sessions")
      .select("id, program_id, week_number, day_label, planned_date, session_id, status")
      .eq("member_id", memberId)
      .eq("planned_date", activityDate),
    supabaseAdmin
      .from("run_stats")
      .select("session_id")
      .eq("member_id", memberId),
  ]);

  const runStatIds = new Set((runStats ?? []).map((row) => row.session_id));
  const realSessionIds = new Set((sessions ?? []).map((row) => row.id));

  const candidates: Array<
    StravaSessionCandidate & {
      kind: "session" | "planned";
      plannedId?: string;
      programId?: string | null;
      weekNumber?: number | null;
      dayLabel?: string | null;
      dayNumber?: number | null;
    }
  > = [];

  for (const session of sessions ?? []) {
    candidates.push({
      kind: "session",
      id: session.id,
      date: session.date,
      status: session.status,
      sessionType: session.session_type ?? "program",
      sessionLabel: session.session_label,
      hasRunStats: runStatIds.has(session.id),
      programId: session.program_id,
      weekNumber: session.week_number,
      dayNumber: session.day_number,
    });
  }

  for (const row of planned ?? []) {
    if (row.session_id && realSessionIds.has(row.session_id)) continue;
    candidates.push({
      kind: "planned",
      id: `planned:${row.id}`,
      plannedId: row.id,
      date: row.planned_date,
      status: row.status ?? "planned",
      sessionType: "program",
      sessionLabel: row.day_label,
      hasRunStats: false,
      programId: row.program_id,
      weekNumber: row.week_number,
      dayLabel: row.day_label,
    });
  }

  return candidates;
}

async function resolveDayNumberFromProgram(input: {
  memberId: string;
  programId: string | null | undefined;
  weekNumber: number | null | undefined;
  dayLabel: string | null | undefined;
}) {
  if (!input.programId || !input.weekNumber || !input.dayLabel) return null;
  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select("id, program_id, programs(structure)")
    .eq("member_id", input.memberId)
    .eq("program_id", input.programId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assignment) return null;

  const { data: adaptedWeeks } = await supabaseAdmin
    .from("assignment_weeks")
    .select("week_number, structure")
    .eq("assignment_id", assignment.id)
    .in("status", ["published", "in_progress", "done"]);

  const weeks = mergeAssignmentWeeks((assignment as any)?.programs?.structure, adaptedWeeks ?? []);
  const days = weeks[Math.max(0, input.weekNumber - 1)]?.days ?? [];
  const target = normalizeLabel(input.dayLabel);
  const idx = days.findIndex((day) => normalizeLabel(day?.label) === target);
  return idx >= 0 ? idx + 1 : null;
}

async function createCompletedSessionFromPlanned(input: {
  memberId: string;
  activity: StravaActivityLike;
  candidate: {
    plannedId?: string;
    programId?: string | null;
    weekNumber?: number | null;
    dayLabel?: string | null;
  };
  metrics: RunMetrics;
}) {
  const date = activityDateISO(input.activity);
  if (!date) throw new Error("Date activité Strava introuvable");
  const dayNumber = await resolveDayNumberFromProgram({
    memberId: input.memberId,
    programId: input.candidate.programId,
    weekNumber: input.candidate.weekNumber,
    dayLabel: input.candidate.dayLabel,
  });
  const durationMin =
    input.metrics.durationSec != null ? Math.round(input.metrics.durationSec / 60) : null;

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      member_id: input.memberId,
      program_id: input.candidate.programId ?? null,
      date,
      started_at: input.activity.start_date ?? new Date(`${date}T12:00:00.000Z`).toISOString(),
      ended_at:
        input.activity.start_date && input.metrics.durationSec != null
          ? new Date(new Date(input.activity.start_date).getTime() + input.metrics.durationSec * 1000).toISOString()
          : new Date().toISOString(),
      status: "completed",
      session_label: input.candidate.dayLabel ?? input.activity.name ?? "Séance course",
      week_number: input.candidate.weekNumber ?? null,
      day_number: dayNumber,
      duration_minutes: durationMin,
      average_rpe: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function linkPlannedSessionToCompletedSession(plannedId: string, sessionId: string) {
  const { error } = await supabaseAdmin
    .from("planned_sessions")
    .update({
      session_id: sessionId,
      status: "done",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", plannedId);

  if (error) throw new Error(error.message);
}

async function upsertStravaActivityRecord(input: {
  memberId: string;
  activity: StravaActivityLike & { id: number };
  sessionId: string | null;
  syncStatus: "imported" | "matched" | "ambiguous" | "ignored";
  syncError?: string | null;
}) {
  const { error } = await supabaseAdmin.from("member_strava_activities").upsert(
    {
      member_id: input.memberId,
      strava_activity_id: input.activity.id,
      session_id: input.sessionId,
      activity_type: input.activity.sport_type ?? input.activity.type ?? "unknown",
      name: input.activity.name ?? null,
      started_at: input.activity.start_date ?? new Date().toISOString(),
      distance_m: input.activity.distance ?? null,
      moving_time_s: input.activity.moving_time ?? null,
      elapsed_time_s: input.activity.elapsed_time ?? null,
      elevation_gain_m: input.activity.total_elevation_gain ?? null,
      average_heartrate: input.activity.average_heartrate ?? null,
      average_speed_mps: input.activity.average_speed ?? null,
      raw_payload: input.activity as never,
      sync_status: input.syncStatus,
      sync_error: input.syncError ?? null,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "strava_activity_id" },
  );
  if (error) throw new Error(error.message);
}

async function markConnectionWebhook(memberId: string) {
  await supabaseAdmin
    .from("member_strava_connections")
    .update({
      last_webhook_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("member_id", memberId);
}

export async function syncStravaActivityForAthlete(athleteId: number, activityId: number) {
  const connection = await getFreshConnectionByAthleteId(athleteId);
  if (!connection) return { ok: false, reason: "connection_not_found" as const };

  const activity = await fetchStravaActivity(connection.access_token, activityId);
  if (!activity || !activity.id) return { ok: false, reason: "activity_not_found" as const };
  if (!isSupportedStravaActivity(activity)) {
    await upsertStravaActivityRecord({
      memberId: connection.member_id,
      activity: activity as StravaActivityLike & { id: number },
      sessionId: null,
      syncStatus: "ignored",
      syncError: "unsupported_activity_type",
    });
    return { ok: false, reason: "unsupported_activity_type" as const };
  }

  const date = activityDateISO(activity);
  if (!date) {
    await upsertStravaActivityRecord({
      memberId: connection.member_id,
      activity: activity as StravaActivityLike & { id: number },
      sessionId: null,
      syncStatus: "ignored",
      syncError: "missing_activity_date",
    });
    return { ok: false, reason: "missing_activity_date" as const };
  }

  const candidates = await collectSessionCandidates(connection.member_id, date);
  const match = matchStravaActivityToSession({
    activityStartedAt: activity.start_date_local ?? activity.start_date ?? `${date}T12:00:00.000Z`,
    sessions: candidates,
  });

  const metrics = mapStravaActivityToRunMetrics(activity);
  let sessionId: string | null = null;

  if (match.status === "matched") {
    const matchedCandidate = candidates.find((candidate) => candidate.id === match.sessionId) ?? null;
    if (matchedCandidate?.kind === "planned") {
      sessionId = await createCompletedSessionFromPlanned({
        memberId: connection.member_id,
        activity,
        candidate: matchedCandidate,
        metrics,
      });
      if (matchedCandidate.plannedId) {
        await linkPlannedSessionToCompletedSession(matchedCandidate.plannedId, sessionId);
      }
    } else {
      sessionId = match.sessionId;
    }
    await upsertRunStats({
      sessionId,
      memberId: connection.member_id,
      metrics,
      source: "strava",
      rawExtraction: activity,
    });
  }

  await upsertStravaActivityRecord({
    memberId: connection.member_id,
    activity: activity as StravaActivityLike & { id: number },
    sessionId,
    syncStatus: match.status === "matched" ? "matched" : match.status === "ambiguous" ? "ambiguous" : "imported",
    syncError: match.status === "ambiguous" ? match.reason : null,
  });
  await markConnectionWebhook(connection.member_id);

  return { ok: true, match, sessionId };
}

export const getStravaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("member_strava_connections")
      .select("strava_athlete_id, expires_at, scope, last_sync_at, last_webhook_at")
      .eq("member_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: Boolean(data),
      athleteId: data?.strava_athlete_id ?? null,
      expiresAt: data?.expires_at ?? null,
      scope: data?.scope ?? [],
      lastSyncAt: data?.last_sync_at ?? null,
      lastWebhookAt: data?.last_webhook_at ?? null,
    };
  });

export const getStravaConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = signState(context.userId, Date.now());
    const url = new URL("https://www.strava.com/oauth/authorize");
    url.searchParams.set("client_id", stravaClientId());
    url.searchParams.set("redirect_uri", oauthRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", "read,activity:read_all");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

export const disconnectStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("member_strava_connections")
      .delete()
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export async function storeStravaOAuthConnection(input: {
  memberId: string;
  code: string;
}) {
  const token = await exchangeStravaCode(input.code);
  await upsertMemberStravaConnection({
    memberId: input.memberId,
    athleteId: token.athlete.id,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at,
    scope: (token.scope ?? "").split(",").filter(Boolean),
  });
  return token;
}
