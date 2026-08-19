import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity.functions";
import { useI18n } from "@/lib/i18n";
import {
  computeDailyStreak,
  goalProgress,
  isGoalReached,
  streakLabel,
  type ActivityDay,
} from "@/lib/activity-streak";

type Props = {
  /** Historique renvoyé par getMyActivity (30 jours) — sert au calcul de la série. */
  days: ActivityDay[];
  today: { steps: number | null; calories: number | null } | null;
  goals: { steps: number | null; calories: number | null };
  todayISO: string;
  /** Recharge l'activité après enregistrement. */
  onSaved?: () => void;
  /** Ouvre la saisie détaillée (pas + calories + date). */
  onOpenDetails?: () => void;
};

const RING = 34;
const CIRC = 2 * Math.PI * RING;

/**
 * Carte d'habitude quotidienne : la saisie des pas en un geste, la série en
 * cours, et l'anneau d'objectif. L'idée est de rendre le remplissage quotidien
 * naturel (aucune navigation) et gratifiant (série + célébration), au lieu d'un
 * simple bouton « + NOTER » qui n'invite à rien.
 */
export function DailyHabitCard({ days, today, goals, todayISO, onSaved, onOpenDetails }: Props) {
  const { t } = useI18n();
  const save = useServerFn(logActivity);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  // Ne fêter qu'une fois par jour : sans ce garde-fou, chaque re-render qui
  // repasse au-dessus de l'objectif relancerait les confettis.
  const celebratedRef = useRef<string | null>(null);

  const steps = today?.steps ?? null;
  const goal = goals.steps ?? null;
  const progress = goalProgress(steps, goal);
  const reached = isGoalReached(steps, goal);
  const streak = computeDailyStreak(days, todayISO);
  const label = streakLabel(streak);
  const filledToday = steps != null || today?.calories != null;

  useEffect(() => {
    if (!reached) return;
    if (celebratedRef.current === todayISO) return;
    celebratedRef.current = todayISO;
    confetti({ particleCount: 90, spread: 65, origin: { y: 0.7 } });
  }, [reached, todayISO]);

  // Suggestion : la valeur de la veille, pour n'avoir qu'à ajuster.
  const yesterday = days.filter((d) => d.date < todayISO && d.steps != null).slice(-1)[0];
  const placeholder =
    steps != null
      ? String(steps)
      : yesterday?.steps != null
        ? String(yesterday.steps)
        : goal != null
          ? String(goal)
          : "8000";

  async function handleSave() {
    const raw = value.trim().replace(/\s/g, "");
    if (raw === "") return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 200000) {
      toast.error(t("Pas invalide"));
      return;
    }
    setSaving(true);
    try {
      await save({ data: { steps: n } });
      setValue("");
      toast.success(t("Pas enregistrés"));
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message || t("Enregistrement impossible"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="cst-card-dark"
      style={{ marginTop: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Anneau d'objectif */}
        <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={RING}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="7"
            />
            {progress != null && (
              <circle
                cx="40"
                cy="40"
                r={RING}
                fill="none"
                stroke={reached ? "#6EAB76" : "#D4A53B"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.5s" }}
              />
            )}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="cst-display" style={{ fontSize: 16, lineHeight: 1 }}>
              {steps != null ? steps.toLocaleString("fr-FR") : "—"}
            </span>
            {goal != null && (
              <span className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>
                / {goal.toLocaleString("fr-FR")}
              </span>
            )}
          </div>
        </div>

        <div className="cst-col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
            {t("PAS AUJOURD'HUI")}
          </span>
          {streak > 0 ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="cst-display" style={{ fontSize: 22, lineHeight: 1 }}>
                🔥 {streak}
              </span>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                {label}
              </span>
            </div>
          ) : (
            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              {t("Note tes pas pour lancer ta série 🔥")}
            </span>
          )}
          {reached && (
            <span className="cst-mono" style={{ fontSize: 9, color: "#6EAB76" }}>
              {t("Objectif du jour atteint 🎉")}
            </span>
          )}
        </div>
      </div>

      {/* Saisie en un geste */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder={placeholder}
          aria-label={t("Nombre de pas aujourd'hui")}
          style={{
            flex: 1,
            minWidth: 0,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#fff",
            padding: "10px 12px",
            fontSize: 15,
          }}
        />
        <button
          className="cst-btn cst-btn-primary"
          disabled={saving || value.trim() === ""}
          onClick={handleSave}
          style={{ fontSize: 11, padding: "10px 14px" }}
        >
          {saving ? "…" : filledToday ? t("METTRE À JOUR") : t("ENREGISTRER")}
        </button>
      </div>

      {onOpenDetails && (
        <button
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          onClick={onOpenDetails}
          style={{ fontSize: 10, alignSelf: "flex-start" }}
        >
          {t("+ calories / autre jour")}
        </button>
      )}
    </div>
  );
}
