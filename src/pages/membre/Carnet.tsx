import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useParams } from "@tanstack/react-router";
import MemberNav from "../../components/MemberNav";
import { getLogbook } from "@/lib/logbook.functions";
import { useI18n } from "@/lib/i18n";

function motivationalIntro(done: number, planned: number, t: (fr: string) => string) {
  if (planned === 0) return t("Une semaine pour reposer le corps. Reviens fort la suivante 💪");
  const pct = (done / planned) * 100;
  if (pct >= 100) return t("Semaine parfaite ! Tu as tenu chaque rendez-vous 🔥");
  if (pct >= 80) return t("Très belle semaine, tu es dans le rythme.");
  if (pct >= 50) return t("Bonne semaine — la régularité paie sur la durée.");
  if (done > 0)
    return `${done} ${done > 1 ? t("séances") : t("séance")}, ${t("c'est")} ${done} ${t("de plus que zéro. On continue.")}`;
  return t("Cette semaine n'a pas été facile. La prochaine sera la bonne 🙌");
}

export default function MemberCarnet() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { week?: string };
  const fn = useServerFn(getLogbook);
  const [logbook, setLogbook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { locale, t } = useI18n();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const week = params.week ? Number(params.week) : undefined;
        const r = await fn({ data: week !== undefined ? { weekNumber: week } : {} });
        setLogbook(r);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.week, fn]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        {t("Chargement…")}
      </div>
    );
  }

  if (!logbook) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6 pb-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">{t("Carnet de bord")}</h1>
          <p className="opacity-70">
            {t("Pas encore de carnet — il sera généré à la fin de ta première semaine.")}
          </p>
          <button
            className="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => navigate({ to: "/membre" })}
          >
            {t("Retour au tableau de bord")}
          </button>
        </div>
        <MemberNav />
      </div>
    );
  }

  const adherence = logbook.sessions_planned
    ? Math.round((logbook.sessions_done / logbook.sessions_planned) * 100)
    : 0;
  const intro = motivationalIntro(logbook.sessions_done, logbook.sessions_planned, t);
  const weightDelta =
    logbook.weight_start != null && logbook.weight_end != null
      ? Number(logbook.weight_end) - Number(logbook.weight_start)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate({ to: "/membre" })} className="text-sm opacity-60">
            {t("← Retour")}
          </button>
          <h1 className="font-mono text-xs tracking-widest">{t("CARNET DE BORD")}</h1>
          <div className="w-10" />
        </div>

        {(() => {
          const wk = logbook.week_number;
          const curWk = logbook.current_week_number ?? wk;
          const canPrev = wk > 1;
          const canNext = wk < curWk;
          const goWeek = (n: number) =>
            navigate({ to: "/membre/carnet/$week", params: { week: String(n) } });
          return (
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => canPrev && goWeek(wk - 1)}
                disabled={!canPrev}
                aria-label={t("Semaine précédente")}
                className="text-lg px-2 disabled:opacity-25"
                style={{ background: "transparent", border: "none", color: "inherit", cursor: canPrev ? "pointer" : "default" }}
              >
                ‹
              </button>
              <div className="text-center">
                <div className="font-mono text-xs opacity-60 tracking-widest">
                  {t("SEMAINE")} {wk}
                </div>
                <div className="text-sm opacity-70">
                  {t("Du")} {new Date(logbook.period_start).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")} {t("au")}{" "}
                  {new Date(logbook.period_end).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")}
                </div>
              </div>
              <button
                onClick={() => canNext && goWeek(wk + 1)}
                disabled={!canNext}
                aria-label={t("Semaine suivante")}
                className="text-lg px-2 disabled:opacity-25"
                style={{ background: "transparent", border: "none", color: "inherit", cursor: canNext ? "pointer" : "default" }}
              >
                ›
              </button>
            </div>
          );
        })()}

        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 mb-6 text-center">
          {intro}
        </div>

        <section className="mb-6">
          <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">{t("CETTE SEMAINE, TU AS…")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {logbook.sessions_done}
                <span className="opacity-50 text-lg">/{logbook.sessions_planned || "—"}</span>
              </div>
              <div className="text-xs opacity-70 mt-1">{t("séances")} ({adherence}%)</div>
              {logbook.free_sessions_done > 0 && (
                <div className="text-xs opacity-60 mt-1">+ {logbook.free_sessions_done} {logbook.free_sessions_done > 1 ? t("libres") : t("libre")}</div>
              )}
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {Math.round(Number(logbook.total_volume_kg ?? 0)).toLocaleString("fr-FR")}
                <span className="text-base opacity-50"> kg</span>
              </div>
              <div className="text-xs opacity-70 mt-1">{t("volume total")}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {Math.floor((logbook.total_duration_min ?? 0) / 60)}h
                {String((logbook.total_duration_min ?? 0) % 60).padStart(2, "0")}
              </div>
              <div className="text-xs opacity-70 mt-1">{t("d'entraînement")}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {logbook.avg_rpe ? Number(logbook.avg_rpe).toFixed(1) : "—"}
                <span className="text-base opacity-50">/10</span>
              </div>
              <div className="text-xs opacity-70 mt-1">{t("RPE moyen")}</div>
            </div>
          </div>
        </section>

        {weightDelta !== null && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">{t("ÉVOLUTION")}</h2>
            <div className="p-4 rounded-lg border border-border bg-card flex justify-between items-baseline">
              <div>
                <div className="text-xs opacity-60">{t("Poids")}</div>
                <div className="text-xl font-semibold">{logbook.weight_end} kg</div>
              </div>
              <div className={`text-sm ${weightDelta < 0 ? "text-emerald-600" : weightDelta > 0 ? "text-orange-500" : "opacity-60"}`}>
                {weightDelta > 0 ? "↑" : weightDelta < 0 ? "↓" : "="} {Math.abs(weightDelta).toFixed(1)} kg
              </div>
            </div>
          </section>
        )}

        {(logbook.new_prs ?? []).length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">
              {t("TES RECORDS DE LA SEMAINE 🏆")}
            </h2>
            <div className="space-y-2">
              {logbook.new_prs.map((pr: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-card flex justify-between">
                  <span className="font-medium">{pr.exercise_name}</span>
                  <span className="font-mono text-sm">
                    {pr.weight_kg ? `${pr.weight_kg} kg` : ""}
                    {pr.reps ? ` × ${pr.reps}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {logbook.pain_summary && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">{t("⚠ À SURVEILLER")}</h2>
            <div className="p-4 rounded-lg border border-orange-300/40 bg-orange-50/10 text-sm">
              {logbook.pain_summary}
              <div className="text-xs opacity-70 mt-2">{t("Léo en a été informé.")}</div>
            </div>
          </section>
        )}

        {logbook.coach_message && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">{t("UN MOT DE TON COACH")}</h2>
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 italic">
              « {logbook.coach_message} »
            </div>
          </section>
        )}

        <div className="mt-8 text-center">
          <button
            className="px-6 py-3 rounded bg-primary text-primary-foreground font-semibold"
            onClick={() => navigate({ to: "/membre/programme" })}
          >
            {t("VOIR MA SEMAINE →")}
          </button>
        </div>
      </div>
      <MemberNav />
    </div>
  );
}
