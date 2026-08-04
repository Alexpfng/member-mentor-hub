import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { MovementProfile } from "@/lib/movement-profile";

const BEFORE = "#7A8C80";
const AFTER = "#6EAB76";

function frRange(range: { from: string; to: string } | null) {
  if (!range) return null;
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${fmt(range.from)} → ${fmt(range.to)}`;
}

/**
 * Toile d'araignée du travail réellement effectué, par famille de mouvement.
 * Chaque axe est ramené à son propre maximum : la forme montre où le membre a
 * progressé, elle ne se compare pas d'un membre à l'autre.
 */
export default function MovementRadar({
  profile,
  title = "Profil de mouvement",
}: {
  profile: MovementProfile;
  title?: string;
}) {
  if (profile.empty) {
    return (
      <div style={{ padding: 16, opacity: 0.6, fontSize: 12 }}>
        Pas encore assez de séances loguées pour tracer un profil. Il apparaît dès les premiers
        exercices enregistrés.
      </div>
    );
  }

  const hasBefore = profile.points.some((point) => point.beforeRaw > 0);
  const data = profile.points.map((point) => ({
    label: point.label,
    avant: point.before,
    maintenant: point.after,
    avantRaw: point.beforeRaw,
    maintenantRaw: point.afterRaw,
  }));
  const untouched = profile.points.filter((point) => point.empty).map((point) => point.label);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.6 }}>
          {title.toUpperCase()}
        </span>
        {hasBefore && (
          <span className="cst-mono" style={{ fontSize: 9.5, opacity: 0.5 }}>
            {frRange(profile.beforeRange)} vs {frRange(profile.afterRange)}
          </span>
        )}
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {hasBefore && (
              <Radar
                name="Début"
                dataKey="avant"
                stroke={BEFORE}
                fill={BEFORE}
                fillOpacity={0.18}
                strokeWidth={1.5}
              />
            )}
            <Radar
              name="Maintenant"
              dataKey="maintenant"
              stroke={AFTER}
              fill={AFTER}
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                background: "#1a261d",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
              }}
              // Le pourcentage n'a de sens que relatif : on montre la charge réelle.
              formatter={(_value, name, item) => {
                const raw =
                  name === "Début"
                    ? (item?.payload as { avantRaw: number })?.avantRaw
                    : (item?.payload as { maintenantRaw: number })?.maintenantRaw;
                return [`${Math.round(raw ?? 0).toLocaleString("fr-FR")} pts de charge`, name];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 10.5, opacity: 0.55, lineHeight: 1.5 }}>
        {hasBefore
          ? "Chaque branche est ramenée à son propre maximum : la surface verte montre où le travail a le plus augmenté depuis le début."
          : "Répartition du travail effectué jusqu'ici. La comparaison avec le début apparaîtra après quelques semaines."}
        {untouched.length > 0 && ` Jamais travaillé : ${untouched.join(", ").toLowerCase()}.`}
      </div>
    </div>
  );
}
