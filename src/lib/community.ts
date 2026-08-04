/**
 * Communauté : jalons et défi du mois.
 *
 * Les jalons ne sont pas stockés — ils sont redérivés des séances, des records
 * et du tonnage. Conséquence utile : si une séance est corrigée ou supprimée,
 * le fil se corrige tout seul, sans table d'événements à réparer.
 */

export type MilestoneKind = "activity" | "sessions" | "streak" | "volume" | "record";

export type Milestone = {
  /** Clé stable de l'événement, support des cololikes. */
  key: string;
  memberId: string;
  memberName: string;
  kind: MilestoneKind;
  /** Phrase affichée telle quelle dans le fil. */
  label: string;
  /** Chiffres de la séance (durée, tonnage, course), affichés en second plan. */
  detail?: string;
  /** Démo YouTube de l'exercice, pour illustrer un record. */
  youtubeId?: string | null;
  date: string;
};

export type MemberActivity = {
  memberId: string;
  memberName: string;
  /** Séances terminées, triées par date croissante. */
  sessions: Array<{
    id?: string | null;
    date: string | null;
    volumeKg: number | null;
    label?: string | null;
    durationMin?: number | null;
    /** Chiffres de course quand la séance en porte. */
    run?: RunStats | null;
  }>;
  /** Records personnels, avec leur date et la démo du mouvement. */
  records: Array<{ exerciseName: string | null; date: string | null; youtubeId?: string | null }>;
};

export type RunStats = {
  distanceKm?: number | null;
  paceSecPerKm?: number | null;
  elevationM?: number | null;
};

const SESSION_TIERS = [1, 10, 25, 50, 100, 200];
const VOLUME_TIERS_KG = [10_000, 50_000, 100_000, 250_000, 500_000];

function frTons(kg: number) {
  return `${Math.round(kg / 1000)} tonnes`;
}

