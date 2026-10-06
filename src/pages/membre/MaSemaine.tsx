import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import MemberNav from "@/components/MemberNav";
import { ProgramBlocks, type ProgExercise } from "@/components/cst/ProgramBlocks";
import { listWeekPlan } from "@/lib/planning.functions";
import { listLibraryForMember } from "@/lib/member-stats.functions";
import { enrichVideosFromLibrary } from "@/lib/enrich-videos";
import type { MemberWeekDetail } from "@/lib/member-week-details";
import { useI18n } from "@/lib/i18n";

type WeekPlan = {
  weekNumber: number;
  weekStart: string | null;
  weekEnd: string | null;
  assignment: { programs?: { name?: string | null } | null } | null;
  weekDetails: MemberWeekDetail[];
  sessions: Array<{ id: string; status: string; day_number?: number | null }>;
};

const PHASE_COLORS = ["#6EAB76", "#E6BD56", "#7EA8CE"];

export default function MaSemaine() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const fetchWeek = useServerFn(listWeekPlan);
  const fetchLibrary = useServerFn(listLibraryForMember);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [library, setLibrary] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchWeek({ data: {} }), fetchLibrary().catch(() => ({ exercises: [] }))])
      .then(([week, exercises]) => {
        if (cancelled) return;
        setPlan(week as WeekPlan);
        setLibrary(exercises?.exercises ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWeek, fetchLibrary]);

  const sessions = plan?.weekDetails.filter((day) => !day.isRest && day.exercises.length > 0) ?? [];
  const completedCount = sessions.reduce((count, _day, index) => {
    const session = plan?.sessions.find((item) => Number(item.day_number) === index + 1);
    return count + (session?.status === "completed" ? 1 : 0);
  }, 0);
  const progress = sessions.length
    ? Math.min(100, Math.round((completedCount / sessions.length) * 100))
    : 0;
  const dateRange = formatWeekRange(plan?.weekStart, plan?.weekEnd, locale);

  return (
    <div
      style={{ minHeight: "100vh", background: "#111", display: "flex", justifyContent: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>
        <main
          className="cst-screen cst-hatch"
          style={{ minHeight: "100vh", padding: "22px 16px 110px" }}
        >
          <button
            type="button"
            className="cst-btn cst-btn-ghost-dark"
            onClick={() => navigate({ to: "/membre" })}
            style={{ fontSize: 10, padding: "8px 12px" }}
          >
            ← {t("RETOUR À L'ACCUEIL")}
          </button>

          <header style={{ marginTop: 24 }}>
            <div
              className="cst-mono"
              style={{ color: "var(--cst-mid-green)", fontSize: 9, letterSpacing: "0.16em" }}
            >
              ✦ {t("TABLEAU DE BORD · SEMAINE")} {plan?.weekNumber ?? "—"}
            </div>
            <h1 className="cst-display" style={{ fontSize: 26, margin: "7px 0 3px" }}>
              {t("TA SEMAINE, EN UN COUP D'ŒIL.")}
            </h1>
            <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
              {plan?.assignment?.programs?.name ?? t("Ton programme")}
              {dateRange ? ` · ${dateRange}` : ""}
            </div>
          </header>

          {loading ? (
            <div className="cst-card-dark" style={{ padding: 18, marginTop: 18 }}>
              {t("Chargement de ta semaine…")}
            </div>
          ) : error ? (
            <div className="cst-card-dark" role="alert" style={{ padding: 18, marginTop: 18 }}>
              {t("Impossible de charger ta semaine. Réessaie dans un instant.")}
            </div>
          ) : !plan?.weekDetails.length ? (
            <div className="cst-card-dark" style={{ padding: 18, marginTop: 18 }}>
              {t("Aucun programme publié pour cette semaine.")}
            </div>
          ) : (
            <>
              <section
                className="cst-card-dark"
                aria-label={t("Progression de la semaine")}
                style={{ marginTop: 18, padding: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="cst-mono" style={{ fontSize: 9, opacity: 0.62 }}>
                      {t("MISSION DE LA SEMAINE")}
                    </div>
                    <div className="cst-display" style={{ fontSize: 20, marginTop: 5 }}>
                      {completedCount} / {sessions.length} {t("séances validées")}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.66, marginTop: 3 }}>
                      {progress === 100
                        ? t("Mission accomplie, belle semaine !")
                        : `${progress}% · ${t("chaque séance compte")}`}
                    </div>
                  </div>
                  <div
                    role="img"
                    aria-label={`${progress}% ${t("de la mission accomplie")}`}
                    style={{
                      width: 62,
                      height: 62,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: `5px solid ${progress === 100 ? "#E6BD56" : "var(--cst-mid-green)"}`,
                      color: progress === 100 ? "#E6BD56" : "#fff",
                      fontWeight: 800,
                    }}
                  >
                    {progress}%
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("Progression des séances")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  style={{
                    height: 8,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.1)",
                    overflow: "hidden",
                    marginTop: 13,
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: progress === 100 ? "#E6BD56" : "var(--cst-mid-green)",
                      transition: "width 250ms ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 10 }} aria-hidden="true">
                  {sessions.map((day, index) => {
                    const done = plan.sessions.some(
                      (item) =>
                        Number(item.day_number) === plan.weekDetails.indexOf(day) + 1 &&
                        item.status === "completed",
                    );
                    return (
                      <span
                        key={`${day.label}-${index}`}
                        title={day.label}
                        style={{
                          height: 5,
                          flex: 1,
                          borderRadius: 99,
                          background: done ? "#E6BD56" : PHASE_COLORS[index % PHASE_COLORS.length],
                          opacity: done ? 1 : 0.42,
                        }}
                      />
                    );
                  })}
                </div>
              </section>

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  alignItems: "end",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <h2 className="cst-display" style={{ fontSize: 17, margin: 0 }}>
                  {t("LE PROGRAMME DÉTAILLÉ")}
                </h2>
                <span className="cst-mono" style={{ fontSize: 8, opacity: 0.55 }}>
                  {sessions.length} {t("SÉANCES")}
                </span>
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                {plan.weekDetails.map((day, index) => {
                  const dayNumber = index + 1;
                  const daySessions = plan.sessions.filter(
                    (item) => Number(item.day_number) === dayNumber,
                  );
                  const done = daySessions.some((item) => item.status === "completed");
                  const active = daySessions.some((item) => item.status === "in_progress");
                  const color = day.isRest
                    ? "rgba(255,255,255,0.34)"
                    : done
                      ? "#E6BD56"
                      : active
                        ? "#72A9D8"
                        : PHASE_COLORS[index % PHASE_COLORS.length];
                  return (
                    <article
                      key={`${day.label}-${index}`}
                      className="cst-card-dark"
                      style={{ padding: 14, borderLeft: `3px solid ${color}` }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 8,
                            background: `${color}20`,
                            color,
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {day.isRest ? "↗" : done ? "✓" : String(dayNumber).padStart(2, "0")}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 8,
                            }}
                          >
                            <h3
                              className="cst-display"
                              style={{
                                fontSize: 15,
                                lineHeight: 1.2,
                                margin: 0,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {day.label}
                            </h3>
                            <span
                              className="cst-mono"
                              style={{ flexShrink: 0, fontSize: 8, color, textAlign: "right" }}
                            >
                              {day.isRest
                                ? t("RÉCUP")
                                : done
                                  ? t("VALIDÉE")
                                  : active
                                    ? t("EN COURS")
                                    : t("AU PROGRAMME")}
                            </span>
                          </div>
                          {day.isRest ? (
                            <p style={{ margin: "10px 0 0", fontSize: 12, opacity: 0.62 }}>
                              {t(
                                "Récupération · profite de cette journée pour recharger les batteries.",
                              )}
                            </p>
                          ) : day.exercises.length ? (
                            <div style={{ marginTop: 12 }}>
                              <ProgramBlocks
                                exercises={enrichVideosFromLibrary(
                                  day.exercises as ProgExercise[],
                                  library as never[],
                                )}
                              />
                            </div>
                          ) : (
                            <p style={{ margin: "10px 0 0", fontSize: 12, opacity: 0.56 }}>
                              {t("Aucun exercice détaillé pour cette journée.")}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="cst-btn cst-btn-ghost-dark"
                onClick={() => navigate({ to: "/membre/planning" })}
                style={{ width: "100%", marginTop: 16 }}
              >
                {t("VOIR LE PLANNING →")}
              </button>
            </>
          )}
        </main>
        <MemberNav />
      </div>
    </div>
  );
}

function formatWeekRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: string,
) {
  if (!start || !end) return "";
  const language = locale === "en" ? "en-GB" : "fr-FR";
  const format = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(language, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${format(start)} – ${format(end)}`;
}
