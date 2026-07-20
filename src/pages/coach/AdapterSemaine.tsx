import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import CoachSidebar from "@/components/CoachSidebar";
import ReplaceExerciseModal from "@/components/coach/ReplaceExerciseModal";
import MultiWeekDuplicateModal from "@/components/coach/MultiWeekDuplicateModal";
import {
  getMemberWeekContext,
  saveDraftWeek,
  publishWeek,
  previewWeekChanges,
} from "@/lib/weekly-adaptation.functions";
import { normalizeWeekId } from "@/lib/coach-navigation";
import { getExerciseFeedback } from "@/lib/exercise-feedback";
import { listExercises } from "@/lib/exercises.functions";
import { setExerciseQuickCoachNote, setExerciseQuickRpe } from "@/lib/adapter-week-rpe";

type LibExercise = {
  id: string;
  name: string;
  color: string | null;
  muscle_group: string | null;
  default_tempo: string | null;
  youtube_url: string | null;
  intensity_code?: string | null;
  is_archived?: boolean | null;
};

type ProgExercise = {
  code?: string | null;
  name: string;
  block_type?: string | null;
  series?: string | number | null;
  reps?: string | number | null;
  charge?: string | null;
  tempo?: string | null;
  recup?: string | null;
  rpe_target?: string | number | null;
  color?: string | null;
  coach_notes?: string | null;
  film_requested?: boolean | null;
  youtube_url?: string | null;
};
type DayStructure = { label?: string; exercises?: ProgExercise[] };
type WeekStructure = { days?: DayStructure[] };

type Feedback = {
  rpe: number | null;
  pain: boolean;
  tooHard: boolean;
  tooEasy: boolean;
  failure: boolean;
};

const QUICK_RPE_VALUES = Array.from({ length: 21 }, (_, index) => index * 0.5);

function formatRpeValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

type Suggestion =
  | { type: "pain"; actions: { label: string; apply?: (ex: ProgExercise) => ProgExercise }[] }
  | {
      type: "too_hard" | "high" | "low" | "slightly_low";
      actions: { label: string; apply: (ex: ProgExercise) => ProgExercise }[];
    };

function nextChargeDelta(charge: string | null | undefined, deltaPct: number): string | null {
  const n = Number(charge);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round(n * (1 + deltaPct) * 2) / 2);
}
function nextChargePlus(charge: string | null | undefined, kg: number): string | null {
  const n = Number(charge);
  if (Number.isNaN(n) || n <= 0) return null;
  return String(Math.round((n + kg) * 2) / 2);
}

