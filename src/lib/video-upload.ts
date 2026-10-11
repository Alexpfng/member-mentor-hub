import { Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

// Supabase Free caps individual uploads at 50 MB (decimal), before any bucket limit.
export const MAX_VIDEO_BYTES = 50_000_000;
const VIDEO_EXTENSIONS = new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]);

export function isVideoFile(file: File): boolean {
  if (file.type) return file.type.startsWith("video/");
  const extension = file.name.split(".").pop()?.toLowerCase();
  return Boolean(extension && VIDEO_EXTENSIONS.has(extension));
}

export type VideoUploadProgress = (percent: number) => void;

export function getResumableUploadEndpoint(projectUrl: string): string {
  const url = new URL(projectUrl);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function videoUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("file size") ||
    normalized.includes("too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("maximum allowed size") ||
    (normalized.includes("size") && normalized.includes("exceeded"))
  ) {
    return "Vidéo trop lourde pour la limite de stockage. Choisis une vidéo plus courte ou de qualité réduite.";
  }
  if (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed")
  ) {
    return "Connexion interrompue. La vidéo reste disponible pour réessayer quand le réseau revient.";
  }
  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "L'envoi est bloqué par les droits de stockage. Réessaie et, si le problème persiste, préviens le coach.";
  }
  return message || "L'envoi de la vidéo a échoué. Réessaie.";
}

type UploadOptions = {
  bucket: string;
  path: string;
  file: File;
  projectUrl: string;
  accessToken: string;
  onProgress?: VideoUploadProgress;
};

export function buildTusVideoOptions({
  bucket,
  path,
  file,
  projectUrl,
  accessToken,
  onProgress,
  onError,
  onSuccess,
}: UploadOptions & {
  onError: (error: Error) => void;
  onSuccess: () => void;
}) {
  return {
    endpoint: getResumableUploadEndpoint(projectUrl),
    retryDelays: [0, 3000, 5000, 10000, 20000],
    chunkSize: 6 * 1024 * 1024,
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    headers: { authorization: `Bearer ${accessToken}` },
    metadata: {
      bucketName: bucket,
      objectName: path,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    },
    fingerprint: async (source: File) =>
      `${bucket}:${path}:${source.name}:${source.size}:${source.lastModified}`,
    onProgress: (sent: number, total: number) =>
      onProgress?.(total ? Math.round((sent / total) * 100) : 0),
    onError,
    onSuccess,
  };
}

export async function uploadVideoToStorage(
  bucket: string,
  path: string,
  file: File,
  onProgress?: VideoUploadProgress,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token)
    throw new Error("Session expirée. Reconnecte-toi puis réessaie.");

  const projectUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!projectUrl) throw new Error("Configuration du stockage indisponible.");
  await uploadVideoResumable({
    bucket,
    path,
    file,
    projectUrl,
    accessToken: data.session.access_token,
    onProgress,
  });
}

export async function removeUploadedVideo(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function uploadVideoResumable({
  bucket,
  path,
  file,
  projectUrl,
  accessToken,
  onProgress,
}: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new Upload(
      file,
      buildTusVideoOptions({
        bucket,
        path,
        file,
        projectUrl,
        accessToken,
        onProgress,
        onError: reject,
        onSuccess: () => {
          onProgress?.(100);
          resolve();
        },
      }),
    );

    void upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}
