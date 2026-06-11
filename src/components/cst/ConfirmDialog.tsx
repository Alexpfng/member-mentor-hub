import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modale de confirmation stylée (remplace window.confirm). Réutilisable dans
 * toute l'app pour les actions destructives. Esc / clic dehors = annuler.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(3px)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#1B2E1F",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h3 className="cst-display" style={{ margin: 0, fontSize: 20, color: "#fff" }}>
          {title}
        </h3>
        {message && (
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.7)" }}>
            {message}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1 }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="cst-btn cst-btn-primary"
            style={{ flex: 1, ...(danger ? { background: "#8B2318", borderColor: "#8B2318" } : {}) }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
