import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import CoachSidebar from "@/components/CoachSidebar";
import { getCoachWeeklyPlan } from "@/lib/coach-dashboard.functions";

export const Route = createFileRoute("/_authenticated/coach/planning")({
  component: CoachPlanningPage,
});

type DayCell = {
  date: string;
  status: "done" | "in_progress" | "planned" | "rest";
  label: string | null;
  sessionId: string | null;
};
type MemberRow = { id: string; name: string; days: DayCell[] };

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const STATUS_ICON: Record<string, string> = {
  done: "✓",
  in_progress: "⏳",
  planned: "●",
  rest: "—",
};

const STATUS_COLOR: Record<string, string> = {
  done: "#4CAF7A",
  in_progress: "#F4A52E",
  planned: "rgba(255,255,255,0.55)",
  rest: "rgba(255,255,255,0.22)",
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function CoachPlanningPage() {
  const navigate = useNavigate();
  const fetchPlan = useServerFn(getCoachWeeklyPlan);
  const [data, setData] = useState<{
    members: MemberRow[];
    weekStart: string;
    weekEnd: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlan()
      .then((d) => {
        setData(d as any);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const weekDates = data ? Array.from({ length: 7 }, (_, i) => addDays(data.weekStart, i)) : [];
  const today = todayISO();

  function fmtDate(iso: string) {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  function fmtWeekRange(start: string, end: string) {
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(end + "T00:00:00Z");
    return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "24px 32px", maxWidth: 1100 }}>
          <div style={{ marginBottom: 20 }}>
            <div
              className="cst-mono"
              style={{ fontSize: 9, letterSpacing: "0.18em", opacity: 0.45, marginBottom: 4 }}
            >
              PLANNING SEMAINE
            </div>
            {data && (
              <div style={{ fontSize: 13, color: "var(--cst-text-soft)" }}>
                {fmtWeekRange(data.weekStart, data.weekEnd)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
            {(["done", "in_progress", "planned", "rest"] as const).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    color: STATUS_COLOR[k],
                    fontSize: 14,
                    fontWeight: 700,
                    width: 18,
                    textAlign: "center",
                  }}
                >
                  {STATUS_ICON[k]}
                </span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.65 }}>
                  {k === "done"
                    ? "FAIT"
                    : k === "in_progress"
                      ? "EN COURS"
                      : k === "planned"
                        ? "PRÉVU"
                        : "REPOS"}
                </span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="cst-mono" style={{ fontSize: 11, opacity: 0.5, padding: "40px 0" }}>
              CHARGEMENT…
            </div>
          ) : !data?.members?.length ? (
            <div style={{ fontSize: 13, opacity: 0.6, padding: "40px 0" }}>
              Aucun membre actif trouvé.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: "8px 14px 8px 0",
                        textAlign: "left",
                        minWidth: 140,
                        fontSize: 10,
                        fontFamily: "var(--cst-mono)",
                        letterSpacing: "0.12em",
                        opacity: 0.45,
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      MEMBRE
                    </th>
                    {weekDates.map((d, i) => {
                      const isToday = d === today;
                      return (
                        <th
                          key={d}
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            minWidth: 72,
                            fontSize: 10,
                            fontFamily: "var(--cst-mono)",
                            letterSpacing: "0.10em",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            color: isToday ? "var(--cst-mid-green)" : "rgba(255,255,255,0.45)",
                            fontWeight: isToday ? 700 : 400,
                          }}
                        >
                          {DAY_LABELS[i]}
                          <br />
                          <span style={{ fontSize: 9, opacity: 0.75 }}>{fmtDate(d)}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m, mi) => {
                    const dayByDate = new Map(m.days.map((d) => [d.date, d]));
                    return (
                      <tr
                        key={m.id}
                        style={{
                          background: mi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <td
                          onClick={() =>
                            navigate({ to: "/coach/membre/$memberId", params: { memberId: m.id } })
                          }
                          style={{
                            padding: "10px 14px 10px 0",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            color: "var(--cst-text)",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.name}
                        </td>
                        {weekDates.map((d) => {
                          const cell = dayByDate.get(d);
                          const isToday = d === today;
                          return (
                            <td
                              key={d}
                              title={cell ? (cell.label ?? cell.status) : undefined}
                              onClick={() =>
                                cell
                                  ? navigate({
                                      to: "/coach/membre/$memberId",
                                      params: { memberId: m.id },
                                    })
                                  : undefined
                              }
                              style={{
                                textAlign: "center",
                                padding: "10px 8px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                cursor: cell ? "pointer" : "default",
                                background: isToday ? "rgba(45,90,53,0.08)" : undefined,
                              }}
                            >
                              {cell ? (
                                <span
                                  style={{
                                    fontSize: cell.status === "in_progress" ? 14 : 15,
                                    color: STATUS_COLOR[cell.status],
                                    fontWeight: cell.status === "done" ? 700 : 400,
                                  }}
                                >
                                  {STATUS_ICON[cell.status]}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
