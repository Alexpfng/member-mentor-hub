import { useTheme } from "@/lib/theme";

type Variant = "icon" | "pill" | "full";

export default function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { resolved, toggle, mode, setMode } = useTheme();
  const isLight = resolved === "light";
  const label = isLight ? "Passer en mode sombre" : "Passer en mode clair";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={className}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "transparent",
          border: "1px solid var(--cst-btn-ghost-border)",
          color: "var(--cst-btn-ghost-color)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          lineHeight: 1,
          flexShrink: 0,
          transition: "background .15s, transform .15s",
        }}
      >
        <span aria-hidden="true">{isLight ? "🌙" : "☀️"}</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 999,
          background: "transparent",
          border: "1px solid var(--cst-btn-ghost-border)",
          color: "var(--cst-btn-ghost-color)",
          cursor: "pointer",
          fontFamily: "var(--cst-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden="true">{isLight ? "🌙" : "☀️"}</span>
        <span>{isLight ? "Sombre" : "Clair"}</span>
      </button>
    );
  }

  // full: three-state segmented (light / dark / auto)
  const items: { id: import("@/lib/theme").ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: "Clair", icon: "☀️" },
    { id: "dark", label: "Sombre", icon: "🌑" },
    { id: "system", label: "Auto", icon: "🖥" },
  ];
  return (
    <div
      role="group"
      aria-label="Thème"
      className={className}
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 999,
        background: "var(--cst-input-bg)",
        border: "1px solid var(--cst-input-border)",
        gap: 2,
      }}
    >
      {items.map((it) => {
        const on = mode === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setMode(it.id)}
            aria-pressed={on}
            style={{
              padding: "6px 12px",
              minHeight: 32,
              borderRadius: 999,
              background: on ? "var(--cst-mid-green)" : "transparent",
              color: on ? "#fff" : "var(--cst-text-soft)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--cst-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span aria-hidden="true">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
