import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Legend } from "recharts";
import MemberNav from "../../components/MemberNav";
import { CSTSectionNum, CSTDuoTitle } from "../../components/Atoms";
import { getMemberProgression, listMyExercises, getMyExerciseProgression } from "@/lib/member-stats.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { localDateISO } from "@/lib/local-date";
import { ConfirmDialog } from "../../components/cst/ConfirmDialog";

const MEASURE_FIELDS = [
  ["waist_cm", "Taille"],
  ["hips_cm", "Hanches"],
  ["chest_cm", "Poitrine"],
  ["arm_cm", "Bras"],
  ["thigh_cm", "Cuisse"],
];

export default function Progression() {
  const fetchProgression = useServerFn(getMemberProgression);
  const fetchExercises = useServerFn(listMyExercises);
  const fetchExProg = useServerFn(getMyExerciseProgression);

  const [data, setData] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState("");
  const [exData, setExData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─ Suivi corporel (mensurations + photos) — P2
  const [userId, setUserId] = useState(null);
  const [measures, setMeasures] = useState([]);
  const [form, setForm] = useState({ waist_cm: "", hips_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "", note: "" });
  const [savingMeasure, setSavingMeasure] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [p, ex] = await Promise.all([fetchProgression(), fetchExercises()]);
        setData(p);
        setExercises(ex.exercises ?? []);
        if (ex.exercises?.[0]) setSelected(ex.exercises[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        const r = await fetchExProg({ data: { exerciseName: selected } });
        setExData(r);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selected]);

  // Charge mensurations + photos (dégrade en silence si la migration P2 n'est pas encore appliquée)
  async function loadEvolution(uid) {
    if (!uid) return;
    const { data: m } = await supabase
      .from("body_measurements").select("*").eq("member_id", uid).order("date", { ascending: false }).limit(12);
    setMeasures(m ?? []);
    const { data: ph } = await supabase
      .from("progress_photos").select("*").eq("member_id", uid).order("date", { ascending: false }).limit(24);
    const signed = await Promise.all(
      (ph ?? []).map(async (p) => {
        const { data: s } = await supabase.storage.from("progress-photos").createSignedUrl(p.storage_path, 3600);
        return { ...p, url: s?.signedUrl ?? null };
      }),
    );
    setPhotos(signed);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id ?? null;
      setUserId(uid);
      try { await loadEvolution(uid); } catch { /* tables/bucket pas encore créés */ }
    })();
  }, []);

  const num = (s) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  async function saveMeasurement() {
    if (!userId) return;
    const hasAnyMeasure = MEASURE_FIELDS.some(([key]) => form[key].trim() !== "");
    if (!hasAnyMeasure) {
      toast.error("Renseigne au moins une mesure.");
      return;
    }
    setSavingMeasure(true);
    const row = {
      member_id: userId,
      date: localDateISO(),
      waist_cm: num(form.waist_cm), hips_cm: num(form.hips_cm), chest_cm: num(form.chest_cm),
      arm_cm: num(form.arm_cm), thigh_cm: num(form.thigh_cm), note: form.note.trim() || null,
    };
    const { error } = await supabase.from("body_measurements").insert(row);
    if (error) { toast.error("Enregistrement impossible. Réessaie."); setSavingMeasure(false); return; }
    setForm({ waist_cm: "", hips_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "", note: "" });
    try { await loadEvolution(userId); } catch { /* ignore */ }
    setSavingMeasure(false);
    toast.success("Mensuration enregistrée ✓");
  }

  async function uploadPhoto(file) {
    if (!userId || !file) return;
    setUploadingPhoto(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: false });
    if (upErr) { toast.error("Envoi de la photo impossible. Réessaie."); setUploadingPhoto(false); return; }
    const { error: insErr } = await supabase.from("progress_photos").insert({ member_id: userId, storage_path: path, date: localDateISO() });
    if (insErr) { toast.error("La photo n'a pas pu être enregistrée."); setUploadingPhoto(false); return; }
    try { await loadEvolution(userId); } catch { /* ignore */ }
    setUploadingPhoto(false);
    toast.success("Photo ajoutée ✓");
  }

  async function deletePhoto(p) {
    const { error: delErr } = await supabase.from("progress_photos").delete().eq("id", p.id);
    await supabase.storage.from("progress-photos").remove([p.storage_path]);
    if (delErr) { toast.error("Suppression impossible. Réessaie."); return; }
    try { await loadEvolution(userId); } catch { /* ignore */ }
    toast.success("Photo supprimée");
  }

  const totalSessions = data?.totalSessions ?? 0;
  const totalVolumeT = data ? Math.round(Number(data.totalVolume) / 100) / 10 : 0; // tonnes
  const prs = data?.prs ?? [];
  const weights = data?.weights ?? [];

  const weightSeries = useMemo(
    () => weights.map((w) => ({
      label: new Date(w.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      kg: Number(w.weight_kg),
    })),
    [weights],
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--cst-dark-green)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="cst-screen" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 8px" }}>
            <button
              onClick={() => navigate({ to: "/membre" })}
              aria-label="Retour à l'accueil"
              style={{ background: "none", border: "none", color: "#fff", fontSize: 18, opacity: 0.7, cursor: "pointer", padding: 0, lineHeight: 1 }}
            >
              ←
            </button>
            <span className="cst-mono" style={{ color: "#fff" }}>PROGRESSION</span>
            <span style={{ width: 18 }} aria-hidden="true" />
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: "0 22px 90px" }}>
            <CSTSectionNum num={1} label="MA PROGRESSION" sub={`${totalSessions} SÉANCES`} />
            <CSTDuoTitle top="DEVANT" bottom="moi." size={36} />

            {loading ? (
              <div style={{ padding: 24, opacity: 0.6 }}>Chargement…</div>
            ) : (
              <>
                {/* Stats globales */}
                <div style={{ marginTop: 18 }}>
                  <CSTSectionNum num={2} label="STATS GLOBALES" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    {[
                      ["SÉANCES", String(totalSessions)],
                      ["VOLUME · T", String(totalVolumeT)],
                      ["RECORDS", String(prs.length)],
                      ["POIDS", weights.length ? `${Number(weights[weights.length - 1].weight_kg)} KG` : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="cst-card-dark" style={{ padding: 12 }}>
                        <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                        <div className="cst-display" style={{ fontSize: 22, marginTop: 4 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weight chart */}
                {weightSeries.length > 1 && (
                  <div style={{ marginTop: 24 }}>
                    <CSTSectionNum num={3} label="POIDS DU CORPS" sub="8 SEMAINES" />
                    <div className="cst-card-dark" style={{ marginTop: 12, padding: 14, height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weightSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} domain={["dataMin - 1", "dataMax + 1"]} />
                          <Tooltip contentStyle={{ background: "#1a261d", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }} />
                          <Line type="monotone" dataKey="kg" stroke="#6EAB76" strokeWidth={2} dot={{ fill: "#6EAB76", r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Exercise progression */}
                {exercises.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <CSTSectionNum num={4} label="PROGRESSION EXERCICE" />
                    <div className="cst-card-dark" style={{ marginTop: 12, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
                        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.7 }}>EXERCICE</span>
                        <select
                          value={selected}
                          onChange={(e) => setSelected(e.target.value)}
                          style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}
                        >
                          {exercises.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                        </select>
                      </div>
                      {exData?.series?.length ? (
                        <div style={{ height: 220 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={exData.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                              <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fill: "rgba(224,123,57,0.8)", fontSize: 11 }} />
                              <Tooltip contentStyle={{ background: "#1a261d", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar yAxisId="left" dataKey="weight" fill="#6EAB76" name="Poids (kg)" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="rpe" stroke="#E07B39" strokeWidth={2} dot={{ fill: "#E07B39", r: 3 }} name="RPE" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ padding: 12, opacity: 0.5, fontSize: 12 }}>Pas encore de données.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* PR list */}
                {prs.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <CSTSectionNum num={5} label="RECORDS PERSONNELS" sub={`${prs.length} PR`} />
                    <div className="cst-col" style={{ gap: 8, marginTop: 12 }}>
                      {prs.map((p, i) => (
                        <div key={i} className="cst-card-dark" style={{ padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{p.exercise_name?.toUpperCase() ?? "—"}</span>
                            <span className="cst-display" style={{ fontSize: 16, color: "var(--cst-mid-green)" }}>
                              {p.weight_kg != null ? `${p.weight_kg} KG` : p.reps != null ? `${p.reps} REPS` : "—"}
                            </span>
                          </div>
                          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
                            {p.date ? new Date(p.date).toLocaleDateString("fr-FR") : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suivi corporel — mensurations */}
                <div style={{ marginTop: 24 }}>
                  <CSTSectionNum num={6} label="SUIVI CORPOREL" sub="MENSURATIONS (CM)" />
                  <div className="cst-card-dark" style={{ marginTop: 12, padding: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      {MEASURE_FIELDS.map(([key, label]) => (
                        <div key={key}>
                          <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: "0.12em", marginBottom: 4 }}>{label.toUpperCase()}</div>
                          <input
                            value={form[key]}
                            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            inputMode="decimal"
                            placeholder="—"
                            style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 14, boxSizing: "border-box" }}
                          />
                        </div>
                      ))}
                    </div>
                    <input
                      value={form.note}
                      onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="Note (optionnel)"
                      style={{ width: "100%", marginTop: 8, padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, boxSizing: "border-box" }}
                    />
                    <button
                      onClick={saveMeasurement}
                      disabled={savingMeasure || !userId}
                      className="cst-btn cst-btn-primary cst-btn-sm"
                      style={{ width: "100%", marginTop: 10 }}
                    >
                      {savingMeasure ? "ENREGISTREMENT…" : "ENREGISTRER MES MENSURATIONS"}
                    </button>
                  </div>
                  {measures.length > 0 && (
                    <div className="cst-col" style={{ gap: 6, marginTop: 10 }}>
                      {measures.map((m) => {
                        const parts = MEASURE_FIELDS.filter(([k]) => m[k] != null).map(([k, l]) => `${l} ${m[k]}`);
                        return (
                          <div key={m.id} className="cst-card-dark" style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                            <span style={{ fontSize: 12, opacity: 0.9, textAlign: "right" }}>{parts.join(" · ") || (m.note ? "" : "—")}{m.note ? ` · « ${m.note} »` : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Photos d'évolution */}
                <div style={{ marginTop: 24 }}>
                  <CSTSectionNum num={7} label="PHOTOS D'ÉVOLUTION" sub="PRIVÉ · VISIBLE PAR TON COACH" />
                  <label
                    className="cst-btn cst-btn-ghost-dark"
                    style={{ display: "block", textAlign: "center", marginTop: 12, cursor: uploadingPhoto ? "wait" : "pointer", opacity: uploadingPhoto || !userId ? 0.6 : 1 }}
                  >
                    {uploadingPhoto ? "ENVOI…" : "📷 AJOUTER UNE PHOTO"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPhoto || !userId}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }}
                      style={{ display: "none" }}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                      {photos.map((p) => (
                        <div key={p.id} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", background: "#111" }}>
                          {p.url ? <img src={p.url} alt="évolution" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                          <span style={{ position: "absolute", left: 0, bottom: 0, right: 0, padding: "3px 6px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontFamily: "var(--cst-mono)" }}>
                            {new Date(p.date).toLocaleDateString("fr-FR")}
                          </span>
                          <button
                            onClick={() => setPhotoToDelete(p)}
                            aria-label="Supprimer"
                            style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 13, cursor: "pointer", lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {photos.length === 0 && (
                    <p style={{ marginTop: 10, fontSize: 12, opacity: 0.5, textAlign: "center" }}>
                      Aucune photo pour l'instant.
                    </p>
                  )}
                </div>

                {prs.length === 0 && exercises.length === 0 && (
                  <div className="cst-card-dark" style={{ marginTop: 24, padding: 22, textAlign: "center" }}>
                    <div className="cst-display" style={{ fontSize: 18, marginBottom: 6 }}>PAS ENCORE DE DONNÉES</div>
                    <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>
                      Termine ta première séance pour voir ta progression ici.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <MemberNav />
        </div>
      </div>

      <ConfirmDialog
        open={!!photoToDelete}
        title="Supprimer cette photo ?"
        message="Cette action est définitive."
        confirmLabel="Supprimer"
        danger
        onCancel={() => setPhotoToDelete(null)}
        onConfirm={() => { const p = photoToDelete; setPhotoToDelete(null); if (p) deletePhoto(p); }}
      />
    </div>
  );
}
