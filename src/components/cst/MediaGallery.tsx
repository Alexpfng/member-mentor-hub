import { useState } from "react";

export type MediaItem = {
  id: string;
  type: "photo" | "video";
  url: string | null;
  thumbnailUrl: string | null;
  caption?: string | null;
};

type Props = {
  items: MediaItem[];
  onDelete?: (id: string) => void;
  onUpdateCaption?: (id: string, caption: string) => void;
};

export default function MediaGallery({ items, onDelete, onUpdateCaption }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState("");

  if (!items.length) {
    return (
      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.45 }}>
        AUCUN MÉDIA
      </div>
    );
  }

  const open = openIdx != null ? items[openIdx] : null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {items.map((m, idx) => (
          <div
            key={m.id}
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 6,
              overflow: "hidden",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
            onClick={() => setOpenIdx(idx)}
          >
            {m.thumbnailUrl ? (
              <img
                src={m.thumbnailUrl}
                alt={m.caption ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.5)", fontSize: 22 }}>
                {m.type === "video" ? "🎥" : "📷"}
              </div>
            )}
            {m.type === "video" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  textShadow: "0 0 6px rgba(0,0,0,0.7)",
                  fontSize: 22,
                  pointerEvents: "none",
                }}
              >
                ▶
              </div>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Supprimer ce média ?")) onDelete(m.id);
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  width: 22,
                  height: 22,
                  cursor: "pointer",
                  fontSize: 12,
                }}
                aria-label="Supprimer"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div
          onClick={() => {
            setOpenIdx(null);
            setEditingId(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "80vh" }}>
            {open.type === "video" ? (
              <video
                src={open.url ?? undefined}
                controls
                autoPlay
                playsInline
                style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 8 }}
              />
            ) : (
              <img
                src={open.url ?? undefined}
                alt={open.caption ?? ""}
                style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
              />
            )}
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#fff", textAlign: "center", maxWidth: 480, width: "100%" }}
          >
            {editingId === open.id ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={draftCaption}
                  onChange={(e) => setDraftCaption(e.target.value)}
                  placeholder="Légende"
                  style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", borderRadius: 6, fontSize: 13 }}
                />
                <button
                  type="button"
                  className="cst-btn cst-btn-primary"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    if (onUpdateCaption) onUpdateCaption(open.id, draftCaption);
                    setEditingId(null);
                  }}
                >
                  OK
                </button>
              </div>
            ) : (
              <div
                style={{ fontSize: 13, opacity: 0.85, cursor: onUpdateCaption ? "pointer" : "default" }}
                onClick={() => {
                  if (!onUpdateCaption) return;
                  setEditingId(open.id);
                  setDraftCaption(open.caption ?? "");
                }}
              >
                {open.caption || (onUpdateCaption ? "+ Ajouter une légende" : "")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: "0.16em",
            }}
          >
            FERMER
          </button>
        </div>
      )}
    </>
  );
}
