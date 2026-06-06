import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRecentSessions } from "@/lib/coach-dashboard.functions";
import { timeAgo } from "@/lib/format";
import { CSTAvatar } from "@/components/Atoms";

export default function RecentSessionsList() {
  const navigate = useNavigate();
  const fetchSessions = useServerFn(getRecentSessions);
  const { data, isLoading } = useQuery({
    queryKey: ["coach", "recent-sessions"],
    queryFn: () => fetchSessions({ data: { limit: 10 } }),
  });

  if (isLoading) return <div className="cst-card-dark" style={{ padding: 20, opacity: 0.6 }}>Chargement…</div>;
  const sessions = data ?? [];
  if (sessions.length === 0) {
    return <div className="cst-card-dark" style={{ padding: 22, opacity: 0.7 }}>Aucune séance terminée pour l'instant.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sessions.map((s) => {
        const initials = s.memberName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
        return (
          <div key={s.id} className="cst-card-dark" style={{ padding: 14, display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer" }}
            onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: s.id } })}>
            <CSTAvatar initials={initials} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{s.memberName.toUpperCase()}</strong>
                {!s.coachSeen && <span className="cst-mono" style={{ fontSize: 9, padding: "2px 6px", background: "#E07B39", color: "#fff", borderRadius: 3, letterSpacing: "0.15em" }}>NOUVEAU</span>}
                <span style={{ fontSize: 12, opacity: 0.7 }}>{s.label || "Séance"}{s.week ? ` · Sem ${s.week}` : ""}{s.day ? ` J${s.day}` : ""}</span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(s.endedAt)}</span>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, opacity: 0.85, flexWrap: "wrap" }}>
                <span>⏱ {s.durationMinutes ?? "—"} min</span>
                <span>⚡ RPE {s.averageRpe != null ? Number(s.averageRpe).toFixed(1) : "—"}</span>
                {s.painCount > 0 && <span style={{ color: "#ff8a7a" }}>🔴 {s.painCount} douleur{s.painCount > 1 ? "s" : ""}</span>}
              </div>
              {s.memberNote && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, fontStyle: "italic" }}>« {s.memberNote.slice(0, 140)}{s.memberNote.length > 140 ? "…" : ""} »</div>}
            </div>
            <div style={{ alignSelf: "center", opacity: 0.6 }}>→</div>
          </div>
        );
      })}
    </div>
  );
}
