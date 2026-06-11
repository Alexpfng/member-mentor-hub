import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import MemberNav from "../../components/MemberNav";
import { listLibraryForMember } from "@/lib/member-stats.functions";

type Ex = {
  id: string;
  name: string;
  muscle_group: string | null;
  category: string | null;
  intensity_code: string | null;
  color: string | null;
  default_tempo: string | null;
  equipement: string | null;
  coach_notes: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  movement_patterns: string[] | null;
};

const COLOR_MAP: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  blue: "#4A8BC4",
};

function ytId(ex: Ex): string | null {
  if (ex.youtube_id) return ex.youtube_id;
  if (!ex.youtube_url) return null;
  const m = ex.youtube_url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function Bibliotheque() {
  const fetchLib = useServerFn(listLibraryForMember);
  const [items, setItems] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const r = (await fetchLib()) as { exercises: Ex[] };
        setItems(r.exercises ?? []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [fetchLib]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || (e.muscle_group || "").toLowerCase().includes(q),
    );
    const map = new Map<string, Ex[]>();
    for (const e of filtered) {
      const key = e.muscle_group?.trim() || "Autres";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, search]);

  function toggle(group: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(group)) n.delete(group);
      else n.add(group);
      return n;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 22px 8px" }}>
            <h1 className="cst-display" style={{ fontSize: 26, margin: 0, color: "#fff" }}>
              BIBLIOTHÈQUE <span style={{ color: "var(--cst-mid-green)" }}>EXERCICES</span>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.7 }}>
              Revois les consignes et les vidéos quand tu veux, par partie du corps.
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Rechercher un exercice…"
              className="cst-input"
              style={{ width: "100%", marginTop: 12, padding: "10px 12px", fontSize: 14 }}
            />
          </div>
          <div className="cst-scroll" style={{ flex: 1, padding: "0 22px 90px" }}>
            {loading ? (
              <div style={{ padding: 24, opacity: 0.6 }}>Chargement…</div>
            ) : groups.length === 0 ? (
              <div style={{ padding: 24, opacity: 0.6, fontSize: 13 }}>Aucun exercice trouvé.</div>
            ) : (
              groups.map(([group, exos]) => {
                const open = expanded.has(group) || !!search.trim();
                return (
                  <div key={group} style={{ marginTop: 14 }}>
                    <button
                      onClick={() => toggle(group)}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <span className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.16em" }}>
                        {group.toUpperCase()} · {exos.length}
                      </span>
                      <span style={{ opacity: 0.5 }}>{open ? "▾" : "▸"}</span>
                    </button>
                    {open && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {exos.map((ex) => {
                          const vid = ytId(ex);
                          return (
                            <div
                              key={ex.id}
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.07)",
                                borderRadius: 10,
                                padding: "12px 14px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: COLOR_MAP[(ex.color || "").toLowerCase()] || "#666",
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{ex.name}</span>
                                {vid && (
                                  <button
                                    onClick={() => setOpenVideo(vid)}
                                    style={{
                                      background: "transparent",
                                      border: "1px solid rgba(255,255,255,0.18)",
                                      color: "#fff",
                                      fontFamily: "var(--cst-mono)",
                                      fontSize: 10,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  >
                                    ▶ VIDÉO
                                  </button>
                                )}
                              </div>
                              {(ex.equipement || ex.default_tempo) && (
                                <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 6 }}>
                                  {ex.equipement || ""}
                                  {ex.equipement && ex.default_tempo ? " · " : ""}
                                  {ex.default_tempo ? `tempo ${ex.default_tempo}` : ""}
                                </div>
                              )}
                              {ex.coach_notes && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    opacity: 0.85,
                                    fontStyle: "italic",
                                    marginTop: 8,
                                    background: "rgba(45,90,53,0.08)",
                                    borderLeft: "2px solid var(--cst-mid-green)",
                                    padding: "6px 10px",
                                    borderRadius: 3,
                                  }}
                                >
                                  {ex.coach_notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {openVideo && (
        <div
          onClick={() => setOpenVideo(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(880px, 100%)", aspectRatio: "16/9", background: "#000", borderRadius: 8, overflow: "hidden" }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${openVideo}?autoplay=1`}
              title="Démo"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      )}
      <MemberNav />
    </div>
  );
}
