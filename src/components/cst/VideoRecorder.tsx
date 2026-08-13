/* ColosmartTraining — Enregistreur vidéo intégré (qualité bridée)
 *
 * Pourquoi : sur le plan Supabase gratuit, les uploads sont plafonnés à 50 Mo. Une
 * vidéo filmée avec l'appareil photo iPhone (4K/1080p60) dépasse vite ça. Recompresser
 * un fichier existant dans le navigateur est lent et plante sur iPhone. En revanche,
 * filmer DIRECTEMENT dans l'app permet de brider la résolution + le débit à la source :
 * le fichier produit reste toujours petit (≈ 720p, ~2,5 Mbps → ~19 Mo/min), donc sous
 * 50 Mo, sans aucune recompression. Coupure automatique à 2 min par sécurité.
 *
 * Léo peut lire la vidéo normalement (mp4 quand le navigateur le supporte — le cas des
 * iPhone ; sinon webm en repli).
 */
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120; // garde-fou dur : ~39 Mo à 2,5 Mbps, bien sous les 50 Mo
const VIDEO_BPS = 2_500_000;
const AUDIO_BPS = 128_000;

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  // On privilégie le mp4 (lisible partout, notamment Safari/iPhone), puis webm en repli.
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* isTypeSupported peut lever sur certains navigateurs */
    }
  }
  return "";
}

type Phase = "loading" | "ready" | "recording" | "recorded" | "error";

export function VideoRecorder({
  open,
  onRecorded,
  onClose,
}: {
  open: boolean;
  onRecorded: (file: File) => void;
  onClose: () => void;
}) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const openCamera = useCallback(
    async (mode: "environment" | "user") => {
      setPhase("loading");
      setErrorMsg("");
      stopTracks();
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase("error");
        setErrorMsg(
          "Ton navigateur ne permet pas de filmer dans l'app. Utilise « importer un fichier ».",
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          previewRef.current.muted = true;
          void previewRef.current.play().catch(() => {});
        }
        setPhase("ready");
      } catch (e) {
        setPhase("error");
        const name = (e as Error)?.name;
        setErrorMsg(
          name === "NotAllowedError"
            ? "Accès caméra refusé. Autorise la caméra dans les réglages, ou importe un fichier."
            : "Impossible d'accéder à la caméra. Utilise « importer un fichier ».",
        );
      }
    },
    [stopTracks],
  );

  // Ouvre la caméra à l'ouverture de la modale, coupe tout à la fermeture.
  useEffect(() => {
    if (!open) return;
    setRecordedFile(null);
    setRecordedUrl(null);
    setElapsed(0);
    void openCamera(facing);
    return () => {
      clearTimer();
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Nettoyage de l'URL objet de la vidéo enregistrée.
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: VIDEO_BPS,
        audioBitsPerSecond: AUDIO_BPS,
      });
    } catch {
      setPhase("error");
      setErrorMsg("Enregistrement non supporté ici. Utilise « importer un fichier ».");
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      clearTimer();
      const type = rec.mimeType || mimeType || "video/mp4";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `filme-${Date.now()}.${ext}`, { type });
      const url = URL.createObjectURL(blob);
      // On coupe la caméra live : on passe à l'aperçu du clip enregistré.
      stopTracks();
      setRecordedFile(file);
      setRecordedUrl(url);
      setPhase("recorded");
    };
    rec.start(1000); // chunks réguliers → plus robuste si l'onglet est mis en veille
    setElapsed(0);
    setPhase("recording");
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= MAX_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    clearTimer();
  }

  function redo() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedFile(null);
    setElapsed(0);
    void openCamera(facing);
  }

  function confirmClip() {
    if (recordedFile) onRecorded(recordedFile);
    close();
  }

  function close() {
    clearTimer();
    stopTracks();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* déjà arrêté */
      }
    }
    onClose();
  }

  function flip() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    void openCamera(next);
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "#fff" }}>
          FILMER · MAX {mmss(MAX_SECONDS)}
        </span>
        <button
          type="button"
          onClick={close}
          className="cst-mono"
          style={{
            background: "none",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 6,
            color: "rgba(255,255,255,0.8)",
            padding: "6px 10px",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          FERMER ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {phase === "error" ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#C56A60",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        ) : phase === "recorded" && recordedUrl ? (
          <video
            src={recordedUrl}
            controls
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          />
        ) : (
          <>
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
                transform: facing === "user" ? "scaleX(-1)" : undefined,
              }}
            />
            {phase === "loading" && (
              <div
                className="cst-mono"
                style={{ position: "absolute", fontSize: 11, color: "rgba(255,255,255,0.7)" }}
              >
                CAMÉRA…
              </div>
            )}
            {phase === "recording" && (
              <div
                className="cst-mono"
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 20,
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#E5484D",
                    display: "inline-block",
                  }}
                />
                {mmss(elapsed)} / {mmss(MAX_SECONDS)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barre d'actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          marginTop: 14,
        }}
      >
        {phase === "error" ? (
          <button type="button" onClick={close} className="cst-btn cst-btn-ghost-dark cst-btn-sm">
            FERMER
          </button>
        ) : phase === "recorded" ? (
          <>
            <button type="button" onClick={redo} className="cst-btn cst-btn-ghost-dark cst-btn-sm">
              ↺ REFAIRE
            </button>
            <button
              type="button"
              onClick={confirmClip}
              className="cst-btn cst-btn-primary cst-btn-sm"
            >
              UTILISER CETTE VIDÉO →
            </button>
          </>
        ) : phase === "recording" ? (
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Arrêter"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.85)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: "#E5484D",
                display: "inline-block",
              }}
            />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={flip}
              disabled={phase !== "ready"}
              aria-label="Changer de caméra"
              className="cst-mono"
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 8,
                color: "#fff",
                padding: "10px 12px",
                fontSize: 16,
                cursor: phase === "ready" ? "pointer" : "not-allowed",
                opacity: phase === "ready" ? 1 : 0.5,
              }}
            >
              ⟲
            </button>
            <button
              type="button"
              onClick={startRecording}
              disabled={phase !== "ready"}
              aria-label="Démarrer l'enregistrement"
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.85)",
                background: phase === "ready" ? "#E5484D" : "rgba(229,72,77,0.4)",
                cursor: phase === "ready" ? "pointer" : "not-allowed",
              }}
            />
            <div style={{ width: 42 }} />
          </>
        )}
      </div>

      <div
        style={{ textAlign: "center", marginTop: 10, fontSize: 10, opacity: 0.55, color: "#fff" }}
      >
        Qualité optimisée pour l'envoi (720p) — reste sous la limite, envoi groupé en fin de séance.
      </div>
    </div>
  );
}
