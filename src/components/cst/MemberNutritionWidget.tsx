import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Flame } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getMyNutrition } from "@/lib/nutrition.functions";
import { buildNutritionWidgetModel } from "@/lib/nutrition-widget";
import { localDateISO } from "@/lib/local-date";

function formatKcal(value: number | null) {
  return value == null ? "—" : value.toLocaleString("fr-FR");
}

export function MemberNutritionWidget() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const loadNutrition = useServerFn(getMyNutrition);
  const [summary, setSummary] = useState<Parameters<typeof buildNutritionWidgetModel>[0]>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const model = buildNutritionWidgetModel(summary);

  useEffect(() => {
    let cancelled = false;
    loadNutrition({ data: { date: localDateISO() } })
      .then((data) => {
        if (!cancelled) setSummary(data.summary);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadNutrition]);

  return (
    <section
      className="cst-card-dark"
      aria-labelledby="member-nutrition-widget-title"
      style={{ marginTop: 14, padding: 14 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="cst-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--cst-mid-green)",
              fontSize: 9,
              letterSpacing: "0.14em",
            }}
          >
            <Flame size={13} aria-hidden="true" /> {t("NUTRITION · AUJOURD'HUI")}
          </div>
          <h2
            id="member-nutrition-widget-title"
            className="cst-display"
            style={{ margin: "5px 0 0", fontSize: 17 }}
          >
            {loading
              ? t("Chargement…")
              : failed
                ? t("Suivi nutrition")
                : `${formatKcal(model.consumedKcal)} kcal`}
          </h2>
          <div style={{ marginTop: 3, fontSize: 11, color: "rgba(255,255,255,0.64)" }}>
            {loading
              ? t("Mise à jour de ta journée")
              : failed
                ? t("Tes données seront disponibles dans Nutrition.")
                : model.goalKcal == null
                  ? t("Aucun objectif calorique défini")
                  : `${formatKcal(model.remainingKcal)} kcal ${t("restantes sur")} ${formatKcal(model.goalKcal)} kcal`}
          </div>
        </div>
        <div
          role="img"
          aria-label={
            model.progressPercent == null
              ? t("Objectif nutritionnel non défini")
              : `${model.progressPercent}% ${t("de l'objectif calorique")}`
          }
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            border: `4px solid ${model.progressPercent === 100 ? "#E6BD56" : "rgba(255,255,255,0.13)"}`,
            background:
              model.progressPercent == null
                ? "transparent"
                : `conic-gradient(var(--cst-mid-green) ${model.progressPercent * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
            boxShadow: "inset 0 0 0 5px var(--cst-card-dark, #1b2c20)",
            color: model.progressPercent === 100 ? "#E6BD56" : "rgba(255,255,255,0.82)",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {model.progressPercent == null ? "—" : `${model.progressPercent}%`}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={t("Progression de l'objectif calorique")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={model.progressPercent ?? 0}
        style={{
          height: 6,
          marginTop: 12,
          borderRadius: 99,
          background: "rgba(255,255,255,0.09)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${model.progressPercent ?? 0}%`,
            height: "100%",
            borderRadius: 99,
            background: model.progressPercent === 100 ? "#E6BD56" : "var(--cst-mid-green)",
            transition: "width 250ms ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 6,
          marginTop: 12,
        }}
      >
        {model.meals.map((meal) => (
          <div
            key={meal.key}
            style={{
              minWidth: 0,
              padding: "7px 6px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.035)",
            }}
          >
            <div
              className="cst-mono"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 8,
                opacity: 0.56,
              }}
            >
              {t(meal.label.toUpperCase())}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                color: meal.totalKcal ? "#E6BD56" : "rgba(255,255,255,0.55)",
              }}
            >
              {loading ? "—" : `${formatKcal(meal.totalKcal)} kcal`}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="cst-btn cst-btn-ghost-dark"
        onClick={() => navigate({ to: "/membre/nutrition" })}
        style={{
          width: "100%",
          marginTop: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          fontSize: 10,
        }}
      >
        {t("NOTER UN REPAS")}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
