import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Legend } from "recharts";
import MemberNav from "../../components/MemberNav";
import { CSTSectionNum, CSTDuoTitle } from "../../components/Atoms";
import { getMemberProgression, listMyExercises, getMyExerciseProgression } from "@/lib/member-stats.functions";

export default function Progression() {
  const fetchProgression = useServerFn(getMemberProgression);
  const fetchExercises = useServerFn(listMyExercises);
  const fetchExProg = useServerFn(getMyExerciseProgression);

  const [data, setData] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState("");
  const [exData, setExData] = useState(null);
  const [loading, setLoading] = useState(true);

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
            <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
            <span className="cst-mono" style={{ color: "#fff" }}>PROGRESSION</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>⌕</span>
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
    </div>
  );
}
