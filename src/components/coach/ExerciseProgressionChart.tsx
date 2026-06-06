import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { getExerciseProgression } from "@/lib/coach-dashboard.functions";

export default function ExerciseProgressionChart({ memberId }: { memberId: string }) {
  const fetchFn = useServerFn(getExerciseProgression);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const { data, isLoading } = useQuery({
    queryKey: ["coach", "ex-progression", memberId, selected ?? "auto"],
    queryFn: () => fetchFn({ data: { memberId, ...(selected ? { exerciseName: selected } : {}) } }),
  });

  if (isLoading) return <div style={{ padding: 16, opacity: 0.6 }}>Chargement…</div>;
  const exercises = data?.exercises ?? [];
  const series = data?.series ?? [];
  const current = selected ?? data?.selected;

  if (!exercises.length) {
    return <div className="cst-card-dark" style={{ padding: 18, opacity: 0.7, fontSize: 13 }}>Aucun exercice enregistré pour ce membre.</div>;
  }

  return (
    <div className="cst-card-dark" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.7 }}>PROGRESSION · {current?.toUpperCase()}</div>
        <select className="cst-input" style={{ fontSize: 11, padding: "4px 8px" }} value={current ?? ""} onChange={(e) => setSelected(e.target.value)}>
          {exercises.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
        </select>
      </div>
      {series.length === 0 ? (
        <div style={{ padding: 16, opacity: 0.6, fontSize: 12 }}>Pas encore de série loguée.</div>
      ) : (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fill: "rgba(224,123,57,0.8)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a261d", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="weight" fill="#6EAB76" name="Poids (kg)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="rpe" stroke="#E07B39" strokeWidth={2} dot={{ fill: "#E07B39", r: 3 }} name="RPE" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