function suggestFor(ex: ProgExercise, fb: Feedback | undefined): Suggestion | null {
  if (!fb) return null;
  const target = Number(ex.rpe_target);
  if (fb.pain) {
    return {
      type: "pain",
      actions: [{ label: "Réduire amplitude (note)" }, { label: "Mettre en pause" }],
    };
  }
  if (fb.failure || (fb.rpe != null && fb.rpe >= 10)) {
    return {
      type: "too_hard",
      actions: [
        {
          label: `−10% → ${nextChargeDelta(ex.charge, -0.1) ?? "?"} kg`,
          apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.1) ?? e.charge }),
        },
        {
          label: `−5% → ${nextChargeDelta(ex.charge, -0.05) ?? "?"} kg`,
          apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe >= target + 1) {
    return {
      type: "high",
      actions: [
        {
          label: `−5% → ${nextChargeDelta(ex.charge, -0.05) ?? "?"} kg`,
          apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe <= target - 2) {
    return {
      type: "low",
      actions: [
        {
          label: `+2,5 kg → ${nextChargePlus(ex.charge, 2.5) ?? "?"}`,
          apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }),
        },
        {
          label: "+1 rep",
          apply: (e) => ({
            ...e,
            reps:
              typeof e.reps === "number" || /^\d+$/.test(String(e.reps ?? ""))
                ? Number(e.reps) + 1
                : e.reps,
          }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.rpe != null && !Number.isNaN(target) && fb.rpe <= target - 1) {
    return {
      type: "slightly_low",
      actions: [
        {
          label: `+2,5 kg → ${nextChargePlus(ex.charge, 2.5) ?? "?"}`,
          apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  }
  if (fb.tooHard)
    return {
      type: "high",
      actions: [
        {
          label: `−5%`,
          apply: (e) => ({ ...e, charge: nextChargeDelta(e.charge, -0.05) ?? e.charge }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  if (fb.tooEasy)
    return {
      type: "low",
      actions: [
        {
          label: `+2,5 kg`,
          apply: (e) => ({ ...e, charge: nextChargePlus(e.charge, 2.5) ?? e.charge }),
        },
        { label: "Garder", apply: (e) => e },
      ],
    };
  return null;
}

const COLOR_MAP: Record<string, { bg: string; label: string }> = {
  red: { bg: "#C44A3A", label: "Force / Épuisant" },
  green: { bg: "#5BA85A", label: "Isolation" },
  yellow: { bg: "#D4A82E", label: "Explosivité" },
  lime: { bg: "#E8D44A", label: "Mobilité" },
  blue: { bg: "#4A8BC4", label: "Technique" },
};

function ColorDot({ c }: { c?: string | null }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: COLOR_MAP[(c || "").toLowerCase()]?.bg || "#666",
      }}
    />
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (c: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>
        COULEUR
      </span>
      {Object.entries(COLOR_MAP).map(([key, { bg, label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: bg,
            border: "none",
            cursor: "pointer",
            outline:
              (value || "").toLowerCase() === key ? `2px solid #fff` : "2px solid transparent",
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}

function sessionLabel(index: number) {
  return `Séance ${index + 1}`;
}

function emptySession(index: number): DayStructure {
  return { label: sessionLabel(index), exercises: [] };
}

// Map exercise library color (FR words or hex names) to our 4 buckets
function libColorToKey(c: string | null | undefined): string {
  const v = (c || "").toLowerCase();
  if (["red", "rouge", "force"].some((k) => v.includes(k))) return "red";
  if (["green", "vert", "isol"].some((k) => v.includes(k))) return "green";
  if (["lime", "clair", "mobil"].some((k) => v.includes(k))) return "lime";
  if (["yellow", "jaune", "explo"].some((k) => v.includes(k))) return "yellow";
  if (["blue", "bleu", "tech"].some((k) => v.includes(k))) return "blue";
  return "green";
}

// ─── Library picker: browse + click to add an exercise to a day ───────────────
function LibraryPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (ex: LibExercise) => void;
}) {
  const listFn = useServerFn(listExercises);
  const [exercises, setExercises] = useState<LibExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listFn()
      .then((r) => setExercises((r.exercises ?? []).filter((e: LibExercise) => !e.is_archived)))
      .finally(() => setLoading(false));
  }, [listFn]);

  const norm = (s: string | null | undefined) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = useMemo(() => {
    const q = norm(query);
    return exercises.filter((e) => !q || norm(e.name).includes(q)).slice(0, 120);
  }, [exercises, query]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{
          width: 460,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 20,
          borderRadius: 12,
        }}
      >
        <div
          className="cst-mono"
          style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em", marginBottom: 8 }}
        >
          BIBLIOTHÈQUE · AJOUTER UN EXERCICE
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un exercice…"
          className="cst-input"
          style={{ width: "100%", marginBottom: 12 }}
        />
        <div
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {loading ? (
            <div style={{ opacity: 0.5, fontSize: 12, padding: 12 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 12, padding: 12 }}>
              Aucun exercice. Tape un nom puis « Créer ».
            </div>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onPick(ex)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--cst-text)",
                }}
              >
                <ColorDot c={libColorToKey(ex.color)} />
                <span style={{ flex: 1, fontSize: 13 }}>{ex.name}</span>
                {ex.muscle_group && (
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45 }}>
                    {ex.muscle_group}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        {query.trim() && (
          <button
            onClick={() =>
              onPick({
                id: "new",
                name: query.trim(),
                color: null,
                muscle_group: null,
                default_tempo: null,
                youtube_url: null,
              })
            }
            className="cst-btn cst-btn-ghost-dark"
            style={{ marginTop: 10 }}
          >
            + Créer « {query.trim()} »
          </button>
        )}
        <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ marginTop: 8 }}>
          Fermer
        </button>
      </div>
    </div>
  );
}

// ─── Exercise edit modal: full detail editing for one card ────────────────────
function ExoEditModal({
  ex,
  fb,
  suggestion,
  weekNumber,
  onChange,
  onReplace,
  onDelete,
  onClose,
}: {
  ex: ProgExercise;
  fb: Feedback | undefined;
  suggestion: Suggestion | null;
  weekNumber: number | null;
  onChange: (fn: (e: ProgExercise) => ProgExercise) => void;
  onReplace: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Ne ferme la modale que si le clic COMMENCE et FINIT sur le fond : évite la
  // fermeture intempestive quand on sélectionne du texte et qu'on relâche hors du champ.
  const overlayDownRef = useRef(false);
  const field = (label: string, node: React.ReactNode) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.1em" }}>
        {label}
      </span>
      {node}
    </label>
  );
  return (
    <div
      onMouseDown={(e) => {
        overlayDownRef.current = e.target === e.currentTarget;
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 440, maxHeight: "88vh", overflowY: "auto", padding: 22, borderRadius: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <ColorDot c={ex.color} />
          <input
            value={ex.name}
            onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))}
            className="cst-display"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--cst-text)",
              fontSize: 18,
            }}
          />
        </div>

        {suggestion && (
          <div
            style={{
              marginBottom: 14,
              padding: "8px 10px",
              background: "rgba(212,168,46,0.08)",
              border: "1px solid rgba(212,168,46,0.25)",
              borderRadius: 6,
            }}
          >
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.8, marginBottom: 6 }}>
              {suggestion.type === "pain" && `🔴 Douleur signalée en S${weekNumber}`}
              {suggestion.type === "too_hard" && `⚠ Trop dur (RPE ${fb?.rpe ?? "?"})`}
              {suggestion.type === "high" && `⚠ RPE haut (${fb?.rpe} vs cible ${ex.rpe_target})`}
              {suggestion.type === "low" && `↓ Marge de progression (RPE ${fb?.rpe})`}
              {suggestion.type === "slightly_low" && `↓ Légèrement sous la cible (RPE ${fb?.rpe})`}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {suggestion.actions.map((a, ai) => (
                <button
                  key={ai}
                  onClick={() => {
                    if (a.apply) onChange(a.apply);
                  }}
                  className="cst-btn cst-btn-sm"
                  style={{
                    background: "rgba(212,168,46,0.2)",
                    border: "1px solid rgba(212,168,46,0.4)",
                    color: "var(--cst-text)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          {ex.block_type === "emom"
            ? field(
                "DURÉE (min)",
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={String(ex.series ?? "").replace(/[^0-9]/g, "") || "10"}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) onChange((x) => ({ ...x, series: `EMOM${v}'` }));
                  }}
                  className="cst-input"
                />,
              )
            : field(
                "SÉRIES",
                <input
                  value={String(ex.series ?? "")}
                  onChange={(e) => onChange((x) => ({ ...x, series: e.target.value }))}
                  className="cst-input"
                />,
              )}
          {field(
            ex.block_type === "emom" ? "REPS/MIN" : "REPS",
            <input
              value={String(ex.reps ?? "")}
              onChange={(e) => onChange((x) => ({ ...x, reps: e.target.value }))}
              className="cst-input"
            />,
          )}
          {field(
            "CHARGE (kg)",
            <input
              value={ex.charge ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, charge: e.target.value }))}
              className="cst-input"
            />,
          )}
          {field(
            "RPE / CONSIGNE",
            <input
              inputMode="text"
              placeholder="ex. 8,5 ou échec"
              value={String(ex.rpe_target ?? "")}
              onChange={(e) => onChange((x) => ({ ...x, rpe_target: e.target.value }))}
              className="cst-input"
            />,
          )}
          {field(
            "TEMPO",
            <input
              value={ex.tempo ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, tempo: e.target.value || null }))}
              placeholder="3-1-2"
              className="cst-input"
            />,
          )}
          {field(
            "RÉCUP",
            <input
              value={ex.recup ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, recup: e.target.value || null }))}
              placeholder="90s"
              className="cst-input"
            />,
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          {field(
            "NOTE POUR LE MEMBRE",
            <textarea
              value={ex.coach_notes ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, coach_notes: e.target.value || null }))}
              placeholder="Consigne technique… (Entrée = nouvelle ligne)"
              className="cst-input"
              rows={7}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 150,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            />,
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!ex.film_requested}
              onChange={(e) =>
                onChange((x) => ({ ...x, film_requested: e.target.checked || null }))
              }
            />
            <span className="cst-mono" style={{ fontSize: 11, letterSpacing: "0.12em" }}>
              📹 DEMANDER UNE VIDÉO AU MEMBRE
            </span>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          {field(
            "VIDÉO (YouTube)",
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={ex.youtube_url ?? ""}
                onChange={(e) => onChange((x) => ({ ...x, youtube_url: e.target.value || null }))}
                placeholder="Coller un lien YouTube…"
                className="cst-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              {ex.youtube_url && (
                <a
                  href={ex.youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                  style={{ whiteSpace: "nowrap", textDecoration: "none" }}
                >
                  ▶ Voir
                </a>
              )}
            </div>,
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <ColorPicker value={ex.color} onChange={(c) => onChange((x) => ({ ...x, color: c }))} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onReplace} className="cst-btn cst-btn-ghost-dark cst-btn-sm">
              ⇄ Remplacer
            </button>
            <button
              onClick={onDelete}
              className="cst-btn cst-btn-sm"
              style={{
                background: "transparent",
                border: "1px solid rgba(196,74,58,0.4)",
                color: "#C44A3A",
              }}
            >
              🗑 Supprimer
            </button>
          </div>
          <button onClick={onClose} className="cst-btn cst-btn-primary cst-btn-sm">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Séances d'endurance où les exercices/consignes doivent être fusionnés en une seule
