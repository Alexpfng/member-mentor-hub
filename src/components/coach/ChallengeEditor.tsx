import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { deleteChallenge, listActiveChallenges, upsertChallenge } from "@/lib/community.functions";
import { daysLeft, METRIC_LABEL, type ChallengeMetric } from "@/lib/community";

const METRICS: ChallengeMetric[] = ["sessions", "volume_kg", "distance_km"];

type ChallengeEntry = {
  challenge: {
    id: string;
    title: string;
    metric: ChallengeMetric;
    target: number;
    starts_on: string;
    ends_on: string;
  };
  progress: { total: number; target: number; percent: number; participants: number };
};

/** Bornes du mois en cours : l'objectif type est mensuel, autant l'offrir d'un clic. */
function monthBounds(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) };
}

function emptyForm() {
  return { id: "", title: "", metric: "sessions" as ChallengeMetric, target: "", ...monthBounds() };
}

/**
 * Objectifs collectifs du coach. Plusieurs peuvent tourner en parallèle — un
 * kilométrage d'équipe et un nombre de séances ne visent pas la même chose.
 */
export default function ChallengeEditor() {
  const listFn = useServerFn(listActiveChallenges);
  const saveFn = useServerFn(upsertChallenge);
  const deleteFn = useServerFn(deleteChallenge);

  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const r = (await listFn()) as { challenges: ChallengeEntry[] };
      setEntries(r.challenges ?? []);
      setLoadError(null);
    } catch (e) {
      // Tant que la migration communauté n'est pas passée, les tables n'existent
      // pas et le panneau disparaissait sans un mot.
      console.error("[objectifs]", e);
      setLoadError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!form) return;
    const target = Number(String(form.target).replace(",", "."));
    if (!form.title.trim()) {
      toast.error("Donne un titre à l'objectif.");
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
          id: form.id || undefined,
          title: form.title.trim(),
          metric: form.metric,
          target,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
        },
      });
      setForm(null);
      await reload();
      toast.success("Objectif enregistré");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: ChallengeEntry) {
    if (busy) return;
    const label =
      entry.progress.participants > 0
        ? `Supprimer « ${entry.challenge.title} » ? ${entry.progress.participants} membre(s) y participent.`
        : `Supprimer « ${entry.challenge.title} » ?`;
    if (!window.confirm(label)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: entry.challenge.id } });
      await reload();
      toast.success("Objectif supprimé");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 10,
        background: "var(--cst-card-bg)",
        border: "1px solid var(--cst-card-border)",
        borderLeft: "3px solid var(--cst-mid-green, #3A8A4D)",
        padding: 16,
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
      >
        <div
          className="cst-mono"
          style={{ fontSize: 9, letterSpacing: "0.15em", color: "var(--cst-text-muted)" }}
        >
          OBJECTIFS COLLECTIFS
        </div>
        {!form && !loadError && (
          <button
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            onClick={() => setForm(emptyForm())}
            style={{ fontSize: 11 }}
          >
            + Ajouter un objectif
          </button>
        )}
      </div>

      {loadError && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#E07070", lineHeight: 1.5 }}>
          Les objectifs ne sont pas branchés sur la base :{" "}
          <span style={{ opacity: 0.8 }}>{loadError}</span>
          <br />
          <span style={{ opacity: 0.7 }}>
            Passe la migration <code>20260804120000_add_community.sql</code>.
          </span>
        </p>
      )}

      {!loadError && entries.length === 0 && !form && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--cst-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Aucun objectif en cours. Un cap collectif sur le mois donne une direction commune à tes
          membres, sans les comparer entre eux.
        </p>
      )}

      {entries.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
          {entries.map((entry) => (
            <div
              key={entry.challenge.id}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="cst-display" style={{ fontSize: 15 }}>
                  {entry.challenge.title}
                </span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    style={{ fontSize: 10 }}
                    disabled={busy}
                    onClick={() =>
                      setForm({
                        id: entry.challenge.id,
                        title: entry.challenge.title,
                        metric: entry.challenge.metric,
                        target: String(entry.challenge.target),
                        startsOn: entry.challenge.starts_on,
                        endsOn: entry.challenge.ends_on,
                      })
                    }
                  >
                    Modifier
                  </button>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    style={{
                      fontSize: 10,
                      color: "#E07070",
                      borderColor: "rgba(224,112,112,0.35)",
                    }}
                    disabled={busy}
                    onClick={() => remove(entry)}
                  >
                    Supprimer
                  </button>
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "var(--cst-hairline)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${entry.progress.percent}%`,
                    height: "100%",
                    background: "#3A8A4D",
                  }}
                />
              </div>
              <div className="cst-mono" style={{ fontSize: 10.5, color: "var(--cst-text-muted)" }}>
                {entry.progress.total.toLocaleString("fr-FR")} /{" "}
                {entry.progress.target.toLocaleString("fr-FR")}{" "}
                {METRIC_LABEL[entry.challenge.metric]} · {entry.progress.participants} inscrit
                {entry.progress.participants > 1 ? "s" : ""} ·{" "}
                {daysLeft(entry.challenge.ends_on, new Date().toISOString())} j restants
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="cst-input"
            placeholder="Titre — ex. « 300 km en équipe »"
            value={form.title}
            onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))}
            style={{ padding: "8px 12px", fontSize: 14 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select
              className="cst-input"
              value={form.metric}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, metric: e.target.value as ChallengeMetric } : f))
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
              onChange={(e) => setForm((f) => (f ? { ...f, target: e.target.value } : f))}
              style={{ padding: "8px 12px", fontSize: 14 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="cst-input"
              type="date"
              value={form.startsOn}
              onChange={(e) => setForm((f) => (f ? { ...f, startsOn: e.target.value } : f))}
              style={{ padding: "8px 12px", fontSize: 13 }}
            />
            <input
              className="cst-input"
              type="date"
              value={form.endsOn}
              onChange={(e) => setForm((f) => (f ? { ...f, endsOn: e.target.value } : f))}
              style={{ padding: "8px 12px", fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="cst-btn cst-btn-ghost-dark cst-btn-sm"
              onClick={() => setForm(null)}
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
          <span style={{ fontSize: 10.5, color: "var(--cst-text-muted)" }}>
            L'avancement se calcule depuis les séances des participants — personne n'a rien à
            saisir.
          </span>
        </div>
      )}
    </div>
  );
}
