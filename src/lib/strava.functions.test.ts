import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchRecentStravaActivities,
  isSupportedStravaActivity,
  mapStravaActivityToRunMetrics,
} from "./strava.functions";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("isSupportedStravaActivity", () => {
  it("accepts a Strava run", () => {
    expect(isSupportedStravaActivity({ sport_type: "Run", type: "Run" })).toBe(true);
  });

  it("accepts a trail run", () => {
    expect(isSupportedStravaActivity({ sport_type: "TrailRun", type: "Run" })).toBe(true);
  });

  it("rejects rides and unsupported activities", () => {
    expect(isSupportedStravaActivity({ sport_type: "Ride", type: "Ride" })).toBe(false);
    expect(isSupportedStravaActivity({ sport_type: "Workout", type: "Workout" })).toBe(false);
  });
});

describe("mapStravaActivityToRunMetrics", () => {
  it("maps raw Strava metrics into run_stats format", () => {
    const metrics = mapStravaActivityToRunMetrics({
      distance: 12800,
      moving_time: 3900,
      total_elevation_gain: 280,
      average_heartrate: 154,
      average_speed: 3.28,
    });

    expect(metrics).toEqual({
      distanceKm: 12.8,
      durationSec: 3900,
      elevationM: 280,
      avgHr: 154,
      paceSecPerKm: 305,
      rpe: null,
    });
  });

  it("keeps nullable values when Strava fields are missing", () => {
    const metrics = mapStravaActivityToRunMetrics({});

    expect(metrics).toEqual({
      distanceKm: null,
      durationSec: null,
      elevationM: null,
      avgHr: null,
      paceSecPerKm: null,
      rpe: null,
    });
  });
});

describe("fetchRecentStravaActivities", () => {
  it("requests the athlete activity feed with the requested date window", async () => {
    const fetchMock = mock(async () => Response.json([{ id: 123, sport_type: "Run" }]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const activities = await fetchRecentStravaActivities("token-123", {
      after: 1788048000,
      before: 1788652800,
      perPage: 12,
    });

    expect(activities).toEqual([{ id: 123, sport_type: "Run" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://www.strava.com/api/v3/athlete/activities?after=1788048000&before=1788652800&per_page=12&page=1",
    );
    expect(init).toEqual({ headers: { Authorization: "Bearer token-123" } });
  });
});
