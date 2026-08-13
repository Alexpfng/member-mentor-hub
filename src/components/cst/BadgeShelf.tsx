import { FAMILY_LABEL, type Badge } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";

/**
 * Étagère à trophées. Deux zones : ce qui est décroché, et le prochain palier
 * de chaque famille avec son avancement. On n'affiche pas les paliers lointains
 * — voir « 500 tonnes » quand on en est à 2 ne motive personne.
 */
export default function BadgeShelf({
  earned,
  next,
  earnedCount,
  totalCount,
}: {
  earned: Badge[];
  next: Badge[];
  earnedCount: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="cst-display" style={{ fontSize: 22 }}>
          {earnedCount}
        </span>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
          / {totalCount} {t("TROPHÉES")}
        </span>
      </div>

      {earned.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {earned.map((badge) => (
            <span
              key={badge.id}
              title={FAMILY_LABEL[badge.family]}
              className="cst-mono"
              style={{
                fontSize: 10,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(58,138,77,0.18)",
                border: "1px solid rgba(58,138,77,0.5)",
                color: "#8FD09A",
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.18em", opacity: 0.5 }}>
            {t("PROCHAINS PALIERS")}
          </span>
          {next.map((badge) => (
            <div key={badge.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 11.5,
                }}
              >
                <span>{badge.label}</span>
                <span className="cst-mono" style={{ opacity: 0.55, whiteSpace: "nowrap" }}>
                  {formatValue(badge)} / {formatThreshold(badge)}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
                role="progressbar"
                aria-valuenow={badge.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={badge.label}
              >
                <div
                  style={{
                    width: `${badge.progress}%`,
                    height: "100%",
                    background: "#3A8A4D",
                  }}
                />
              </div>
              <span style={{ fontSize: 10, opacity: 0.45 }}>{badge.hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Le tonnage se lit en tonnes ; le reste en unités. */
function formatValue(badge: Badge) {
  if (badge.family !== "volume") return Math.round(badge.value).toLocaleString("fr-FR");
  return `${(badge.value / 1000).toFixed(1).replace(".", ",")} t`;
}

function formatThreshold(badge: Badge) {
  if (badge.family !== "volume") return badge.threshold.toLocaleString("fr-FR");
  return `${badge.threshold / 1000} t`;
}
