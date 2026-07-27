import { describe, expect, it } from "bun:test";
import { isSupportedStravaActivity, mapStravaActivityToRunMetrics } from "./strava.functions";

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