// carte (course, natation, renfo, trail…). En muscu, au contraire, chaque exercice est
// réel et garde sa carte + son RPE : on n'y fusionne JAMAIS, même si le RPE contient du
// texte parasite. La fusion est donc conditionnée au type de séance (libellé du jour).
const ENDURANCE_SESSION_RE =
  /(course|courir|footing|run(?:ning)?|natation|nage|swim|renfo|renforcement|trail|cardio|endurance|sortie|v[ée]lo|marche)/i;
function isEnduranceSession(day: { label?: string | null } | null | undefined): boolean {
  return ENDURANCE_SESSION_RE.test(day?.label ?? "");
}

// Un « exercice » cardio / course : soit block_type cardio, soit un bloc de consignes
// texte importé (rpe_target non numérique). On les détecte pour fusionner une séance de
// course — exercice réel + lignes de consignes — en une seule carte (comme côté membre).
function isCardioExo(ex: ProgExercise): boolean {
  if ((ex.block_type ?? "").toLowerCase() === "cardio") return true;
  const rpe = String(ex.rpe_target ?? "").trim();
  return !!(rpe && Number.isNaN(Number(rpe.replace(",", "."))) && rpe.length > 3);
}
// Texte de consigne porté par un exercice cardio (stocké dans rpe_target non numérique).
function cardioConsigneText(ex: ProgExercise): string | null {
  const rpe = String(ex.rpe_target ?? "").trim();
  return rpe && Number.isNaN(Number(rpe.replace(",", "."))) ? rpe : null;
}

// Code de bloc (A1, B2…) → lettre du groupe. Deux exercices ou plus qui partagent
// la lettre (B1, B2…) forment un enchaînement / superset — c'est ainsi qu'ils sont
// repérés dans les Google Sheets. On affiche le code + un bandeau pour que le coach
// voie l'enchaînement au lieu de cartes isolées.
function blockLetterOf(code?: string | null): string | null {
  const m = /^([A-Za-z])\d/.exec(String(code ?? "").trim());
  return m ? m[1].toUpperCase() : null;
}

