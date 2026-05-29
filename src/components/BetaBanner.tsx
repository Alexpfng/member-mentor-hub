import { BETA_MODE, BETA_CONTACT_EMAIL } from "@/lib/site";

export function BetaBanner() {
  if (!BETA_MODE) return null;
  return (
    <div
      style={{
        background: "#2D5A35",
        color: "white",
        fontSize: 11,
        fontFamily: "var(--cst-mono, 'JetBrains Mono', monospace)",
        textAlign: "center",
        padding: "6px 16px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}
    >
      Bêta privée · Vos retours comptent →{" "}
      <a href={`mailto:${BETA_CONTACT_EMAIL}`} style={{ color: "#fff", textDecoration: "underline" }}>
        {BETA_CONTACT_EMAIL}
      </a>
    </div>
  );
}
