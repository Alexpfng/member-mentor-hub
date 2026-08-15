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

// Pas : atteint l'objectif = vert, en dessous = ambre, pas de saisie = grisé.
function stepColor(steps: number | null, goal: number | null) {
  if (steps == null) return "rgba(255,255,255,0.25)";
  if (goal == null) return "#fff";
  return steps >= goal ? "var(--cst-mid-green, #6EAB76)" : "#E0A23B";
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

  // Tableau jour par jour, un bloc par mois (façon feuille de suivi de Léo) :
  // chaque jour du mois en colonne (date · jour · nb de pas), + moyenne du mois et
  // moyennes hebdo « S1..Sn » (tranches de 7 jours depuis le 1er du mois).
  const stepsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of dailySteps) m.set(a.date, a.steps);
    return m;
  }, [dailySteps]);

  const monthGrid = useMemo(() => {
    if (dailySteps.length === 0) return [];
    const monthKeys = [...new Set(dailySteps.map((a) => a.date.slice(0, 7)))].sort((a, b) =>
      b.localeCompare(a),
    );
    return monthKeys.map((ym) => {
      const [y, mo] = ym.split("-").map(Number);
      const lastDayOfMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      // On s'arrête au dernier jour loggé du mois (pas de colonnes vides dans le futur).
      let lastLogged = 1;
      for (const a of dailySteps) {
        if (a.date.slice(0, 7) === ym) {
          const d = Number(a.date.slice(8, 10));
          if (d > lastLogged) lastLogged = d;
        }
      }
      const lastDay = Math.min(lastDayOfMonth, lastLogged);
      const days = Array.from({ length: lastDay }, (_, i) => {
        const iso = `${ym}-${String(i + 1).padStart(2, "0")}`;
        return { iso, dayNum: i + 1, steps: stepsByDate.get(iso) ?? null };
      });
      const avgOf = (arr: { steps: number | null }[]) => {
        const vals = arr.map((d) => d.steps).filter((v): v is number => v != null);
        return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      };
      const weekAvgs: { label: string; avg: number | null }[] = [];
      for (let i = 0; i < days.length; i += 7) {
        weekAvgs.push({ label: `S${Math.floor(i / 7) + 1}`, avg: avgOf(days.slice(i, i + 7)) });
      }
      return { ym, days, monthAvg: avgOf(days), weekAvgs };
    });
  }, [dailySteps, stepsByDate]);

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

            {/* Détail jour par jour, un bloc par mois (scroll horizontal) */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
              {monthGrid.map((m) => (
                <div key={m.ym}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 6,
                    }}
                  >
                    <span className="cst-display" style={{ fontSize: 13 }}>
                      {fmtDate(`${m.ym}-01`, { month: "long", year: "numeric" }).toUpperCase()}
                    </span>
                    <span className="cst-mono" style={{ fontSize: 9, opacity: 0.7 }}>
                      MOY. MOIS ·{" "}
                      <span
                        className="cst-display"
                        style={{ fontSize: 12, color: stepColor(m.monthAvg, stepsGoal) }}
                      >
                        {m.monthAvg != null ? m.monthAvg.toLocaleString("fr-FR") : "—"}
                      </span>
                    </span>
                  </div>
                  <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                    <div style={{ display: "flex", gap: 3, minWidth: "min-content" }}>
                      {m.days.map((d) => (
                        <div
                          key={d.iso}
                          style={{
                            flex: "0 0 auto",
                            width: 42,
                            textAlign: "center",
                            padding: "4px 0",
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <div className="cst-mono" style={{ fontSize: 9, opacity: 0.7 }}>
                            {String(d.dayNum).padStart(2, "0")}
                          </div>
                          <div
                            className="cst-mono"
                            style={{ fontSize: 7, opacity: 0.4, textTransform: "uppercase" }}
                          >
                            {fmtDate(d.iso, { weekday: "short" }).replace(".", "")}
                          </div>
                          <div
                            className="cst-display"
                            style={{
                              fontSize: 10,
                              marginTop: 2,
                              color: stepColor(d.steps, stepsGoal),
                            }}
                          >
                            {d.steps != null ? d.steps.toLocaleString("fr-FR") : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {m.weekAvgs.length > 1 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                      {m.weekAvgs.map((w) => (
                        <span
                          key={w.label}
                          className="cst-mono"
                          style={{ fontSize: 9, opacity: 0.75 }}
                        >
                          {w.label} ·{" "}
                          <span
                            className="cst-display"
                            style={{ color: stepColor(w.avg, stepsGoal) }}
                          >
                            {w.avg != null ? w.avg.toLocaleString("fr-FR") : "—"}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
