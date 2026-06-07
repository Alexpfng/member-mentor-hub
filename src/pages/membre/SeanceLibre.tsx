import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listFreeActivities,
  listSessionMedia,
  addFreeActivity,
  deleteFreeActivity,
  deleteSessionMedia,
  updateMediaCaption,
  updateFreeSessionMeta,
  finishFreeSession,
} from "@/lib/free-session.functions";
import FreeActivityDialog, { type FreeActivityValues } from "@/components/cst/FreeActivityDialog";
import MediaUploader from "@/components/cst/MediaUploader";
import MediaGallery, { type MediaItem } from "@/components/cst/MediaGallery";
import PainReportDialog from "@/components/cst/PainReportDialog";
import { toast } from "sonner";

type Activity = {
  id: string;
  name: string;
  category: string | null;
  series: number | null;
  reps: string | null;
  charge: string | null;
  distance_km: number | null;
  duration_min: number | null;
  elevation_m: number | null;
  rpe: number | null;
  note: string | null;
};

const CATS: { key: string; label: string }[] = [
  { key: "muscu", label: "Muscu" },
  { key: "course", label: "Course" },
  { key: "cardio", label: "Cardio" },
  { key: "sport", label: "Sport" },
  { key: "mobilite", label: "Mobilité" },
  { key: "autre", label: "Autre" },
];

const FEELINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😴", label: "Épuisé" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "⚡", label: "En forme" },
  { value: 5, emoji: "🔥", label: "Excellent" },
];

