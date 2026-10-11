import {
  getSessionGoalProgress,
  type MemberWeekOverview as WeekOverview,
} from "@/lib/member-week-overview";
import { useI18n } from "@/lib/i18n";

type Props = {
  overview: WeekOverview;
  stepsGoal: number | null;
  today: string;
  dayLabels: string[];
  onOpenPlanning: () => void;
  onOpenDetails: () => void;
};

const DAY_LABELS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

export function MemberWeekOverview({
  overview,
  stepsGoal,
  today,
  dayLabels,
  onOpenPlanning,
  onOpenDetails,
}: Props) {
  const { t } = useI18n();
  const { summary } = overview;
  const sessionProgress = getSessionGoalProgress(summary.completedSessions, summary.sessionTarget);
  const message = getSessionMessage(
    summary.completedSessions,
    sessionProgress.remaining,
    sessionProgress.complete,
    sessionProgress.hasTarget,
    t,
  );

  return (
    <section
      className="cst-card-dark"
      aria-labelledby="member-week-title"
      style={{ marginTop: 22, padding: 16 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <span
            className="cst-mono"
            style={{ fontSize: 9, color: "var(--cst-mid-green)", letterSpacing: "0.16em" }}
          >
            ✦ {t("MISSION DE LA SEMAINE")}
          </span>
          <h2
            id="member-week-title"
            className="cst-display"
            style={{ fontSize: 18, margin: "5px 0 0" }}
          >
            {summary.completedSessions} / {summary.sessionTarget || "—"} {t("SÉANCES")}
          </h2>
        </div>
        <SessionProgressRing
          completed={summary.completedSessions}
          target={summary.sessionTarget}
          percent={sessionProgress.percent}
          t={t}
        />
      </div>

      <div
        role="progressbar"
        aria-label={t("Progression des séances")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.sessionProgress}
        style={{
          height: 8,
          marginTop: 12,
          overflow: "hidden",
          borderRadius: 99,
          background: "rgba(255,255,255,0.09)",
        }}
      >
        <div
          style={{
            width: `${summary.sessionProgress}%`,
            height: "100%",
            borderRadius: 99,
            background: sessionProgress.complete ? "#E6BD56" : "var(--cst-mid-green)",
            transition: "width 250ms ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: sessionProgress.complete ? "#E6BD56" : "rgba(255,255,255,0.72)",
          }}
        >
          {message}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          marginTop: 14,
        }}
      >
        {summary.sessionTarget > 0 && (
          <div
            aria-label={`${summary.completedSessions} ${t("séances validées sur")} ${summary.sessionTarget}`}
            style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}
          >
            {Array.from({ length: Math.min(summary.sessionTarget, 7) }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                style={{
                  fontSize: 15,
                  lineHeight: 1,
                  color: index < summary.completedSessions ? "#E6BD56" : "rgba(255,255,255,0.18)",
                }}
              >
                ★
              </span>
            ))}
            {summary.sessionTarget > 7 && (
              <span className="cst-mono" style={{ fontSize: 8, opacity: 0.55 }}>
                +{summary.sessionTarget - 7}
              </span>
            )}
          </div>
        )}
        {stepsGoal != null ? (
          <div style={{ textAlign: "right" }}>
            <div className="cst-mono" style={{ fontSize: 8, opacity: 0.62 }}>
              {t("OBJECTIF PAS")}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: "#E6BD56" }}>
              👟 {summary.stepGoalsReached} / {summary.stepDaysElapsed || 0} {t("jours")}
            </div>
          </div>
        ) : (
          <div
            className="cst-mono"
            style={{ textAlign: "right", alignSelf: "center", fontSize: 8, opacity: 0.5 }}
          >
            {t("Pas d'objectif de pas défini")}
          </div>
        )}
      </div>

      <div
        aria-label={`${t("Pas cette semaine")}: ${summary.stepsTotal.toLocaleString("fr-FR")}, ${summary.stepDaysTracked} ${t("jours saisis")}`}
        style={{
          marginTop: 12,
          padding: "11px 12px 9px",
          borderRadius: 7,
          background: "rgba(255,255,255,0.045)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.62, letterSpacing: "0.12em" }}>
            {t("PAS CETTE SEMAINE")}
          </span>
          <strong style={{ fontSize: 16 }}>{summary.stepsTotal.toLocaleString("fr-FR")}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5, marginTop: 9 }}>
          {overview.days.map((day, index) => {
            const percent = stepsGoal && day.steps != null ? Math.min(100, (day.steps / stepsGoal) * 100) : 0;
            const color = day.stepsState === "met" ? "var(--cst-mid-green)" : day.stepsState === "short" ? "#E6BD56" : "rgba(255,255,255,0.18)";
            return (
              <div key={day.date} title={`${t(dayLabels[index] ?? DAY_LABELS[index] ?? "")}: ${day.steps == null ? t("Pas non saisis") : day.steps.toLocaleString("fr-FR")}`} style={{ minWidth: 0, textAlign: "center" }}>
                <div style={{ height: 32, display: "flex", alignItems: "flex-end", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <div style={{ width: "70%", height: `${Math.max(day.steps != null ? 10 : 0, percent * 0.32)}px`, borderRadius: "3px 3px 0 0", background: color, opacity: day.steps == null ? 0.35 : 0.9 }} />
                </div>
                <span className="cst-mono" style={{ display: "block", marginTop: 4, fontSize: 7, opacity: 0.58 }}>{t(dayLabels[index] ?? DAY_LABELS[index] ?? "")}</span>
                <span style={{ display: "block", marginTop: 2, fontSize: 8, fontWeight: 700, color: day.steps == null ? "rgba(255,255,255,0.35)" : color }}>
                  {day.steps == null ? "—" : day.steps >= 1000 ? `${(day.steps / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}k` : day.steps}
                </span>
              </div>
            );
          })}
        </div>
        <div className="cst-mono" style={{ marginTop: 7, fontSize: 8, opacity: 0.55 }}>
          {summary.stepDaysTracked} / {summary.stepDaysElapsed} {t("jours saisis")}
        </div>
      </div>

      <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          aria-hidden="true"
          className="cst-mono"
          style={{
            display: "grid",
            gridTemplateColumns: "48px minmax(0, 1fr) 112px",
            gap: 8,
            padding: "10px 0 7px",
            fontSize: 8,
            letterSpacing: "0.12em",
            opacity: 0.48,
          }}
        >
          <span>{t("JOUR")}</span>
          <span>{t("SÉANCE")}</span>
          <span style={{ textAlign: "right" }}>{t("PAS")}</span>
        </div>

        {overview.days.map((day, index) => {
          const isToday = day.date === today;
          const status = workoutStatus(day.workoutState, t);
          const stepLabel = getStepLabel(day, stepsGoal, t);
          const stepsColor =
            day.stepsState === "met"
              ? "var(--cst-mid-green)"
              : day.stepsState === "short"
                ? "#E6BD56"
                : "rgba(255,255,255,0.36)";
          return (
            <div
              key={day.date}
              style={{
                display: "grid",
                gridTemplateColumns: "48px minmax(0, 1fr) 112px",
                gap: 8,
                alignItems: "center",
                minHeight: 54,
                borderTop: "1px solid rgba(255,255,255,0.055)",
                background: isToday ? "rgba(110,171,118,0.07)" : "transparent",
                marginInline: -6,
                paddingInline: 6,
              }}
            >
              <div>
                <div
                  className="cst-mono"
                  style={{
                    fontSize: 8,
                    color: isToday ? "var(--cst-mid-green)" : "rgba(255,255,255,0.48)",
                  }}
                >
                  {t(dayLabels[index] ?? DAY_LABELS[index] ?? "")}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 13,
                    fontWeight: 700,
                    color: isToday ? "#fff" : "rgba(255,255,255,0.82)",
                  }}
                >
                  {new Date(`${day.date}T00:00:00Z`).getUTCDate()}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    flexShrink: 0,
                    textAlign: "center",
                    color: status.color,
                    fontSize: 13,
                  }}
                >
                  {status.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.88)",
                    }}
                  >
                    {day.workoutLabels[0] ?? status.label}
                  </div>
                  {day.workoutLabels.length > 1 && (
                    <div className="cst-mono" style={{ marginTop: 2, fontSize: 8, opacity: 0.52 }}>
                      +{day.workoutLabels.length - 1} {t("séance(s)")}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  className="cst-mono"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                    fontSize: 8,
                    color: stepsColor,
                  }}
                >
                  {stepLabel}
                </div>
                {day.stepProgress != null && (
                  <div
                    style={{
                      height: 4,
                      marginTop: 5,
                      overflow: "hidden",
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.09)",
                    }}
                  >
                    <div
                      style={{
                        width: `${day.stepProgress}%`,
                        height: "100%",
                        borderRadius: 99,
                        background: stepsColor,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          className="cst-btn cst-btn-ghost-dark"
          onClick={onOpenPlanning}
          style={{ width: "100%", minWidth: 0, paddingInline: 8, fontSize: 9 }}
        >
          {t("VOIR LE PLANNING →")}
        </button>
        <button
          type="button"
          className="cst-btn cst-btn-primary"
          onClick={onOpenDetails}
          style={{ width: "100%", minWidth: 0, paddingInline: 8, fontSize: 9 }}
        >
          {t("VOIR PLUS →")}
        </button>
      </div>
    </section>
  );
}

function SessionProgressRing({
  completed,
  target,
  percent,
  t,
}: {
  completed: number;
  target: number;
  percent: number;
  t: (value: string) => string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const ringColor = percent >= 100 ? "#E6BD56" : "var(--cst-mid-green)";

  return (
    <div
      role="img"
      aria-label={`${completed} ${t("séances réalisées sur")} ${target || t("aucune cible définie")}, ${percent}%`}
      style={{ width: 68, height: 68, position: "relative", flexShrink: 0 }}
    >
      <svg viewBox="0 0 68 68" width="68" height="68" aria-hidden="true">
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="6"
        />
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 450ms ease, stroke 250ms ease" }}
        />
      </svg>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeContent: "center",
          textAlign: "center",
          fontSize: 12,
          fontWeight: 800,
          color: ringColor,
        }}
      >
        {target > 0 ? `${percent}%` : "—"}
      </div>
    </div>
  );
}

