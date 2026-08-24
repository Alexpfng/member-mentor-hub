import { useEffect, useState } from "react";

/**
 * Visite guidée du premier lancement : dix écrans qui rejouent le parcours d'une
 * séance, pour un coaché qui découvre l'app et ne lira pas le guide PDF.
 *
 * On reconstitue les écrans plutôt que de pointer les vrais : à la première
 * connexion le membre n'a pas forcément de programme publié, et une visite qui
 * dépend des données réelles casserait précisément là où elle est la plus utile.
 */

const SEEN_KEY = "cst_tour_seen_v1";

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // stockage indisponible : on n'impose pas la visite
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* navigation privée : tant pis, la visite se reproposera */
  }
}

type Step = { title: string; text: string; pill: string; screen: React.ReactNode };

const C = {
  line: "1px solid rgba(255,255,255,0.10)",
  card: "rgba(255,255,255,0.04)",
  green: "#6EAB76",
  gold: "#D4A53B",
  red: "#C56A60",
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="cst-mono"
      style={{ fontSize: 8, letterSpacing: "0.2em", opacity: 0.5, textTransform: "uppercase" }}
    >
      {children}
    </div>
  );
}
function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: C.card,
        border: accent ? `1px solid ${accent}` : C.line,
        borderRadius: 9,
        padding: 10,
      }}
    >
      {children}
    </div>
  );
}
function Btn({ children, ghost }: { children: React.ReactNode; ghost?: boolean }) {
  return (
    <div
      className="cst-mono"
      style={{
        background: ghost ? "transparent" : "rgba(45,90,53,0.85)",
        border: ghost ? C.line : "none",
        color: ghost ? "rgba(255,255,255,0.65)" : "#fff",
        borderRadius: 8,
        padding: "9px 0",
        textAlign: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </div>
  );
}
const col = (gap = 8): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap });

