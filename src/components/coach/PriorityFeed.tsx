import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPriorityFeed } from "@/lib/coach-dashboard.functions";
import { resolvePainReport } from "@/lib/pain-reports.functions";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

export default function PriorityFeed() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFeed = useServerFn(getPriorityFeed);
  const resolve = useServerFn(resolvePainReport);
  const { data, isLoading } = useQuery({ queryKey: ["coach", "priority"], queryFn: () => fetchFeed() });

  if (isLoading) {
    return <div className="cst-card-dark" style={{ padding: 20, opacity: 0.6 }}>Chargement…</div>;
  }
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <div className="cst-card-dark" style={{ padding: 22, textAlign: "center" }}>
        <div className="cst-display" style={{ fontSize: 18, marginBottom: 4 }}>RIEN À TRAITER</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Tes coachés sont à jour 💪</div>
      </div>
    );
  }

  async function onResolve(id: string) {
    try {
      await resolve({ data: { id } });
      toast.success("Marqué comme résolu");
      qc.invalidateQueries({ queryKey: ["coach"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="cst-card-dark" style={{ padding: 0, overflow: "hidden" }}>
      {items.map((it, idx) => {
        const isLast = idx === items.length - 1;
        const common = { borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" } as const;

        if (it.type === "pain") {
          const accent = it.intensity >= 4 ? "#C0392B" : "#E07B39";
          return (
            <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🔴</span>
                <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: accent }}>DOULEUR · {it.intensity}/5</span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>{it.memberName}</strong> · {it.exerciseName} — <span style={{ opacity: 0.85 }}>{it.zone}</span>
              </div>
              {it.comment && <div style={{ fontSize: 12, opacity: 0.75, fontStyle: "italic" }}>« {it.comment} »</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {it.sessionId && <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: it.sessionId! } })}>Voir la séance</button>}
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: it.memberId } })}>Fiche membre</button>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => onResolve(it.id)}>✓ Résoudre</button>
              </div>
            </div>
          );
        }
        if (it.type === "high_rpe") {
          return (
            <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🟠</span>
                <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#E07B39" }}>RPE ÉLEVÉ · {it.rpe}/10</span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>{it.memberName}</strong> · {it.exerciseName}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: it.sessionId } })}>Voir la séance</button>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: it.memberId } })}>Fiche membre</button>
              </div>
            </div>
          );
        }
        if (it.type === "video") {
          return (
            <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🎬</span>
                <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em" }}>VIDÉO À REVOIR</span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13 }}><strong>{it.memberName}</strong> · {it.exerciseName || "—"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: it.memberId } })}>Ouvrir</button>
              </div>
            </div>
          );
        }
        return (
          <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em" }}>MESSAGE</span>
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13 }}><strong>{it.memberName}</strong></div>
            <div style={{ fontSize: 12, opacity: 0.8, fontStyle: "italic" }}>« {it.content.slice(0, 140)}{it.content.length > 140 ? "…" : ""} »</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/messages" })}>Répondre</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
