import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { consumeInvitation } from "@/lib/invitations.functions";
import { CSTLogo, CSTSectionNum, CSTDuoTitle } from "../../components/Atoms";

const hatchOverlay = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 11px)",
};

export default function Signup() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/signup" });
  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [lockedEmail, setLockedEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setTokenError("Aucun lien d'invitation fourni.");
        setChecking(false);
        return;
      }
      const { data, error: err } = await supabase.rpc("validate_invitation", {
        _token: token,
      });
      if (err) {
        setTokenError("Impossible de vérifier l'invitation.");
        setChecking(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.valid) {
        const reason = row?.reason;
        const msg =
          reason === "used"
            ? "Cette invitation a déjà été utilisée."
            : reason === "expired"
              ? "Cette invitation a expiré."
              : reason === "revoked"
                ? "Cette invitation a été révoquée."
                : "Invitation introuvable.";
        setTokenError(msg);
      } else if (row.email) {
        setLockedEmail(row.email);
        setEmail(row.email);
      }
      setChecking(false);
    })();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { first_name: firstName, last_name: lastName },
        },
      });
      if (err) throw err;
      const userId = data.user?.id;
      if (userId) {
        try {
          await consumeInvitation({ data: { token, userId } });
        } catch (consumeErr) {
          console.warn("consume_invitation failed", consumeErr);
        }
      }
      if (!data.session) {
        // Auto-confirm activé : on tente une connexion immédiate
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      }
      navigate({ to: "/onboarding/$step", params: { step: "1" } });
    } catch (err) {
      setError(err?.message || "Erreur lors de l'inscription.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cst-dark-green)",
      }}
    >
      <div
        className="cst-screen cst-hatch"
        style={{
          width: 390,
          minHeight: 780,
          padding: "20px 24px 28px",
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div style={hatchOverlay} />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: 740,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
            <CSTLogo />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 24,
              paddingTop: 24,
            }}
          >
            <div className="cst-col" style={{ gap: 10 }}>
              <CSTSectionNum num={1} label="ACCÈS · INVITATION" />
              <CSTDuoTitle top="REJOINS." bottom="Crée ton compte." size={44} />
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  opacity: 0.7,
                  lineHeight: 1.55,
                  maxWidth: 280,
                }}
              >
                Entraîne-toi. Note. Progresse.
              </p>
            </div>

            {checking ? (
              <div className="cst-card-dark" style={{ padding: 22, textAlign: "center" }}>
                Vérification de l'invitation…
              </div>
            ) : tokenError ? (
              <div className="cst-card-dark" style={{ padding: 22 }}>
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(139,35,24,0.15)",
                    border: "1px solid rgba(139,35,24,0.4)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#C56A60",
                    marginBottom: 12,
                  }}
                >
                  {tokenError}
                </div>
                <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                  Demande un nouveau lien à ton coach.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/login" })}
                  className="cst-btn cst-btn-primary"
                  style={{ width: "100%", marginTop: 12 }}
                >
                  RETOUR CONNEXION →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="cst-card-dark cst-hatch" style={{ padding: 22 }}>
                <div className="cst-col" style={{ gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <span className="cst-label">PRÉNOM</span>
                      <input
                        className="cst-input"
                        placeholder="Jordan"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <span className="cst-label">NOM</span>
                      <input
                        className="cst-input"
                        placeholder="Ferrer"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <span className="cst-label">EMAIL</span>
                    <input
                      className="cst-input"
                      placeholder="ton.email@domaine.fr"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      required
                      readOnly={!!lockedEmail}
                      style={lockedEmail ? { opacity: 0.7 } : undefined}
                    />
                  </div>
                  <div>
                    <span className="cst-label">MOT DE PASSE</span>
                    <input
                      className="cst-input"
                      type="password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      required
                      minLength={6}
                    />
                  </div>

                  {error && (
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "rgba(139,35,24,0.15)",
                        border: "1px solid rgba(139,35,24,0.4)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#C56A60",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="cst-btn cst-btn-primary"
                    style={{ width: "100%", marginTop: 4, opacity: loading ? 0.7 : 1 }}
                    disabled={loading}
                  >
                    {loading ? "..." : "CRÉER MON COMPTE →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate({ to: "/login" })}
                    style={{
                      background: "none",
                      border: "none",
                      textAlign: "center",
                      fontSize: 11,
                      color: "var(--cst-text-muted)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Déjà inscrit ? Se connecter
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="cst-col" style={{ gap: 12, alignItems: "center", paddingTop: 8 }}>
            <div style={{ width: 32, height: 1, background: "rgba(255,255,255,0.1)" }} />
            <div className="cst-mono" style={{ fontSize: 8, opacity: 0.4 }}>
              COLOSMARTRAINING™ · VICHY · FR · EST. 2024
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
