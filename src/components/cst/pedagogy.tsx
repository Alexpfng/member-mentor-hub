/* ColosmartTraining — pedagogy layer
   Isolated color tokens (do NOT pollute the brand palette).
   All components live here to keep things contained. */

import { useEffect, useState } from "react";

/* ───────── Color codes ───────── */

export type ExerciseColor = "red" | "green" | "yellow" | "blue" | null | undefined;

const COLOR_HEX: Record<NonNullable<ExerciseColor>, string> = {
  red: "#C9483A",
  green: "#3A8A4D",
  yellow: "#D4A53B",
  blue: "#3E7AA8",
};

const COLOR_META: Record<
  NonNullable<ExerciseColor>,
  { title: string; subtitle: string; rule: string; rpeTarget: string }
> = {
  red: {
    title: "MOUVEMENT DE FORCE",
    subtitle: "Risque d'imbalance — réserve obligatoire",
    rule: "Garde 1 à 2 reps en réserve sur CHAQUE série. Approche-toi de l'échec sans jamais l'atteindre complètement.",
    rpeTarget: "RPE 7-8 sur les premières séries, max 9 sur la dernière.",
  },
  green: {
    title: "ISOLATION",
    subtitle: "Approche l'échec en fin de série",
    rule: "Garde 1 rep en réserve max. Sur ta dernière série : presque l'échec.",
    rpeTarget: "RPE 8-9. Dernière série 9-10.",
  },
  yellow: {
    title: "EXPLOSIF / PLYO",
    subtitle: "Qualité avant quantité",
    rule: "Concentre-toi sur le temps de contact au sol et l'intention. Saute haut, réagis vite. JAMAIS d'échec.",
    rpeTarget: "RPE 6-7. Réduis les reps si la vitesse baisse.",
  },
  blue: {
    title: "PRÉVENTION / GAINAGE",
    subtitle: "Forme, contrôle, mind-muscle",
    rule: "Prévention de blessure et stabilité. Contrôle total. Pas de fatigue excessive.",
    rpeTarget: "RPE 3-5. La technique prime.",
  },
};

export function colorHex(c: ExerciseColor): string | undefined {
  return c ? COLOR_HEX[c] : undefined;
}

export function ColorDot({
  color,
  size = 12,
  onClick,
}: {
  color: ExerciseColor;
  size?: number;
  onClick?: () => void;
}) {
  if (!color) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Voir le code couleur"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLOR_HEX[color],
        border: 0,
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 0 0 2px rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
      aria-label={`Code couleur ${color}`}
    />
  );
}

/* ───────── Tap-anywhere modal shell ───────── */

export function CSTModal({
  open,
  onClose,
  children,
  maxWidth = 460,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#243029",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 24,
          color: "#fff",
        }}
        className="cst-hatch"
      >
        {children}
        <button
          type="button"
          onClick={onClose}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ marginTop: 18, width: "100%" }}
        >
          Compris ✓
        </button>
      </div>
    </div>
  );
}

/* ───────── Color tooltip ───────── */

export function ColorTooltip({
  color,
  open,
  onClose,
}: {
  color: ExerciseColor;
  open: boolean;
  onClose: () => void;
}) {
  if (!color) return null;
  const m = COLOR_META[color];
  return (
    <CSTModal open={open} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <ColorDot color={color} size={18} />
        <h3 className="cst-display" style={{ margin: 0, fontSize: 22 }}>
          {m.title}
        </h3>
      </div>
      <p className="cst-italic" style={{ margin: "0 0 14px", opacity: 0.8, fontSize: 14 }}>
        {m.subtitle}
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55 }}>{m.rule}</p>
      <div
        className="cst-mono"
        style={{ fontSize: 10, padding: 12, background: "rgba(0,0,0,0.25)", borderRadius: 8 }}
      >
        {m.rpeTarget}
      </div>
    </CSTModal>
  );
}

/* ───────── RPE guidance line (above the selector) ───────── */

const RPE_GUIDANCE: Record<NonNullable<ExerciseColor>, string> = {
  red: "🔴 Force : 1-2 reps en réserve — vise RPE 7-8",
  green: "🟢 Isolation : 1 rep en réserve max — approche l'échec",
  yellow: "🟡 Explosif : qualité > quantité — jamais d'échec",
  blue: "🔵 Prévention : contrôle total — pas de fatigue excessive",
};

