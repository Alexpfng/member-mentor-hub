import { describe, expect, it } from "bun:test";

import { buildBadges, summarizeBadges, type BadgeStats } from "./badges";

function stats(patch: Partial<BadgeStats> = {}): BadgeStats {
  return {
    sessionsDone: 0,
    streakWeeks: 0,
    totalVolumeKg: 0,
    personalRecords: 0,
    fullyRatedSessions: 0,
    ...patch,
  };
}

describe("buildBadges", () => {
  it("ne décroche rien pour un membre qui débute", () => {
    expect(buildBadges(stats()).every((badge) => !badge.earned)).toBe(true);
  });

  it("décroche tous les paliers atteints, pas seulement le dernier", () => {
    const badges = buildBadges(stats({ sessionsDone: 26 }));
    const assiduite = badges.filter((b) => b.family === "assiduite" && b.earned);
    expect(assiduite.map((b) => b.threshold)).toEqual([1, 10, 25]);
  });

  it("calcule un avancement borné à 100", () => {
    const badges = buildBadges(stats({ sessionsDone: 5 }));
    expect(badges.find((b) => b.id === "assiduite-10")?.progress).toBe(50);
    expect(badges.find((b) => b.id === "assiduite-1")?.progress).toBe(100);
  });

  it("compte le tonnage en kilos", () => {
    const badges = buildBadges(stats({ totalVolumeKg: 12_500 }));
    expect(badges.find((b) => b.id === "volume-10000")?.earned).toBe(true);
    expect(badges.find((b) => b.id === "volume-50000")?.earned).toBe(false);
  });

  it("récompense les séances entièrement notées", () => {
    const badges = buildBadges(stats({ fullyRatedSessions: 5 }));
    expect(badges.find((b) => b.id === "retours-5")?.earned).toBe(true);
  });

  it("encaisse des valeurs absurdes sans casser", () => {
    const badges = buildBadges(stats({ sessionsDone: -3 }));
    expect(badges.find((b) => b.id === "assiduite-1")?.progress).toBe(0);
    expect(badges.find((b) => b.id === "assiduite-1")?.earned).toBe(false);
  });
});

describe("summarizeBadges", () => {
  it("propose le prochain palier de chaque famille", () => {
    const summary = summarizeBadges(stats({ sessionsDone: 12, streakWeeks: 2 }));
    expect(summary.next.find((b) => b.family === "assiduite")?.threshold).toBe(25);
    expect(summary.next.find((b) => b.family === "regularite")?.threshold).toBe(4);
    expect(summary.next).toHaveLength(5);
  });

  it("compte les trophées décrochés", () => {
    const summary = summarizeBadges(stats({ sessionsDone: 12 }));
    expect(summary.earnedCount).toBe(2);
    expect(summary.totalCount).toBeGreaterThan(summary.earnedCount);
  });

  it("ne propose plus de palier dans une famille terminée", () => {
    const summary = summarizeBadges(stats({ personalRecords: 999 }));
    expect(summary.next.find((b) => b.family === "records")).toBeUndefined();
  });
});
