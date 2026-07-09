/* Carte de comparaison d'une course vs la précédente. Réutilisée côté membre
   (retour instantané "donnant-donnant") et côté coach (fiche séance). */
import {
  computeRunComparison,
  runVerdict,
  formatPace,
  type MetricDelta,
  type RunMetrics,
} from "@/lib/run-stats";

type Props = {
  previous: RunMetrics | null;
  current: RunMetrics;
  compact?: boolean;
};

function frNum(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function formatValue(key: MetricDelta["key"], value: number | null): string {
  if (value == null) return "—";
  switch (key) {
    case "pace":
      return `${formatPace(value)} /km`;
    case "distance":
      return `${frNum(value)} km`;
    case "elevation":
      return `${Math.round(value)} m`;
    case "avgHr":
      return `${Math.round(value)} bpm`;
  }
}

function formatDelta(key: MetricDelta["key"], d: MetricDelta): string {
  if (d.delta == null || d.direction === "same" || d.direction == null) return "=";
  const arrow = d.direction === "up" ? "▲" : "▼";
  const abs = Math.abs(d.delta);
  const amount =
    key === "pace"
      ? `${Math.round(abs)} s`
      : key === "distance"
        ? `${frNum(abs)} km`
        : key === "elevation"
          ? `${Math.round(abs)} m`
          : `${Math.round(abs)}`;
  return `${arrow} ${amount}`;
}

const SENTIMENT_COLOR: Record<MetricDelta["sentiment"], string> = {
  good: "#6EAB76",
  bad: "#E0857B",
  neutral: "rgba(255,255,255,0.55)",
};

export function RunComparisonCard({ previous, current, compact }: Props) {
  const deltas = computeRunComparison(previous, current);
  const verdict = runVerdict(deltas);
  // Fallback : si pas de course précédente, on affiche quand même les métriques du jour.
  const rows: MetricDelta[] =
    deltas.length > 0
      ? deltas
      : [
          {
            key: "pace",
            label: "Allure",
            current: current.paceSecPerKm,
            previous: null,
            delta: null,
            direction: null,
            sentiment: "neutral",
          },
          {
            key: "distance",
            label: "Distance",
            current: current.distanceKm,
            previous: null,
            delta: null,
            direction: null,
            sentiment: "neutral",
          },
          {
            key: "elevation",
            label: "D+",
            current: current.elevationM,
            previous: null,
            delta: null,
            direction: null,
            sentiment: "neutral",
          },
          {
            key: "avgHr",
            label: "FC moy",
            current: current.avgHr,
            previous: null,
            delta: null,
            direction: null,
            sentiment: "neutral",
          },
        ];
  const visible = rows.filter((r) => r.current != null);

  return (
    <div
      className="cst-card-dark"
      style={{
        padding: compact ? 14 : 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: "rgba(110,171,118,0.3)",
      }}
    >
      <div className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.2em", opacity: 0.6 }}>
        {previous ? "VS TA COURSE PRÉCÉDENTE" : "TES STATS DU JOUR"}
      </div>
      <div
        className="cst-display"
        style={{ fontSize: compact ? 16 : 18, lineHeight: 1.2, color: "#fff" }}
      >
        {verdict}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {visible.map((d) => (
          <div key={d.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              className="cst-mono"
              style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.12em" }}
            >
              {d.label.toUpperCase()}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {formatValue(d.key, d.current)}
            </span>
            {previous && (
              <span
                className="cst-mono"
                style={{ fontSize: 11, color: SENTIMENT_COLOR[d.sentiment] }}
              >
                {formatDelta(d.key, d)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
