import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // Tant que la session de récupération n'est pas établie, on ne montre pas le
  // formulaire (updateUser échouerait avec une erreur incompréhensible).
  const [status, setStatus] = useState<Status>("checking");

  // Établit la session de récupération à partir du lien reçu par email.
  useEffect(() => {
    let mounted = true;
    const markReady = () => { if (mounted) setStatus("ready"); };

    // Supabase émet PASSWORD_RECOVERY quand le lien de reset est détecté dans l'URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === "PASSWORD_RECOVERY" || session) markReady();
    });

    (async () => {
      try {
        // Templates récents : lien vers /reset-password?token_hash=...&type=recovery
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (tokenHash && (type === "recovery" || type === "email")) {
          const { error: err } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (!err) { markReady(); return; }
        }
        // Flux standard : detectSessionInUrl a déjà posé la session (hash / PKCE).
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setStatus(data.session ? "ready" : "invalid");
      } catch {
        if (mounted) setStatus("invalid");
      }
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 6) { setError("6 caractères minimum."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setInfo("Mot de passe mis à jour ✓");
    setTimeout(() => navigate({ to: "/login", search: { redirect: "/" } }), 1200);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cst-dark-green)" }}>
      <div className="cst-screen cst-hatch" style={{ width: 390, padding: "32px 24px", borderRadius: 16 }}>
        <h1 className="cst-display" style={{ fontSize: 28, marginBottom: 6 }}>NOUVEAU</h1>
        <div className="cst-italic" style={{ fontSize: 18, color: "var(--cst-mid-green)", marginBottom: 24 }}>mot de passe.</div>

        {status === "checking" && (
          <div className="cst-mono" style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
            Vérification du lien…
          </div>
        )}

        {status === "invalid" && (
          <div className="cst-col" style={{ gap: 14 }}>
            <div style={{ padding: "10px 14px", background: "rgba(139,35,24,0.15)", border: "1px solid rgba(139,35,24,0.4)", borderRadius: 8, fontSize: 12, color: "#C56A60" }}>
              Ce lien de réinitialisation est invalide ou expiré. Redemande un email depuis « Mot de passe oublié ? » sur la page de connexion.
            </div>
            <button
              type="button"
              className="cst-btn cst-btn-primary"
              style={{ width: "100%" }}
              onClick={() => navigate({ to: "/login", search: { redirect: "/" } })}
            >
              ← RETOUR À LA CONNEXION
            </button>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="cst-col" style={{ gap: 14 }}>
            <div>
              <span className="cst-label">NOUVEAU MOT DE PASSE</span>
              <input className="cst-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <span className="cst-label">CONFIRMER</span>
              <input className="cst-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
            {error && <div style={{ padding: "10px 14px", background: "rgba(139,35,24,0.15)", border: "1px solid rgba(139,35,24,0.4)", borderRadius: 8, fontSize: 12, color: "#C56A60" }}>{error}</div>}
            {info && <div style={{ padding: "10px 14px", background: "rgba(45,90,53,0.15)", border: "1px solid rgba(45,90,53,0.4)", borderRadius: 8, fontSize: 12, color: "#6EAB76" }}>{info}</div>}
            <button type="submit" className="cst-btn cst-btn-primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "..." : "METTRE À JOUR →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
