import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { createInvitation } from "@/lib/invitations.functions";

const APP_URL = "https://app.colosmartraining.fr";

type Invitation = {
  id: string;
  token: string;
  email: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

function statusOf(inv: Invitation): { label: string; color: string } {
  if (inv.revoked_at) return { label: "Révoquée", color: "#C56A60" };
  if (inv.used_at) return { label: "Utilisée", color: "#888" };
  if (new Date(inv.expires_at) < new Date()) return { label: "Expirée", color: "#C56A60" };
  return { label: "Active", color: "#6EAB76" };
}

export default function Invitations() {
  const createFn = useServerFn(createInvitation);
  const [list, setList] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data as Invitation[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await createFn({
        data: {
          email: email.trim() || null,
        },
      });
      setEmail("");
      await load();
      try {
        await navigator.clipboard.writeText(res.signup_url);
        setCopied(res.invitation.token);
        setTimeout(() => setCopied(null), 1500);
      } catch {}
      setNotice("Lien d'invitation généré et copié dans le presse-papiers.");
      setTimeout(() => setNotice(null), 4000);
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    await load();
  }

  function linkFor(token: string) {
    return `${APP_URL}/signup?token=${encodeURIComponent(token)}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(linkFor(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Link
        to="/coach"
        className="cst-btn cst-btn-ghost-dark cst-btn-sm"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16, textDecoration: "none" }}
      >
        ← RETOUR À L'ACCUEIL
      </Link>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Invitations</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 24 }}>
        Génère un lien d'invitation à transmettre manuellement à ton client (email, SMS, WhatsApp…).
        Le lien est valable 14 jours et utilisable une seule fois.
      </p>

      <div
        className="cst-card-dark"
        style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="cst-label">EMAIL DU CLIENT (OPTIONNEL)</span>
          <input
            className="cst-input"
            type="email"
            placeholder="client@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          className="cst-btn cst-btn-primary"
          onClick={generate}
          disabled={loading}
          style={{ height: 42 }}
        >
          {loading ? "..." : "GÉNÉRER UN LIEN →"}
        </button>
      </div>

      {notice && (
        <div style={{ padding: "10px 14px", marginBottom: 12, background: "rgba(45,90,53,0.15)", border: "1px solid rgba(45,90,53,0.4)", borderRadius: 8, fontSize: 12, color: "#6EAB76" }}>
          {notice}
        </div>
      )}
      {err && (
        <div style={{ padding: "10px 14px", marginBottom: 12, background: "rgba(139,35,24,0.15)", border: "1px solid rgba(139,35,24,0.4)", borderRadius: 8, fontSize: 12, color: "#C56A60" }}>
          {err}
        </div>
      )}

      <div className="cst-col" style={{ gap: 10 }}>
        {list.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", opacity: 0.5, fontSize: 13 }}>
            Aucune invitation pour l'instant.
          </div>
        )}
        {list.map((inv) => {
          const st = statusOf(inv);
          const isActive = st.label === "Active";
          return (
            <div
              key={inv.id}
              className="cst-card-dark"
              style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: `${st.color}22`,
                    color: st.color,
                    fontFamily: "var(--cst-mono)",
                  }}
                >
                  {st.label.toUpperCase()}
                </span>
                <span style={{ fontSize: 13 }}>{inv.email || "Lien libre"}</span>
                <span style={{ fontSize: 11, opacity: 0.5, marginLeft: "auto" }}>
                  Expire le {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
              {isActive && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="cst-input"
                    value={linkFor(inv.token)}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    style={{ flex: 1, fontSize: 11, fontFamily: "var(--cst-mono)" }}
                  />
                  <button
                    className="cst-btn"
                    onClick={() => copy(inv.token)}
                    style={{ fontSize: 11 }}
                  >
                    {copied === inv.token ? "✓ COPIÉ" : "COPIER"}
                  </button>
                  <button
                    className="cst-btn"
                    onClick={() => revoke(inv.id)}
                    style={{ fontSize: 11, color: "#C56A60" }}
                  >
                    RÉVOQUER
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
