import { describe, expect, it } from "bun:test";

import {
  buildChallengeProgress,
  buildFeed,
  buildMilestones,
  daysLeft,
  type MemberActivity,
  type Milestone,
} from "./community";

function activity(patch: Partial<MemberActivity> = {}): MemberActivity {
  return {
    memberId: "m1",
    memberName: "Teddy",
    sessions: [],
    records: [],
    ...patch,
  };
}

function sessions(count: number, from = "2026-01-01", volumeKg = 0) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), volumeKg };
  });
}

const milestonesOnly = (list: Milestone[]) => list.filter((m) => m.kind !== "activity");

describe("buildMilestones", () => {
  it("ne produit rien sans séance ni record", () => {
    expect(buildMilestones(activity())).toEqual([]);
  });

  it("publie chaque séance terminée, avec ses chiffres", () => {
    const milestones = buildMilestones(
      activity({
        sessions: [
          { date: "2026-01-05", volumeKg: 3_200, label: "Upper 1 focus pull", durationMin: 95 },
        ],
      }),
    );
    const feedEntry = milestones.find((m) => m.kind === "activity");
    expect(feedEntry?.label).toBe("a fait Upper 1 focus pull");
    expect(feedEntry?.detail).toBe("1 h 35 · 3,2 t soulevées");
  });

  it("reste lisible quand la séance n'a ni titre ni chiffres", () => {
    const milestones = buildMilestones(
      activity({ sessions: [{ date: "2026-01-05", volumeKg: null }] }),
    );
    const feedEntry = milestones.find((m) => m.kind === "activity");
    expect(feedEntry?.label).toBe("a fait une séance");
    expect(feedEntry?.detail).toBeUndefined();
  });

  it("affiche les petits tonnages en kilos", () => {
    const milestones = buildMilestones(
      activity({ sessions: [{ date: "2026-01-05", volumeKg: 420, durationMin: 45 }] }),
    );
    expect(milestones.find((m) => m.kind === "activity")?.detail).toBe("45 min · 420 kg soulevés");
  });

  it("date le jalon à la séance qui l'a déclenché", () => {
    const milestones = buildMilestones(activity({ sessions: sessions(10) }));
    const tenth = milestones.find((m) => m.label.includes("10 séances"));
    expect(tenth?.date).toBe("2026-01-10");
  });

  it("célèbre la première séance", () => {
    const milestones = buildMilestones(activity({ sessions: sessions(1) }));
    expect(milestonesOnly(milestones)[0].label).toBe("a fait sa toute première séance");
  });

  it("ne déclenche un palier de tonnage qu'une fois", () => {
    const milestones = buildMilestones(
      activity({ sessions: sessions(5, "2026-01-01", 4_000) }), // 20 t cumulées
    );
    const volume = milestones.filter((m) => m.kind === "volume");
    expect(volume).toHaveLength(1);
    expect(volume[0].label).toBe("a soulevé 10 tonnes au total");
  });

  it("franchit plusieurs paliers de tonnage d'un coup si la séance est énorme", () => {
    const milestones = buildMilestones(
      activity({ sessions: [{ date: "2026-02-01", volumeKg: 60_000 }] }),
    );
    expect(milestones.filter((m) => m.kind === "volume").map((m) => m.label)).toEqual([
      "a soulevé 10 tonnes au total",
      "a soulevé 50 tonnes au total",
    ]);
  });

  it("reprend le nom de l'exercice sur un record", () => {
    const milestones = buildMilestones(
      activity({ records: [{ exerciseName: "Back squat", date: "2026-03-02" }] }),
    );
    expect(milestonesOnly(milestones)[0].label).toBe("a battu son record sur Back squat");
  });

  it("ignore un record sans date, qu'on ne saurait pas placer dans le fil", () => {
    expect(buildMilestones(activity({ records: [{ exerciseName: "Squat", date: null }] }))).toEqual(
      [],
    );
  });

  it("ne répète pas un record enregistré plusieurs fois le même jour", () => {
    // Vu en production : trois lignes « a battu son record sur Pistol squat »
    // le même jour, une par série validée.
    const milestones = buildMilestones(
      activity({
        records: [
          { exerciseName: "Pistol squat", date: "2026-07-29" },
          { exerciseName: "Pistol squat", date: "2026-07-29" },
          { exerciseName: "Pistol squat", date: "2026-08-02" },
        ],
      }),
    );
    expect(milestones.filter((m) => m.kind === "record")).toHaveLength(2);
  });

  it("donne à chaque entrée une clé stable, support des cololikes", () => {
    const milestones = buildMilestones(
      activity({ sessions: [{ id: "sess-1", date: "2026-01-05", volumeKg: 100 }] }),
    );
    expect(milestones.find((m) => m.kind === "activity")?.key).toBe("activity:sess-1");
    expect(milestones.find((m) => m.kind === "sessions")?.key).toBe("tier:m1:1");
  });

  it("ne mélange pas les clés de deux membres", () => {
    const mine = buildMilestones(
      activity({ records: [{ exerciseName: "Squat", date: "2026-01-05" }] }),
    )[0];
    const other = buildMilestones(
      activity({ memberId: "m2", records: [{ exerciseName: "Squat", date: "2026-01-05" }] }),
    )[0];
    expect(mine.key).not.toBe(other.key);
  });

  it("met le jalon avant la séance ordinaire du même jour", () => {
    const feed = buildFeed([activity({ sessions: sessions(1, "2026-01-01") })]);
    expect(feed[0].kind).toBe("sessions");
    expect(feed[1].kind).toBe("activity");
  });
});