const STEPS: Step[] = [
  {
    title: "Ta séance t'attend",
    text: "Tu ouvres l'app : la séance du jour est déjà là, avec sa durée. Un bouton, et c'est parti.",
    pill: "Aucun menu à fouiller",
    screen: (
      <div style={col()}>
        <Lbl>L'espace · membre</Lbl>
        <div className="cst-display" style={{ fontSize: 18 }}>
          BON MATIN, ALEX.
        </div>
        <Card>
          <Lbl>Ma semaine</Lbl>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span className="cst-display" style={{ fontSize: 26 }}>
              3
            </span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>/ 4 séances</span>
          </div>
        </Card>
        <Card accent="rgba(110,171,118,0.5)">
          <Lbl>Séance du jour</Lbl>
          <div className="cst-display" style={{ fontSize: 14, marginTop: 4 }}>
            LOWER BODY 1
          </div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>40 min · 6 exercices</div>
        </Card>
        <Btn>COMMENCER →</Btn>
      </div>
    ),
  },
  {
    title: "Tes pas, tous les jours",
    text: "Cinq secondes par jour. L'anneau se remplit vers ton objectif, et ta série 🔥 grandit tant que tu ne lâches pas.",
    pill: "La série, c'est le moteur",
    screen: (
      <div style={col()}>
        <Lbl>Pas aujourd'hui</Lbl>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="74" height="74" viewBox="0 0 74 74" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx="37"
              cy="37"
              r="30"
              fill="none"
              stroke="rgba(255,255,255,.08)"
              strokeWidth="7"
            />
            <circle
              cx="37"
              cy="37"
              r="30"
              fill="none"
              stroke={C.green}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="188"
              strokeDashoffset="24"
            />
          </svg>
          <div>
            <div className="cst-display" style={{ fontSize: 24 }}>
              8 240
            </div>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              / 8 000 pas
            </div>
          </div>
        </div>
        <Card accent="rgba(110,171,118,0.5)">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="cst-display" style={{ fontSize: 20 }}>
              🔥 12
            </span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>jours d'affilée</span>
          </div>
        </Card>
        <div style={{ fontSize: 11, color: C.green }}>Objectif du jour atteint 🎉</div>
      </div>
    ),
  },
  {
    title: "Guidé ou expert ?",
    text: "Guidé : tout est expliqué, tu notes série par série. Expert : tu vas vite, tu renseignes tes RPE à la fin. Tu choisis à chaque séance.",
    pill: "Commence en guidé",
    screen: (
      <div style={col()}>
        <Lbl>Comment veux-tu être accompagné ?</Lbl>
        <Card>
          <div className="cst-display" style={{ fontSize: 13 }}>
            MODE GUIDÉ
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
            Tout est expliqué. Tu notes chaque série au fur et à mesure.
          </div>
        </Card>
        <Card accent={C.green}>
          <div className="cst-display" style={{ fontSize: 13 }}>
            MODE EXPERT
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
            Écran épuré. Tu valides vite, tu notes tes RPE à la fin.
          </div>
        </Card>
      </div>
    ),
  },
  {
    title: "Un exercice à l'écran",
    text: "Ce qui est prescrit, ta dernière performance pour te repérer, et la couleur qui te dit à quelle intensité aller.",
    pill: "Rouge = force",
    screen: (
      <div style={col()}>
        <Lbl>Bloc B · série 2/4</Lbl>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.red }} />
          <span className="cst-display" style={{ fontSize: 15 }}>
            BACK SQUAT
          </span>
        </div>
        <Card>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              ["Reps", "10"],
              ["Charge", "80 kg"],
              ["Tempo", "3010"],
            ].map(([k, v]) => (
              <div key={k} style={{ flex: 1 }}>
                <Lbl>{k}</Lbl>
                <div className="cst-mono" style={{ fontSize: 15 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Lbl>La dernière fois</Lbl>
          <div className="cst-mono" style={{ fontSize: 11, marginTop: 3, opacity: 0.75 }}>
            77,5 kg × 10 · RPE 8
          </div>
        </Card>
      </div>
    ),
  },
  {
    title: "Le RPE, c'est la clé",
    text: "À quel point c'était dur, de 1 à 10. RPE 8 = il te restait 2 répétitions. C'est là-dessus que ton coach décide de charger plus ou moins.",
    pill: "Sois honnête, toujours",
    screen: (
      <div style={col()}>
        <Lbl>Ta série est faite</Lbl>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["Poids", "80"],
            ["Reps", "9"],
          ].map(([k, v]) => (
            <div key={k} style={{ flex: 1 }}>
              <Card>
                <Lbl>{k}</Lbl>
                <div className="cst-mono" style={{ fontSize: 15 }}>
                  {v}
                </div>
              </Card>
            </div>
          ))}
        </div>
        <Lbl>Ton RPE ressenti</Lbl>
        <div style={{ display: "flex", gap: 5 }}>
          {[6, 7, 8, 9, 10].map((n) => (
            <span
              key={n}
              className="cst-mono"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "7px 0",
                borderRadius: 7,
                fontSize: 12,
                border: n === 8 ? `1px solid ${C.gold}` : C.line,
                background: n === 8 ? "rgba(212,165,59,0.16)" : C.card,
                color: n === 8 ? C.gold : "inherit",
              }}
            >
              {n}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>RPE 8 — il te restait 2 reps en réserve.</div>
      </div>
    ),
  },
  {
    title: "Le repos se gère seul",
    text: "Le chrono démarre tout seul. Tu peux l'allonger, l'écourter ou le passer. Ton téléphone vibre quand c'est reparti.",
    pill: "Note pendant le repos",
    screen: (
      <div style={{ ...col(10), alignItems: "center" }}>
        <Lbl>— Repos</Lbl>
        <div className="cst-display" style={{ fontSize: 42 }}>
          1:30
        </div>
        <div style={{ display: "flex", gap: 6, width: "100%" }}>
          <div style={{ flex: 1 }}>
            <Btn ghost>−15 s</Btn>
          </div>
          <div style={{ flex: 1 }}>
            <Btn ghost>❚❚</Btn>
          </div>
          <div style={{ flex: 1 }}>
            <Btn ghost>+15 s</Btn>
          </div>
        </div>
        <div style={{ width: "100%" }}>
          <Card>
            <Lbl>Après le repos</Lbl>
            <div className="cst-display" style={{ fontSize: 12, marginTop: 3 }}>
              BACK SQUAT · SÉRIE 3/4
            </div>
          </Card>
        </div>
      </div>
    ),
  },
  {
    title: "Machine prise ? Tu changes",
    text: "Un bouton, tu choisis l'exercice libre et tu y vas. L'app te ramènera automatiquement sur ceux qu'il te reste.",
    pill: "Plus jamais bloqué",
    screen: (
      <div style={col()}>
        <div
          className="cst-mono"
          style={{
            border: "1px dashed rgba(255,255,255,0.28)",
            borderRadius: 8,
            padding: "9px 0",
            textAlign: "center",
            fontSize: 10,
            letterSpacing: "0.06em",
          }}
        >
          ⤼ PASSER / CHOISIR UN AUTRE EXERCICE
        </div>
        {[
          ["✓ Back squat", "FAIT", C.green],
          ["□ Leg curl", "ALLER →", C.green],
          ["□ Fentes bulgares", "À FAIRE", ""],
        ].map(([name, tag, color], i) => (
          <Card key={name} accent={i === 1 ? C.green : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12 }}>{name}</span>
              <span
                className="cst-mono"
                style={{ fontSize: 9, color: color || "rgba(255,255,255,0.45)" }}
              >
                {tag}
              </span>
            </div>
          </Card>
        ))}
      </div>
    ),
  },
  {
    title: "Rien ne s'oublie",
    text: "Le résumé montre ce qui est fait, en cours et à faire. La séance ne se termine que lorsque tout est bouclé.",
    pill: "Touche un exo pour y aller",
    screen: (
      <div style={col()}>
        <div className="cst-display" style={{ fontSize: 14 }}>
          RÉSUMÉ DE SÉANCE
        </div>
        {[
          ["✓ Back squat", "4/4", C.green],
          ["✓ Leg curl", "3/3", C.green],
          ["… Fentes bulgares", "1/3", C.gold],
          ["□ Gainage", "0/3", ""],
        ].map(([name, n, color]) => (
          <Card key={name} accent={color === C.gold ? C.gold : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12 }}>{name}</span>
              <span
                className="cst-mono"
                style={{ fontSize: 10, color: color || "rgba(255,255,255,0.45)" }}
              >
                {n}
              </span>
            </div>
          </Card>
        ))}
      </div>
    ),
  },
  {
    title: "Tu termines, il reçoit",
    text: "Ton volume, ton RPE moyen, et un mot si tu veux. Un clic et tout part chez ton coach.",
    pill: "Deux mots valent dix messages",
    screen: (
      <div style={col()}>
        <Lbl>✓ Séance terminée</Lbl>
        <div className="cst-display" style={{ fontSize: 20 }}>
          BIEN JOUÉ.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["Volume", "4,2 t"],
            ["RPE moy", "7,8"],
          ].map(([k, v]) => (
            <div key={k} style={{ flex: 1 }}>
              <Card>
                <Lbl>{k}</Lbl>
                <div className="cst-mono" style={{ fontSize: 14 }}>
                  {v}
                </div>
              </Card>
            </div>
          ))}
        </div>
        <Card>
          <Lbl>Un mot pour ton coach</Lbl>
          <div style={{ fontSize: 11, fontStyle: "italic", opacity: 0.75, marginTop: 3 }}>
            « Épaule ok, squat lourd sur la 4e »
          </div>
        </Card>
        <Btn>TERMINER LA SÉANCE ✓</Btn>
      </div>
    ),
  },
  {
    title: "Et ça recommence",
    text: "Ton carnet, tes progrès, tes badges. Plus tu remplis honnêtement, plus ton coach t'adapte finement la semaine suivante.",
    pill: "C'est tout le principe",
    screen: (
      <div style={col()}>
        {[
          ["📖 CARNET", "Ton bilan de la semaine + le mot du coach."],
          ["📈 PROGRÈS", "Tes courbes, tes records, tes badges."],
          ["💬 MESSAGES", "Une question ? Ton coach répond."],
        ].map(([t, d]) => (
          <Card key={t}>
            <div className="cst-display" style={{ fontSize: 12 }}>
              {t}
            </div>
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>{d}</div>
          </Card>
        ))}
        <Card accent="rgba(110,171,118,0.5)">
          <div style={{ fontSize: 11 }}>
            Tu peux revoir cette visite à tout moment dans Réglages.
          </div>
        </Card>
      </div>
    ),
  },
];

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(STEPS.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  function finish() {
    markTourSeen();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visite guidée de l'application"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(8,14,10,0.94)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* progression */}
        <div style={{ display: "flex", gap: 4, paddingTop: 4 }}>
          {STEPS.map((_, n) => (
            <button
              key={n}
              onClick={() => setI(n)}
              aria-label={`Étape ${n + 1}`}
              style={{
                flex: 1,
                height: 3,
                border: 0,
                padding: 0,
                borderRadius: 2,
                cursor: "pointer",
                background: n <= i ? C.green : "rgba(255,255,255,0.16)",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="cst-mono"
            style={{ fontSize: 9, letterSpacing: "0.2em", color: C.green }}
          >
            ÉTAPE {String(i + 1).padStart(2, "0")} / {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="cst-mono"
            style={{
              background: "none",
              border: 0,
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              letterSpacing: "0.1em",
              cursor: "pointer",
              padding: 4,
            }}
          >
            PASSER ✕
          </button>
        </div>

        {/* écran reconstitué */}
        <div
          key={i}
          className="cst-card-dark"
          style={{ padding: 14, borderRadius: 14, animation: "cstTourIn .35s ease both" }}
        >
          {step.screen}
        </div>

        {/* explication */}
        <div>
          <div className="cst-display" style={{ fontSize: 22, lineHeight: 1.1 }}>
            {step.title}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.75, margin: "8px 0 0" }}>
            {step.text}
          </p>
          <div
            className="cst-mono"
            style={{
              display: "inline-block",
              marginTop: 10,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.gold,
              border: "1px solid rgba(212,165,59,0.4)",
              background: "rgba(212,165,59,0.09)",
              borderRadius: 99,
              padding: "5px 11px",
            }}
          >
            {step.pill}
          </div>
        </div>

        {/* navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingBottom: 8 }}>
          {i > 0 && (
            <button
              onClick={() => setI(i - 1)}
              className="cst-btn cst-btn-ghost-dark"
              style={{ flex: 1, fontSize: 11 }}
            >
              ← PRÉCÉDENT
            </button>
          )}
          <button
            onClick={() => (last ? finish() : setI(i + 1))}
            className="cst-btn cst-btn-primary"
            style={{ flex: 2, fontSize: 11, padding: "13px 0" }}
          >
            {last ? "C'EST PARTI ✓" : "SUIVANT →"}
          </button>
        </div>
      </div>
      <style>{`@keyframes cstTourIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){[style*="cstTourIn"]{animation:none!important}}`}</style>
    </div>
  );
}
