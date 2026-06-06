import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useParams } from "@tanstack/react-router";
import MemberNav from "../../components/MemberNav";
import { getLogbook } from "@/lib/logbook.functions";

function motivationalIntro(done: number, planned: number) {
  if (planned === 0) return "Une semaine pour reposer le corps. Reviens fort la suivante 💪";
  const pct = (done / planned) * 100;
  if (pct >= 100) return "Semaine parfaite ! Tu as tenu chaque rendez-vous 🔥";
  if (pct >= 80) return "Très belle semaine, tu es dans le rythme.";
  if (pct >= 50) return "Bonne semaine — la régularité paie sur la durée.";
  if (done > 0) return `${done} séance${done > 1 ? "s" : ""}, c'est ${done} de plus que zéro. On continue.`;
  return "Cette semaine n'a pas été facile. La prochaine sera la bonne 🙌";
}

export default function MemberCarnet() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { week?: string };
  const fn = useServerFn(getLogbook);
  const [logbook, setLogbook] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        Chargement…
      </div>
    );
  }

  if (!logbook) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6 pb-24 text-center">
          <h1 className="text-2xl font-semibold mb-2">Carnet de bord</h1>
          <p className="opacity-70">
            Pas encore de carnet — il sera généré à la fin de ta première semaine.
          </p>
          <button
            className="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => navigate({ to: "/membre" })}
          >
            Retour au tableau de bord
          </button>
        </div>
        <MemberNav />
      </div>
    );
  }

  const adherence = logbook.sessions_planned
    ? Math.round((logbook.sessions_done / logbook.sessions_planned) * 100)
    : 0;
  const intro = motivationalIntro(logbook.sessions_done, logbook.sessions_planned);
  const weightDelta =
    logbook.weight_start != null && logbook.weight_end != null
      ? Number(logbook.weight_end) - Number(logbook.weight_start)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate({ to: "/membre" })} className="text-sm opacity-60">
            ← Retour
          </button>
          <h1 className="font-mono text-xs tracking-widest">CARNET DE BORD</h1>
          <div className="w-10" />
        </div>

        <div className="text-center mb-6">
          <div className="font-mono text-xs opacity-60 tracking-widest">
            SEMAINE {logbook.week_number + 1}
          </div>
          <div className="text-sm opacity-70">
            Du {new Date(logbook.period_start).toLocaleDateString("fr-FR")} au{" "}
            {new Date(logbook.period_end).toLocaleDateString("fr-FR")}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 mb-6 text-center">
          {intro}
        </div>

        <section className="mb-6">
          <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">CETTE SEMAINE, TU AS…</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {logbook.sessions_done}
                <span className="opacity-50 text-lg">/{logbook.sessions_planned || "—"}</span>
              </div>
              <div className="text-xs opacity-70 mt-1">séances ({adherence}%)</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {Math.round(Number(logbook.total_volume_kg ?? 0)).toLocaleString("fr-FR")}
                <span className="text-base opacity-50"> kg</span>
              </div>
              <div className="text-xs opacity-70 mt-1">volume total</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {Math.floor((logbook.total_duration_min ?? 0) / 60)}h
                {String((logbook.total_duration_min ?? 0) % 60).padStart(2, "0")}
              </div>
              <div className="text-xs opacity-70 mt-1">d'entraînement</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-3xl font-semibold">
                {logbook.avg_rpe ? Number(logbook.avg_rpe).toFixed(1) : "—"}
                <span className="text-base opacity-50">/10</span>
              </div>
              <div className="text-xs opacity-70 mt-1">RPE moyen</div>
            </div>
          </div>
        </section>

        {weightDelta !== null && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">ÉVOLUTION</h2>
            <div className="p-4 rounded-lg border border-border bg-card flex justify-between items-baseline">
              <div>
                <div className="text-xs opacity-60">Poids</div>
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
              TES RECORDS DE LA SEMAINE 🏆
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
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">⚠ À SURVEILLER</h2>
            <div className="p-4 rounded-lg border border-orange-300/40 bg-orange-50/10 text-sm">
              {logbook.pain_summary}
              <div className="text-xs opacity-70 mt-2">Léo en a été informé.</div>
            </div>
          </section>
        )}

        {logbook.coach_message && (
          <section className="mb-6">
            <h2 className="text-xs font-mono tracking-widest opacity-60 mb-3">UN MOT DE TON COACH</h2>
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
            VOIR MA SEMAINE →
          </button>
        </div>
      </div>
      <MemberNav />
    </div>
  );
}
