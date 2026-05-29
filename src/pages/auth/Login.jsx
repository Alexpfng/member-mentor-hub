import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CSTLogo, CSTSectionNum, CSTDuoTitle } from "../../components/Atoms";

const hatchOverlay = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 11px)",
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in, route to the right dashboard
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      navigate(r?.role === "coach" ? "/coach" : "/membre");
    })();
  }, [navigate]);

  async function handleForgot() {
    if (!email.trim()) {
      setError("Entre ton email puis clique sur « Mot de passe oublié ».");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setInfo("Email envoyé. Vérifie ta boîte mail pour réinitialiser ton mot de passe.");
    } catch (err) {
      setError(err?.message || "Impossible d'envoyer l'email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { first_name: firstName, last_name: lastName },
          },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Compte créé. Vérifie ton email pour confirmer ton inscription.");
          setLoading(false);
          return;
        }
        navigate("/onboarding/1");
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (err) throw err;
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();
        navigate(r?.role === "coach" ? "/coach" : "/membre");
      }
    } catch (err) {
      const msg = err?.message || "Erreur.";
      if (msg.toLowerCase().includes("invalid login")) setError("Email ou mot de passe incorrect.");
      else if (msg.toLowerCase().includes("email not confirmed"))
        setError("Email non confirmé. Vérifie ta boîte mail.");
      else setError(msg);
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
          style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 740 }}
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
              <CSTSectionNum num={1} label="ACCÈS · L'ESPACE" />
              <CSTDuoTitle
                top={mode === "login" ? "TON ESPACE." : "REJOINS."}
                bottom={mode === "login" ? "Connecte-toi." : "Crée ton compte."}
                size={44}
              />
              <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.55, maxWidth: 280 }}>
                Entraîne-toi. Note. Progresse.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="cst-card-dark cst-hatch"
              style={{ padding: 22 }}
            >
              <div className="cst-col" style={{ gap: 14 }}>
                {mode === "signup" && (
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
                )}
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
                {info && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(45,90,53,0.15)",
                      border: "1px solid rgba(45,90,53,0.4)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#6EAB76",
                    }}
                  >
                    {info}
                  </div>
                )}


                <button
                  type="submit"
                  className="cst-btn cst-btn-primary"
                  style={{ width: "100%", marginTop: 4, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "..." : mode === "login" ? "SE CONNECTER →" : "CRÉER MON COMPTE →"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError("");
                    setInfo("");
                  }}
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
                  {mode === "login"
                    ? "Pas encore de compte ? S'inscrire"
                    : "Déjà inscrit ? Se connecter"}
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={handleForgot}
                    style={{
                      background: "none",
                      border: "none",
                      textAlign: "center",
                      fontSize: 11,
                      color: "var(--cst-text-muted)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
            </form>
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
