import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

type Point = { date: string | null; rpe: number | null };

export default function RpeChart({ data, target = 7 }: { data: Point[]; target?: number }) {
  if (!data.length) {
    return <div style={{ padding: 16, opacity: 0.6, fontSize: 12 }}>Aucun RPE enregistré ces 7 derniers jours.</div>;
  }
  const formatted = data.map((p) => ({
    label: p.date ? new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—",
    rpe: p.rpe,
  }));
  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={formatted} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
          <YAxis domain={[0, 10]} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#1a261d", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }} />
          <ReferenceLine y={target} stroke="#E07B39" strokeDasharray="4 4" label={{ value: `Cible ${target}`, fill: "#E07B39", fontSize: 10, position: "right" }} />
          <Line type="monotone" dataKey="rpe" stroke="#6EAB76" strokeWidth={2} dot={{ fill: "#6EAB76", r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
