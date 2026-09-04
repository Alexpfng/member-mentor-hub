export type MemberAppEvent = {
  id: string;
  memberId: string;
  memberName: string;
  eventName: string;
  eventAt: string;
  metadata?: Record<string, unknown> | null;
};

export type MemberAppEventSummary = {
  memberId: string;
  memberName: string;
  latestEventAt: string;
  latestLabel: string;
  eventCount: number;
  events: Array<{
    id: string;
    eventAt: string;
    eventName: string;
    label: string;
  }>;
};

type MemberAppEventRow = {
  id: string;
  member_id: string;
  event_name: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function memberName(profile: MemberAppEventRow["profiles"]): string {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return fullName || profile?.email || "Coaché";
}

export function normalizeMemberAppEventRows(rows: MemberAppEventRow[]): MemberAppEvent[] {
  return rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: memberName(row.profiles),
    eventName: row.event_name,
    eventAt: row.created_at,
    metadata: row.metadata ?? {},
  }));
}

function pageLabel(path: string | null): string {
  if (!path) return "Page membre";
  if (path === "/membre") return "Accueil";
  if (path.includes("/planning")) return "Planning";
  if (path.includes("/messages")) return "Messages";
  if (path.includes("/seance")) return "Séance";
  if (path.includes("/running")) return "Trail & Run";
  if (path.includes("/profil")) return "Réglages";
  if (path.includes("/programme")) return "Programme";
  if (path.includes("/carnet")) return "Carnet";
  if (path.includes("/progression")) return "Progrès";
  return path.replace(/^\/membre\/?/, "") || "Accueil";
}

export function formatMemberAppEventLabel(
  eventName: string,
  metadata: Record<string, unknown> | null | undefined = {},
): string {
  const sessionLabel = asText(metadata?.sessionLabel) ?? "la séance";
  const activityName = asText(metadata?.activityName) ?? "activité";

  switch (eventName) {
    case "page_view":
      return `A ouvert ${pageLabel(asText(metadata?.path))}`;
    case "session_open":
      return `A ouvert ${sessionLabel}`;
    case "session_start":
      return `A démarré ${sessionLabel}`;
    case "session_finish":
      return `A terminé ${sessionLabel}`;
    case "session_exit":
      return `A quitté ${sessionLabel}`;
    case "strava_manual_sync":
      return "A lancé la synchro Strava";
    case "strava_webhook_received":
      return "Webhook Strava reçu";
    case "strava_activity_matched":
      return `Strava rattaché : ${activityName}`;
    case "strava_activity_created":
      return `Strava ajouté : ${activityName}`;
    case "strava_activity_ignored":
      return `Strava ignoré : ${activityName}`;
    case "strava_activity_ambiguous":
      return `Strava à vérifier : ${activityName}`;
    case "strava_sync_failed":
      return "Erreur synchro Strava";
    case "pain_skip":
      return `Douleur signalée : ${sessionLabel}`;
    default:
      return eventName.replace(/_/g, " ");
  }
}

export function summarizeMemberAppEvents(events: MemberAppEvent[]): MemberAppEventSummary[] {
  const ordered = [...events].sort(
    (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
  );
  const byMember = new Map<string, MemberAppEventSummary>();

  for (const event of ordered) {
    const label = formatMemberAppEventLabel(event.eventName, event.metadata);
    const existing = byMember.get(event.memberId);
    if (!existing) {
      byMember.set(event.memberId, {
        memberId: event.memberId,
        memberName: event.memberName,
        latestEventAt: event.eventAt,
        latestLabel: label,
        eventCount: 1,
        events: [
          {
            id: event.id,
            eventAt: event.eventAt,
            eventName: event.eventName,
            label,
          },
        ],
      });
      continue;
    }

    existing.eventCount += 1;
    existing.events.push({
      id: event.id,
      eventAt: event.eventAt,
      eventName: event.eventName,
      label,
    });
  }

  return Array.from(byMember.values());
}
