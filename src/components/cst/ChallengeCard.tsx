import { daysLeft, METRIC_LABEL, type ChallengeMetric } from "@/lib/community";

type Challenge = {
  id: string;
  title: string;
  metric: ChallengeMetric;
  target: number;
  ends_on: string;
};

type Progress = {
  total: number;
  target: number;
  percent: number;
  participants: number;
  mine: number | null;
  done: boolean;
};

/** Défi collectif vu par le membre : une jauge commune, jamais un classement. */
export default function ChallengeCard({
  challenge,
  progress,
  joined,
  busy,
  onToggleJoin,
}: {
  challenge: Challenge;
  progress: Progress;
  joined: boolean;
  busy: boolean;
  onToggleJoin: () => void;
}) {
  return (
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
          {daysLeft(challenge.ends_on, new Date().toISOString())} J RESTANTS
        </span>
      </div>

      <div className="cst-display" style={{ fontSize: 18 }}>
        {challenge.title}
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
        aria-label={challenge.title}
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
          {METRIC_LABEL[challenge.metric]}
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
        onClick={onToggleJoin}
        disabled={busy}
        className={joined ? "cst-btn cst-btn-ghost-dark" : "cst-btn cst-btn-primary"}
        style={{ fontSize: 12, padding: "10px 0" }}
      >
        {joined ? "Quitter le défi" : "Je participe"}
      </button>
    </div>
  );
}
