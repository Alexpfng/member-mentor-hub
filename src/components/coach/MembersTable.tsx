import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMembersOverview } from "@/lib/coach-dashboard.functions";
import { timeAgo } from "@/lib/format";
import { CSTAvatar } from "@/components/Atoms";

type SortKey = "alert" | "name" | "adherence" | "last";

export default function MembersTable() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getMembersOverview);
  const { data, isLoading } = useQuery({ queryKey: ["coach", "members-overview"], queryFn: () => fetchOverview() });
  const [sort, setSort] = useState<SortKey>("alert");

  if (isLoading) return <div className="cst-card-dark" style={{ padding: 20, opacity: 0.6 }}>Chargement…</div>;
  const rows = [...(data ?? [])];
  const rank = { red: 0, orange: 1, green: 2 } as const;
  rows.sort((a, b) => {
    if (sort === "alert") return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "adherence") return (b.adherence7d ?? -1) - (a.adherence7d ?? -1);
    if (sort === "last") return (b.lastSessionAt || "").localeCompare(a.lastSessionAt || "");
    return 0;
  });

  if (rows.length === 0) {
    return <div className="cst-card-dark" style={{ padding: 22, opacity: 0.7 }}>Aucun coaché pour l'instant.</div>;
  }

  return (
    <div className="cst-card-dark" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "flex-end", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <label className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginRight: 8, alignSelf: "center", letterSpacing: "0.15em" }}>TRIER PAR</label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="cst-input" style={{ fontSize: 11, padding: "4px 8px" }}>
          <option value="alert">Alerte</option>
          <option value="name">Nom</option>
          <option value="adherence">Adhérence</option>
          <option value="last">Dernière séance</option>
        </select>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["", "COACHÉ", "PROGRAMME", "SEM.", "DERNIÈRE SÉANCE", "ADHÉRENCE 7J", "ÉTAT", ""].map((h, i) => (
              <th key={i} style={{ fontFamily: "var(--cst-mono)", fontSize: 10, letterSpacing: "0.15em", textAlign: "left", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", opacity: 0.6 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const initials = r.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
            const dot = r.status === "red" ? "#C0392B" : r.status === "orange" ? "#E07B39" : "#6EAB76";
            return (
              <tr key={r.memberId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: r.memberId } })}>
                <td style={{ padding: "12px 12px" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: dot }} />
                </td>
                <td style={{ padding: "12px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CSTAvatar initials={initials} size={28} />
                    <strong>{r.name}</strong>
                  </div>
                </td>
                <td style={{ padding: "12px 12px", opacity: 0.85 }}>{r.programName || "—"}</td>
                <td style={{ padding: "12px 12px", fontFamily: "var(--cst-mono)", fontSize: 11 }}>{r.currentWeek != null ? `${r.currentWeek}${r.durationWeeks ? `/${r.durationWeeks}` : ""}` : "—"}</td>
                <td style={{ padding: "12px 12px", opacity: 0.75, fontSize: 12 }}>{timeAgo(r.lastSessionAt)}</td>
                <td style={{ padding: "12px 12px", fontFamily: "var(--cst-mono)", fontSize: 11 }}>{r.adherence7d != null ? `${r.adherence7d}% (${r.sessionsDone7d}/${r.sessionsTotal7d})` : "—"}</td>
                <td style={{ padding: "12px 12px", fontSize: 12, color: dot }}>{r.statusLabel}</td>
                <td style={{ padding: "12px 12px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: r.memberId } })}>VOIR</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
