import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import MemberNav from "../../components/MemberNav";
import { CSTSectionNum, CSTDuoTitle } from "../../components/Atoms";
import { ExerciseThread } from "../../components/cst/ExerciseThread";
import { getMemberCoachFeedback, type MemberFeedbackSession } from "@/lib/member-feedback.functions";

const DAY_LABELS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

function formatDate(iso: string | null): { day: string; label: string } {
  if (!iso) return { day: "--", label: "" };
  const d = new Date(iso);
  return { day: String(d.getDate()).padStart(2, "0"), label: DAY_LABELS[d.getDay()] };
}

export default function MemberFeedback() {
  const navigate = useNavigate();
  const fetchFeedback = useServerFn(getMemberCoachFeedback);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<MemberFeedbackSession[]>([]);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // La route vit sous le layout `_authenticated` qui garantit la session ;
        // on récupère juste l'uid pour le fil d'échange.
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { setLoading(false); return; }
        setUid(u.user.id);
        const res = await fetchFeedback();
        setSessions(res.sessions ?? []);
      } catch (e) {
        console.error("getMemberCoachFeedback failed", e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
        <div className="cst-screen" style={{ minHeight: "100vh" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 8px" }}>
            <button
              onClick={() => navigate({ to: "/membre" })}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 18, cursor: "pointer", padding: 0 }}
              aria-label="Retour"
            >
              ←
            </button>
            <span className="cst-mono" style={{ color: "#fff" }}>RETOURS DU COACH</span>
            <span style={{ width: 18 }} />
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "0 22px 90px" }}>
            <CSTSectionNum num={1} label="RETOURS DE LÉO" sub={`${sessions.length} SÉANCE${sessions.length > 1 ? "S" : ""}`} />
            <CSTDuoTitle top="LES RETOURS" bottom="de ton coach." size={34} color={undefined} />

            {loading ? (
              <div className="cst-mono" style={{ opacity: 0.5, fontSize: 11, padding: "24px 0" }}>CHARGEMENT…</div>
            ) : sessions.length === 0 ? (
              <div className="cst-card-dark" style={{ padding: 24, textAlign: "center", marginTop: 20 }}>
                <div className="cst-display" style={{ fontSize: 16, marginBottom: 8 }}>AUCUN RETOUR</div>
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
                  Ton coach n'a pas encore laissé de retour sur tes dernières séances. Envoie-lui une vidéo depuis une séance pour lancer l'échange.
                </p>
              </div>
            ) : (
              <div className="cst-col" style={{ gap: 16, marginTop: 20 }}>
                {sessions.map((s) => {
                  const { day, label: dow } = formatDate(s.date ?? s.endedAt);
                  const sem = s.weekNumber != null && s.dayNumber != null
                    ? `SEM ${String(s.weekNumber).padStart(2, "0")} · J${s.dayNumber}`
                    : null;
                  return (
                    <div key={s.id} className="cst-card-dark cst-hatch" style={{ padding: 16 }}>
                      {/* En-tête séance */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div className="cst-col" style={{ alignItems: "center", width: 38, flexShrink: 0 }}>
                          <span className="cst-display" style={{ fontSize: 18 }}>{day}</span>
                          <span className="cst-mono" style={{ fontSize: 8 }}>{dow}</span>
                        </div>
                        <div className="cst-col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className="cst-display" style={{ fontSize: 16 }}>{s.label.toUpperCase()}</span>
                            {s.unseen && (
                              <span className="cst-mono" style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "var(--cst-mid-green)", color: "#fff", letterSpacing: "0.14em" }}>
                                NOUVEAU
                              </span>
                            )}
                          </div>
                          {sem && <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>{sem}</span>}
                        </div>
                      </div>

                      {/* Mot du coach sur la séance */}
                      {s.coachNote && (
                        <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(45,90,53,0.14)", border: "1px solid rgba(110,171,118,0.3)", borderRadius: 8 }}>
                          <span className="cst-mono" style={{ fontSize: 8, color: "var(--cst-mid-green)", letterSpacing: "0.14em" }}>💬 MOT DE LÉO</span>
                          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.9)" }}>{s.coachNote}</p>
                        </div>
                      )}

                      {/* Fil par exercice (réponses coach + tes vidéos) */}
                      {uid && s.exercises.length > 0 && (
                        <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                          {s.exercises.map((ex) => (
                            <div key={ex} style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 12px" }}>
                              <span className="cst-display" style={{ fontSize: 13 }}>{ex.toUpperCase()}</span>
                              <ExerciseThread sessionId={s.id} exerciseName={ex} userId={uid} viewerRole="member" expandVideos />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lien vers la séance dans l'historique */}
                      <button
                        className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                        style={{ marginTop: 14, fontSize: 10 }}
                        onClick={() => navigate({ to: "/membre/historique" })}
                      >
                        VOIR LA SÉANCE →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
