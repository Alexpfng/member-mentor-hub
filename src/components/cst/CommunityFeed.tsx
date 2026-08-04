import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import ChallengeCard from "@/components/cst/ChallengeCard";
import {
  listActiveChallenges,
  getCommunityFeed,
  joinChallenge,
  leaveChallenge,
  setShareMilestones,
  toggleCololike,
} from "@/lib/community.functions";
import { formatLikers, type ChallengeMetric } from "@/lib/community";

type FeedEntry = {
  key: string;
  memberId: string;
  memberName: string;
  kind: string;
  label: string;
  detail?: string;
  youtubeId?: string | null;
  date: string;
  likes: number;
  likers?: string[];
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
  };
  progress: {
    total: number;
    target: number;
    percent: number;
    participants: number;
    mine: number | null;
    done: boolean;
  };
  joined: boolean;
};

/** Pastille de l'entrée : un jalon doit se distinguer d'une séance ordinaire. */
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
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  if (iso === todayISO) return "aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return "hier";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Le fil se lit par journée, comme un fil d'actualité. */
function groupByDay(entries: FeedEntry[]) {
  const groups: Array<{ date: string; entries: FeedEntry[] }> = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}

/**
 * Fil communautaire, partagé par l'espace membre et l'espace coach : Léo suit
 * ses coachés et peut les encourager d'un cololike, sans écran séparé à
 * maintenir en double.
 */
export default function CommunityFeed({ canShare = true }: { canShare?: boolean }) {
  const feedFn = useServerFn(getCommunityFeed);
  const challengeFn = useServerFn(listActiveChallenges);
  const joinFn = useServerFn(joinChallenge);
  const leaveFn = useServerFn(leaveChallenge);
  const shareFn = useServerFn(setShareMilestones);
  const likeFn = useServerFn(toggleCololike);

  const [feed, setFeed] = useState<{ milestones: FeedEntry[]; sharing: boolean } | null>(null);
  const [challenges, setChallenges] = useState<ChallengeState[]>([]);
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
    if (c.status === "fulfilled") {
      setChallenges((c.value as { challenges: ChallengeState[] }).challenges ?? []);
    } else {
      console.error("[communauté] objectifs", c.reason);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Le compteur bascule tout de suite : un like qui attend le réseau ne donne pas envie. */
  async function like(entry: FeedEntry) {
    const next = !entry.likedByMe;
    const apply = (liked: boolean, likes: number) =>
      setFeed((prev) =>
        prev
          ? {
              ...prev,
              milestones: prev.milestones.map((m) =>
                m.key === entry.key ? { ...m, likedByMe: liked, likes } : m,
              ),
            }
          : prev,
      );

    apply(next, entry.likes + (next ? 1 : -1));
    try {
      await likeFn({ data: { eventKey: entry.key, liked: next } });
    } catch (e: unknown) {
      // On ne laisse pas un compteur mentir.
      apply(entry.likedByMe, entry.likes);
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

  async function toggleJoin(entry: ChallengeState) {
    if (busy) return;
    setBusy(true);
    try {
      const payload = { data: { challengeId: entry.challenge.id } };
      if (entry.joined) await leaveFn(payload);
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
    <>
      {challenges.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {challenges.map((entry) => (
            <ChallengeCard
              key={entry.challenge.id}
              challenge={entry.challenge}
              progress={entry.progress}
              joined={entry.joined}
              busy={busy}
              onToggleJoin={() => toggleJoin(entry)}
            />
          ))}
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
          La communauté n'est pas disponible : {loadError}
        </div>
      )}

      {!loading && !loadError && entries.length === 0 && (
        <div className="cst-card-dark" style={{ marginTop: 14, padding: 22, textAlign: "center" }}>
          <div className="cst-display" style={{ fontSize: 18, marginBottom: 6 }}>
            LE FIL EST ENCORE VIDE
          </div>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
            Les séances et les records des membres qui partagent apparaîtront ici.
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
                    {entry.label.charAt(0).toUpperCase() + entry.label.slice(1)}
                  </div>

                  {/* Démo du mouvement : illustre un record sans exposer quoi que
                      ce soit du membre, la vidéo vient de la bibliothèque. */}
                  {entry.youtubeId && (
                    <a
                      href={`https://www.youtube.com/watch?v=${entry.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        position: "relative",
                        display: "block",
                        borderRadius: 8,
                        overflow: "hidden",
                        lineHeight: 0,
                      }}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${entry.youtubeId}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        width={320}
                        height={180}
                        style={{ width: "100%", height: "auto", display: "block", opacity: 0.9 }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 26,
                          color: "#fff",
                          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
                        }}
                        aria-hidden
                      >
                        ▶
                      </span>
                      <span
                        className="cst-mono"
                        style={{
                          position: "absolute",
                          left: 8,
                          bottom: 8,
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          background: "rgba(0,0,0,0.55)",
                          padding: "3px 6px",
                          borderRadius: 4,
                        }}
                      >
                        VOIR LE MOUVEMENT
                      </span>
                    </a>
                  )}

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
                      aria-label={entry.likedByMe ? "Retirer mon cololike" : "Envoyer un cololike"}
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
                      <span style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.4 }}>
                        {formatLikers(entry.likers ?? [], entry.likes)}
                      </span>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {canShare && !loadError && feed && (
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
    </>
  );
}
