import { describe, expect, it } from "bun:test";
import {
  COACH_MEMBER_APP_EVENTS_SELECT,
  formatMemberAppEventLabel,
  normalizeMemberAppEventRows,
  summarizeMemberAppEvents,
  type MemberAppEvent,
} from "./member-app-events";

describe("COACH_MEMBER_APP_EVENTS_SELECT", () => {
  it("uses the member_id profile relation explicitly for Supabase embeds", () => {
    expect(COACH_MEMBER_APP_EVENTS_SELECT).toContain(
      "member_profile:profiles!member_app_events_member_id_fkey",
    );
    expect(COACH_MEMBER_APP_EVENTS_SELECT).not.toContain("metadata, profiles(");
  });
});

describe("formatMemberAppEventLabel", () => {
  it("turns known event names into coach-friendly labels", () => {
    expect(formatMemberAppEventLabel("page_view", { path: "/membre/messages" })).toBe(
      "A ouvert Messages",
    );
    expect(formatMemberAppEventLabel("session_start", { sessionLabel: "Lower Body 1" })).toBe(
      "A démarré Lower Body 1",
    );
    expect(formatMemberAppEventLabel("strava_activity_matched", { activityName: "Sortie longue" }))
      .toBe("Strava rattaché : Sortie longue");
    expect(formatMemberAppEventLabel("session_force_completed", { sessionLabel: "Upper Push" }))
      .toBe("Léo a forcé la fin : Upper Push");
  });

  it("keeps a readable fallback for future events", () => {
    expect(formatMemberAppEventLabel("custom_debug_event", {})).toBe("custom debug event");
  });
});

describe("summarizeMemberAppEvents", () => {
  it("summarizes latest activity per member and keeps chronological events", () => {
    const events: MemberAppEvent[] = [
      {
        id: "evt-1",
        memberId: "member-a",
        memberName: "Teddy Morin",
        eventName: "page_view",
        eventAt: "2026-09-04T09:00:00.000Z",
        metadata: { path: "/membre" },
      },
      {
        id: "evt-2",
        memberId: "member-b",
        memberName: "Pierre Dupont",
        eventName: "session_finish",
        eventAt: "2026-09-04T09:05:00.000Z",
        metadata: { sessionLabel: "Upper 2" },
      },
      {
        id: "evt-3",
        memberId: "member-a",
        memberName: "Teddy Morin",
        eventName: "session_start",
        eventAt: "2026-09-04T09:10:00.000Z",
        metadata: { sessionLabel: "Séance 1" },
      },
    ];

    const summary = summarizeMemberAppEvents(events);

    expect(summary).toEqual([
      {
        memberId: "member-a",
        memberName: "Teddy Morin",
        latestEventAt: "2026-09-04T09:10:00.000Z",
        latestLabel: "A démarré Séance 1",
        eventCount: 2,
        events: [
          {
            id: "evt-3",
            eventAt: "2026-09-04T09:10:00.000Z",
            eventName: "session_start",
            label: "A démarré Séance 1",
          },
          {
            id: "evt-1",
            eventAt: "2026-09-04T09:00:00.000Z",
            eventName: "page_view",
            label: "A ouvert Accueil",
          },
        ],
      },
      {
        memberId: "member-b",
        memberName: "Pierre Dupont",
        latestEventAt: "2026-09-04T09:05:00.000Z",
        latestLabel: "A terminé Upper 2",
        eventCount: 1,
        events: [
          {
            id: "evt-2",
            eventAt: "2026-09-04T09:05:00.000Z",
            eventName: "session_finish",
            label: "A terminé Upper 2",
          },
        ],
      },
    ]);
  });
});

describe("normalizeMemberAppEventRows", () => {
  it("keeps member names readable even when profile fields are partial", () => {
    const rows = normalizeMemberAppEventRows([
      {
        id: "evt-1",
        member_id: "member-a",
        event_name: "page_view",
        created_at: "2026-09-04T09:00:00.000Z",
        metadata: { path: "/membre/planning" },
        profiles: { first_name: "Teddy", last_name: "Morin", email: "teddy@example.com" },
      },
      {
        id: "evt-2",
        member_id: "member-b",
        event_name: "page_view",
        created_at: "2026-09-04T09:03:00.000Z",
        metadata: {},
        profiles: { first_name: null, last_name: null, email: "pierre@example.com" },
      },
    ]);

    expect(rows).toEqual([
      {
        id: "evt-1",
        memberId: "member-a",
        memberName: "Teddy Morin",
        eventName: "page_view",
        eventAt: "2026-09-04T09:00:00.000Z",
        metadata: { path: "/membre/planning" },
      },
      {
        id: "evt-2",
        memberId: "member-b",
        memberName: "pierre@example.com",
        eventName: "page_view",
        eventAt: "2026-09-04T09:03:00.000Z",
        metadata: {},
      },
    ]);
  });

  it("accepts the explicit member_profile relation returned by the coach feed", () => {
    const rows = normalizeMemberAppEventRows([
      {
        id: "evt-1",
        member_id: "member-a",
        event_name: "page_view",
        created_at: "2026-09-04T09:00:00.000Z",
        metadata: { path: "/membre" },
        member_profile: { first_name: "Alex", last_name: "Durand", email: "alex@example.com" },
      },
    ]);

    expect(rows[0]?.memberName).toBe("Alex Durand");
  });
});
