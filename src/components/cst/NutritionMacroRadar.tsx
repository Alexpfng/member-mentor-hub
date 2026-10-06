import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { NutritionMacroComparison } from "@/lib/nutrition";
import { buildNutritionRadarModel, nutritionMissingDataMessage } from "./nutrition-detail";

function grams(value: number | null) {
  return value == null
    ? "Non renseigné"
    : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
}

export default function NutritionMacroRadar({
  comparison,
}: {
  comparison: NutritionMacroComparison | null | undefined;
}) {
  const model = buildNutritionRadarModel(comparison);
  const missingMessage = nutritionMissingDataMessage(comparison);
  const hasData = model.hasToday || model.hasPreviousAverage;

  return (
    <section aria-label="Comparaison des macronutriments" style={{ padding: "8px 0 18px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3 className="cst-mono" style={{ margin: 0, fontSize: 10, letterSpacing: "0.12em" }}>
          MACRONUTRIMENTS · EN GRAMMES
        </h3>
        <span style={{ fontSize: 11, opacity: 0.58 }}>Aujourd’hui vs jours précédents</span>
      </div>

      {hasData ? (
        <>
          <div style={{ width: "100%", height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <RadarChart data={model.data} outerRadius="68%">
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.72)", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  domain={[0, model.maxGrams]}
                  tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 9 }}
                  tickFormatter={(value: number) => `${value}g`}
                  axisLine={false}
                />
                {model.hasPreviousAverage && (
                  <Radar
                    name="Moyenne précédente"
                    dataKey="moyenne"
                    stroke="#d1a74b"
                    fill="#d1a74b"
                    fillOpacity={0.16}
                    strokeWidth={1.5}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                {model.hasToday && (
                  <Radar
                    name="Aujourd’hui"
                    dataKey="aujourdhui"
                    stroke="#72bd7b"
                    fill="#72bd7b"
                    fillOpacity={0.3}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: "#1a261d",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    grams(typeof value === "number" ? value : null),
                    name,
                  ]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              fontSize: 11,
            }}
          >
            <span>
              <b style={{ color: "#72bd7b" }}>●</b> Aujourd’hui
            </span>
            {model.hasPreviousAverage && (
              <span>
                <b style={{ color: "#d1a74b" }}>●</b> Moyenne des jours précédents
              </span>
            )}
          </div>
          {comparison && model.hasPreviousAverage && (
            <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 10, opacity: 0.55 }}>
              Moyenne calculée par nutriment sur les jours renseignés parmi les 6 jours précédents.
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: "14px 0", fontSize: 12, opacity: 0.62 }}>
          Les données nutritionnelles apparaîtront ici quand les aliments auront des macros
          renseignées.
        </p>
      )}

      {missingMessage && (
        <p
          role="note"
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            borderLeft: "2px solid #d1a74b",
            background: "rgba(209,167,75,0.08)",
            fontSize: 11,
            lineHeight: 1.5,
            opacity: 0.82,
          }}
        >
          {missingMessage}
        </p>
      )}
    </section>
  );
}