describe("buildFeed", () => {
  const teddy = activity({ sessions: sessions(1, "2026-01-01") });
  const gaetan = activity({
    memberId: "m2",
    memberName: "Gaétan",
    sessions: sessions(1, "2026-06-01"),
  });

  it("trie du plus récent au plus ancien", () => {
    const feed = buildFeed([teddy, gaetan]);
    expect(feed[0].memberName).toBe("Gaétan");
  });

  it("respecte la fenêtre demandée", () => {
    // Une séance + son jalon « première séance » pour le seul Gaétan.
    expect(buildFeed([teddy, gaetan], { since: "2026-05-01" })).toHaveLength(2);
  });

  it("respecte la limite", () => {
    const bavard = activity({ sessions: sessions(60, "2026-01-01", 20_000) });
    expect(buildFeed([bavard], { limit: 3 })).toHaveLength(3);
  });
});

describe("buildChallengeProgress", () => {
  const contributions = [
    { memberId: "m1", memberName: "Teddy", value: 12 },
    { memberId: "m2", memberName: "Gaétan", value: 8 },
  ];

  it("additionne les contributions et calcule la jauge", () => {
    const progress = buildChallengeProgress(contributions, 40, "m1");
    expect(progress.total).toBe(20);
    expect(progress.percent).toBe(50);
    expect(progress.participants).toBe(2);
    expect(progress.mine).toBe(12);
    expect(progress.done).toBe(false);
  });

  it("classe les contributions par ordre décroissant", () => {
    expect(buildChallengeProgress(contributions, 40).contributions[0].memberName).toBe("Teddy");
  });

  it("borne la jauge à 100 et marque le défi réussi", () => {
    const progress = buildChallengeProgress(contributions, 10);
    expect(progress.percent).toBe(100);
    expect(progress.done).toBe(true);
  });

  it("renvoie une contribution nulle pour qui ne participe pas", () => {
    expect(buildChallengeProgress(contributions, 40, "inconnu").mine).toBeNull();
  });

  it("encaisse un défi sans participant", () => {
    const progress = buildChallengeProgress([], 100);
    expect(progress.total).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.done).toBe(false);
  });
});

describe("daysLeft", () => {
  it("compte les jours restants", () => {
    expect(daysLeft("2026-08-31", "2026-08-04")).toBe(27);
  });

  it("ne descend jamais sous zéro", () => {
    expect(daysLeft("2026-08-01", "2026-08-04")).toBe(0);
  });

  it("accepte un horodatage complet pour aujourd'hui", () => {
    expect(daysLeft("2026-08-06", "2026-08-04T18:00:00.000Z")).toBe(2);
  });
});
