import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CoachSidebar from "@/components/CoachSidebar";
import { CSTSectionNum } from "@/components/Atoms";
import { getSessionDetail, markSessionSeen, setSessionCoachNote } from "@/lib/coach-dashboard.functions";
import { resolvePainReport } from "@/lib/pain-reports.functions";
import { timeAgo, sanitizeDurationMin } from "@/lib/format";
import { toast } from "sonner";
import { ExerciseThread } from "@/components/cst/ExerciseThread";
import { getCoachMetricLabel, getCoachMetricValue } from "@/lib/session-prescription";
import { supabase } from "@/integrations/supabase/client";
import { RunComparisonCard } from "@/components/cst/RunComparisonCard";
import type { RunMetrics } from "@/lib/run-stats";

type ProgExo = { code?: string; name?: string; series?: string | number; reps?: string | number; charge?: string; rpe_target?: string | number; recup?: string };
type ProgBlock = { letter?: string; type?: string; isSuperset?: boolean; exercises?: ProgExo[] };
type ProgWeek = { number?: number; days?: Array<{ number?: number; label?: string; blocks?: ProgBlock[] }> };
type ProgStructure = { weeks?: ProgWeek[] } | null;

export default function CoachSessionDetail() {
  const { sessionId } = useParams({ from: "/_authenticated/coach/seance/$sessionId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getSessionDetail);
  const markSeen = useServerFn(markSessionSeen);
  const resolve = useServerFn(resolvePainReport);
  const [lightbox, setLightbox] = useState<{ type: "photo" | "video"; url: string | null; caption: string | null } | null>(null);
  const saveCoachNoteFn = useServerFn(setSessionCoachNote);
  const [coachUserId, setCoachUserId] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["coach", "session", sessionId],
    queryFn: () => fetchDetail({ data: { sessionId } }),
  });

  useEffect(() => {
    if (data && !data.session.coach_seen) {
      markSeen({ data: { sessionId } }).then(() => qc.invalidateQueries({ queryKey: ["coach"] })).catch(() => {});
    }
  }, [data, sessionId, markSeen, qc]);

  useEffect(() => { supabase.auth.getUser().then(({ data: u }) => setCoachUserId(u.user?.id ?? null)); }, []);
  useEffect(() => { if (data?.session) setCoachNote((data.session as { coach_note?: string | null }).coach_note ?? ""); }, [data]);

  async function handleSaveCoachNote() {
    setSavingNote(true);
    try {
      await saveCoachNoteFn({ data: { sessionId, note: coachNote } });
      toast.success("Mot du coach enregistré (visible par le membre)");
      qc.invalidateQueries({ queryKey: ["coach", "session", sessionId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingNote(false);
    }
  }

  const blockForExo = useMemo(() => {
    const map = new Map<string, ProgExo & { blockLetter?: string }>();
    if (!data?.program?.structureJson || !data.session.week_number || !data.session.day_number) return map;
    try {
      const structure = JSON.parse(data.program.structureJson) as ProgStructure;
      const week = structure?.weeks?.find((w) => w.number === data.session.week_number);
      const day = week?.days?.find((d) => d.number === data.session.day_number);
      for (const block of day?.blocks ?? []) {
        for (const ex of block.exercises ?? []) {
          if (ex.name) map.set(ex.name.toLowerCase(), { ...ex, blockLetter: block.letter });
        }
      }
    } catch (e) {
      // Structure legacy illisible : la page reste utilisable (logs seuls).
      console.error("[SessionDetail] parse structureJson", e);
    }
    return map;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="cst-screen" style={{ flexDirection: "row" }}>
        <CoachSidebar />
        <div style={{ flex: 1, padding: 32, opacity: 0.6 }}>Chargement…</div>
      </div>
    );
  }

  const s = data.session;
  // Group set logs by exercise
  const byExo = new Map<string, typeof data.setLogs>();
  for (const l of data.setLogs) {
    const key = l.exercise_name || "—";
    if (!byExo.has(key)) byExo.set(key, []);
    byExo.get(key)!.push(l);
  }
  const fbByExo = new Map(data.feedbacks.map((f) => [f.exercise_name || "", f]));
  const painsByExo = new Map<string, typeof data.pains>();
  for (const p of data.pains) {
    const key = p.exercise_name;
    if (!painsByExo.has(key)) painsByExo.set(key, []);
    painsByExo.get(key)!.push(p);
  }
  const activePains = data.pains.filter((p) => !p.resolved_at);

  async function onResolve(id: string) {
    try { await resolve({ data: { id } }); toast.success("Résolu"); qc.invalidateQueries({ queryKey: ["coach"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  const isFree = (s as any).session_type === "free";
  const freeTitle = (s as any).free_title as string | null;
  const freeCategory = (s as any).free_category as string | null;
  const runStats = (data as any).runStats as RunMetrics | null;
  const runPrevious = (data as any).runPrevious as RunMetrics | null;
  const catIcon = freeCategory === "course" ? "🏃" : freeCategory === "cardio" ? "❤️" : freeCategory === "muscu" ? "🏋️" : freeCategory === "sport" ? "⚽" : "✨";
  const freeActivities = (data as any).freeActivities as Array<{ id: string; name: string; category: string | null; series: number | null; reps: string | null; charge: string | null; duration_min: number | null; distance_km: number | null; elevation_m: number | null; rpe: number | null; note: string | null }> | undefined;
  const allMedia = (data as any).media as Array<{ id: string; type: "photo" | "video"; url: string | null; thumbnailUrl: string | null; caption: string | null; isSessionLevel?: boolean }> | undefined;
  const sessionMedia = allMedia?.filter((m) => m.isSessionLevel) ?? [];
  const exerciseMedia = allMedia?.filter((m) => !m.isSessionLevel) ?? [];
  const techniqueVideos = (data as any).techniqueVideos as Array<{ id: string; exerciseName: string | null; url: string | null; thumbnailUrl: string | null }> | undefined ?? [];
  const totalMediaCount = (allMedia?.length ?? 0) + techniqueVideos.length;

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <CSTSectionNum num={1} label={isFree ? "SÉANCE LIBRE" : "DÉTAIL DE SÉANCE"} sub={`${data.member.name} · ${isFree ? `${catIcon} ${freeTitle || "Séance libre"}` : (s.session_label || "Séance")}`} />
            {isFree && <span className="cst-mono" style={{ fontSize: 10, padding: "3px 8px", background: "#2DBE9A", color: "#0a0a0a", borderRadius: 3, letterSpacing: "0.18em" }}>HORS PROGRAMME</span>}
          </div>
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: "/coach" })}>← RETOUR</button>
        </div>

        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Résumé */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Metric label="DURÉE" value={`${sanitizeDurationMin(s.duration_minutes) ?? "—"} min`} />
            <Metric label="RPE MOYEN" value={s.average_rpe != null ? Number(s.average_rpe).toFixed(1) : "—"} />
            {!isFree && <Metric label="VOLUME TOTAL" value={s.total_volume_kg != null ? `${Math.round(Number(s.total_volume_kg))} kg` : "—"} />}
            <Metric label="RESSENTI" value={s.overall_feeling != null ? `${s.overall_feeling}/5` : "—"} />
          </div>

          {runStats && (
            <div>
              <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 10 }}>📊 STATS DE COURSE</div>
              <RunComparisonCard previous={runPrevious} current={runStats} />
            </div>
          )}

          {s.member_note && (
            <div className="cst-card-dark" style={{ padding: 16 }}>
              <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.18em", marginBottom: 6 }}>NOTE DU MEMBRE</div>
              <div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.9 }}>« {s.member_note} »</div>
            </div>
          )}

          {activePains.length > 0 && (
            <div style={{ padding: 16, background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="cst-mono" style={{ fontSize: 10, color: "#ff8a7a", letterSpacing: "0.18em" }}>🔴 DOULEUR{activePains.length > 1 ? "S" : ""} SIGNALÉE{activePains.length > 1 ? "S" : ""}</div>
              {activePains.map((p) => (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 13 }}><strong>{p.exercise_name}</strong> · {p.zone} · intensité {p.intensity}/5</div>
                  {p.comment && <div style={{ fontSize: 12, opacity: 0.8, fontStyle: "italic" }}>« {p.comment} »</div>}
                  <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => onResolve(p.id)}>✓ Marquer comme résolu</button>
                </div>
              ))}
            </div>
          )}

          {/* Activités libres (séance libre uniquement) */}
          {isFree && (
            <div>
              <CSTSectionNum num={2} label="ACTIVITÉS LIBRES" sub="" />
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {(freeActivities ?? []).map((a) => {
                  const bits: string[] = [];
                  if (a.series != null || a.reps) bits.push(`${a.series ?? "?"} × ${a.reps ?? "?"}`);
                  if (a.charge) bits.push(a.charge);
                  if (a.distance_km != null) bits.push(`${a.distance_km} km`);
                  if (a.duration_min != null) bits.push(`${a.duration_min} min`);
                  if (a.elevation_m != null) bits.push(`D+ ${a.elevation_m} m`);
                  if (a.rpe != null) bits.push(`RPE ${a.rpe}`);
                  return (
                    <div key={a.id} className="cst-card-dark" style={{ padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        {a.category && <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.12em" }}>{a.category.toUpperCase()}</span>}
                        <h3 className="cst-display" style={{ margin: 0, fontSize: 15 }}>{a.name.toUpperCase()}</h3>
                      </div>
                      {bits.length > 0 && <div className="cst-mono" style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>{bits.join(" · ")}</div>}
                      {a.note && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, fontStyle: "italic" }}>« {a.note} »</div>}
                    </div>
                  );
                })}
                {(!freeActivities || freeActivities.length === 0) && (
                  <div className="cst-card-dark" style={{ padding: 14, opacity: 0.6 }}>Aucune activité enregistrée.</div>
                )}
              </div>
            </div>
          )}

          {/* Médias (photos / vidéos) — niveau séance */}
          {(sessionMedia.length > 0 || exerciseMedia.length > 0 || techniqueVideos.length > 0) && (
            <div>
              <CSTSectionNum num={isFree ? 3 : 2} label="PHOTOS & VIDÉOS" sub={`${totalMediaCount} fichier${totalMediaCount > 1 ? "s" : ""}`} />

              {sessionMedia.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em", marginBottom: 8 }}>VIDÉOS GLOBALES SÉANCE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {sessionMedia.map((m) => <MediaThumb key={m.id} m={m} onOpen={setLightbox} />)}
                  </div>
                </div>
              )}

              {exerciseMedia.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.18em", marginBottom: 8 }}>MÉDIAS PAR EXERCICE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {exerciseMedia.map((m) => <MediaThumb key={m.id} m={m} onOpen={setLightbox} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Détail par exercice (séance de programme uniquement) */}
          {!isFree && (
          <div>
            <CSTSectionNum num={2} label="DÉTAIL PAR EXERCICE" sub="" />
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from(byExo.entries()).map(([name, logs]) => {
                const planned = blockForExo.get(name.toLowerCase());
                const fb = fbByExo.get(name);
                const pains = painsByExo.get(name) || [];
                const rpeTarget = planned?.rpe_target ? Number(planned.rpe_target) : null;
                const overTarget = rpeTarget != null && fb?.rpe != null && fb.rpe > rpeTarget + 1;
                const metricLabel = getCoachMetricLabel(planned);
                return (
                  <div key={name} className="cst-card-dark" style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      {planned?.blockLetter && <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>{planned.blockLetter}</span>}
                      <h3 className="cst-display" style={{ margin: 0, fontSize: 16 }}>{name.toUpperCase()}</h3>
                      {overTarget && <span className="cst-mono" style={{ fontSize: 9, padding: "2px 6px", background: "rgba(224,123,57,0.2)", color: "#E07B39", borderRadius: 3, letterSpacing: "0.1em" }}>⚠ RPE &gt; PRÉVU</span>}
                      {pains.length > 0 && <span className="cst-mono" style={{ fontSize: 9, padding: "2px 6px", background: "rgba(192,57,43,0.2)", color: "#ff8a7a", borderRadius: 3, letterSpacing: "0.1em" }}>🔴 DOULEUR</span>}
                    </div>
                    {planned && (
                      <div className="cst-mono" style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
                        PRÉVU : {planned.series ?? "?"} × {planned.reps ?? "?"}
                        {planned.charge ? ` · ${planned.charge}` : ""}
                        {planned.rpe_target ? ` · RPE ${planned.rpe_target}` : ""}
                      </div>
                    )}
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ opacity: 0.55, fontFamily: "var(--cst-mono)", fontSize: 10, letterSpacing: "0.1em" }}>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>SÉRIE</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>POIDS</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>{metricLabel}</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>RPE</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>NOTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.sort((a, b) => (a.set_number || 0) - (b.set_number || 0)).map((l, i) => (
                          <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "6px" }}>{l.set_number ?? i + 1}</td>
                            <td style={{ padding: "6px" }}>{l.weight_kg != null ? `${l.weight_kg} kg` : "—"}</td>
                            <td style={{ padding: "6px" }}>{getCoachMetricValue(planned, l.reps)}</td>
                            <td style={{ padding: "6px", color: l.rpe != null && l.rpe >= 9 ? "#E07B39" : undefined }}>{l.rpe ?? "—"}</td>
                            <td style={{ padding: "6px", opacity: 0.8, fontStyle: "italic" }}>{l.note || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {fb && (fb.rpe != null || fb.member_comment) && (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {fb.rpe != null && <span style={{ marginRight: 12 }}>RPE bloc : <strong>{fb.rpe}</strong></span>}
                        {fb.felt_too_hard && <span style={{ color: "#E07B39", marginRight: 12 }}>trop dur</span>}
                        {fb.felt_too_easy && <span style={{ color: "#6EAB76", marginRight: 12 }}>trop facile</span>}
                        {fb.could_not_do && <span style={{ color: "#ff8a7a", marginRight: 12 }}>n'a pas pu faire</span>}
                        {fb.member_comment && <div style={{ marginTop: 4, fontStyle: "italic" }}>« {fb.member_comment} »</div>}
                      </div>
                    )}
                    {/* Échange en contexte (notes athlète + vidéos technique + réponse coach) */}
                    {coachUserId && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <ExerciseThread sessionId={sessionId} exerciseName={name} userId={coachUserId} viewerRole="coach" />
                      </div>
                    )}
                  </div>
                );
              })}
              {byExo.size === 0 && <div className="cst-card-dark" style={{ padding: 16, opacity: 0.6 }}>Aucune série enregistrée pour cette séance.</div>}
            </div>
          </div>
          )}

          <div className="cst-card-dark" style={{ padding: 16 }}>
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.16em", marginBottom: 8 }}>💬 MOT DU COACH SUR LA SÉANCE · VISIBLE PAR LE MEMBRE</div>
            <textarea
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value)}
              rows={3}
              placeholder="Ex. ta moyenne BPM est trop haute, vise plutôt ~140 bpm — ton allure 7'30/km est bonne pour le moment, on construit la base."
              className="cst-input"
              style={{ width: "100%", resize: "vertical", fontFamily: "var(--cst-ui)", padding: "10px 12px", fontSize: 13 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={handleSaveCoachNote} disabled={savingNote}>
                {savingNote ? "…" : "Enregistrer le mot du coach"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="cst-btn cst-btn-primary" onClick={() => navigate({ to: "/coach/membre/$memberId/adapter", params: { memberId: s.member_id }, search: s.week_number ? { week: s.week_number + 1 } : {} })}>
              ADAPTER S{s.week_number ? `+1 (S${String(s.week_number + 1).padStart(2, "0")})` : "UIVANTE"} →
            </button>
            <button className="cst-btn cst-btn-ghost-dark" onClick={() => navigate({ to: "/coach/messages" })}>Répondre au membre</button>
            <button className="cst-btn cst-btn-ghost-dark" onClick={() => navigate({ to: "/coach/membre/$memberId", params: { memberId: s.member_id } })}>Fiche membre</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, fontFamily: "var(--cst-mono)" }}>Terminée {timeAgo(s.ended_at)}</div>
        </div>
      </div>
      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cst-card-dark" style={{ padding: 14 }}>
      <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.18em" }}>{label}</div>
      <div className="cst-display" style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MediaThumb({ m, onOpen }: { m: { id: string; type: "photo" | "video"; url: string | null; thumbnailUrl: string | null; caption: string | null; isSessionLevel?: boolean }; onOpen: (media: { type: "photo" | "video"; url: string | null; caption: string | null }) => void }) {
  return (
    <button type="button" onClick={() => onOpen({ type: m.type, url: m.url, caption: m.caption })}
      style={{ display: "block", width: "100%", aspectRatio: "1", background: "#111", borderRadius: 8, overflow: "hidden", position: "relative", border: "none", padding: 0, cursor: "pointer" }}>
      {m.type === "video"
        ? m.thumbnailUrl
          ? <img src={m.thumbnailUrl} alt={m.caption || "Vidéo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : m.url ? <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null
        : m.url ? <img src={m.url} alt={m.caption || "Photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {m.type === "video" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", color: "#fff", fontSize: 28 }}>▶</div>
      )}
      {m.caption && m.caption !== "[SESSION]" && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 8px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11 }}>{m.caption}</div>
      )}
    </button>
  );
}

function MediaLightbox({ media, onClose }: { media: { type: "photo" | "video"; url: string | null; caption: string | null } | null; onClose: () => void }) {
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [media, onClose]);

  if (!media || !media.url) return null;
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <button type="button" onClick={onClose} aria-label="Fermer"
        style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      <div onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {media.type === "video"
          ? <video src={media.url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8 }} />
          : <img src={media.url} alt={media.caption || "Photo"} style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 8 }} />}
        {media.caption && media.caption !== "[SESSION]" && (
          <div style={{ color: "#fff", fontSize: 13, opacity: 0.85, textAlign: "center", maxWidth: 600 }}>{media.caption}</div>
        )}
      </div>
    </div>
  );
}
