import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Point = { week: string; done: number; planned: number };

export default function AdherenceChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return <div style={{ padding: 16, opacity: 0.6, fontSize: 12 }}>Pas encore de données d'adhérence.</div>;
  }
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#1a261d", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="planned" fill="rgba(255,255,255,0.15)" name="Prévues" radius={[4, 4, 0, 0]} />
          <Bar dataKey="done" fill="#6EAB76" name="Faites" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
