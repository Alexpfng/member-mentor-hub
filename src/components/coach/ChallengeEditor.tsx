import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getActiveChallenge, upsertChallenge } from "@/lib/community.functions";
import { daysLeft, METRIC_LABEL, type ChallengeMetric } from "@/lib/community";

const METRICS: ChallengeMetric[] = ["sessions", "volume_kg", "distance_km"];

/** Bornes du mois en cours : le défi type est mensuel, autant l'offrir d'un clic. */
function monthBounds(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) };
}

/**
 * Panneau coach du défi collectif. Un seul défi actif à la fois : deux défis
 * concurrents diluent l'attention et rendent la jauge illisible.
 */
export default function ChallengeEditor() {
  const activeFn = useServerFn(getActiveChallenge);
  const saveFn = useServerFn(upsertChallenge);

  const [active, setActive] = useState<{
    challenge: {
      id: string;
      title: string;
      metric: ChallengeMetric;
      target: number;
      ends_on: string;
    } | null;
    progress: { total: number; target: number; percent: number; participants: number } | null;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    title: "",
    metric: "sessions" as ChallengeMetric,
    target: "",
    ...monthBounds(),
  }));

  async function reload() {
    try {
      setActive(await activeFn());
    } catch (e) {
      console.error("[défi]", e);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit() {
    const current = active?.challenge;
    setForm({
      title: current?.title ?? "",
      metric: current?.metric ?? "sessions",
      target: current ? String(current.target) : "",
      ...monthBounds(),
    });
    setEditing(true);
  }

  async function save() {
    const target = Number(String(form.target).replace(",", "."));
    if (!form.title.trim()) {
      toast.error("Donne un titre au défi.");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("L'objectif doit être un nombre supérieur à zéro.");
      return;
    }
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: active?.challenge?.id,
          title: form.title.trim(),
          metric: form.metric,
          target,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
        },
      });
      setEditing(false);
      await reload();
      toast.success("Défi enregistré");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const current = active?.challenge;
  const progress = active?.progress;

  return (
    <div className="cst-card-dark" style={{ padding: 14, margin: "0 32px 32px" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
      >
        <div className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.15em", opacity: 0.5 }}>
          DÉFI COLLECTIF
        </div>
        {!editing && (
          <button
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            onClick={startEdit}
            style={{ fontSize: 11 }}
          >
            {current ? "Modifier" : "Lancer un défi"}
          </button>
        )}
      </div>

      {!editing && current && progress && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="cst-display" style={{ fontSize: 16 }}>
            {current.title}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${progress.percent}%`, height: "100%", background: "#3A8A4D" }} />
          </div>
          <div className="cst-mono" style={{ fontSize: 10.5, opacity: 0.7 }}>
            {progress.total.toLocaleString("fr-FR")} / {progress.target.toLocaleString("fr-FR")}{" "}
            {METRIC_LABEL[current.metric]} · {progress.participants} inscrit
            {progress.participants > 1 ? "s" : ""} ·{" "}
            {daysLeft(current.ends_on, new Date().toISOString())} j restants
          </div>
        </div>
      )}

      {!editing && !current && (
        <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
          Aucun défi en cours. Un objectif collectif sur le mois donne un cap commun à tes membres,
          sans les comparer entre eux.
        </p>
      )}

      {editing && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="cst-input"
            placeholder="Titre — ex. « 300 km en équipe »"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={{ padding: "8px 12px", fontSize: 14 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select
              className="cst-input"
              value={form.metric}
              onChange={(e) =>
                setForm((f) => ({ ...f, metric: e.target.value as ChallengeMetric }))
              }
              style={{ padding: "8px 12px" }}
            >
              {METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABEL[metric]}
                </option>
              ))}
            </select>
            <input
              className="cst-input"
              inputMode="decimal"
              placeholder="Objectif"
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              style={{ padding: "8px 12px", fontSize: 14 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="cst-input"
              type="date"
              value={form.startsOn}
              onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
              style={{ padding: "8px 12px", fontSize: 13 }}
            />
            <input
              className="cst-input"
              type="date"
              value={form.endsOn}
              onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
              style={{ padding: "8px 12px", fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="cst-btn cst-btn-ghost-dark cst-btn-sm"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              className="cst-btn cst-btn-primary"
              onClick={save}
              disabled={busy}
              style={{ flex: 1 }}
            >
              {busy ? "..." : "Enregistrer"}
            </button>
          </div>
          <span style={{ fontSize: 10.5, opacity: 0.5 }}>
            L'avancement est calculé automatiquement depuis les séances des participants — personne
            n'a rien à saisir.
          </span>
        </div>
      )}
    </div>
  );
}