export function RPEGuidance({ color }: { color: ExerciseColor }) {
  if (!color) return null;
  return (
    <div
      className="cst-mono"
      style={{
        fontSize: 10,
        padding: "8px 12px",
        background: `${COLOR_HEX[color]}1F`,
        border: `1px solid ${COLOR_HEX[color]}55`,
        borderRadius: 6,
        color: "#fff",
        opacity: 0.95,
        letterSpacing: "0.08em",
      }}
    >
      {RPE_GUIDANCE[color]}
    </div>
  );
}

/* ───────── RPE Feedback (toast) after logging ───────── */

export function rpeFeedbackMessage(
  color: ExerciseColor,
  rpe: number,
  isLastSet = false,
): string | null {
  if (!color) return null;
  if (color === "red" && rpe >= 10)
    return "⚠️ Échec sur un mouvement de force. Réduis la charge la semaine prochaine — garde 1-2 reps en réserve.";
  if (color === "green" && isLastSet && rpe <= 6)
    return "💡 Sur les exercices d'isolation, approche-toi de l'échec sur ta dernière série. Tu as encore de la marge.";
  if (color === "yellow" && rpe >= 9)
    return "⚠️ Sur les explosifs, la qualité prime. Réduis les reps pour maintenir la vitesse d'exécution.";
  if (color === "blue" && rpe >= 8)
    return "💡 Sur la prévention, vise un RPE plus bas (3-5). Contrôle, pas fatigue.";
  return null;
}

/* ───────── RPE Reference Sheet ───────── */

const RPE_SCALE = [
  { v: 10, t: "Échec total. Impossible 1 rep de plus." },
  { v: 9, t: "1 rep possible. Très dur." },
  { v: 8, t: "2 reps possibles. Zone force 🔴" },
  { v: 7, t: "3 reps possibles. Modéré — progression." },
  { v: 6, t: "4 reps possibles. Confortable." },
  { v: 5, t: "5 reps possibles. Facile." },
  { v: 4, t: "Très facile. Charge probablement légère." },
  { v: 3, t: "Mobilité / prévention 🔵" },
  { v: 2, t: "Minimal. Échauffement." },
  { v: 1, t: "Presque pas d'effort." },
];

export function RPEReferenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CSTModal open={open} onClose={onClose} maxWidth={500}>
      <h3 className="cst-display" style={{ margin: 0, fontSize: 22 }}>
        Échelle RPE
      </h3>
      <p className="cst-mono" style={{ marginTop: 4, marginBottom: 16, fontSize: 10 }}>
        — RATING OF PERCEIVED EXERTION
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RPE_SCALE.map((r) => (
          <div
            key={r.v}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.20)",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <span
              className="cst-display"
              style={{
                fontSize: 18,
                minWidth: 24,
                textAlign: "center",
                color: r.v >= 9 ? "#C9483A" : r.v >= 7 ? "#D4A53B" : "#fff",
              }}
            >
              {r.v}
            </span>
            <span style={{ opacity: 0.85 }}>{r.t}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: "rgba(45,90,53,0.15)",
          border: "1px solid rgba(45,90,53,0.35)",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        💡 Note le RPE <strong>immédiatement</strong> après chaque exercice.<br />
        💡 Si ton RPE remonte vs la semaine dernière pour la même charge → n'augmente pas. Le corps est plus fatigué.
      </div>
    </CSTModal>
  );
}

/* ───────── Tempo ───────── */

export function parseTempo(t?: string | null) {
  if (!t || t.length < 4) return null;
  const ch = (i: number): number | "X" =>
    t[i] === "X" || t[i] === "x" ? "X" : parseInt(t[i]);
  const bottomPause = ch(1);
  const topPause = ch(3);
  return {
    eccentric: ch(0),
    bottomPause: typeof bottomPause === "number" ? bottomPause : 0,
    concentric: ch(2),
    topPause: typeof topPause === "number" ? topPause : 0,
  };
}

export function TempoBadge({
  tempo,
  onClick,
}: {
  tempo?: string | null;
  onClick?: () => void;
}) {
  const p = parseTempo(tempo);
  if (!p) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="cst-mono"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.85)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 10,
        letterSpacing: "0.18em",
        cursor: onClick ? "pointer" : "default",
      }}
      title="Voir le tempo"
    >
      {p.eccentric}·{p.bottomPause}·{p.concentric}·{p.topPause}
    </button>
  );
}

