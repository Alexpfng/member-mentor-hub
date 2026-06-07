import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { attachSessionMedia } from "@/lib/free-session.functions";
import { toast } from "sonner";

const MAX_BYTES = 100 * 1024 * 1024; // 100 Mo

type Props = {
  sessionId: string;
  memberId: string;
  onUploaded: () => void;
};

function extOf(file: File) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  return (m?.[1] ?? "bin").toLowerCase();
}

async function videoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(1, (video.duration || 1) / 2);
        } catch {
          resolve(null);
        }
      };
      video.onseeked = () => {
        const w = Math.min(640, video.videoWidth || 640);
        const h = Math.round(((video.videoHeight || 360) / (video.videoWidth || 640)) * w);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          resolve(b);
        }, "image/jpeg", 0.8);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export default function MediaUploader({ sessionId, memberId, onUploaded }: Props) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const attach = useServerFn(attachSessionMedia);

  async function uploadOne(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} dépasse 100 Mo`);
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const type: "photo" | "video" = isVideo ? "video" : "photo";
    const path = `${memberId}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
    const { error: upErr } = await supabase.storage
      .from("session-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    let thumbPath: string | null = null;
    if (isVideo) {
      const thumb = await videoThumbnail(file);
      if (thumb) {
        thumbPath = `${memberId}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-thumb.jpg`;
        await supabase.storage
          .from("session-media")
          .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
      }
    }

    await attach({
      data: {
        sessionId,
        type,
        storagePath: path,
        thumbnailPath: thumbPath,
      },
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setProgress(0);
    try {
      let i = 0;
      for (const f of Array.from(files)) {
        await uploadOne(f);
        i += 1;
        setProgress(Math.round((i / files.length) * 100));
      }
      onUploaded();
      toast.success(files.length > 1 ? `${files.length} fichiers envoyés` : "Fichier envoyé");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur d'upload");
    } finally {
      setUploading(false);
      setProgress(0);
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <button
          type="button"
          className="cst-btn cst-btn-ghost-dark"
          onClick={() => photoRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: 11 }}
        >
          📷 PHOTO
        </button>
        <button
          type="button"
          className="cst-btn cst-btn-ghost-dark"
          onClick={() => videoRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: 11 }}
        >
          🎥 VIDÉO
        </button>
        <button
          type="button"
          className="cst-btn cst-btn-ghost-dark"
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: 11 }}
        >
          🖼 STATS / GALERIE
        </button>
      </div>
      {uploading && (
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
          ENVOI… {progress}%
        </div>
      )}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
