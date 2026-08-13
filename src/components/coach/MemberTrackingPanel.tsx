/* ColosmartTraining — Tracking coaché côté coach (poids + pas)
 *
 * Léo suit ses clients sur des tableaux Excel : « fluctuation du poids » (date,
 * poids, % semaine, % total) et « nombre de pas » (moyennes hebdo / mensuelles vs
 * objectif). Les coachés loggent déjà poids (pesée) et pas (module activité) ; ici
 * on ressort ces données au format tracking pour que le coach ait juste à suivre.
 *
 * Écran coach : pas d'i18n (l'espace coach reste en français).
 */
import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { CSTSectionNum } from "../Atoms";

type WeightLog = { date: string; weight_kg: number };
type ActivityLog = { date: string; steps: number | null; calories: number | null };
type Goals = { steps: number | null; calories: number | null };

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...opts });
}
function mondayISO(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const diff = (d.getUTCDay() + 6) % 7; // jours depuis lundi
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
function pct(a: number, b: number) {
  return b !== 0 ? ((a - b) / b) * 100 : 0;
}
function signed(n: number, digits = 1) {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}
// Perdre du poids = vert (objectif fréquent) ; prendre = ambre. Neutre à 0.
function deltaColor(n: number) {
  if (n < 0) return "var(--cst-mid-green, #6EAB76)";
  if (n > 0) return "#E0A23B";
  return "rgba(255,255,255,0.6)";
}

const CHART_TOOLTIP = {
  background: "#1a261d",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 12,
} as const;
const AXIS_TICK = { fill: "rgba(255,255,255,0.6)", fontSize: 11 } as const;

export default function MemberTrackingPanel({
  weights,
  activity,
  goals,
}: {
  weights: WeightLog[];
  activity: ActivityLog[];
  goals: Goals;
}) {
  // ─── Poids ───
  const weightAsc = useMemo(
    () =>
      [...weights]
        .filter((w) => Number.isFinite(w.weight_kg))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [weights],
  );
  const first = weightAsc[0]?.weight_kg ?? null;
  const last = weightAsc[weightAsc.length - 1]?.weight_kg ?? null;
  const totalDelta = first != null && last != null ? last - first : null;
  const weightChart = useMemo(
    () =>
      weightAsc.map((w) => ({
        label: fmtDate(w.date, { day: "2-digit", month: "2-digit" }),
        kg: w.weight_kg,
      })),
    [weightAsc],
  );
  const weightRows = useMemo(() => {
    // Plus récent en haut ; % vs pesée précédente + % total depuis le départ.
    return weightAsc
      .map((w, i) => ({
        date: w.date,
        kg: w.weight_kg,
        weekPct: i > 0 ? pct(w.weight_kg, weightAsc[i - 1].weight_kg) : null,
        totalPct: first != null ? pct(w.weight_kg, first) : null,
      }))
      .reverse();
  }, [weightAsc, first]);

  // ─── Pas ───
  const dailySteps = useMemo(
    () =>
      activity
        .filter((a) => typeof a.steps === "number")
        .map((a) => ({ date: a.date, steps: a.steps as number })),
    [activity],
  );
  const avgSteps =
    dailySteps.length > 0
      ? Math.round(dailySteps.reduce((s, a) => s + a.steps, 0) / dailySteps.length)
      : null;

  const weeks = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const a of dailySteps) {
      const k = mondayISO(a.date);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(a.steps);
    }
    return [...buckets.entries()]
      .map(([monday, arr]) => ({
        monday,
        avg: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
        days: arr.length,
      }))
      .sort((a, b) => a.monday.localeCompare(b.monday));
  }, [dailySteps]);

  const months = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const a of dailySteps) {
      const k = a.date.slice(0, 7);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(a.steps);
    }
    return [...buckets.entries()]
      .map(([ym, arr]) => ({
        ym,
        avg: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
      }))
      .sort((a, b) => b.ym.localeCompare(a.ym));
  }, [dailySteps]);

  const stepsGoal = goals.steps ?? null;
  const weeksChart = useMemo(
    () =>
      weeks.slice(-12).map((w) => ({
        label: fmtDate(w.monday, { day: "2-digit", month: "2-digit" }),
        pas: w.avg,
      })),
    [weeks],
  );

  return (
    <>
      {/* ══════ POIDS ══════ */}
      <div style={{ marginTop: 24 }}>
        <CSTSectionNum
          num={2}
          label="TRACKING POIDS"
          sub={weightAsc.length > 0 ? `${weightAsc.length} PESÉES` : "AUCUNE DONNÉE"}
        />
        {weightAsc.length === 0 ? (
          <div
            className="cst-card-dark"
            style={{ padding: 18, marginTop: 14, opacity: 0.6, fontSize: 13 }}
          >
            Aucune pesée pour l'instant. Le coaché renseigne son poids depuis l'app.
          </div>
        ) : (
          <div className="cst-card-dark" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>
                  POIDS ACTUEL
                </span>
                <span className="cst-display" style={{ fontSize: 22 }}>
                  {last} <span style={{ fontSize: 12, opacity: 0.5 }}>KG</span>
                </span>
              </div>
              {totalDelta != null && first != null && (
                <div className="cst-col" style={{ gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>
                    VARIATION TOTALE
                  </span>
                  <span
                    className="cst-display"
                    style={{ fontSize: 22, color: deltaColor(totalDelta) }}
                  >
                    {signed(totalDelta)} KG{" "}
                    <span style={{ fontSize: 11 }}>({signed(pct(last!, first))}%)</span>
                  </span>
                </div>
              )}
            </div>

            {weightChart.length > 1 && (
              <div style={{ height: 190, marginBottom: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} domain={["dataMin - 1", "dataMax + 1"]} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Line
                      type="monotone"
                      dataKey="kg"
                      stroke="#6EAB76"
                      strokeWidth={2}
                      dot={{ fill: "#6EAB76", r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table : Date · Poids · % vs précédente · % total */}
            <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 4 }}>
              <div
                className="cst-mono"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 0.8fr 0.8fr 0.9fr",
                  gap: 6,
                  fontSize: 8,
                  opacity: 0.5,
                  padding: "4px 2px",
                  position: "sticky",
                  top: 0,
                  background: "var(--cst-dark-green, #16241a)",
                }}
              >
                <span>DATE</span>
                <span style={{ textAlign: "right" }}>POIDS</span>
                <span style={{ textAlign: "right" }}>% SEM.</span>
                <span style={{ textAlign: "right" }}>% TOTAL</span>
              </div>
              {weightRows.map((r) => (
                <div
                  key={r.date}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 0.8fr 0.8fr 0.9fr",
                    gap: 6,
                    fontSize: 12,
                    padding: "6px 2px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    alignItems: "baseline",
                  }}
                >
                  <span className="cst-mono" style={{ opacity: 0.8 }}>
                    {fmtDate(r.date, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </span>
                  <span className="cst-display" style={{ textAlign: "right" }}>
                    {r.kg}
                  </span>
                  <span
                    className="cst-mono"
                    style={{
                      textAlign: "right",
                      color: r.weekPct != null ? deltaColor(r.weekPct) : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {r.weekPct != null ? `${signed(r.weekPct)}%` : "—"}
                  </span>
                  <span
                    className="cst-mono"
                    style={{
                      textAlign: "right",
                      color: r.totalPct != null ? deltaColor(r.totalPct) : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {r.totalPct != null ? `${signed(r.totalPct)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════ PAS ══════ */}
      <div style={{ marginTop: 24 }}>
        <CSTSectionNum
          num={3}
          label="TRACKING PAS"
          sub={
            stepsGoal != null
              ? `OBJECTIF ${stepsGoal.toLocaleString("fr-FR")} / JOUR`
              : "PAS D'OBJECTIF"
          }
        />
        {dailySteps.length === 0 ? (
          <div
            className="cst-card-dark"
            style={{ padding: 18, marginTop: 14, opacity: 0.6, fontSize: 13 }}
          >
            Aucun pas enregistré. Le coaché note ses pas chaque jour depuis l'app.
          </div>
        ) : (
          <div className="cst-card-dark" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>
                  MOYENNE / JOUR
                </span>
                <span className="cst-display" style={{ fontSize: 22 }}>
                  {avgSteps != null ? avgSteps.toLocaleString("fr-FR") : "—"}
                </span>
              </div>
              {stepsGoal != null && avgSteps != null && (
                <div className="cst-col" style={{ gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>
                    % DE L'OBJECTIF
                  </span>
                  <span
                    className="cst-display"
                    style={{
                      fontSize: 22,
                      color: avgSteps >= stepsGoal ? "var(--cst-mid-green, #6EAB76)" : "#E0A23B",
                    }}
                  >
                    {Math.round((avgSteps / stepsGoal) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {weeksChart.length > 0 && (
              <div style={{ height: 180, marginBottom: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeksChart} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={16} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    {stepsGoal != null && (
                      <ReferenceLine y={stepsGoal} stroke="#E0A23B" strokeDasharray="4 4" />
                    )}
                    <Bar dataKey="pas" fill="#6EAB76" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 6 }}>
              {/* Par semaine */}
              <div>
                <div className="cst-mono" style={{ fontSize: 8, opacity: 0.5, marginBottom: 4 }}>
                  PAR SEMAINE (MOY.)
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {[...weeks]
                    .reverse()
                    .slice(0, 12)
                    .map((w) => {
                      const okGoal = stepsGoal != null && w.avg >= stepsGoal;
                      return (
                        <div
                          key={w.monday}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            padding: "5px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span className="cst-mono" style={{ opacity: 0.7 }}>
                            sem. {fmtDate(w.monday, { day: "2-digit", month: "2-digit" })}
                          </span>
                          <span
                            className="cst-display"
                            style={{
                              color:
                                stepsGoal != null
                                  ? okGoal
                                    ? "var(--cst-mid-green, #6EAB76)"
                                    : "#E0A23B"
                                  : "#fff",
                            }}
                          >
                            {w.avg.toLocaleString("fr-FR")}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
              {/* Par mois */}
              <div>
                <div className="cst-mono" style={{ fontSize: 8, opacity: 0.5, marginBottom: 4 }}>
                  PAR MOIS (MOY.)
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {months.map((m) => {
                    const okGoal = stepsGoal != null && m.avg >= stepsGoal;
                    return (
                      <div
                        key={m.ym}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          padding: "5px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <span className="cst-mono" style={{ opacity: 0.7 }}>
                          {fmtDate(`${m.ym}-01`, { month: "short", year: "2-digit" })}
                        </span>
                        <span
                          className="cst-display"
                          style={{
                            color:
                              stepsGoal != null
                                ? okGoal
                                  ? "var(--cst-mid-green, #6EAB76)"
                                  : "#E0A23B"
                                : "#fff",
                          }}
                        >
                          {m.avg.toLocaleString("fr-FR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
