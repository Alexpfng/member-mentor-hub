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
const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const accentOf = (ex: Ex) => COLOR_MAP[(ex.color || "").toLowerCase()] || "var(--cst-mid-green)";

// Vignette d'exercice : miniature vidéo si dispo, sinon placeholder coloré.
function Tile({ ex, onClick }: { ex: Ex; onClick: () => void }) {
  const vid = ytId(ex);
  const [imgOk, setImgOk] = useState(true);
  const accent = accentOf(ex);
  const showImg = vid && imgOk;
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        textAlign: "left",
        padding: 0,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: showImg ? "#111" : `linear-gradient(135deg, ${accent}33, rgba(0,0,0,0.4))` }}>
        {showImg ? (
          <img
            src={ytThumb(vid!)}
            alt=""
            onError={() => setImgOk(false)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, opacity: 0.85 }}>🏋️</div>
        )}
        {/* pastille couleur d'intensité */}
        <span style={{ position: "absolute", top: 8, left: 8, width: 10, height: 10, borderRadius: "50%", background: accent, boxShadow: "0 0 0 2px rgba(0,0,0,0.4)" }} />
        {/* badge play si vidéo */}
        {vid && (
          <span style={{ position: "absolute", bottom: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>▶</span>
        )}
        {/* bandeau sombre franc pour que le nom reste BLANC et lisible sur toute photo (même fond clair) */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "30px 10px 9px", background: "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.82) 55%, transparent 100%)" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}>{ex.name}</span>
        </div>
      </div>
    </button>
  );
}

export default function Bibliotheque() {
  const fetchLib = useServerFn(listLibraryForMember);
  const [items, setItems] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tout");
  const [active, setActive] = useState<Ex | null>(null);

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

  const groupsList = useMemo(() => {
    const set = new Set<string>();
    for (const e of items) set.add(e.muscle_group?.trim() || "Autres");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      const grp = e.muscle_group?.trim() || "Autres";
      if (filter !== "Tout" && grp !== filter) return false;
      if (q && !e.name.toLowerCase().includes(q) && !grp.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter]);

  const activeVid = active ? ytId(active) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "18px 22px 8px" }}>
            <h1 className="cst-display" style={{ fontSize: 26, margin: 0, color: "#fff" }}>
              BIBLIOTHÈQUE <span style={{ color: "var(--cst-mid-green)" }}>EXERCICES</span>
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.7 }}>
              Touche un exercice pour voir la vidéo et les consignes.
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Rechercher un exercice…"
              className="cst-input"
              style={{ width: "100%", marginTop: 12, padding: "10px 12px", fontSize: 14 }}
            />
            {/* Pastilles de filtre par partie du corps */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {["Tout", ...groupsList].map((g) => {
                const on = filter === g;
                return (
                  <button
                    key={g}
                    onClick={() => setFilter(g)}
                    className="cst-mono"
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--cst-mid-green)" : "rgba(255,255,255,0.15)"}`,
                      background: on ? "var(--cst-mid-green)" : "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "8px 22px 90px" }}>
            {loading ? (
              <div style={{ padding: 24, opacity: 0.6 }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, opacity: 0.6, fontSize: 13 }}>Aucun exercice trouvé.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {filtered.map((ex) => (
                  <Tile key={ex.id} ex={ex} onClick={() => setActive(ex)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fiche détail */}
      {active && (
        <div
          onClick={() => setActive(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: "#1B2E1F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: accentOf(active), flexShrink: 0 }} />
              <h2 className="cst-display" style={{ margin: 0, fontSize: 20, color: "#fff", flex: 1 }}>{active.name}</h2>
              <button onClick={() => setActive(null)} style={{ background: "none", border: 0, color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {activeVid ? (
              <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: 10, overflow: "hidden" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${activeVid}`}
                  title={active.name}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: 0 }}
                />
              </div>
            ) : (
              <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, background: `linear-gradient(135deg, ${accentOf(active)}33, rgba(0,0,0,0.4))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🏋️</div>
            )}

            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 12, letterSpacing: "0.1em" }}>
              {(active.muscle_group || "Autres").toUpperCase()}
              {active.equipement ? ` · ${active.equipement}` : ""}
              {active.default_tempo ? ` · TEMPO ${active.default_tempo}` : ""}
            </div>

            {active.coach_notes ? (
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5, marginTop: 12, background: "rgba(45,90,53,0.12)", borderLeft: "2px solid var(--cst-mid-green)", padding: "10px 12px", borderRadius: 4 }}>
                {active.coach_notes}
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 12 }}>Pas de consigne pour cet exercice.</div>
            )}
          </div>
        </div>
      )}

      <MemberNav />
    </div>
  );
}
