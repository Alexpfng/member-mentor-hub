export type StravaActivityCardData = {
  activityId: number | null;
  title: string;
  sportType: string | null;
  startedAt: string | null;
  distanceKm: number | null;
  durationSec: number | null;
  elapsedSec: number | null;
  elevationM: number | null;
  avgHr: number | null;
  paceSecPerKm: number | null;
  polyline: string | null;
  stravaUrl: string | null;
};

export type StravaActivityRecordLike = {
  session_id?: string | null;
  strava_activity_id?: number | string | null;
  activity_type?: string | null;
  name?: string | null;
  started_at?: string | null;
  distance_m?: number | string | null;
  moving_time_s?: number | string | null;
  elapsed_time_s?: number | string | null;
  elevation_gain_m?: number | string | null;
  average_heartrate?: number | string | null;
  average_speed_mps?: number | string | null;
  raw_payload?: unknown;
};

export type LatLng = { lat: number; lng: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fromRaw(raw: unknown, key: string): unknown {
  return isRecord(raw) ? raw[key] : undefined;
}

function polylineFromRaw(raw: unknown): string | null {
  const map = fromRaw(raw, "map");
  if (!isRecord(map)) return null;
  return toStringOrNull(map.summary_polyline) ?? toStringOrNull(map.polyline);
}

export function normalizeStravaActivityCard(
  activity: StravaActivityRecordLike | null | undefined,
): StravaActivityCardData | null {
  if (!activity) return null;
  const raw = activity.raw_payload;
  const activityId = toNumber(activity.strava_activity_id ?? fromRaw(raw, "id"));
  const distanceM = toNumber(activity.distance_m ?? fromRaw(raw, "distance"));
  const durationSec = toNumber(activity.moving_time_s ?? fromRaw(raw, "moving_time"));
  const elapsedSec = toNumber(activity.elapsed_time_s ?? fromRaw(raw, "elapsed_time"));
  const elevationM = toNumber(activity.elevation_gain_m ?? fromRaw(raw, "total_elevation_gain"));
  const avgHr = toNumber(activity.average_heartrate ?? fromRaw(raw, "average_heartrate"));
  const averageSpeedMps = toNumber(activity.average_speed_mps ?? fromRaw(raw, "average_speed"));
  const distanceKm = distanceM != null ? round2(distanceM / 1000) : null;
  const paceSecPerKm =
    averageSpeedMps != null && averageSpeedMps > 0
      ? Math.round(1000 / averageSpeedMps)
      : distanceKm && durationSec
        ? Math.round(durationSec / distanceKm)
        : null;

  return {
    activityId,
    title: toStringOrNull(fromRaw(raw, "name")) ?? activity.name ?? "Course Strava",
    sportType:
      toStringOrNull(fromRaw(raw, "sport_type")) ??
      toStringOrNull(fromRaw(raw, "type")) ??
      activity.activity_type ??
      null,
    startedAt: toStringOrNull(fromRaw(raw, "start_date")) ?? activity.started_at ?? null,
    distanceKm,
    durationSec: durationSec != null ? Math.round(durationSec) : null,
    elapsedSec: elapsedSec != null ? Math.round(elapsedSec) : null,
    elevationM: elevationM != null ? Math.round(elevationM) : null,
    avgHr: avgHr != null ? Math.round(avgHr) : null,
    paceSecPerKm,
    polyline: polylineFromRaw(raw),
    stravaUrl: activityId != null ? `https://www.strava.com/activities/${activityId}` : null,
  };
}

export function attachStravaActivityCardsToSessions<T extends { id?: string | null }>(
  sessions: T[],
  activities: StravaActivityRecordLike[] | null | undefined,
): Array<T & { strava: StravaActivityCardData | null }> {
  const bySessionId = new Map<string, StravaActivityCardData>();

  for (const activity of activities ?? []) {
    if (!activity.session_id) continue;
    const card = normalizeStravaActivityCard(activity);
    if (card) bySessionId.set(activity.session_id, card);
  }

  return sessions.map((session) => ({
    ...session,
    strava: session.id ? (bySessionId.get(session.id) ?? null) : null,
  }));
}

export function decodeStravaPolyline(encoded: string | null | undefined): LatLng[] {
  if (!encoded) return [];
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({
      lat: Math.round((lat / 1e5) * 1e5) / 1e5,
      lng: Math.round((lng / 1e5) * 1e5) / 1e5,
    });
  }

  return points;
}
