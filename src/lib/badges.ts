/**
 * Trophées du membre.
 *
 * Tout est calculé à la volée depuis ce qui existe déjà (séances, séries,
 * records, streak) : aucune table à créer, donc rien à migrer en production, et
 * pas d'état à resynchroniser si une séance est corrigée après coup.
 *
 * Règle de conception : on ne compare JAMAIS deux membres. Un client qui paie
 * un coaching se mesure à lui-même — un classement entre clients démotive ceux
 * qui en ont le plus besoin.
 */

export type BadgeFamily = "assiduite" | "regularite" | "volume" | "records" | "retours";

export type BadgeStats = {
  /** Séances terminées, tous types confondus. */
  sessionsDone: number;
  /** Semaines consécutives à au moins 3 séances. */
  streakWeeks: number;
  /** Tonnage cumulé, en kilos. */
  totalVolumeKg: number;
  /** Records personnels enregistrés. */
  personalRecords: number;
  /** Séances terminées dont TOUTES les séries portent un RPE. */
  fullyRatedSessions: number;
};

export type Badge = {
  id: string;
  family: BadgeFamily;
  label: string;
  /** Ce qu'il faut faire, à la deuxième personne. */
  hint: string;
  threshold: number;
  value: number;
  earned: boolean;
  /** Avancement 0-100 vers ce palier. */
  progress: number;
};

type Definition = {
  family: BadgeFamily;
  metric: keyof BadgeStats;
  /** Palier → libellé. */
  tiers: Array<{ threshold: number; label: string }>;
  hint: string;
};

const DEFINITIONS: Definition[] = [
  {
    family: "assiduite",
    metric: "sessionsDone",
    hint: "Termine des séances.",
    tiers: [
      { threshold: 1, label: "Première séance" },
      { threshold: 10, label: "10 séances" },
      { threshold: 25, label: "25 séances" },
      { threshold: 50, label: "50 séances" },
      { threshold: 100, label: "100 séances" },
      { threshold: 200, label: "200 séances" },
    ],
  },
  {
    family: "regularite",
    metric: "streakWeeks",
    hint: "Enchaîne les semaines à 3 séances ou plus.",
    tiers: [
      { threshold: 2, label: "2 semaines d'affilée" },
      { threshold: 4, label: "1 mois sans rien lâcher" },
      { threshold: 8, label: "2 mois d'affilée" },
      { threshold: 12, label: "Un trimestre plein" },
      { threshold: 26, label: "6 mois d'affilée" },
    ],
  },
  {
    family: "volume",
    metric: "totalVolumeKg",
    hint: "Accumule du tonnage, série après série.",
    tiers: [
      { threshold: 10_000, label: "10 tonnes soulevées" },
      { threshold: 50_000, label: "50 tonnes" },
      { threshold: 100_000, label: "100 tonnes" },
      { threshold: 250_000, label: "250 tonnes" },
      { threshold: 500_000, label: "500 tonnes" },
    ],
  },
  {
    family: "records",
    metric: "personalRecords",
    hint: "Bats tes charges de référence.",
    tiers: [
      { threshold: 1, label: "Premier record" },
      { threshold: 10, label: "10 records" },
      { threshold: 25, label: "25 records" },
      { threshold: 50, label: "50 records" },
    ],
  },
  {
    family: "retours",
    metric: "fullyRatedSessions",
    // Le RPE est ce qui permet au coach d'adapter : autant le récompenser.
    hint: "Renseigne ton RPE sur toutes les séries d'une séance.",
    tiers: [
      { threshold: 5, label: "5 séances entièrement notées" },
      { threshold: 20, label: "20 séances notées" },
      { threshold: 50, label: "50 séances notées" },
    ],
  },
];

export const FAMILY_LABEL: Record<BadgeFamily, string> = {
  assiduite: "Assiduité",
  regularite: "Régularité",
  volume: "Volume",
  records: "Records",
  retours: "Retours au coach",
};

export function buildBadges(stats: BadgeStats): Badge[] {
  return DEFINITIONS.flatMap((definition) => {
    const value = Math.max(0, Number(stats[definition.metric] ?? 0));
    return definition.tiers.map((tier) => ({
      id: `${definition.family}-${tier.threshold}`,
      family: definition.family,
      label: tier.label,
      hint: definition.hint,
      threshold: tier.threshold,
      value,
      earned: value >= tier.threshold,
      progress: Math.min(100, Math.round((value / tier.threshold) * 100)),
    }));
  });
}

/**
 * Ce qu'on met en avant : les trophées décrochés, et le prochain palier de
 * chaque famille. Afficher les paliers lointains n'aide personne.
 */
export function summarizeBadges(stats: BadgeStats) {
  const all = buildBadges(stats);
  const earned = all.filter((badge) => badge.earned);
  const next = DEFINITIONS.map((definition) =>
    all.find((badge) => badge.family === definition.family && !badge.earned),
  ).filter((badge): badge is Badge => !!badge);

  return { earned, next, earnedCount: earned.length, totalCount: all.length };
}