export default function AdapterSemaine() {
  const { memberId } = useParams({ from: "/_authenticated/coach/membre/$memberId/adapter" });
  const search = useSearch({ from: "/_authenticated/coach/membre/$memberId/adapter" }) as {
    week?: number;
    weekId?: string;
  };
  const safeWeekId = normalizeWeekId(search.weekId);
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMemberWeekContext);
  const saveFn = useServerFn(saveDraftWeek);
  const publishFn = useServerFn(publishWeek);
  const previewFn = useServerFn(previewWeekChanges);

  type Ctx = Awaited<ReturnType<typeof getMemberWeekContext>>;
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [structure, setStructure] = useState<WeekStructure>({ days: [] });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [changes, setChanges] = useState<Array<{ type: string; label: string }>>([]);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<{
    dayIdx: number;
    exoIdx: number;
    ex: ProgExercise;
  } | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<{ dayIdx: number; exoIdx: number } | null>(null);
  const [libraryTarget, setLibraryTarget] = useState<number | null>(null);
  const [quickRpeTarget, setQuickRpeTarget] = useState<{ dayIdx: number; exoIdx: number } | null>(
    null,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickRpePopoverRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const c = await fetchCtx({
        data: { memberId, weekNumber: search.week, ...(safeWeekId ? { weekId: safeWeekId } : {}) },
      });
      setCtx(c);
      setStructure((c.week.structure as WeekStructure) ?? { days: [] });
      const isAlreadyPublished = ["published", "in_progress"].includes(c.week.status);
      setMessage(
        isAlreadyPublished
          ? `Mise à jour de ta semaine ${c.week.week_number}, ${c.member.name.split(" ")[0]}. Vérifie les changements 👀`
          : `Nouvelle semaine prête, ${c.member.name.split(" ")[0]}. À toi de jouer 💪`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [memberId, search.week, safeWeekId]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!quickRpeTarget) return;
      if (quickRpePopoverRef.current?.contains(event.target as Node)) return;
      setQuickRpeTarget(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [quickRpeTarget]);

  // Auto-save with debounce
  useEffect(() => {
    if (!ctx?.week.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveFn({ data: { weekId: ctx.week.id, structure } });
        setSavedAt(Date.now());
      } catch (e) {
        console.error("[autosave]", e);
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [structure, ctx?.week.id, saveFn]);

  function updateExo(dayIdx: number, exoIdx: number, fn: (ex: ProgExercise) => ProgExercise) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      const exos = [...(day.exercises ?? [])];
      exos[exoIdx] = fn(exos[exoIdx]);
      day.exercises = exos;
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  function removeExo(dayIdx: number, exoIdx: number) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      day.exercises = (day.exercises ?? []).filter((_, i) => i !== exoIdx);
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  // Réordonne un exercice (ou un bloc cardio fusionné de `len` exercices) dans sa séance.
  // dir = -1 monter, +1 descendre. Pour un exercice simple, len = 1.
  function moveBlock(dayIdx: number, startIdx: number, len: number, dir: -1 | 1) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      const exos = [...(day.exercises ?? [])];
      if (dir === -1) {
        if (startIdx <= 0) return s;
        const block = exos.splice(startIdx, len);
        exos.splice(startIdx - 1, 0, ...block);
      } else {
        if (startIdx + len >= exos.length) return s;
        const block = exos.splice(startIdx, len);
        exos.splice(startIdx + 1, 0, ...block);
      }
      day.exercises = exos;
      days[dayIdx] = day;
      return { ...s, days };
    });
  }
  function addExoFromLibrary(dayIdx: number, lib: LibExercise) {
    setStructure((s) => {
      const days = [...(s.days ?? [])];
      const day = { ...days[dayIdx] };
      const newExo: ProgExercise = {
        name: lib.name,
        series: 3,
        reps: 10,
        charge: null,
        rpe_target: 8,
        color: libColorToKey(lib.color),
        tempo: lib.default_tempo ?? null,
        recup: null,
        coach_notes: null,
        youtube_url: lib.youtube_url ?? null,
        code: null,
      };
      day.exercises = [...(day.exercises ?? []), newExo];
      days[dayIdx] = day;
      return { ...s, days };
    });
    // open the new card for immediate tweaking
    const newIdx = structure.days?.[dayIdx]?.exercises?.length ?? 0;
    setLibraryTarget(null);
    setEditTarget({ dayIdx, exoIdx: newIdx });
  }
  function removeDay(dayIdx: number) {
    setStructure((s) => ({ ...s, days: (s.days ?? []).filter((_, i) => i !== dayIdx) }));
    setConfirmDeleteDay(null);
  }
  function addDay() {
    setStructure((s) => ({ ...s, days: [...(s.days ?? []), emptySession(s.days?.length ?? 0)] }));
  }

  function resetAllRpe() {
    if (!window.confirm("Effacer tous les RPE de cette semaine ?")) return;
    setStructure((s) => ({
      ...s,
      days: (s.days ?? []).map((day) => ({
        ...day,
        exercises: (day.exercises ?? []).map((ex) => {
          // N'efface que les vrais RPE numériques : un rpe_target texte est une
          // consigne cardio (héritée d'imports) qu'on doit préserver.
          const str = String(ex.rpe_target ?? "").trim();
          const isNumeric = str !== "" && !Number.isNaN(Number(str.replace(",", ".")));
          return isNumeric ? { ...ex, rpe_target: null } : ex;
        }),
      })),
    }));
    setQuickRpeTarget(null);
  }

  function applyQuickRpe(dayIdx: number, exoIdx: number, rpe: string | number | null) {
    setStructure((current) => setExerciseQuickRpe(current, dayIdx, exoIdx, rpe));
  }

  function applyQuickCoachNote(dayIdx: number, exoIdx: number, coachNote: string) {
    setStructure((current) => setExerciseQuickCoachNote(current, dayIdx, exoIdx, coachNote));
  }

  async function openPublish() {
    if (!ctx?.week.id) return;
    try {
      // Flush : le preview et la publication lisent la base — on pousse d'abord
      // l'état local, sinon les dernières frappes (< 700 ms) seraient ignorées.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saveFn({ data: { weekId: ctx.week.id, structure } });
      setSavedAt(Date.now());
      const { changes } = await previewFn({ data: { weekId: ctx.week.id } });
      setChanges(changes);
      setShowPublish(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function doPublish() {
    if (!ctx?.week.id) return;
    setPublishing(true);
    try {
      await publishFn({
        data: { weekId: ctx.week.id, notify, message: notify ? message : undefined },
      });
      setShowPublish(false);
      navigate({ to: "/coach/membre/$memberId", params: { memberId } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading)
    return (
      <Shell>
        <div style={{ opacity: 0.6, padding: 40 }}>Chargement…</div>
      </Shell>
    );
  if (err || !ctx)
    return (
      <Shell>
        <div style={{ padding: 40 }}>
          <div
            className="cst-mono"
            style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.5, marginBottom: 8 }}
          >
            ERREUR · ADAPTER SEMAINE
          </div>
          <div style={{ color: "#C44A3A", fontSize: 15, marginBottom: 20 }}>
            {err ?? "Erreur inconnue"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={load} className="cst-btn cst-btn-primary">
              Réessayer
            </button>
            <button
              onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })}
              className="cst-btn cst-btn-ghost-dark"
            >
              ← Retour fiche membre
            </button>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div style={{ padding: 20, maxWidth: 1100 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })}
            className="cst-mono"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            ← FICHE MEMBRE
          </button>
          {ctx && ctx.week.week_number > 0 && (
            <button
              onClick={() =>
                navigate({
                  to: "/coach/membre/$memberId/adapter",
                  params: { memberId },
                  search: { week: ctx.week.week_number - 1 },
                })
              }
              className="cst-mono"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.6)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              ← S{String(ctx.week.week_number - 1).padStart(2, "0")}
            </button>
          )}
          {ctx && ctx.week.week_number < ctx.maxWeekNumber && (
            <button
              onClick={() =>
                navigate({
                  to: "/coach/membre/$memberId/adapter",
                  params: { memberId },
                  search: { week: ctx.week.week_number + 1 },
                })
              }
              className="cst-mono"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.6)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              S{String(ctx.week.week_number + 1).padStart(2, "0")} →
            </button>
          )}
        </div>

        <div
          className="cst-mono"
          style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.55, marginBottom: 4 }}
        >
          ADAPTER · {ctx.member.name} · {ctx.assignment.program_name}
        </div>
        <h1 className="cst-display" style={{ fontSize: 28, marginBottom: 6 }}>
          Semaine {ctx.week.week_number}
          {ctx.week.based_on_week != null && (
            <span style={{ opacity: 0.5, fontSize: 16 }}>
              {" "}
              · copiée de S{ctx.week.based_on_week}
            </span>
          )}
        </h1>

        {(ctx.week.status === "published" || ctx.week.status === "in_progress") && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(212,168,46,0.12)",
              border: "1px solid rgba(212,168,46,0.35)",
              borderRadius: 8,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>⚠</span>
            <div>
              <div
                className="cst-mono"
                style={{ fontSize: 10, color: "#D4A82E", letterSpacing: "0.15em" }}
              >
                SEMAINE {ctx.week.status === "in_progress" ? "EN COURS" : "DÉJÀ PUBLIÉE"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                Tes modifications seront visibles par le membre après republication. Un message de
                notification lui sera envoyé.
              </div>
            </div>
          </div>
        )}

        {ctx.sourceSummary.weekNumber != null && (
          <div className="cst-mono" style={{ fontSize: 11, opacity: 0.7, marginBottom: 20 }}>
            RÉSUMÉ S{ctx.sourceSummary.weekNumber} ·
            {ctx.sourceSummary.adherence &&
              ` Adhérence ${ctx.sourceSummary.adherence.done}/${ctx.sourceSummary.adherence.total} · `}
            {ctx.sourceSummary.avgRpe != null && `RPE moy. ${ctx.sourceSummary.avgRpe} · `}
            {ctx.sourceSummary.painCount > 0
              ? `${ctx.sourceSummary.painCount} douleur(s) signalée(s)`
              : "aucune douleur"}
          </div>
        )}

        {/* Séances */}
        {(structure.days ?? []).length === 0 && (
          <div className="cst-card-dark" style={{ padding: 28, textAlign: "center" }}>
            <div className="cst-display" style={{ fontSize: 18, marginBottom: 8 }}>
              Semaine vide
            </div>
            <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 20, lineHeight: 1.5 }}>
              Cette semaine n'a pas encore de séances.
              <br />
              Commence en ajoutant une séance, ou génère depuis les séances passées.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setStructure((s) => ({ ...s, days: [emptySession(0)] }))}
                className="cst-btn cst-btn-primary"
              >
                + Ajouter une première séance
              </button>
              <button
                onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId } })}
                className="cst-btn cst-btn-ghost-dark"
              >
                ← Retour fiche membre
              </button>
            </div>
          </div>
        )}

        {/* Jours en colonnes (builder léger) */}
        {(structure.days ?? []).length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              paddingBottom: 14,
              marginBottom: 16,
              alignItems: "flex-start",
            }}
          >
            {(structure.days ?? []).map((day, di) => (
              <div
                key={di}
                className="cst-card-dark"
                style={{
                  padding: 14,
                  width: 280,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* En-tête colonne jour */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    value={day.label ?? ""}
                    onChange={(e) =>
                      setStructure((s) => {
                        const days = [...(s.days ?? [])];
                        days[di] = { ...days[di], label: e.target.value };
                        return { ...s, days };
                      })
                    }
                    placeholder={sessionLabel(di)}
                    className="cst-display"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      color: "var(--cst-text)",
                      fontSize: 15,
                      paddingBottom: 4,
                    }}
                  />
                  {confirmDeleteDay === di ? (
                    <>
                      <button
                        onClick={() => removeDay(di)}
                        style={{
                          background: "#C44A3A",
                          border: "none",
                          color: "#fff",
                          borderRadius: 5,
                          padding: "3px 7px",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setConfirmDeleteDay(null)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.2)",
                          color: "var(--cst-text-soft)",
                          borderRadius: 5,
                          padding: "3px 7px",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        Non
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteDay(di)}
                      title="Supprimer ce jour"
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(196,74,58,0.3)",
                        color: "#C44A3A",
                        borderRadius: 5,
                        padding: "3px 7px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* Cartes exercices */}
                {(day.exercises ?? []).map((ex, ei) => {
                  const exos = day.exercises ?? [];
                  // La fusion ne s'applique qu'aux séances d'endurance (course, natation,
                  // renfo, trail…). En muscu, chaque exercice garde sa carte et son RPE.
                  const dayIsEndurance = isEnduranceSession(day);
                  // Fragment cardio qui suit un autre exercice cardio : il est absorbé dans
                  // la carte précédente (une séance de course = une seule carte).
                  if (dayIsEndurance && ei > 0 && isCardioExo(ex) && isCardioExo(exos[ei - 1]))
                    return null;
                  // Tête d'un bloc cardio : on agrège les fragments cardio consécutifs.
                  const cardioFragments: ProgExercise[] = [];
                  if (dayIsEndurance && isCardioExo(ex)) {
                    for (let k = ei + 1; k < exos.length && isCardioExo(exos[k]); k++) {
                      cardioFragments.push(exos[k]);
                    }
                  }
                  const blockLen = 1 + cardioFragments.length;
                  const fb = getExerciseFeedback(ctx.feedback, ex.name);
                  const sugg = suggestFor(ex, fb);
                  const cardColor = COLOR_MAP[(ex.color || "").toLowerCase()]?.bg || "#555";
                  const lastIdx = (day.exercises?.length ?? 1) - 1;
                  // Enchaînement (superset) : cet exercice partage sa lettre de code
                  // (B1/B2…) avec au moins un autre du même jour.
                  const blockLetter = blockLetterOf(ex.code);
                  const isSuperset =
                    !!blockLetter &&
                    exos.filter((e) => blockLetterOf(e.code) === blockLetter).length >= 2;
                  const prevLetter = ei > 0 ? blockLetterOf(exos[ei - 1]?.code) : null;
                  const nextLetter = blockLetterOf(exos[ei + 1]?.code);
                  const isBlockStart = isSuperset && blockLetter !== prevLetter;
                  const isBlockEnd = isSuperset && blockLetter !== nextLetter;
                  // Le RPE est une valeur numérique (badge). La virgule décimale (9,5)
                  // est acceptée. Tout texte libre hérité d'un ancien import cardio reste
                  // affiché sous la carte, mais ne s'affiche plus comme un badge « CONSIGNE ».
                  const rpeStr = ex.rpe_target == null ? "" : String(ex.rpe_target).trim();
                  const rpeNum = rpeStr === "" ? NaN : Number(rpeStr.replace(",", "."));
                  const rpeIsNumeric = !Number.isNaN(rpeNum);
                  const rpeDisplay = rpeIsNumeric ? rpeStr.replace(".", ",") : null;
                  const rpeIsFailure = /^(échec|echec)$/i.test(rpeStr);
                  const rpeConsigne =
                    rpeStr !== "" && !rpeIsNumeric && !rpeIsFailure ? rpeStr : null;
                  return (
                    <Fragment key={ei}>
                      {isBlockStart && (
                        <div
                          className="cst-mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            fontWeight: 700,
                            color: "var(--cst-mid-green)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 2px 0",
                          }}
                        >
                          ⛓ SUPERSET {blockLetter} · enchaîner sans repos
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          alignItems: "stretch",
                          ...(isSuperset
                            ? {
                                borderLeft: "2px solid var(--cst-mid-green)",
                                paddingLeft: 6,
                                marginLeft: 1,
                                paddingBottom: isBlockEnd ? 4 : 0,
                              }
                            : {}),
                        }}
                      >
                        <div
                          onClick={() => setEditTarget({ dayIdx: di, exoIdx: ei })}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setEditTarget({ dayIdx: di, exoIdx: ei });
                            }
                          }}
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            flex: 1,
                            minWidth: 0,
                            background: `${cardColor}0d`,
                            border: sugg
                              ? "1px solid rgba(212,168,46,0.5)"
                              : `1px solid ${cardColor}40`,
                            borderLeft: `3px solid ${cardColor}`,
                            borderRadius: 8,
                            padding: "9px 10px",
                            color: "var(--cst-text)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <ColorDot c={ex.color} />
                            {ex.code && (
                              <span
                                className="cst-mono"
                                title={isSuperset ? `Superset ${blockLetter}` : undefined}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  color: "var(--cst-mid-green)",
                                  background: "rgba(45,90,53,0.14)",
                                  border: "1px solid rgba(45,90,53,0.3)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                }}
                              >
                                {ex.code}
                              </span>
                            )}
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                              }}
                            >
                              {ex.name}
                            </span>
                            {sugg && (
                              <span title="Suggestion d'après les retours" style={{ fontSize: 11 }}>
                                {sugg.type === "pain" ? "🔴" : "⚠"}
                              </span>
                            )}
                            <div style={{ position: "relative", flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setQuickRpeTarget((current) =>
                                    current?.dayIdx === di && current?.exoIdx === ei
                                      ? null
                                      : { dayIdx: di, exoIdx: ei },
                                  );
                                }}
                                className="cst-mono"
                                title={rpeConsigne ?? "Modifier le RPE"}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  maxWidth: 90,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  background: rpeIsNumeric
                                    ? `${cardColor}33`
                                    : rpeIsFailure
                                      ? "rgba(201,72,58,0.22)"
                                      : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${rpeIsNumeric ? cardColor + "66" : rpeIsFailure ? "rgba(255,138,122,0.32)" : "rgba(255,255,255,0.12)"}`,
                                  borderRadius: 5,
                                  padding: "2px 7px",
                                  color: rpeIsNumeric
                                    ? cardColor
                                    : rpeIsFailure
                                      ? "#ffb0a5"
                                      : "rgba(255,255,255,0.35)",
                                  cursor: "pointer",
                                }}
                              >
                                {rpeIsNumeric
                                  ? `RPE ${rpeDisplay}`
                                  : rpeIsFailure
                                    ? "ÉCHEC"
                                    : "RPE —"}
                              </button>
                              {quickRpeTarget?.dayIdx === di && quickRpeTarget?.exoIdx === ei && (
                                <div
                                  ref={quickRpePopoverRef}
                                  onClick={(event) => event.stopPropagation()}
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 6px)",
                                    right: 0,
                                    zIndex: 30,
                                    width: 264,
                                    padding: 8,
                                    borderRadius: 8,
                                    background: "#223528",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                      gap: 6,
                                    }}
                                  >
                                    {QUICK_RPE_VALUES.map((value) => (
                                      <button
                                        key={String(value)}
                                        type="button"
                                        className="cst-mono"
                                        onClick={() => applyQuickRpe(di, ei, value)}
                                        style={{
                                          borderRadius: 6,
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          background:
                                            Number(rpeStr.replace(",", ".")) === value
                                              ? `${cardColor}44`
                                              : "rgba(255,255,255,0.05)",
                                          color: "#fff",
                                          WebkitTextFillColor: "#fff",
                                          appearance: "none",
                                          WebkitAppearance: "none",
                                          padding: "6px 0",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        {formatRpeValue(value)}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      className="cst-mono"
                                      onClick={() => applyQuickRpe(di, ei, "échec")}
                                      style={{
                                        gridColumn: "span 2",
                                        borderRadius: 6,
                                        border: "1px solid rgba(255,138,122,0.28)",
                                        background:
                                          String(rpeStr).trim().toLowerCase() === "échec" ||
                                          String(rpeStr).trim().toLowerCase() === "echec"
                                            ? "rgba(201,72,58,0.28)"
                                            : "rgba(255,255,255,0.05)",
                                        color: "#fff",
                                        WebkitTextFillColor: "#fff",
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        padding: "6px 0",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ÉCHEC
                                    </button>
                                    <button
                                      type="button"
                                      className="cst-mono"
                                      onClick={() => applyQuickRpe(di, ei, null)}
                                      style={{
                                        gridColumn: "span 2",
                                        borderRadius: 6,
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        background: "rgba(255,255,255,0.04)",
                                        color: "rgba(255,255,255,0.92)",
                                        WebkitTextFillColor: "rgba(255,255,255,0.92)",
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        padding: "6px 0",
                                        fontSize: 10,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Effacer le RPE
                                    </button>
                                  </div>
                                  <label
                                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                                  >
                                    <span
                                      className="cst-mono"
                                      style={{
                                        fontSize: 9,
                                        opacity: 0.65,
                                        letterSpacing: "0.12em",
                                      }}
                                    >
                                      COMMENTAIRE / CONSIGNE (OPTIONNEL)
                                    </span>
                                    <textarea
                                      value={String(ex.coach_notes ?? "")}
                                      onChange={(event) =>
                                        applyQuickCoachNote(di, ei, event.target.value)
                                      }
                                      placeholder="ex. rester propre, douleur à surveiller..."
                                      rows={3}
                                      style={{
                                        width: "100%",
                                        resize: "vertical",
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.04)",
                                        color: "#fff",
                                        padding: "10px 12px",
                                        fontSize: 12,
                                        lineHeight: 1.4,
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="cst-mono"
                            style={{
                              fontSize: 10,
                              opacity: 0.6,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              {ex.block_type === "emom"
                                ? String(ex.series ?? "EMOM")
                                : `${ex.series ?? "—"}×${ex.reps ?? "—"}`}
                            </span>
                            {ex.charge && (
                              <span>
                                {/^(pdc|bb|bw|poids du corps|pds de corps|corps|bodyweight|[-—/])$/i.test(
                                  ex.charge.trim(),
                                )
                                  ? "PDC"
                                  : /^[\d.,]+$/.test(ex.charge.trim())
                                    ? `${ex.charge.trim()}kg`
                                    : ex.charge.trim()}
                              </span>
                            )}
                            {ex.tempo && <span>⏱{ex.tempo}</span>}
                          </div>
                          {rpeConsigne && (
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.75,
                                lineHeight: 1.35,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {rpeConsigne}
                            </div>
                          )}
                          {fb?.rpe != null && (
                            <div
                              className="cst-mono"
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color:
                                  fb.rpe >= 9 ? "#C0392B" : fb.rpe >= 7 ? "#E07B39" : "#5BA85A",
                              }}
                            >
                              Retour membre S{ctx.sourceSummary.weekNumber ?? "?"} · RPE {fb.rpe}
                            </div>
                          )}
                          {ex.coach_notes && (
                            <div
                              style={{
                                fontSize: 10,
                                opacity: 0.5,
                                fontStyle: "italic",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              "{ex.coach_notes}"
                            </div>
                          )}
                          {cardioFragments.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                marginTop: 2,
                                paddingTop: 6,
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              {cardioFragments.map((f, fi) => {
                                const txt = cardioConsigneText(f);
                                return (
                                  <div
                                    key={fi}
                                    style={{
                                      fontSize: 11,
                                      lineHeight: 1.35,
                                      whiteSpace: "normal",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {f.name && (
                                      <span style={{ fontWeight: 600, opacity: 0.9 }}>
                                        {f.name}{" "}
                                      </span>
                                    )}
                                    {txt && <span style={{ opacity: 0.75 }}>{txt}</span>}
                                    {f.coach_notes && (
                                      <span style={{ opacity: 0.6, fontStyle: "italic" }}>
                                        {" "}
                                        {f.coach_notes}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: 3,
                          }}
                        >
                          <button
                            onClick={() => moveBlock(di, ei, blockLen, -1)}
                            disabled={ei === 0}
                            title="Monter"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "var(--cst-text)",
                              borderRadius: 5,
                              width: 28,
                              padding: "5px 0",
                              fontSize: 12,
                              lineHeight: 1,
                              cursor: ei === 0 ? "default" : "pointer",
                              opacity: ei === 0 ? 0.25 : 0.85,
                            }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveBlock(di, ei, blockLen, 1)}
                            disabled={ei + blockLen - 1 >= lastIdx}
                            title="Descendre"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "var(--cst-text)",
                              borderRadius: 5,
                              width: 28,
                              padding: "5px 0",
                              fontSize: 12,
                              lineHeight: 1,
                              cursor: ei + blockLen - 1 >= lastIdx ? "default" : "pointer",
                              opacity: ei + blockLen - 1 >= lastIdx ? 0.25 : 0.85,
                            }}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}

                {/* Ajouter un exercice (bibliothèque) */}
                <button
                  onClick={() => setLibraryTarget(di)}
                  style={{
                    background: "transparent",
                    border: "1px dashed rgba(255,255,255,0.2)",
                    color: "var(--cst-text-soft)",
                    borderRadius: 7,
                    padding: "9px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  + exercice
                </button>
              </div>
            ))}

            {/* Colonne « ajouter une séance » */}
            <button
              onClick={addDay}
              className="cst-card-dark"
              style={{
                width: 140,
                flexShrink: 0,
                minHeight: 90,
                border: "1px dashed rgba(255,255,255,0.18)",
                background: "transparent",
                color: "var(--cst-text-soft)",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              + Séance
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--cst-dark-green)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: "14px 0",
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            {savedAt
              ? ctx && ["published", "in_progress"].includes(ctx.week.status)
                ? `✓ Brouillon sauvegardé ${new Date(savedAt).toLocaleTimeString("fr-FR")} · visible après republication`
                : `✓ Sauvegardé ${new Date(savedAt).toLocaleTimeString("fr-FR")}`
              : "—"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={resetAllRpe}
              className="cst-btn cst-btn-ghost-dark"
              title="Effacer tous les RPE de la semaine"
            >
              Réinitialiser les RPE
            </button>
            <button onClick={() => setShowDuplicate(true)} className="cst-btn cst-btn-ghost-dark">
              Dupliquer vers…
            </button>
            <button onClick={() => setShowPreview(true)} className="cst-btn cst-btn-ghost-dark">
              Aperçu membre
            </button>
            <button onClick={openPublish} className="cst-btn cst-btn-primary">
              {ctx.week.status === "published" || ctx.week.status === "in_progress"
                ? `Republier la semaine ${ctx.week.week_number} →`
                : `Publier la semaine ${ctx.week.week_number} →`}
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          structure={structure}
          weekNumber={ctx.week.week_number}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showPublish && (
        <PublishModal
          weekNumber={ctx.week.week_number}
          memberName={ctx.member.name}
          isRepublish={ctx.week.status === "published" || ctx.week.status === "in_progress"}
          changes={changes}
          notify={notify}
          setNotify={setNotify}
          message={message}
          setMessage={setMessage}
          publishing={publishing}
          onCancel={() => setShowPublish(false)}
          onPublish={doPublish}
        />
      )}
      {replaceTarget && ctx && (
        <ReplaceExerciseModal
          weekId={ctx.week.id}
          dayIndex={replaceTarget.dayIdx}
          exoIndex={replaceTarget.exoIdx}
          currentName={replaceTarget.ex.name}
          currentPatterns={null}
          currentMuscleGroup={null}
          onClose={() => setReplaceTarget(null)}
          onReplaced={(s) => setStructure(s as WeekStructure)}
        />
      )}
      {showDuplicate && ctx && (
        <MultiWeekDuplicateModal
          weekId={ctx.week.id}
          currentWeek={ctx.week.week_number}
          onClose={() => setShowDuplicate(false)}
          onCreated={(firstWeek, firstWeekId) =>
            navigate({
              to: "/coach/membre/$memberId/adapter",
              params: { memberId },
              search: { week: firstWeek, ...(firstWeekId ? { weekId: firstWeekId } : {}) },
            })
          }
        />
      )}
      {libraryTarget != null && (
        <LibraryPicker
          onClose={() => setLibraryTarget(null)}
          onPick={(ex) => addExoFromLibrary(libraryTarget, ex)}
        />
      )}
      {editTarget &&
        structure.days?.[editTarget.dayIdx]?.exercises?.[editTarget.exoIdx] &&
        (() => {
          const ex = structure.days![editTarget.dayIdx].exercises![editTarget.exoIdx];
          const fb = getExerciseFeedback(ctx.feedback, ex.name);
          return (
            <ExoEditModal
              ex={ex}
              fb={fb}
              suggestion={suggestFor(ex, fb)}
              weekNumber={ctx.sourceSummary.weekNumber}
              onChange={(fn) => updateExo(editTarget.dayIdx, editTarget.exoIdx, fn)}
              onReplace={() => {
                setReplaceTarget({ dayIdx: editTarget.dayIdx, exoIdx: editTarget.exoIdx, ex });
                setEditTarget(null);
              }}
              onDelete={() => {
                removeExo(editTarget.dayIdx, editTarget.exoIdx);
                setEditTarget(null);
              }}
              onClose={() => setEditTarget(null)}
            />
          );
        })()}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--cst-dark-green)",
        color: "var(--cst-text)",
      }}
    >
      <CoachSidebar />
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}

function PreviewModal({
  structure,
  weekNumber,
  onClose,
}: {
  structure: WeekStructure;
  weekNumber: number;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 480, maxHeight: "85vh", overflow: "auto", padding: 24, borderRadius: 12 }}
      >
        <div
          className="cst-mono"
          style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.18em", marginBottom: 6 }}
        >
          APERÇU MEMBRE
        </div>
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 16 }}>
          Semaine {weekNumber}
        </h2>
        {(structure.days ?? []).map((d, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="cst-display" style={{ fontSize: 14, marginBottom: 6 }}>
              {d.label ?? sessionLabel(i)}
            </div>
            {(d.exercises ?? []).map((e, j) => (
              <div
                key={j}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 12,
                }}
              >
                <span>
                  <ColorDot c={e.color} /> {e.name}
                </span>
                <span style={{ opacity: 0.7, fontFamily: "var(--cst-mono)", fontSize: 11 }}>
                  {e.series ?? "—"} × {e.reps ?? "—"}
                  {e.charge ? ` · ${e.charge}kg` : ""}
                  {e.rpe_target ? ` · RPE ${e.rpe_target}` : ""}
                </span>
              </div>
            ))}
          </div>
        ))}
        <button onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ marginTop: 16 }}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function PublishModal(props: {
  weekNumber: number;
  memberName: string;
  isRepublish?: boolean;
  changes: Array<{ type: string; label: string }>;
  notify: boolean;
  setNotify: (b: boolean) => void;
  message: string;
  setMessage: (s: string) => void;
  publishing: boolean;
  onCancel: () => void;
  onPublish: () => void;
}) {
  return (
    <div
      onClick={props.onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 500, maxHeight: "85vh", overflow: "auto", padding: 28, borderRadius: 12 }}
      >
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 4 }}>
          {props.isRepublish
            ? `Republier la semaine ${props.weekNumber}`
            : `Publier la semaine ${props.weekNumber}`}
        </h2>
        <div
          className="cst-italic"
          style={{ fontSize: 13, color: "var(--cst-mid-green)", marginBottom: 16 }}
        >
          pour {props.memberName}
        </div>

        <div
          className="cst-mono"
          style={{ fontSize: 10, opacity: 0.7, marginBottom: 8, letterSpacing: "0.15em" }}
        >
          RÉCAP DES CHANGEMENTS
        </div>
        <div
          style={{
            marginBottom: 18,
            maxHeight: 200,
            overflow: "auto",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
          }}
        >
          {props.changes.length === 0 ? (
            <div style={{ opacity: 0.6 }}>Aucun changement détecté.</div>
          ) : (
            props.changes.map((c, i) => (
              <div key={i} style={{ padding: "3px 0" }}>
                • {c.label}
              </div>
            ))
          )}
        </div>

        <label
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={props.notify}
            onChange={(e) => props.setNotify(e.target.checked)}
          />{" "}
          Notifier le membre + message
        </label>
        {props.notify && (
          <textarea
            value={props.message}
            onChange={(e) => props.setMessage(e.target.value)}
            rows={3}
            className="cst-input"
            style={{ width: "100%", marginBottom: 16 }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={props.onCancel}
            className="cst-btn cst-btn-ghost-dark"
            disabled={props.publishing}
          >
            Annuler
          </button>
          <button
            onClick={props.onPublish}
            className="cst-btn cst-btn-primary"
            disabled={props.publishing}
          >
            {props.publishing
              ? "Publication…"
              : props.isRepublish
                ? "Republier et notifier"
                : "Publier et envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
