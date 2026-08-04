import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  getActiveChallenge,
  getCommunityFeed,
  joinChallenge,
  leaveChallenge,
  setShareMilestones,
} from "@/lib/community.functions";
import { daysLeft, METRIC_LABEL, type ChallengeMetric } from "@/lib/community";

type Challenge = {
  id: string;
  title: string;
  metric: ChallengeMetric;
  target: number;
  starts_on: string;
  ends_on: string;
};

const KIND_MARK: Record<string, string> = {
  sessions: "▲",
  volume: "■",
  record: "★",
  streak: "◆",
};

function frDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Communauté côté membre : le défi collectif en cours, puis le fil des jalons.
 * Rien ne s'écrit ici — le fil est dérivé de ce que les membres font
 * réellement, il n'y a donc aucun contenu à modérer.
 */
export default function CommunityPanel() {
  const feedFn = useServerFn(getCommunityFeed);
  const challengeFn = useServerFn(getActiveChallenge);
  const joinFn = useServerFn(joinChallenge);
  const leaveFn = useServerFn(leaveChallenge);
  const shareFn = useServerFn(setShareMilestones);

  const [feed, setFeed] = useState<{
    milestones: Array<{ memberName: string; label: string; date: string; kind: string }>;
    sharing: boolean;
  } | null>(null);
  const [challenge, setChallenge] = useState<{
    challenge: Challenge | null;
    progress: {
      total: number;
      target: number;
      percent: number;
      participants: number;
      mine: number | null;
      done: boolean;
    } | null;
    joined: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const [f, c] = await Promise.all([feedFn(), challengeFn()]);
      setFeed(f);
      setChallenge(c);
    } catch (e) {
      console.error("[communauté]", e);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleJoin() {
    if (!challenge?.challenge || busy) return;
    setBusy(true);
    try {
      const payload = { data: { challengeId: challenge.challenge.id } };
      if (challenge.joined) await leaveFn(payload);
      else await joinFn(payload);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare() {
    if (!feed || busy) return;
    setBusy(true);
    try {
      await shareFn({ data: { share: !feed.sharing } });
      await reload();
      toast.success(
        feed.sharing ? "Tes jalons redeviennent privés" : "Tes jalons apparaîtront dans le fil",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const active = challenge?.challenge;
  const progress = challenge?.progress;
  const hasFeed = (feed?.milestones.length ?? 0) > 0;
  if (!active && !hasFeed) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {active && progress && (
        <div
          className="cst-card-dark"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span
              className="cst-mono"
              style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--cst-mid-green)" }}
            >
              DÉFI EN COURS
            </span>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
              {daysLeft(active.ends_on, new Date().toISOString())} J RESTANTS
            </span>
          </div>

          <div className="cst-display" style={{ fontSize: 17 }}>
            {active.title}
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={active.title}
          >
            <div
              style={{
                width: `${progress.percent}%`,
                height: "100%",
                background: progress.done ? "#D4A53B" : "#3A8A4D",
                transition: "width 300ms ease",
              }}
            />
          </div>

          <div
            className="cst-mono"
            style={{ fontSize: 10.5, opacity: 0.7, display: "flex", gap: 6, flexWrap: "wrap" }}
          >
            <span>
              {progress.total.toLocaleString("fr-FR")} / {progress.target.toLocaleString("fr-FR")}{" "}
              {METRIC_LABEL[active.metric]}
            </span>
            <span aria-hidden>·</span>
            <span>
              {progress.participants} participant{progress.participants > 1 ? "s" : ""}
            </span>
            {progress.mine != null && (
              <>
                <span aria-hidden>·</span>
                <span style={{ color: "var(--cst-mid-green)" }}>
                  toi : {progress.mine.toLocaleString("fr-FR")}
                </span>
              </>
            )}
          </div>

          {progress.done && (
            <div style={{ fontSize: 12, color: "#D4A53B" }}>Objectif atteint. Bravo à tous.</div>
          )}

          <button
            onClick={toggleJoin}
            disabled={busy}
            className={challenge?.joined ? "cst-btn cst-btn-ghost-dark" : "cst-btn cst-btn-primary"}
            style={{ fontSize: 12, padding: "10px 0" }}
          >
            {challenge?.joined ? "Quitter le défi" : "Je participe"}
          </button>
        </div>
      )}

      {hasFeed && (
        <div className="cst-card-dark" style={{ padding: 16 }}>
          <span
            className="cst-mono"
            style={{ fontSize: 9, letterSpacing: "0.18em", opacity: 0.55 }}
          >
            DANS LA COMMUNAUTÉ
          </span>
          <div
            style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}
            aria-live="polite"
          >
            {feed?.milestones.map((milestone, index) => (
              <div
                key={`${milestone.date}-${milestone.memberName}-${index}`}
                style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5 }}
              >
                <span style={{ color: "var(--cst-mid-green)", fontSize: 10 }} aria-hidden>
                  {KIND_MARK[milestone.kind] ?? "•"}
                </span>
                <span style={{ flex: 1, lineHeight: 1.4 }}>
                  <strong>{milestone.memberName}</strong> {milestone.label}
                </span>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45 }}>
                  {frDate(milestone.date)}
                </span>
              </div>
            ))}
          </div>

          {/* Le partage reste un choix explicite, réversible d'un tap. */}
          <label
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              opacity: 0.8,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={!!feed?.sharing}
              onChange={toggleShare}
              disabled={busy}
              style={{ width: 15, height: 15, accentColor: "var(--cst-mid-green)" }}
            />
            Partager mes jalons avec les autres membres
          </label>
        </div>
      )}
    </div>
  );
}
