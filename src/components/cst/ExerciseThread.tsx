/* ColosmartTraining — Fil de discussion + vidéos par exercice */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getExerciseThread,
  postExerciseComment,
  getSignedVideoUrl,
} from "@/lib/videos.functions";

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
}: {
  sessionId: string;
  exerciseName: string;
  userId: string;
  viewerRole?: "coach" | "member";
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

  async function load() {
    try {
      const res = await fetchThread({ data: { sessionId, exerciseName } });
      setVideos(res.videos as Video[]);
      setComments(res.comments as Comment[]);
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

  async function uploadFile(file: File) {
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
    } catch (e: any) {
      setUploadErr(e.message || "Erreur upload");
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
        <div style={{ display: "flex", gap: 8 }}>
          <UploadBtn icon="🎬" label={uploading ? "ENVOI…" : "FILMER"} capture onFile={uploadFile} disabled={uploading} />
          <UploadBtn icon="📁" label="IMPORTER" onFile={uploadFile} disabled={uploading} />
        </div>
      )}
      {uploadErr && <div style={{ color: "#C56A60", fontSize: 11 }}>{uploadErr}</div>}

      {/* Videos gallery */}
      {videos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {videos.map(v => (
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
                cursor: "pointer", textAlign: "left",
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
                  <span style={{ opacity: 0.5, fontSize: 11 }}>{openVideoId === v.id ? "▾" : "▸"}</span>
                </span>
              </button>
              {openVideoId === v.id && signed[v.id] && (
                <video src={signed[v.id]} controls playsInline style={{ width: "100%", maxHeight: 360, background: "#000", display: "block" }} />
              )}
              {openVideoId === v.id && !signed[v.id] && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, opacity: 0.6 }}>Chargement…</div>
              )}
            </div>
          ))}
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
  icon, label, capture, disabled, onFile,
}: {
  icon: string; label: string; capture?: boolean; disabled?: boolean;
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
        {...(capture ? { capture: "environment" as any } : {})}
        style={{ display: "none" }}
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
      />
    </label>
  );
}
