import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { attachSessionMedia } from "@/lib/free-session.functions";
import { toast } from "sonner";
import {
  isVideoFile,
  MAX_VIDEO_BYTES,
  removeUploadedVideo,
  uploadVideoToStorage,
  videoUploadError,
} from "@/lib/video-upload";

const MAX_BYTES = MAX_VIDEO_BYTES;
const MAX_IMAGE_BYTES = 100 * 1024 * 1024;

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
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timeout = window.setTimeout(() => finish(null), 8000);
    try {
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(1, (video.duration || 1) / 2);
        } catch {
          finish(null);
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
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.8);
      };
      video.onerror = () => finish(null);
    } catch {
      finish(null);
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

  async function uploadOne(file: File, onProgress: (percent: number) => void) {
    const isVideo = isVideoFile(file);
    if (file.size > (isVideo ? MAX_BYTES : MAX_IMAGE_BYTES)) {
      throw new Error(
        isVideo
          ? `${file.name} dépasse la limite de 50 Mo. Choisis une vidéo plus courte ou de qualité réduite.`
          : `${file.name} dépasse la limite de 100 Mo.`,
      );
    }
    const type: "photo" | "video" = isVideo ? "video" : "photo";
    const path = `${memberId}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
    let thumbPath: string | null = null;
    let uploaded = false;
    try {
      if (isVideo) {
        await uploadVideoToStorage("session-media", path, file, onProgress);
      } else {
        const { error: upErr } = await supabase.storage
          .from("session-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        onProgress(100);
      }
      uploaded = true;
      if (isVideo) {
        const thumb = await videoThumbnail(file);
        if (thumb) {
          thumbPath = `${memberId}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-thumb.jpg`;
          const { error: thumbError } = await supabase.storage
            .from("session-media")
            .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
          if (thumbError) thumbPath = null;
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
    } catch (error) {
      if (uploaded) {
        try {
          if (isVideo) await removeUploadedVideo("session-media", path);
          else await supabase.storage.from("session-media").remove([path]);
          if (thumbPath) await supabase.storage.from("session-media").remove([thumbPath]);
        } catch {
          // Keep the upload or database error visible.
        }
      }
      throw error;
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    setProgress(0);
    try {
      let i = 0;
      const selected = Array.from(files);
      for (const [index, f] of selected.entries()) {
        await uploadOne(f, (fileProgress) => {
          setProgress(Math.round(((index + fileProgress / 100) / selected.length) * 100));
        });
        i += 1;
        setProgress(Math.round((i / selected.length) * 100));
      }
      onUploaded();
      toast.success(files.length > 1 ? `${files.length} fichiers envoyés` : "Fichier envoyé");
    } catch (e) {
      console.error(e);
      toast.error(videoUploadError(e));
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
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
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
