import { describe, expect, it } from "bun:test";

import {
  attachStravaActivityCardsToSessions,
  decodeStravaPolyline,
  normalizeStravaActivityCard,
} from "./strava-activity-card";

describe("normalizeStravaActivityCard", () => {
  it("builds display data from a stored Strava activity payload", () => {
    const card = normalizeStravaActivityCard({
      session_id: "session-1",
      strava_activity_id: 123456,
      name: "Footing nature",
      activity_type: "TrailRun",
      started_at: "2026-08-30T08:12:00Z",
      distance_m: 10420,
      moving_time_s: 3150,
      elevation_gain_m: 186,
      average_heartrate: 153,
      average_speed_mps: 3.31,
      raw_payload: {
        name: "Footing nature Strava",
        map: { summary_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
      },
    });

    expect(card).toMatchObject({
      activityId: 123456,
      title: "Footing nature Strava",
      sportType: "TrailRun",
      distanceKm: 10.42,
      durationSec: 3150,
      elevationM: 186,
      avgHr: 153,
      paceSecPerKm: 302,
      polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      stravaUrl: "https://www.strava.com/activities/123456",
    });
  });
});

describe("decodeStravaPolyline", () => {
  it("decodes an encoded Strava map polyline", () => {
    expect(decodeStravaPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });
});

describe("attachStravaActivityCardsToSessions", () => {
  it("adds the matching Strava card to each session without dropping sessions", () => {
    const sessions = [
      { id: "session-1", session_label: "Course 1" },
      { id: "session-2", session_label: "Course 2" },
    ];

    const enriched = attachStravaActivityCardsToSessions(sessions, [
      {
        session_id: "session-2",
        strava_activity_id: 456,
        name: "Deuxième course",
        distance_m: 5000,
      },
    ]);

    expect(enriched).toHaveLength(2);
    expect(enriched[0].strava).toBeNull();
    expect(enriched[1].strava?.title).toBe("Deuxième course");
  });
});