export function TempoExplainer({
  open,
  onClose,
  tempo,
  startsAtTop = true,
  name,
}: {
  open: boolean;
  onClose: () => void;
  tempo?: string | null;
  startsAtTop?: boolean;
  name?: string;
}) {
  const p = parseTempo(tempo);
  const [playKey, setPlayKey] = useState(0);
  if (!p) return null;

  const phase1Label = startsAtTop ? "DESCENTE (excentrique)" : "MONTÉE (concentrique)";
  const phase3Label = startsAtTop ? "POUSSÉE (concentrique)" : "DESCENTE (excentrique)";
  const phase2Label = startsAtTop ? "PAUSE EN BAS" : "PAUSE EN HAUT";
  const phase4Label = startsAtTop ? "ENTRE LES REPS" : "ENTRE LES REPS";

  const seconds = (v: number | "X") => (v === "X" ? "EXPLO" : `${v}s`);
  const total =
    (typeof p.eccentric === "number" ? p.eccentric : 1) +
    p.bottomPause +
    (typeof p.concentric === "number" ? p.concentric : 1) +
    p.topPause;

  return (
    <CSTModal open={open} onClose={onClose} maxWidth={520}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>
        — TEMPO {p.eccentric}·{p.bottomPause}·{p.concentric}·{p.topPause}
      </p>
      <h3 className="cst-display" style={{ margin: "6px 0 18px", fontSize: 22 }}>
        {name ?? "Cadence d'exécution"}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PhaseRow num="①" sec={seconds(p.eccentric)} arrow={startsAtTop ? "↓" : "↑"} label={phase1Label} />
        <PhaseRow num="②" sec={`${p.bottomPause}s`} arrow="─" label={phase2Label} />
        <PhaseRow num="③" sec={seconds(p.concentric)} arrow={startsAtTop ? "↑" : "↓"} label={phase3Label} />
        <PhaseRow num="④" sec={`${p.topPause}s`} arrow="─" label={phase4Label} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          key={playKey}
          style={{
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "100%",
              background: "linear-gradient(90deg, #3A6B42, #2D5A35)",
              transformOrigin: "left center",
              animation: `cstTempoFill ${Math.max(2, total)}s linear forwards`,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setPlayKey((k) => k + 1)}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ marginTop: 10 }}
        >
          ▶ Rejouer
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          fontSize: 11,
          background: "rgba(45,90,53,0.15)",
          border: "1px solid rgba(45,90,53,0.35)",
          borderRadius: 8,
        }}
      >
        💡 <strong>X</strong> = EXPLOSIF : phase aussi rapide que possible.
      </div>

      <style>{`@keyframes cstTempoFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </CSTModal>
  );
}

function PhaseRow({ num, sec, arrow, label }: { num: string; sec: string; arrow: string; label: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 70px 30px 1fr",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(0,0,0,0.20)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <span className="cst-display" style={{ fontSize: 18, color: "#3A6B42" }}>{num}</span>
      <span className="cst-mono" style={{ fontSize: 12, color: "#fff" }}>{sec}</span>
      <span style={{ fontSize: 18, textAlign: "center", color: "#6EAB76" }}>{arrow}</span>
      <span style={{ opacity: 0.85, letterSpacing: "0.04em" }}>{label}</span>
    </div>
  );
}

/* ───────── "Seen once" explainer hook ───────── */

function useSeenOnce(key: string, autoOpen: boolean) {
  const storageKey = `cst_seen_${key}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (autoOpen && typeof window !== "undefined" && !localStorage.getItem(storageKey)) {
      setOpen(true);
    }
  }, [autoOpen, storageKey]);
  const close = () => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, "true");
    setOpen(false);
  };
  return [open, close, () => setOpen(true)] as const;
}

/* ───────── Grouping (Superset / Circuit) header ───────── */

