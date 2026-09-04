import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCoachMemberAppEventFeed } from "@/lib/member-app-events.functions";
import { timeAgo } from "@/lib/format";

function eventTone(eventName: string) {
  if (eventName.includes("failed")) return "#ff8a7a";
  if (eventName.includes("finish") || eventName.includes("matched")) return "#6EAB76";
  if (eventName.includes("strava")) return "#fc4c02";
  if (eventName.includes("session")) return "#D4A82E";
  return "rgba(255,255,255,0.65)";
}

export default function MemberAppLogWidget() {
  const navigate = useNavigate();
  const fetchLogs = useServerFn(getCoachMemberAppEventFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["coach", "member-app-events"],
    queryFn: () => fetchLogs({ data: { limit: 80 } }),
    refetchInterval: 45_000,
  });

  return (
    <section className="cst-card-dark cst-hatch" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.18em", opacity: 0.65 }}>
            SUIVI LOGS
          </div>
          <div className="cst-display" style={{ fontSize: 24, lineHeight: 1.05 }}>
            PARCOURS COACHÉS
          </div>
        </div>
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, alignSelf: "flex-start" }}>
          AUTO · 45S
        </div>
      </div>

      {isLoading && <div style={{ fontSize: 13, opacity: 0.65 }}>Chargement des logs…</div>}

      {!isLoading && data?.migrationMissing && (
        <div style={{ fontSize: 13, opacity: 0.75, color: "#D4A82E" }}>
          Logs prêts côté app. Migration Supabase à appliquer pour commencer l'enregistrement.
        </div>
      )}

      {!isLoading && !data?.migrationMissing && (!data?.summaries || data.summaries.length === 0) && (
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Aucun mouvement enregistré pour l'instant. Les prochains passages dans l'espace membre
          apparaîtront ici.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {(data?.summaries ?? []).slice(0, 6).map((summary) => (
          <button
            key={summary.memberId}
            type="button"
            onClick={() =>
              navigate({ to: "/coach/membre/$memberId", params: { memberId: summary.memberId } })
            }
            className="cst-card-dark"
            style={{
              textAlign: "left",
              padding: 12,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: `3px solid ${eventTone(summary.events[0]?.eventName ?? "")}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <strong style={{ fontSize: 13 }}>{summary.memberName.toUpperCase()}</strong>
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
                {timeAgo(summary.latestEventAt)}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--cst-text-soft)" }}>
              {summary.latestLabel}
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {summary.events.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 11,
                    opacity: 0.72,
                  }}
                >
                  <span>{event.label}</span>
                  <span className="cst-mono" style={{ whiteSpace: "nowrap" }}>
                    {new Date(event.eventAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