export default function SeanceLibre() {
  const { sessionId } = useParams({ from: "/_authenticated/membre/seance-libre/$sessionId" });
  const navigate = useNavigate();

  const listActivities = useServerFn(listFreeActivities);
  const listMedia = useServerFn(listSessionMedia);
  const addActivity = useServerFn(addFreeActivity);
  const delActivity = useServerFn(deleteFreeActivity);
  const delMedia = useServerFn(deleteSessionMedia);
  const updCaption = useServerFn(updateMediaCaption);
  const updMeta = useServerFn(updateFreeSessionMeta);
  const finish = useServerFn(finishFreeSession);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("autre");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [note, setNote] = useState("");
  const [feeling, setFeeling] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    const [a, m] = await Promise.all([
      listActivities({ data: { sessionId } }),
      listMedia({ data: { sessionId } }),
    ]);
    setActivities(a as Activity[]);
    setMedia(m as MediaItem[]);
  }, [listActivities, listMedia, sessionId]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      const { data: s } = await supabase
        .from("sessions")
        .select("id, started_at, free_title, free_category, member_note, overall_feeling, average_rpe")
        .eq("id", sessionId)
        .maybeSingle();
      if (s) {
        setTitle(s.free_title ?? "");
        setCategory(s.free_category ?? "autre");
        setNote(s.member_note ?? "");
        setFeeling(s.overall_feeling ?? null);
        setRpe(s.average_rpe != null ? Number(s.average_rpe) : null);
        if (s.started_at) setStartedAt(new Date(s.started_at).getTime());
      }
      await reload();
      setLoading(false);
    })();
  }, [sessionId, reload]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  async function saveMeta(patch: { title?: string; category?: string }) {
    try {
      await updMeta({
        data: {
          sessionId,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.category !== undefined ? { category: patch.category as "muscu" | "course" | "cardio" | "sport" | "mobilite" | "autre" } : {}),
        },
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAdd(v: FreeActivityValues) {
    try {
      await addActivity({ data: { sessionId, activity: v } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleDeleteActivity(id: string) {
    if (!confirm("Supprimer cette activité ?")) return;
    try {
      await delActivity({ data: { id, sessionId } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleDeleteMedia(id: string) {
    try {
      await delMedia({ data: { id } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleCaption(id: string, caption: string) {
    try {
      await updCaption({ data: { id, caption } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await updMeta({
        data: {
          sessionId,
          title,
          category: category as "muscu" | "course" | "cardio" | "sport" | "mobilite" | "autre",
        },
      });
      await finish({
        data: {
          sessionId,
          overallFeeling: feeling,
          averageRpe: rpe,
          memberNote: note,
        },
      });
      toast.success("Séance libre envoyée à ton coach ✓");
      navigate({ to: "/membre" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)" }}>
        <span className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.18em" }}>CHARGEMENT…</span>
      </div>
    );
  }

  const activityName = activities[0]?.name ?? (title || "Séance libre");

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="cst-screen cst-hatch" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 8px" }}>
            <button
              onClick={() => navigate({ to: "/membre" })}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 18, cursor: "pointer", padding: 0 }}
              aria-label="Retour"
            >
              ←
            </button>
            <span className="cst-mono" style={{ color: "#fff", letterSpacing: "0.2em", fontSize: 11 }}>
              SÉANCE LIBRE
            </span>
            <span className="cst-mono" style={{ color: "#F5A623", fontSize: 11 }}>
              ⏱ {hh}:{mm}:{ss}
            </span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "8px 22px 120px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Type + titre */}
            <div>
              <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 8 }}>
                TYPE DE SÉANCE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {CATS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setCategory(c.key);
                      saveMeta({ category: c.key });
                    }}
                    className="cst-btn cst-btn-sm"
                    style={{
                      padding: "8px 6px",
                      fontSize: 11,
                      background: category === c.key ? "var(--cst-mid-green)" : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => saveMeta({ title })}
                placeholder="Titre (optionnel)"
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Activités */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em" }}>
                  CE QUE J'AI FAIT
                </span>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45 }}>
                  {activities.length} {activities.length > 1 ? "ACTIVITÉS" : "ACTIVITÉ"}
                </span>
              </div>
              <div className="cst-col" style={{ gap: 6 }}>
                {activities.map((a) => {
                  const bits: string[] = [];
                  if (a.series) bits.push(`${a.series} séries`);
                  if (a.reps) bits.push(`${a.reps} reps`);
                  if (a.charge) bits.push(a.charge);
                  if (a.distance_km != null) bits.push(`${a.distance_km} km`);
                  if (a.duration_min != null) bits.push(`${a.duration_min} min`);
                  if (a.elevation_m != null) bits.push(`${a.elevation_m} m D+`);
                  if (a.rpe != null) bits.push(`RPE ${a.rpe}`);
                  return (
                    <div
                      key={a.id}
                      className="cst-card-dark"
                      style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cst-display" style={{ fontSize: 14 }}>{a.name.toUpperCase()}</div>
                        {bits.length > 0 && (
                          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.65, marginTop: 3 }}>
                            {bits.join(" · ")}
                          </div>
                        )}
                        {a.note && (
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7, fontStyle: "italic" }}>
                            « {a.note} »
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteActivity(a.id)}
                        style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16, padding: 0 }}
                        aria-label="Supprimer"
                      >
                        🗑
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => setDialogOpen(true)}
                  className="cst-btn cst-btn-ghost-dark"
                  style={{ width: "100%", padding: "12px 14px" }}
                >
                  + AJOUTER UNE ACTIVITÉ
                </button>
              </div>
            </div>

            {/* Notes pour le coach */}
            <div>
              <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 8 }}>
                NOTES POUR LE COACH
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Raconte ta séance, le contexte, les sensations…"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 13,
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Pièces jointes */}
            <div>
              <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 8 }}>
                PIÈCES JOINTES
              </div>
              {userId && (
                <MediaUploader sessionId={sessionId} memberId={userId} onUploaded={reload} />
              )}
              <div style={{ marginTop: 10 }}>
                <MediaGallery items={media} onDelete={handleDeleteMedia} onUpdateCaption={handleCaption} />
              </div>
            </div>

            {/* Ressenti + RPE */}
            <div>
              <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 8 }}>
                RESSENTI
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {FEELINGS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFeeling(f.value)}
                    style={{
                      padding: "10px 4px",
                      borderRadius: 8,
                      border: feeling === f.value ? "1px solid var(--cst-mid-green)" : "1px solid rgba(255,255,255,0.1)",
                      background: feeling === f.value ? "rgba(110,171,118,0.15)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{f.emoji}</span>
                    <span className="cst-mono" style={{ fontSize: 8, opacity: 0.75 }}>{f.label.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 8 }}>
                RPE GLOBAL {rpe != null ? `· ${rpe}/10` : ""}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRpe(n)}
                    style={{
                      padding: "10px 0",
                      borderRadius: 4,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: rpe != null && rpe >= n ? (n >= 9 ? "#C0392B" : n >= 7 ? "#E07B39" : "var(--cst-mid-green)") : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Douleur */}
            <button
              onClick={() => setPainOpen(true)}
              className="cst-btn cst-btn-ghost-dark"
              style={{ width: "100%", borderColor: "rgba(192,57,43,0.45)", color: "#ff8a7a" }}
            >
              😣 SIGNALER UNE GÊNE
            </button>

            {/* Action finale */}
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="cst-btn cst-btn-primary"
              style={{ width: "100%", padding: "16px 0", fontSize: 13, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "ENVOI…" : "TERMINER ET ENVOYER AU COACH →"}
            </button>
          </div>
        </div>
      </div>

      <FreeActivityDialog
        open={dialogOpen}
        defaultCategory={category}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAdd}
      />

      <PainReportDialog
        open={painOpen}
        onClose={() => setPainOpen(false)}
        sessionId={sessionId}
        exerciseName={activityName}
      />
    </div>
  );
}
