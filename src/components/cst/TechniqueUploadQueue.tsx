/* ColosmartTraining — File d'attente des vidéos technique (envoi groupé en fin de séance)
 *
 * Pourquoi : filmer un exercice puis uploader la vidéo TOUT DE SUITE, pendant la séance,
 * ajoute du temps de repos (l'upload tourne entre les séries) et casse souvent sur mobile
 * quand l'écran se verrouille (« Load failed »). Les coachés préfèrent choisir leurs vidéos
 * pendant la séance et TOUT envoyer d'un coup à la fin (au calme, en Wi-Fi).
 *
 * Ce Context tient la file d'attente au niveau de la séance. `ExerciseThread` y ajoute les
 * vidéos choisies (au lieu d'uploader), et une barre flottante « Envoyer à Léo » déclenche
 * l'upload séquentiel de tout le lot. En dehors d'une séance live (revue post-séance, vues
 * coach), le Context est absent → `ExerciseThread` retombe sur l'upload immédiat.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Plan Supabase gratuit : chaque upload est plafonné à 50 Mo (non modifiable).
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function humanMB(bytes: number): number {
  return Math.round((bytes / 1048576) * 10) / 10;
}

export function tooLargeMessage(bytes: number): string {
  return `Vidéo trop lourde (${humanMB(bytes)} Mo). Max 50 Mo — filme plus court ou en qualité réduite.`;
}

export type PendingVideo = {
  id: string;
  exerciseName: string;
  file: File;
  sizeMB: number;
  error?: string | null;
};

type QueueApi = {
  items: PendingVideo[];
  /** Ajoute une vidéo à la file (garde-fou taille). */
  add: (exerciseName: string, file: File) => { ok: boolean; error?: string };
  remove: (id: string) => void;
  uploadAll: () => Promise<void>;
  uploading: boolean;
  progress: { done: number; total: number } | null;
  sentCount: number;
  forExercise: (name: string) => PendingVideo[];
};

const Ctx = createContext<QueueApi | null>(null);

/** Renvoie l'API de file d'attente si on est dans une séance live, sinon `null`. */
export function useTechniqueUploadQueue(): QueueApi | null {
  return useContext(Ctx);
}

let seq = 0;

export function TechniqueUploadQueueProvider({
  sessionId,
  userId,
  children,
}: {
  sessionId: string;
  userId: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<PendingVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const add = useCallback((exerciseName: string, file: File) => {
    if (file.size > MAX_VIDEO_BYTES) {
      return { ok: false, error: tooLargeMessage(file.size) };
    }
    seq += 1;
    const id = `pv_${Date.now()}_${seq}`;
    setSentCount(0);
    setItems((xs) => [...xs, { id, exerciseName, file, sizeMB: humanMB(file.size), error: null }]);
    return { ok: true };
  }, []);

  const remove = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const uploadAll = useCallback(async () => {
    if (uploading || !userId) return;
    const queued = items;
    if (queued.length === 0) return;
    setUploading(true);
    setSentCount(0);
    setProgress({ done: 0, total: queued.length });

    const succeeded: string[] = [];
    const errors: Record<string, string> = {};

    for (let i = 0; i < queued.length; i++) {
      const it = queued[i];
      try {
        if (it.file.size > MAX_VIDEO_BYTES) throw new Error(tooLargeMessage(it.file.size));
        const ts = Date.now();
        const safe = it.exerciseName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 32);
        const ext = (it.file.name.split(".").pop() || "mp4").toLowerCase();
        const path = `${userId}/${sessionId}/${safe}-${ts}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("technique-videos")
          .upload(path, it.file, { contentType: it.file.type || "video/mp4", upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("technique_videos").insert({
          member_id: userId,
          session_id: sessionId,
          exercise_name: it.exerciseName,
          storage_path: path,
        });
        if (insErr) throw insErr;
        succeeded.push(it.id);
      } catch (e) {
        errors[it.id] = (e as Error)?.message || "Échec de l'envoi";
      } finally {
        setProgress({ done: i + 1, total: queued.length });
      }
    }

    // On retire les vidéos envoyées, on garde celles en échec (avec leur message) pour réessayer.
    setItems((xs) =>
      xs
        .filter((x) => !succeeded.includes(x.id))
        .map((x) => (errors[x.id] ? { ...x, error: errors[x.id] } : x)),
    );
    setSentCount(succeeded.length);
    setUploading(false);
    setProgress(null);
  }, [items, uploading, sessionId, userId]);

  const forExercise = useCallback(
    (name: string) => items.filter((x) => x.exerciseName === name),
    [items],
  );

  const api: QueueApi = {
    items,
    add,
    remove,
    uploadAll,
    uploading,
    progress,
    sentCount,
    forExercise,
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <QueueBar api={api} />
    </Ctx.Provider>
  );
}

function QueueBar({ api }: { api: QueueApi }) {
  const { items, uploading, progress, sentCount, uploadAll } = api;
  const nbErrors = items.filter((x) => x.error).length;
  const visible = items.length > 0 || (sentCount > 0 && !uploading);
  if (!visible) return null;

  const justSent = items.length === 0 && sentCount > 0;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
        zIndex: 60,
        maxWidth: 520,
        margin: "0 auto",
        borderRadius: 12,
        padding: "12px 14px",
        background: justSent ? "rgba(45,90,53,0.95)" : "rgba(20,28,22,0.97)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {justSent ? (
        <div
          className="cst-mono"
          style={{ fontSize: 12, color: "#DFF3E4", letterSpacing: "0.04em" }}
        >
          ✓ {sentCount} vidéo{sentCount > 1 ? "s" : ""} envoyée{sentCount > 1 ? "s" : ""} à Léo
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="cst-mono"
              style={{ fontSize: 12, color: "#fff", letterSpacing: "0.04em" }}
            >
              🎬 {items.length} vidéo{items.length > 1 ? "s" : ""} à envoyer à Léo
            </div>
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
              {uploading && progress
                ? `Envoi… ${progress.done}/${progress.total}`
                : nbErrors > 0
                  ? `${nbErrors} en échec — appuie pour réessayer`
                  : "En fin de séance, envoie tout d'un coup"}
            </div>
          </div>
          <button
            type="button"
            onClick={uploadAll}
            disabled={uploading}
            className="cst-mono"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--cst-mid-green)",
              background: uploading ? "rgba(45,90,53,0.35)" : "var(--cst-mid-green)",
              color: "#fff",
              fontSize: 11,
              letterSpacing: "0.12em",
              cursor: uploading ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {uploading ? "ENVOI…" : nbErrors > 0 ? "RÉESSAYER" : "ENVOYER →"}
          </button>
        </>
      )}
    </div>
  );
}
