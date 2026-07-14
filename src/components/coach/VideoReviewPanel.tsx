/* Coach side — review videos uploaded by a member */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMemberVideos, markVideoReviewed } from "@/lib/videos.functions";
import { ExerciseThread } from "../cst/ExerciseThread";

type V = {
  id: string;
  session_id: string;
  exercise_name: string;
  storage_path: string;
  created_at: string;
  coach_reviewed: boolean;
};

export function VideoReviewPanel({
  memberId,
  coachUserId,
  initialVideoId,
}: {
  memberId: string;
  coachUserId: string;
  initialVideoId?: string;
}) {
  const fetchVideos = useServerFn(listMemberVideos);
  const review = useServerFn(markVideoReviewed);
  const [videos, setVideos] = useState<V[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const v = await fetchVideos({ data: { memberId } });
      setVideos(v as V[]);
      return v as V[];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().then((v) => {
      // Deep link (?video=…) : déplie directement le fil de la vidéo ciblée.
      if (!initialVideoId) return;
      const target = (v ?? []).find(x => x.id === initialVideoId);
      if (target) setOpenKey(`${target.session_id}::${target.exercise_name}`);
    });
    // eslint-disable-next-line
  }, [memberId, initialVideoId]);

  async function markDone(id: string) {
    await review({ data: { videoId: id } });
    await load();
  }

  if (loading) return <div style={{ padding: 18, opacity: 0.5, fontSize: 12 }}>Chargement…</div>;
  if (!videos.length) {
    return (
      <div className="cst-card-dark" style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>
        Aucune vidéo envoyée par ce coaché pour le moment.
      </div>
    );
  }

  const unreviewed = videos.filter(v => !v.coach_reviewed).length;

  return (
    <div className="cst-col" style={{ gap: 10 }}>
      {unreviewed > 0 && (
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.7, color: "#D4A53B" }}>
          ⚠ {unreviewed} vidéo{unreviewed > 1 ? "s" : ""} à revoir
        </div>
      )}
      {videos.map(v => {
        const key = `${v.session_id}::${v.exercise_name}`;
        const open = openKey === key;
        return (
          <div key={v.id} className="cst-card-dark" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setOpenKey(open ? null : key)}
              style={{
                width: "100%", padding: "14px 18px",
                background: "transparent", border: "none", color: "#fff",
                display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div className="cst-mono" style={{ width: 90, fontSize: 10 }}>
                {new Date(v.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cst-display" style={{ fontSize: 14 }}>{v.exercise_name.toUpperCase()}</div>
                <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                  {new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              {!v.coach_reviewed && (
                <span className="cst-mono" style={{ fontSize: 8, padding: "3px 8px", borderRadius: 3, background: "rgba(212,165,59,0.2)", color: "#D4A53B" }}>
                  À REVOIR
                </span>
              )}
              <span style={{ opacity: 0.5 }}>{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div style={{ padding: "0 18px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <ExerciseThread
                  sessionId={v.session_id}
                  exerciseName={v.exercise_name}
                  userId={coachUserId}
                  viewerRole="coach"
                />
                {!v.coach_reviewed && (
                  <button
                    onClick={() => markDone(v.id)}
                    className="cst-btn cst-btn-primary cst-btn-sm"
                    style={{ marginTop: 12 }}
                  >
                    ✓ MARQUER COMME REVU
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
