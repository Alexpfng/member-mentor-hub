/* Bloc partagé : importe une capture d'écran de course, l'analyse via l'IA et
   renvoie des valeurs pré-remplies (éditables). Jamais bloquant : en cas
   d'échec, l'utilisateur saisit à la main. Utilisé côté séance programme ET
   séance libre course. */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRunScreenshot } from "@/lib/run.functions";
import { extractionToFormValues, type RunExtraction, type RunFormValues } from "@/lib/run-stats";

const MAX_BYTES = 12 * 1024 * 1024; // 12 Mo

export type RunCaptureMeta = {
  confidence: number;
  screenshotMediaId: string | null;
  raw: RunExtraction;
};

type Props = {
  sessionId: string;
  userId: string;
  onExtracted: (form: RunFormValues, meta: RunCaptureMeta) => void;
  disabled?: boolean;
};

type Status = "idle" | "working" | "done" | "error";

export function RunStatsCapture({ sessionId, userId, onExtracted, disabled }: Props) {
  const analyze = useServerFn(analyzeRunScreenshot);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Choisis une image (capture d'écran).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setMessage("Image trop lourde (max 12 Mo).");
      return;
    }

    setStatus("working");
    setMessage("Lecture de ta capture…");
    setConfidence(null);
    try {
      const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "png").toLowerCase();
      const path = `${userId}/${sessionId}/run-shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("session-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      // Garde la capture comme média de séance (le coach la voit aussi).
      let screenshotMediaId: string | null = null;
      const { data: mediaRow } = await supabase
        .from("session_media")
        .insert({
          session_id: sessionId,
          member_id: userId,
          type: "photo",
          storage_path: path,
          caption: "[RUN_SCREENSHOT]",
        })
        .select("id")
        .single();
      screenshotMediaId = mediaRow?.id ?? null;

      const raw = (await analyze({ data: { sessionId, storagePath: path } })) as RunExtraction;
      const form = extractionToFormValues(raw);
      setConfidence(raw.confidence ?? null);
      setStatus("done");
      setMessage("Valeurs pré-remplies — vérifie-les avant d'envoyer.");
      onExtracted(form, { confidence: raw.confidence ?? 0, screenshotMediaId, raw });
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Analyse impossible — saisis à la main.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const lowConfidence = confidence != null && confidence < 0.6;

  return (
    <div
      style={{
        padding: 14,
        background: "rgba(110,171,118,0.08)",
        border: "1px solid rgba(110,171,118,0.3)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        className="cst-mono"
        style={{
          fontSize: 10,
          opacity: 0.75,
          letterSpacing: "0.18em",
          color: "var(--cst-mid-green)",
        }}
      >
        ✨ REMPLIR DEPUIS UNE CAPTURE
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
        Importe la capture de ta montre/app : l'IA remplit tes stats. Tu peux tout corriger ensuite.
      </div>

      {status === "done" && (
        <div
          className="cst-mono"
          style={{ fontSize: 11, color: lowConfidence ? "#E0A93B" : "var(--cst-mid-green)" }}
        >
          {lowConfidence ? "⚠ Confiance faible — vérifie bien" : "✓ Stats extraites"}
          {confidence != null ? ` · ${Math.round(confidence * 100)}%` : ""}
        </div>
      )}
      {status === "error" && (
        <div className="cst-mono" style={{ fontSize: 11, color: "#E0857B" }}>
          ⚠ {message}
        </div>
      )}
      {status === "working" && (
        <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7 }}>
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || status === "working"}
        className="cst-btn cst-btn-ghost-dark"
        style={{
          fontSize: 12,
          padding: "10px 0",
          opacity: disabled || status === "working" ? 0.6 : 1,
        }}
      >
        {status === "working"
          ? "ANALYSE…"
          : status === "done"
            ? "📸 CHANGER DE CAPTURE"
            : "📸 IMPORTER UNE CAPTURE"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files)}
      />
    </div>
  );
}
