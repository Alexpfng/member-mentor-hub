import { decodeStravaPolyline, type StravaActivityCardData } from "@/lib/strava-activity-card";
import { formatPace } from "@/lib/run-stats";

type Props = {
  activity: StravaActivityCardData;
  compact?: boolean;
};

function frNum(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const sec = Math.round(seconds % 60);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  if (minutes > 0) return `${minutes}min`;
  return `${sec}s`;
}

function routePath(
  polyline: string | null,
  width: number,
  height: number,
  padding: number,
): string {
  const points = decodeStravaPolyline(polyline);
  if (points.length < 2) return "";

  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));
  const latRange = Math.max(maxLat - minLat, 0.00001);
  const lngRange = Math.max(maxLng - minLng, 0.00001);
  const drawableW = width - padding * 2;
  const drawableH = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + ((point.lng - minLng) / lngRange) * drawableW;
      const y = padding + (1 - (point.lat - minLat) / latRange) * drawableH;
      return `${index === 0 ? "M" : "L"}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}

function RoutePreview({ polyline, compact }: { polyline: string | null; compact?: boolean }) {
  const width = 320;
  const height = compact ? 96 : 132;
  const path = routePath(polyline, width, height, 16);

  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: compact ? 12 : 16,
        background:
          "radial-gradient(circle at 18% 20%, rgba(252, 82, 0, 0.2), transparent 24%), linear-gradient(135deg, #1d2f25 0%, #0f1f17 52%, #26392c 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="strava-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" />
          </pattern>
          <linearGradient id="strava-route" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffb347" />
            <stop offset="55%" stopColor="#fc4c02" />
            <stop offset="100%" stopColor="#ff7347" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#strava-grid)" />
        {path ? (
          <>
            <path d={path} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="8" />
            <path
              d={path}
              fill="none"
              stroke="url(#strava-route)"
              strokeWidth={compact ? "5" : "6"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.45)"
            fontSize="12"
            fontFamily="monospace"
          >
            TRACE NON DISPONIBLE
          </text>
        )}
      </svg>
      <div
        className="cst-mono"
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          padding: "4px 7px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.36)",
          color: "#fc4c02",
          fontSize: 8,
          letterSpacing: "0.18em",
        }}
      >
        STRAVA
      </div>
    </div>
  );
}

export function StravaRunCard({ activity, compact }: Props) {
  const stats = [
    activity.distanceKm != null
      ? { label: "Distance", value: `${frNum(activity.distanceKm)} km` }
      : null,
    activity.durationSec != null
      ? { label: "Temps", value: formatDuration(activity.durationSec) }
      : null,
    activity.paceSecPerKm != null
      ? { label: "Allure", value: `${formatPace(activity.paceSecPerKm)} /km` }
      : null,
    activity.elevationM != null ? { label: "D+", value: `${activity.elevationM} m` } : null,
    activity.avgHr != null ? { label: "FC moy", value: `${activity.avgHr} bpm` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div
      className="cst-card-dark"
      style={{
        padding: compact ? 10 : 14,
        borderColor: "rgba(252,76,2,0.34)",
        background:
          "linear-gradient(145deg, rgba(252,76,2,0.10), rgba(20,37,27,0.96) 38%, rgba(15,31,23,0.98))",
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 12,
      }}
    >
      <RoutePreview polyline={activity.polyline} compact={compact} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: compact ? 12 : 16,
              lineHeight: 1.15,
              overflowWrap: "anywhere",
            }}
          >
            {activity.title}
          </div>
          <div className="cst-mono" style={{ marginTop: 3, fontSize: 8, opacity: 0.58 }}>
            {(activity.sportType ?? "RUN").toUpperCase()}
          </div>
        </div>
        {activity.stravaUrl && (
          <a
            href={activity.stravaUrl}
            target="_blank"
            rel="noreferrer"
            className="cst-mono"
            style={{
              flexShrink: 0,
              color: "#fc4c02",
              fontSize: 8,
              letterSpacing: "0.12em",
              textDecoration: "none",
              paddingTop: 2,
            }}
          >
            VOIR
          </a>
        )}
      </div>
      {stats.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <div
                className="cst-mono"
                style={{ fontSize: 7, opacity: 0.48, letterSpacing: "0.12em" }}
              >
                {stat.label.toUpperCase()}
              </div>
              <div style={{ color: "#fff", fontSize: compact ? 12 : 15, fontWeight: 750 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