export function GroupingHeader({
  label,
  type,
}: {
  label: string;
  type: "single" | "superset" | "circuit";
}) {
  if (type === "single") return null;
  const icon = type === "superset" ? "⛓" : "⟳";
  const title = type === "superset" ? `SUPERSET ${label}` : `CIRCUIT ${label}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: "rgba(45,90,53,0.18)",
        border: "1px solid rgba(45,90,53,0.4)",
        borderRadius: 8,
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span
        className="cst-display"
        style={{ fontSize: 14, letterSpacing: "0.08em", color: "#6EAB76" }}
      >
        {title}
      </span>
    </div>
  );
}

/* ───────── Explainer modals ───────── */

export function SupersetTooltipOnce({ trigger }: { trigger: boolean }) {
  const [open, close] = useSeenOnce("superset", trigger);
  return (
    <CSTModal open={open} onClose={close} maxWidth={420}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>— SUPERSET</p>
      <h3 className="cst-display" style={{ margin: "6px 0 14px", fontSize: 20 }}>
        Enchaîne les 2 exercices
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Tu enchaînes B1 et B2 <strong>SANS récupération</strong> entre eux.
        La récup ne s'effectue <strong>QU'APRÈS</strong> le 2e exercice.
        Puis tu répètes le cycle pour chaque série.
      </p>
    </CSTModal>
  );
}

export function CARsExplainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CSTModal open={open} onClose={onClose}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>— CARs</p>
      <h3 className="cst-display" style={{ margin: "6px 0 14px", fontSize: 20 }}>
        Controlled Articular Rotations
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Mouvement circulaire LENT qui emmène l'articulation dans toute son
        amplitude avec une <strong>forte contraction musculaire</strong> autour d'elle.
      </p>
      <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
        <li>Santé articulaire</li>
        <li>Mobilité + force</li>
        <li>Prévention des blessures</li>
      </ul>
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "rgba(62,122,168,0.18)",
          border: "1px solid rgba(62,122,168,0.4)",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        ⚠️ <strong>L'intention est la clé.</strong> Pousse activement dans
        CHAQUE direction. La résistance vient de toi-même.
      </div>
    </CSTModal>
  );
}

export function RepRangeExplainerOnce({ trigger }: { trigger: boolean }) {
  const [open, close] = useSeenOnce("rep_range", trigger);
  return (
    <CSTModal open={open} onClose={close}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>— FOURCHETTE DE REPS</p>
      <h3 className="cst-display" style={{ margin: "6px 0 14px", fontSize: 20 }}>
        Vise toujours le haut
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Pour <strong>10 – 8 reps</strong> : vise <strong>10</strong> dès la
        première série. Si ton énergie baisse → descends à 9, puis 8.
      </p>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.55, opacity: 0.85 }}>
        Pour une fourchette de <strong>charge</strong> (ex: 80-70kg) : commence
        par la charge haute. Si trop dur → descends. Si elle passe → reste dessus.
      </p>
    </CSTModal>
  );
}

export function PelvisGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CSTModal open={open} onClose={onClose} maxWidth={480}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>— PLACEMENT DU BASSIN</p>
      <h3 className="cst-display" style={{ margin: "6px 0 16px", fontSize: 20 }}>
        Antéversion vs Rétroversion
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            padding: 14,
            background: "rgba(201,72,58,0.10)",
            border: "1px solid rgba(201,72,58,0.4)",
            borderRadius: 8,
          }}
        >
          <div className="cst-display" style={{ fontSize: 14, color: "#E37968", marginBottom: 4 }}>
            ❌ ANTÉVERSION — à éviter
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
            Bas du dos cambré, fesses qui ressortent, ventre en avant.
            <strong> Pression sur les lombaires.</strong>
          </p>
        </div>

        <div
          style={{
            padding: 14,
            background: "rgba(58,138,77,0.12)",
            border: "1px solid rgba(58,138,77,0.4)",
            borderRadius: 8,
          }}
        >
          <div className="cst-display" style={{ fontSize: 14, color: "#6EAB76", marginBottom: 4 }}>
            ✅ RÉTROVERSION — à rechercher
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
            Bassin <strong>basculé vers l'avant</strong>, fesses serrées, abdos engagés,
            bas du dos plaqué. <strong>Colonne neutre, protégée.</strong>
          </p>
        </div>
      </div>

      <p style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.55 }}>
        Cue mental : "serre les fesses + tire le nombril vers la colonne".
        S'applique aux gainages, hollow hold, Nordic curls, hip thrust, RDL,
        bird dog, dead bug.
      </p>
    </CSTModal>
  );
}

export function EmomExplainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <CSTModal open={open} onClose={onClose}>
      <p className="cst-mono" style={{ margin: 0, fontSize: 10 }}>— EMOM</p>
      <h3 className="cst-display" style={{ margin: "6px 0 14px", fontSize: 20 }}>
        Every Minute On the Minute
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Au début de chaque minute, tu fais les reps. Le reste de la minute = ta récupération.
        <strong> Plus tu es rapide, plus tu récupères.</strong>
      </p>
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "var(--cst-mono)",
          lineHeight: 1.6,
        }}
      >
        Min 1 → 10 reps (0:22) · repos 0:38<br />
        Min 2 → 10 reps (0:25) · repos 0:35<br />
        ...
      </div>
      <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.55, opacity: 0.85 }}>
        💡 <strong>Ladder 1/2/3</strong> : Min 1→1 rep, Min 2→2 reps, Min 3→3 reps, Min 4→1 rep…
        Densifie la séance avec une meilleure qualité.
      </p>
    </CSTModal>
  );
}
