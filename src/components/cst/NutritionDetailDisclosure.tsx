import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  MEAL_LABELS,
  MEAL_ORDER,
  kcalForPortion,
  type NutritionDaySummary,
  type NutritionMacroComparison,
} from "@/lib/nutrition";
import NutritionMacroRadar from "./NutritionMacroRadar";

type Props = {
  summary: NutritionDaySummary | null | undefined;
  macroComparison: NutritionMacroComparison | null | undefined;
  onDeleteEntry?: (entryId: string) => void;
};

export default function NutritionDetailDisclosure({
  summary,
  macroComparison,
  onDeleteEntry,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const entryCount = MEAL_ORDER.reduce(
    (total, meal) => total + (summary?.meals[meal].entries.length ?? 0),
    0,
  );

  return (
    <section style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <button
        type="button"
        className="cst-btn cst-btn-ghost-dark"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "12px 2px",
          textAlign: "left",
        }}
      >
        <span>
          {expanded ? "Masquer le détail" : "Voir le détail"}
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.58 }}>
            {entryCount} aliment{entryCount > 1 ? "s" : ""}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={17}
          style={{
            transform: expanded ? "rotate(180deg)" : undefined,
            transition: "transform 160ms",
          }}
        />
      </button>

      {expanded && (
        <div>
          <NutritionMacroRadar comparison={macroComparison} />
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
            <div
              className="cst-mono"
              style={{ fontSize: 10, letterSpacing: "0.12em", opacity: 0.72 }}
            >
              ALIMENTS PAR REPAS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: 14,
                marginTop: 10,
              }}
            >
              {MEAL_ORDER.map((meal) => {
                const group = summary?.meals[meal];
                return (
                  <section key={meal} aria-label={MEAL_LABELS[meal]} style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <h3 className="cst-display" style={{ margin: 0, fontSize: 17 }}>
                        {MEAL_LABELS[meal]}
                      </h3>
                      <span className="cst-mono" style={{ fontSize: 10, opacity: 0.68 }}>
                        {group?.totalKcal.toLocaleString("fr-FR") ?? 0} kcal
                      </span>
                    </div>
                    {!group?.entries.length ? (
                      <p style={{ fontSize: 12, opacity: 0.5, margin: "8px 0 0" }}>Aucun aliment</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {group.entries.map((entry) => (
                          <li
                            key={entry.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) auto auto",
                              alignItems: "center",
                              gap: 8,
                              padding: "10px 0",
                              borderTop: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <strong
                                style={{ display: "block", fontSize: 12, overflowWrap: "anywhere" }}
                              >
                                {entry.foodName}
                              </strong>
                              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                                {entry.grams} g
                              </span>
                            </div>
                            <span
                              className="cst-mono"
                              style={{ fontSize: 10, whiteSpace: "nowrap" }}
                            >
                              {kcalForPortion(entry)} kcal
                            </span>
                            {onDeleteEntry && (
                              <button
                                type="button"
                                className="cst-btn cst-btn-ghost-dark"
                                style={{ minWidth: 34, padding: "6px 8px" }}
                                onClick={() => onDeleteEntry(entry.id)}
                                aria-label={`Supprimer ${entry.foodName}`}
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
