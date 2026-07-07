import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getArchivedCoachSessions,
  restoreSessionToCoachDashboard,
} from "@/lib/coach-dashboard.functions";
import { sanitizeDurationMin, timeAgo } from "@/lib/format";
import { CSTAvatar } from "@/components/Atoms";
import { toast } from "sonner";

export default function ArchivedSessionsPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchArchived = useServerFn(getArchivedCoachSessions);
  const restoreSession = useServerFn(restoreSessionToCoachDashboard);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["coach", "archived-sessions"],
    queryFn: () => fetchArchived({ data: { limit: 50 } }),
  });

  const archivedSessions = data ?? [];

  async function onRestore(sessionId: string) {
    try {
      await restoreSession({ data: { sessionId } });
      toast.success("Séance restaurée dans le dashboard");
      await qc.invalidateQueries({ queryKey: ["coach"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    }
  }

  return (
    <div className="cst-card-dark" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="cst-display" style={{ fontSize: 18, marginBottom: 4 }}>
            INFOS ARCHIVÉES
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Retrouve les séances retirées du dashboard coach.
          </div>
        </div>
        <button
          type="button"
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          onClick={() => setOpen((current) => !current)}
        >
          {open
            ? "MASQUER"
            : `VOIR${archivedSessions.length ? ` (${archivedSessions.length})` : ""}`}{" "}
          →
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {isLoading ? (
            <div style={{ padding: 16, opacity: 0.6 }}>Chargement…</div>
          ) : archivedSessions.length === 0 ? (
            <div style={{ padding: 16, opacity: 0.7 }}>Aucune séance archivée pour l’instant.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {archivedSessions.map((s) => {
                const initials = s.memberName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const isFree = s.sessionType === "free";
                const catIcon =
                  s.freeCategory === "course"
                    ? "🏃"
                    : s.freeCategory === "cardio"
                      ? "❤️"
                      : s.freeCategory === "muscu"
                        ? "🏋️"
                        : s.freeCategory === "sport"
                          ? "⚽"
                          : "✨";
                const label = isFree
                  ? `${catIcon} ${s.freeTitle || "Séance libre"}`
                  : `${s.label || "Séance"}${s.week ? ` · Sem ${s.week}` : ""}${s.day ? ` J${s.day}` : ""}`;

                return (
                  <div
                    key={s.id}
                    className="cst-card-dark"
                    style={{ padding: 14, display: "flex", gap: 14, alignItems: "flex-start" }}
                  >
                    <CSTAvatar initials={initials} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                      >
                        <strong style={{ fontSize: 14 }}>{s.memberName.toUpperCase()}</strong>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
                        <span
                          className="cst-mono"
                          style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}
                        >
                          archivée {timeAgo(s.archivedAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          marginTop: 6,
                          fontSize: 12,
                          opacity: 0.85,
                          flexWrap: "wrap",
                        }}
                      >
                        {s.endedAt && (
                          <span>
                            📅{" "}
                            {new Date(s.endedAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </span>
                        )}
                        <span>⏱ {sanitizeDurationMin(s.durationMinutes) ?? "—"} min</span>
                        <span>
                          ⚡ RPE {s.averageRpe != null ? Number(s.averageRpe).toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                        onClick={() =>
                          navigate({ to: "/coach/seance/$sessionId", params: { sessionId: s.id } })
                        }
                      >
                        Voir →
                      </button>
                      <button
                        type="button"
                        className="cst-btn cst-btn-sm"
                        style={{
                          background: "rgba(45,90,53,0.15)",
                          border: "1px solid rgba(45,90,53,0.4)",
                          color: "#6EAB76",
                        }}
                        onClick={() => void onRestore(s.id)}
                      >
                        Restaurer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