/** Durée lisible : « 45 min », « 1 h 35 ». */
function frDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Allure au format course : 5'42/km. */
function frPace(secPerKm: number) {
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}/km`;
}

/**
 * Chiffres d'une séance, omis quand ils ne sont pas renseignés.
 * Une sortie course parle en distance et en allure, pas en tonnage.
 */
function sessionDetail(
  durationMin?: number | null,
  volumeKg?: number | null,
  run?: RunStats | null,
) {
  const parts: string[] = [];
  if (run?.distanceKm != null && run.distanceKm > 0) {
    parts.push(`${run.distanceKm.toFixed(1).replace(".", ",")} km`);
  }
  if (durationMin != null && durationMin > 0) parts.push(frDuration(Math.round(durationMin)));
  if (run?.paceSecPerKm != null && run.paceSecPerKm > 0) parts.push(frPace(run.paceSecPerKm));
  if (run?.elevationM != null && run.elevationM > 0) {
    parts.push(`${Math.round(run.elevationM)} m D+`);
  }
  if (volumeKg != null && volumeKg > 0) {
    parts.push(
      volumeKg >= 1000
        ? `${(volumeKg / 1000).toFixed(1).replace(".", ",")} t soulevées`
        : `${Math.round(volumeKg)} kg soulevés`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Jalons franchis par un membre, avec la date à laquelle ils l'ont été.
 * On date le jalon à la séance qui l'a fait basculer : c'est ce qui permet
 * d'ordonner un fil, contrairement à un compteur courant.
 */
export function buildMilestones(activity: MemberActivity): Milestone[] {
  const out: Milestone[] = [];
  const sessions = activity.sessions
    .filter((session) => !!session.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let cumulativeVolume = 0;
  let remainingVolumeTiers = [...VOLUME_TIERS_KG];

  sessions.forEach((session, index) => {
    const date = String(session.date);
    const count = index + 1;

    // Chaque séance terminée alimente le fil : les jalons seuls sont trop
    // rares pour qu'une petite communauté ait quelque chose à lire.
    out.push({
      key: session.id ? `activity:${session.id}` : `activity:${activity.memberId}:${date}:${index}`,
      memberId: activity.memberId,
      memberName: activity.memberName,
      kind: "activity",
      label: session.label ? `a fait ${session.label}` : "a fait une séance",
      detail: sessionDetail(session.durationMin, session.volumeKg, session.run),
      date,
    });

    if (SESSION_TIERS.includes(count)) {
      out.push({
        key: `tier:${activity.memberId}:${count}`,
        memberId: activity.memberId,
        memberName: activity.memberName,
        kind: "sessions",
        label: count === 1 ? "a fait sa toute première séance" : `a franchi les ${count} séances`,
        date,
      });
    }

    cumulativeVolume += Number(session.volumeKg ?? 0);
    while (remainingVolumeTiers.length > 0 && cumulativeVolume >= remainingVolumeTiers[0]) {
      const tier = remainingVolumeTiers[0];
      remainingVolumeTiers = remainingVolumeTiers.slice(1);
      out.push({
        key: `volume:${activity.memberId}:${tier}`,
        memberId: activity.memberId,
        memberName: activity.memberName,
        kind: "volume",
        label: `a soulevé ${frTons(tier)} au total`,
        date,
      });
    }
  });

  // Un même record peut être enregistré plusieurs fois le même jour (séries
  // successives) : le fil affichait alors deux ou trois lignes identiques.
  const seenRecords = new Set<string>();
  for (const record of activity.records) {
    if (!record.date) continue;
    const recordKey = `record:${activity.memberId}:${record.date}:${(record.exerciseName ?? "")
      .trim()
      .toLowerCase()}`;
    if (seenRecords.has(recordKey)) continue;
    seenRecords.add(recordKey);
    out.push({
      key: recordKey,
      memberId: activity.memberId,
      memberName: activity.memberName,
      kind: "record",
      label: record.exerciseName
        ? `a battu son record sur ${record.exerciseName}`
        : "a battu un record personnel",
      youtubeId: record.youtubeId ?? null,
      date: record.date,
    });
  }

  return out;
}

/** Fil trié du plus récent au plus ancien, limité à une fenêtre récente. */
export function buildFeed(
  activities: MemberActivity[],
  { since, limit = 20 }: { since?: string; limit?: number } = {},
): Milestone[] {
  return activities
    .flatMap(buildMilestones)
    .filter((milestone) => (since ? milestone.date >= since : true))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Number(a.kind === "activity") - Number(b.kind === "activity"),
    )
    .slice(0, limit);
}

export type ChallengeMetric = "sessions" | "volume_kg" | "distance_km";

export const METRIC_LABEL: Record<ChallengeMetric, string> = {
  sessions: "séances",
  volume_kg: "kg soulevés",
  distance_km: "km parcourus",
};

export type ChallengeContribution = { memberId: string; memberName: string; value: number };

export type ChallengeProgress = {
  total: number;
  target: number;
  /** Avancement collectif, borné à 100 pour la jauge. */
  percent: number;
  participants: number;
  contributions: ChallengeContribution[];
  /** Contribution du membre qui regarde, s'il participe. */
  mine: number | null;
  done: boolean;
};

export function buildChallengeProgress(
  contributions: ChallengeContribution[],
  target: number,
  viewerId?: string | null,
): ChallengeProgress {
  const total = contributions.reduce((sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0), 0);
  const mine = contributions.find((c) => c.memberId === viewerId)?.value ?? null;
  return {
    total: Math.round(total),
    target,
    percent: target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0,
    participants: contributions.length,
    // Classement décroissant : il n'est affiché que si le coach l'active.
    contributions: [...contributions].sort((a, b) => b.value - a.value),
    mine: mine != null ? Math.round(mine) : null,
    done: target > 0 && total >= target,
  };
}

/** Jours restants, la journée en cours comptant pour un jour entier. */
export function daysLeft(endsOn: string, today: string): number {
  const end = new Date(`${endsOn}T00:00:00Z`).getTime();
  const now = new Date(`${today.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - now) / 86_400_000));
}
