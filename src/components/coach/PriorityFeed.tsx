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
  // Group high_rpe + session items by memberId → 1 card per member
  const rawItems = data ?? [];
  type SessionEntry = { sessionId: string; createdAt: string; exercises: { name: string; rpe: number }[]; maxRpe: number; label?: string | null };
  type MemberGroup = { type: 'member_group'; id: string; memberId: string; memberName: string; sessions: SessionEntry[]; maxRpe: number; createdAt: string; priority: number };
  const memberGroupMap = new Map<string, MemberGroup>();
  const items: (typeof rawItems[number] | MemberGroup)[] = [];

  function getOrCreateMemberGroup(it: { memberId: string; memberName: string; priority: number; createdAt: string }): MemberGroup {
    if (!memberGroupMap.has(it.memberId)) {
      const g: MemberGroup = { type: 'member_group', id: `mg-${it.memberId}`, memberId: it.memberId, memberName: it.memberName, sessions: [], maxRpe: 0, createdAt: it.createdAt, priority: it.priority };
      memberGroupMap.set(it.memberId, g);
      items.push(g);
    }
    return memberGroupMap.get(it.memberId)!;
  }

  for (const it of rawItems) {
    if (it.type === 'high_rpe') {
      const g = getOrCreateMemberGroup(it);
      let sess = g.sessions.find(s => s.sessionId === it.sessionId);
      if (!sess) { sess = { sessionId: it.sessionId, createdAt: it.createdAt, exercises: [], maxRpe: 0 }; g.sessions.push(sess); }
      sess.exercises.push({ name: it.exerciseName, rpe: it.rpe });
      sess.maxRpe = Math.max(sess.maxRpe, it.rpe);
      g.maxRpe = Math.max(g.maxRpe, it.rpe);
      if (it.createdAt > g.createdAt) g.createdAt = it.createdAt;
    } else if (it.type === 'session') {
      const g = getOrCreateMemberGroup(it);
      if (!g.sessions.find(s => s.sessionId === it.sessionId)) {
        g.sessions.push({ sessionId: it.sessionId, createdAt: it.createdAt, exercises: [], maxRpe: it.rpe ?? 0, label: it.label });
        g.maxRpe = Math.max(g.maxRpe, it.rpe ?? 0);
        if (it.createdAt > g.createdAt) g.createdAt = it.createdAt;
      }
    } else {
      items.push(it);
    }
  }

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
        if (it.type === "member_group") {
          const totalSessions = it.sessions.length;
          const totalExercises = it.sessions.reduce((n, s) => n + s.exercises.length, 0);
          const hasRpe = it.sessions.some(s => s.exercises.length > 0);
          return (
            <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{hasRpe ? "🟠" : "🏋️"}</span>
                {hasRpe
                  ? <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#E07B39" }}>RPE ÉLEVÉ · {it.maxRpe}/10</span>
                  : <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.8 }}>SÉANCE{totalSessions > 1 ? 'S' : ''} À VOIR</span>
                }
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                  {totalSessions} SÉANCE{totalSessions > 1 ? 'S' : ''}{totalExercises > 0 ? ` · ${totalExercises} EX.` : ''}
                </span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.memberName}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {it.sessions.map((sess, si) => (
                  <div key={sess.sessionId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: sess.exercises.length > 0 ? 5 : 0 }}>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{sess.label || `Séance ${si + 1}`}</span>
                      {sess.maxRpe > 0 && <span className="cst-mono" style={{ fontSize: 9, color: "#E07B39" }}>RPE {sess.maxRpe}</span>}
                      <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ padding: "2px 8px", fontSize: 10 }}
                        onClick={() => navigate({ to: "/coach/seance/$sessionId", params: { sessionId: sess.sessionId } })}>Voir →</button>
                    </div>
                    {sess.exercises.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {sess.exercises.map((e, i) => (
                          <span key={i} style={{ fontSize: 10, background: "rgba(224,123,57,0.1)", border: "1px solid rgba(224,123,57,0.22)", borderRadius: 4, padding: "1px 6px", opacity: 0.85 }}>
                            {e.name} <span style={{ color: "#E07B39" }}>{e.rpe}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ alignSelf: "flex-start" }}
                onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: it.memberId } })}>Fiche membre</button>
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
        if (it.type !== "message") return null;
        const msgContent = (it as unknown as { content: string }).content;
        return (
          <div key={it.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, ...common }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span className="cst-mono" style={{ fontSize: 10, letterSpacing: "0.18em" }}>MESSAGE</span>
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: "auto" }}>{timeAgo(it.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13 }}><strong>{it.memberName}</strong></div>
            <div style={{ fontSize: 12, opacity: 0.8, fontStyle: "italic" }}>« {msgContent.slice(0, 140)}{msgContent.length > 140 ? "…" : ""} »</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach/messages" })}>Répondre</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
