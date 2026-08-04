import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import MemberNav from "../../components/MemberNav";
import { CSTSectionNum } from "../../components/Atoms";
import ChallengeCard from "@/components/cst/ChallengeCard";
import {
  getActiveChallenge,
  getCommunityFeed,
  joinChallenge,
  leaveChallenge,
  setShareMilestones,
  toggleCololike,
} from "@/lib/community.functions";
import type { ChallengeMetric } from "@/lib/community";

type FeedEntry = {
  key: string;
  memberId: string;
  memberName: string;
  kind: string;
  label: string;
  detail?: string;
  date: string;
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
};

type ChallengeState = {
  challenge: {
    id: string;
    title: string;
    metric: ChallengeMetric;
    target: number;
    ends_on: string;
  } | null;
  progress: {
    total: number;
    target: number;
    percent: number;
    participants: number;
    mine: number | null;
    done: boolean;
  } | null;
  joined: boolean;
};

/** Pastille de l'entrée : un jalon se distingue d'une séance ordinaire. */
const KIND_BADGE: Record<string, { mark: string; label: string; color: string }> = {
  activity: { mark: "▸", label: "SÉANCE", color: "rgba(255,255,255,0.35)" },
  sessions: { mark: "▲", label: "PALIER", color: "#6EAB76" },
  volume: { mark: "■", label: "TONNAGE", color: "#6EAB76" },
  record: { mark: "★", label: "RECORD", color: "#D4A53B" },
  streak: { mark: "◆", label: "SÉRIE", color: "#6EAB76" },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function frDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  if (iso === todayISO) return "aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return "hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Regroupe le fil par jour, comme un fil d'actualité. */
function groupByDay(entries: FeedEntry[]) {
  const groups: Array<{ date: string; entries: FeedEntry[] }> = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}

export default function Communaute() {
  const navigate = useNavigate();
  const feedFn = useServerFn(getCommunityFeed);
  const challengeFn = useServerFn(getActiveChallenge);
  const joinFn = useServerFn(joinChallenge);
  const leaveFn = useServerFn(leaveChallenge);
  const shareFn = useServerFn(setShareMilestones);
  const likeFn = useServerFn(toggleCololike);

  const [feed, setFeed] = useState<{ milestones: FeedEntry[]; sharing: boolean } | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [f, c] = await Promise.allSettled([feedFn(), challengeFn()]);
    if (f.status === "fulfilled") {
      setFeed(f.value as { milestones: FeedEntry[]; sharing: boolean });
      setLoadError(null);
    } else {
      console.error("[communauté] fil", f.reason);
      setLoadError(f.reason instanceof Error ? f.reason.message : "Erreur inconnue");
    }
    if (c.status === "fulfilled") setChallenge(c.value as ChallengeState);
    else console.error("[communauté] défi", c.reason);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Le compteur bascule tout de suite : un like qui attend le réseau ne donne pas envie. */
  async function like(entry: FeedEntry) {
    const next = !entry.likedByMe;
    setFeed((prev) =>
      prev
        ? {
            ...prev,
            milestones: prev.milestones.map((m) =>
              m.key === entry.key ? { ...m, likedByMe: next, likes: m.likes + (next ? 1 : -1) } : m,
            ),
          }
        : prev,
    );
    try {
      await likeFn({ data: { eventKey: entry.key, liked: next } });
    } catch (e: unknown) {
      // Rollback : on ne laisse pas un compteur mentir.
      setFeed((prev) =>
        prev
          ? {
              ...prev,
              milestones: prev.milestones.map((m) =>
                m.key === entry.key ? { ...m, likedByMe: entry.likedByMe, likes: entry.likes } : m,
              ),
            }
          : prev,
      );
      toast.error(e instanceof Error ? e.message : "Le cololike n'est pas passé");
    }
  }

  async function toggleShare() {
    if (!feed || busy) return;
    setBusy(true);
    try {
      await shareFn({ data: { share: !feed.sharing } });
      await reload();
      toast.success(
        feed.sharing ? "Tes séances redeviennent privées" : "Tes séances apparaissent dans le fil",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

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

  const entries = feed?.milestones ?? [];
  const days = groupByDay(entries);

  return (
    <div className="cst-page">
      <div className="cst-shell" style={{ paddingBottom: 96 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 4px" }}>
          <button
            onClick={() => navigate({ to: "/membre" })}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            aria-label="Retour à l'accueil"
            style={{ paddingInline: 12 }}
          >
            ←
          </button>
          <CSTSectionNum num={1} label="COMMUNAUTÉ" sub="LES COACHÉS DE LÉO" />
        </div>

        {challenge?.challenge && challenge.progress && (
          <div style={{ marginTop: 14 }}>
            <ChallengeCard
              challenge={challenge.challenge}
              progress={challenge.progress}
              joined={challenge.joined}
              busy={busy}
              onToggleJoin={toggleJoin}
            />
          </div>
        )}

        {loading && (
          <div style={{ opacity: 0.6, fontSize: 13, padding: "32px 0", textAlign: "center" }}>
            Chargement…
          </div>
        )}

        {loadError && (
          <div
            className="cst-card-dark"
            style={{ marginTop: 14, padding: 16, fontSize: 13, color: "#E07070" }}
          >
            La communauté n'est pas disponible pour l'instant. Ton coach est prévenu.
          </div>
        )}

        {!loading && !loadError && entries.length === 0 && (
          <div
            className="cst-card-dark"
            style={{ marginTop: 14, padding: 22, textAlign: "center" }}
          >
            <div className="cst-display" style={{ fontSize: 18, marginBottom: 6 }}>
              LE FIL EST ENCORE VIDE
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
              Les séances et les records des membres qui partagent apparaîtront ici. Active le
              partage ci-dessous pour lancer le mouvement.
            </p>
          </div>
        )}

        {days.map((day) => (
          <div key={day.date} style={{ marginTop: 20 }}>
            <div
              className="cst-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                opacity: 0.45,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {frDay(day.date)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {day.entries.map((entry) => {
                const badge = KIND_BADGE[entry.kind] ?? KIND_BADGE.activity;
                return (
                  <article
                    key={entry.key}
                    className="cst-card-dark"
                    style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: entry.isMine
                            ? "rgba(58,138,77,0.35)"
                            : "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials(entry.memberName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {entry.isMine ? "Toi" : entry.memberName}
                        </div>
                        <div
                          className="cst-mono"
                          style={{ fontSize: 9, letterSpacing: "0.14em", color: badge.color }}
                        >
                          {badge.mark} {badge.label}
                        </div>
                      </div>
                    </header>

                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                      {entry.label.replace(/^a /, "").replace(/^fait /, "")}
                    </div>

                    {entry.detail && (
                      <div
                        className="cst-mono"
                        style={{
                          fontSize: 11,
                          opacity: 0.65,
                          paddingTop: 8,
                          borderTop: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        {entry.detail}
                      </div>
                    )}

                    <footer style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => like(entry)}
                        aria-pressed={entry.likedByMe}
                        aria-label={
                          entry.likedByMe ? "Retirer mon cololike" : "Envoyer un cololike"
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 12px",
                          borderRadius: 999,
                          cursor: "pointer",
                          fontSize: 12,
                          fontFamily: "inherit",
                          background: entry.likedByMe ? "rgba(58,138,77,0.22)" : "transparent",
                          border: `1px solid ${
                            entry.likedByMe ? "rgba(58,138,77,0.6)" : "rgba(255,255,255,0.12)"
                          }`,
                          color: entry.likedByMe ? "#8FD09A" : "rgba(255,255,255,0.65)",
                          transition: "background 150ms ease, border-color 150ms ease",
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 13 }}>
                          {entry.likedByMe ? "💪" : "🤍"}
                        </span>
                        Cololike
                      </button>
                      {entry.likes > 0 && (
                        <span className="cst-mono" style={{ fontSize: 11, opacity: 0.6 }}>
                          {entry.likes} cololike{entry.likes > 1 ? "s" : ""}
                        </span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        {!loadError && feed && (
          <div className="cst-card-dark" style={{ marginTop: 20, padding: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={feed.sharing}
                onChange={toggleShare}
                disabled={busy}
                style={{ width: 16, height: 16, accentColor: "var(--cst-mid-green)" }}
              />
              Partager mes séances avec les autres membres
            </label>
            <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.5, lineHeight: 1.5 }}>
              Décoché, personne ne voit ton activité — tu continues de voir la tienne et celle des
              membres qui partagent.
            </p>
          </div>
        )}
      </div>

      <MemberNav />
    </div>
  );
}
