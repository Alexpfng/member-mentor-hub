import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMembersOverview } from "@/lib/coach-dashboard.functions";
import { toggleMemberArchived, deleteMemberAccount } from "@/lib/coach.functions";
import { timeAgo } from "@/lib/format";
import { CSTAvatar } from "@/components/Atoms";
import { toast } from "sonner";

type SortKey = "alert" | "name" | "adherence" | "last";

export default function MembersTable() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getMembersOverview);
  const toggleFn = useServerFn(toggleMemberArchived);
  const deleteFn = useServerFn(deleteMemberAccount);
  const { data, isLoading } = useQuery({
    queryKey: ["coach", "members-overview"],
    queryFn: () => fetchOverview(),
  });
  const [sort, setSort] = useState<SortKey>("alert");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleToggleArchive(memberId: string, isArchived: boolean) {
    setBusy(memberId);
    setMenuOpen(null);
    try {
      await toggleFn({ data: { memberId, archive: !isArchived } });
      toast.success(isArchived ? "Compte réactivé" : "Compte archivé");
      qc.invalidateQueries({ queryKey: ["coach", "members-overview"] });
    } catch {
      toast.error("Erreur lors de l'archivage");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(memberId: string, name: string) {
    setMenuOpen(null);
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${name} ? Cette action est irréversible.`,
      )
    )
      return;
    setBusy(memberId);
    try {
      await deleteFn({ data: { memberId } });
      toast.success("Compte supprimé");
      qc.invalidateQueries({ queryKey: ["coach", "members-overview"] });
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading)
    return (
      <div className="cst-card-dark" style={{ padding: 20, opacity: 0.6 }}>
        Chargement…
      </div>
    );

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
    return (
      <div className="cst-card-dark" style={{ padding: 22, opacity: 0.7 }}>
        Aucun coaché pour l'instant.
      </div>
    );
  }

  return (
    <div className="cst-card-dark" style={{ padding: 0, overflow: "hidden" }}>
      {/* close menu on outside click */}
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setMenuOpen(null)}
        />
      )}
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          justifyContent: "flex-end",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <label
          className="cst-mono"
          style={{
            fontSize: 10,
            opacity: 0.6,
            marginRight: 8,
            alignSelf: "center",
            letterSpacing: "0.15em",
          }}
        >
          TRIER PAR
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="cst-input"
          style={{ fontSize: 11, padding: "4px 8px" }}
        >
          <option value="alert">Alerte</option>
          <option value="name">Nom</option>
          <option value="adherence">Adhérence</option>
          <option value="last">Dernière séance</option>
        </select>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["", "COACHÉ", "PROGRAMME", "SEM.", "DERNIÈRE SÉANCE", "ADHÉRENCE 7J", "ÉTAT", ""].map(
              (h, i) => (
                <th
                  key={i}
                  style={{
                    fontFamily: "var(--cst-mono)",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    opacity: 0.6,
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const initials = r.name
              .split(" ")
              .map((p: string) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const dot =
              r.status === "red" ? "#C0392B" : r.status === "orange" ? "#E07B39" : "#6EAB76";
            const isArchived = (r as any).isArchived ?? false;
            const isBusy = busy === r.memberId;
            return (
              <tr
                key={r.memberId}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  opacity: isArchived ? 0.5 : 1,
                }}
                onClick={() =>
                  navigate({ to: "/coach/membre/$memberId", params: { memberId: r.memberId } })
                }
              >
                <td style={{ padding: "12px 12px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: isArchived ? "rgba(255,255,255,0.2)" : dot,
                    }}
                  />
                </td>
                <td style={{ padding: "12px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CSTAvatar initials={initials} size={28} />
                    <strong>{r.name}</strong>
                    {isArchived && (
                      <span
                        className="cst-mono"
                        style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.12em" }}
                      >
                        ARCHIVÉ
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 12px", opacity: 0.85 }}>{r.programName || "—"}</td>
                <td style={{ padding: "12px 12px", fontFamily: "var(--cst-mono)", fontSize: 11 }}>
                  {r.currentWeek != null
                    ? `${r.currentWeek}${r.durationWeeks ? `/${r.durationWeeks}` : ""}`
                    : "—"}
                </td>
                <td style={{ padding: "12px 12px", opacity: 0.75, fontSize: 12 }}>
                  {timeAgo(r.lastSessionAt)}
                </td>
                <td style={{ padding: "12px 12px", fontFamily: "var(--cst-mono)", fontSize: 11 }}>
                  {r.adherence7d != null
                    ? `${r.adherence7d}% (${r.sessionsDone7d}/${r.sessionsTotal7d})`
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "12px 12px",
                    fontSize: 12,
                    color: isArchived ? "rgba(255,255,255,0.3)" : dot,
                  }}
                >
                  {isArchived ? "Archivé" : r.statusLabel}
                </td>
                <td
                  style={{ padding: "12px 12px", textAlign: "right" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                      onClick={() =>
                        navigate({
                          to: "/coach/membre/$memberId/adapter",
                          params: { memberId: r.memberId },
                          search:
                            r.currentWeek != null
                              ? { week: r.currentWeek + 1 }
                              : {},
                        })
                      }
                    >
                      ADAPTER S+1
                    </button>
                    <button
                      className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                      onClick={() =>
                        navigate({
                          to: "/coach/membre/$memberId",
                          params: { memberId: r.memberId },
                        })
                      }
                    >
                      VOIR
                    </button>
                    {/* ⋮ menu */}
                    <div style={{ position: "relative" }}>
                      <button
                        className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                        style={{ padding: "4px 8px", minWidth: 28 }}
                        disabled={isBusy}
                        onClick={() => setMenuOpen(menuOpen === r.memberId ? null : r.memberId)}
                      >
                        {isBusy ? "…" : "⋮"}
                      </button>
                      {menuOpen === r.memberId && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 4px)",
                            zIndex: 100,
                            background: "#1a2a1a",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            padding: "4px 0",
                            minWidth: 160,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          }}
                        >
                          <button
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              color: "rgba(255,255,255,0.8)",
                              fontFamily: "var(--cst-mono)",
                              fontSize: 11,
                              letterSpacing: "0.1em",
                              padding: "9px 14px",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "rgba(255,255,255,0.07)")
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            onClick={() => handleToggleArchive(r.memberId, isArchived)}
                          >
                            {isArchived ? "↩ RÉACTIVER" : "⊘ ARCHIVER"}
                          </button>
                          <div
                            style={{
                              height: 1,
                              background: "rgba(255,255,255,0.08)",
                              margin: "2px 0",
                            }}
                          />
                          <button
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              color: "#C0392B",
                              fontFamily: "var(--cst-mono)",
                              fontSize: 11,
                              letterSpacing: "0.1em",
                              padding: "9px 14px",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "rgba(192,57,43,0.12)")
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            onClick={() => handleDelete(r.memberId, r.name)}
                          >
                            ✕ SUPPRIMER
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