function getSessionMessage(
  completed: number,
  remaining: number,
  complete: boolean,
  hasTarget: boolean,
  t: (value: string) => string,
) {
  if (complete) return t("Objectif de séances atteint. Tu as assuré !");
  if (!hasTarget) return t("Objectif de séances non défini.");
  if (completed === 0) return t("Une première séance lance ta progression.");
  return `${t("Encore")} ${remaining} ${t(
    remaining > 1 ? "séances pour valider ta mission." : "séance pour valider ta mission.",
  )}`;
}

function workoutStatus(
  state: WeekOverview["days"][number]["workoutState"],
  t: (value: string) => string,
) {
  switch (state) {
    case "completed":
      return { icon: "✓", label: t("Séance terminée"), color: "var(--cst-mid-green)" };
    case "in_progress":
      return { icon: "◷", label: t("Séance en cours"), color: "#E6BD56" };
    case "planned":
      return { icon: "●", label: t("Séance planifiée"), color: "#72A9D8" };
    case "rest":
      return { icon: "◌", label: t("Récupération"), color: "rgba(255,255,255,0.48)" };
    case "free":
      return { icon: "✦", label: t("Séance libre"), color: "#E6BD56" };
    default:
      return { icon: "·", label: t("Libre / rien de planifié"), color: "rgba(255,255,255,0.32)" };
  }
}

function getStepLabel(
  day: WeekOverview["days"][number],
  goal: number | null,
  t: (value: string) => string,
) {
  if (goal == null) return t("Sans objectif");
  if (day.stepsState === "upcoming") return t("À venir");
  if (day.steps == null) return t("Pas non saisis");
  return `${day.steps.toLocaleString("fr-FR")} / ${goal.toLocaleString("fr-FR")}`;
}
