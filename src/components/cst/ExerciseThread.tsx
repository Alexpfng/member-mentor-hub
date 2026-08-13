/* ColosmartTraining — Fil de discussion + vidéos par exercice */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getExerciseThread,
  postExerciseComment,
  getSignedVideoUrl,
} from "@/lib/videos.functions";
import { useTechniqueUploadQueue, MAX_VIDEO_BYTES, tooLargeMessage } from "./TechniqueUploadQueue";
import { VideoRecorder } from "./VideoRecorder";

type Video = {
  id: string;
  exercise_name: string;
  storage_path: string;
  thumbnail_url: string | null;
  created_at: string;
  coach_reviewed: boolean;
  unread_for_member?: boolean;
  member_id: string;
};

type Comment = {
  id: string;
  content: string;
  author_id: string;
  author_role: "coach" | "member";
  created_at: string;
  video_id: string | null;
};

export function ExerciseThread({
  sessionId,
  exerciseName,
  userId,
  viewerRole = "member",
  expandVideos = false,
}: {
  sessionId: string;
  exerciseName: string;
  userId: string;
  viewerRole?: "coach" | "member";
  // Lecture directe : affiche le lecteur vidéo déplié d'emblée (sans clic).
  // Utilisé dans le détail de séance côté coach.
  expandVideos?: boolean;
}) {
  const fetchThread = useServerFn(getExerciseThread);
  const postComment = useServerFn(postExerciseComment);
  const sign = useServerFn(getSignedVideoUrl);

  const [videos, setVideos] = useState<Video[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);

  // Présent uniquement pendant une séance live : on diffère alors l'envoi des vidéos
  // en fin de séance (voir TechniqueUploadQueue). Ailleurs (revue post-séance), null.
  const queue = useTechniqueUploadQueue();
  const pending = queue?.forExercise(exerciseName) ?? [];

  async function load() {
    try {
      const res = await fetchThread({ data: { sessionId, exerciseName } });
      const vids = res.videos as Video[];
      setVideos(vids);
      setComments(res.comments as Comment[]);
      // Lecture directe : précharge les URLs signées pour afficher le lecteur
      // sans que le coach ait à déplier chaque vidéo.
      if (expandVideos && vids.length > 0) {
        const entries = await Promise.all(
          vids.map(async (v) => {
            try {
              const r = await sign({ data: { storagePath: v.storage_path } });
              return [v.id, r.url] as const;
            } catch {
              return null;
            }
          }),
        );
        setSigned((s) => {
          const next = { ...s };
          for (const e of entries) if (e) next[e[0]] = e[1];
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sessionId, exerciseName]);

  async function openVideo(v: Video) {
    setOpenVideoId(v.id);
    if (signed[v.id]) return;
    try {
      const res = await sign({ data: { storagePath: v.storage_path } });
      setSigned(s => ({ ...s, [v.id]: res.url }));
    } catch (e) {
      console.error(e);
    }
  }

  // Vidéo choisie : garde-fou taille (plan gratuit = 50 Mo), puis soit on la met en
  // file d'attente (séance live → envoi groupé en fin de séance), soit upload immédiat.
  function handlePicked(file: File) {
    setUploadErr(null);
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadErr(tooLargeMessage(file.size));
      return;
    }
    if (queue) {
      const res = queue.add(exerciseName, file);
      if (!res.ok) setUploadErr(res.error || "Vidéo refusée");
      return;
    }
    void uploadFileImmediate(file);
  }

  async function uploadFileImmediate(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const ts = Date.now();
      const safe = exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${userId}/${sessionId}/${safe}-${ts}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("technique-videos")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("technique_videos").insert({
        member_id: userId,
        session_id: sessionId,
        exercise_name: exerciseName,
        storage_path: path,
      });
      if (insErr) throw insErr;
      await load();
    } catch (e) {
      setUploadErr((e as Error).message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  async function sendComment() {
    const c = content.trim();
    if (!c || posting) return;
    setPosting(true);
    try {
      await postComment({
        data: { sessionId, exerciseName, content: c, videoId: openVideoId },
      });
      setContent("");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  }

  const isCoachView = viewerRole === "coach";
  const memberLabel = isCoachView ? "Coaché" : "Toi";

  return (
    <div style={{
      borderTop: "1px dashed rgba(255,255,255,0.12)",
      paddingTop: 12, marginTop: 4,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.16em" }}>
        TECHNIQUE & ÉCHANGES COACH
      </div>

      {/* Upload row (member only) */}
      {!isCoachView && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Filmer dans l'app = qualité bridée → reste sous 50 Mo (voir VideoRecorder). */}
          <button
            type="button"
            onClick={() => setRecorderOpen(true)}
            disabled={uploading}
            className="cst-mono"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 12px", borderRadius: 6, cursor: uploading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.18)",
              color: "rgba(255,255,255,0.75)", fontSize: 11, letterSpacing: "0.14em",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            🎥 FILMER (optimisé, sous 50 Mo)
          </button>
          <UploadBtn icon="📁" label={uploading ? "ENVOI…" : "ou importer un fichier"} onFile={handlePicked} disabled={uploading} />
          {/* Séance live : vidéos choisies, en attente d'un envoi groupé en fin de séance */}
          {pending.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              background: "rgba(45,90,53,0.14)", border: "1px solid rgba(45,90,53,0.35)",
              fontSize: 11, color: "rgba(255,255,255,0.85)",
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                🎬 En attente d'envoi · {p.sizeMB} Mo
                {p.error && <span style={{ color: "#C56A60" }}> — {p.error}</span>}
              </span>
              <button
                type="button"
                onClick={() => queue?.remove(p.id)}
                aria-label="Retirer la vidéo"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
          {queue && pending.length > 0 && (
            <div style={{ fontSize: 10, opacity: 0.6 }}>
              Envoi groupé à Léo en fin de séance (bouton en bas de l'écran).
            </div>
          )}
        </div>
      )}
      {uploadErr && <div style={{ color: "#C56A60", fontSize: 11 }}>{uploadErr}</div>}

      {!isCoachView && (
        <VideoRecorder
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          onRecorded={(f) => {
            setRecorderOpen(false);
            handlePicked(f);
          }}
        />
      )}

      {/* Videos gallery */}
      {videos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {videos.map(v => {
            const open = expandVideos || openVideoId === v.id;
            return (
            <div key={v.id} style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}>
              <button onClick={() => openVideo(v)} style={{
                width: "100%", padding: "8px 10px", display: "flex",
                alignItems: "center", justifyContent: "space-between", gap: 8,
                background: "transparent", border: "none", color: "#fff",
                cursor: expandVideos ? "default" : "pointer", textAlign: "left",
              }}>
                <span style={{ fontFamily: "var(--cst-mono)", fontSize: 10 }}>
                  🎥 {new Date(v.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {!v.coach_reviewed && isCoachView && (
                    <span className="cst-mono" style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(212,165,59,0.2)", color: "#D4A53B" }}>À REVOIR</span>
                  )}
                  {v.unread_for_member && !isCoachView && (
                    <span className="cst-mono" style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(45,90,53,0.3)", color: "#6EAB76" }}>NOUVEAU</span>
                  )}
                  {!expandVideos && <span style={{ opacity: 0.5, fontSize: 11 }}>{open ? "▾" : "▸"}</span>}
                </span>
              </button>
              {open && signed[v.id] && (
                <video src={signed[v.id]} controls playsInline style={{ width: "100%", maxHeight: 360, background: "#000", display: "block" }} />
              )}
              {open && !signed[v.id] && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, opacity: 0.6 }}>Chargement…</div>
              )}
            </div>
          );})}
        </div>
      )}

      {/* Comments thread */}
      {comments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map(c => {
            const mine = c.author_id === userId;
            const isCoach = c.author_role === "coach";
            return (
              <div key={c.id} style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "8px 10px",
                borderRadius: 10,
                background: isCoach ? "rgba(45,90,53,0.22)" : "rgba(255,255,255,0.06)",
                border: isCoach ? "1px solid rgba(45,90,53,0.45)" : "1px solid rgba(255,255,255,0.08)",
                fontSize: 12, lineHeight: 1.45, color: "#fff",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                <div className="cst-mono" style={{ fontSize: 8, opacity: 0.55, letterSpacing: "0.14em", marginBottom: 3 }}>
                  {isCoach ? "COACH LÉO" : memberLabel} · {new Date(c.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
                {c.content}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div style={{ display: "flex", gap: 6 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={isCoachView ? "Conseil pour le coaché…" : "Écris à Léo…"}
          rows={2}
          style={{
            flex: 1, resize: "none",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "8px 10px",
            color: "#fff", fontSize: 12, fontFamily: "inherit",
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment();
          }}
        />
        <button
          onClick={sendComment}
          disabled={posting || !content.trim()}
          style={{
            padding: "0 14px",
            borderRadius: 6, border: "1px solid var(--cst-mid-green)",
            background: "rgba(45,90,53,0.25)", color: "#fff",
            fontFamily: "var(--cst-mono)", fontSize: 10, letterSpacing: "0.12em",
            cursor: posting || !content.trim() ? "not-allowed" : "pointer",
            opacity: posting || !content.trim() ? 0.5 : 1,
          }}
        >ENVOYER</button>
      </div>
    </div>
  );
}

function UploadBtn({
  icon, label, disabled, onFile,
}: {
  icon: string; label: string; disabled?: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "10px 12px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
      background: "rgba(255,255,255,0.04)",
      border: "1px dashed rgba(255,255,255,0.18)",
      color: "rgba(255,255,255,0.75)",
      fontSize: 11, fontFamily: "var(--cst-mono)", letterSpacing: "0.14em",
      opacity: disabled ? 0.5 : 1,
    }}>
      <span>{icon}</span><span>{label}</span>
      <input
        ref={ref}
        type="file" accept="video/*"
        style={{ display: "none" }}
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
      />
    </label>
  );
}
