const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWeekId(weekId?: string | null) {
  return weekId && UUID_RE.test(weekId) ? weekId : undefined;
}

export function buildCoachMemberAdapterHref({
  memberId,
  week,
  weekId,
}: {
  memberId: string;
  week?: number | null;
  weekId?: string | null;
}) {
  const search = new URLSearchParams();
  if (typeof week === "number" && Number.isFinite(week)) {
    search.set("week", String(week));
  }

  const safeWeekId = normalizeWeekId(weekId);
  if (safeWeekId) {
    search.set("weekId", safeWeekId);
  }

  const query = search.toString();
  return `/coach/membre/${encodeURIComponent(memberId)}/adapter${query ? `?${query}` : ""}`;
}
