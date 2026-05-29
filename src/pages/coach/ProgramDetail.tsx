import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import CoachSidebar from "../../components/CoachSidebar";
import { CSTSectionNum } from "../../components/Atoms";
import { getProgram } from "@/lib/coach.functions";
import { ProgramBlocks, type ProgExercise } from "../../components/cst/ProgramBlocks";

type Day = { number?: number; label?: string; exercises?: ProgExercise[] };
type Week = { number?: number; days?: Day[] };
type Program = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  duration_weeks: number | null;
  frequency_per_week: number | null;
  structure: { weeks?: Week[] } | null;
};

export default function ProgramDetail() {
  const { id } = useParams({ from: "/_authenticated/coach/programmes/$id" });
  const navigate = useNavigate();
  const fn = useServerFn(getProgram);
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fn({ data: { id } });
        setProgram(r.program as unknown as Program);
      } catch (ex: any) {
        setError(ex?.message || "Erreur");
      }
    })();
  }, [id]);

  const weeks = program?.structure?.weeks || [];
  const week = weeks[activeWeek];

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "24px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <button
              onClick={() => navigate({ to: "/coach/programmes" })}
              className="cst-btn cst-btn-ghost-dark cst-btn-sm"
              style={{ marginBottom: 10 }}
            >
              ← PROGRAMMES
            </button>
            <CSTSectionNum
              num={3}
              label={program?.name?.toUpperCase() || "PROGRAMME"}
              sub={program?.objective || ""}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              className="cst-mono"
              style={{ fontSize: 11, opacity: 0.75, display: "flex", gap: 16 }}
            >
              <span>{program?.duration_weeks ?? "—"} SEMAINES</span>
              <span>{program?.frequency_per_week ?? "—"} J/SEM.</span>
            </div>
            {program && (
              <button
                className="cst-btn cst-btn-primary cst-btn-sm"
                onClick={() => navigate({ to: "/coach/builder/$id", params: { id: program.id } })}
              >
                ÉDITER →
              </button>
            )}
          </div>

        </div>

        {error && (
          <div style={{ padding: 24, color: "#C56A60" }}>{error}</div>
        )}

        {!program && !error && (
          <div style={{ padding: 24, opacity: 0.6 }}>Chargement…</div>
        )}

        {program && (
          <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Week tabs */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {weeks.map((w, i) => (
                <button
                  key={i}
                  onClick={() => setActiveWeek(i)}
                  className="cst-btn cst-btn-sm"
                  style={{
                    background: i === activeWeek ? "var(--cst-mid-green)" : "transparent",
                    color: i === activeWeek ? "#0f1a12" : "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: "var(--cst-mono)",
                    fontSize: 11,
                    padding: "6px 12px",
                  }}
                >
                  S{w.number ?? i + 1}
                </button>
              ))}
            </div>

            {/* Days */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {(week?.days || []).map((d, i) => (
                <div key={i} className="cst-card-dark" style={{ padding: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="cst-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.22em",
                        color: "var(--cst-mid-green)",
                      }}
                    >
                      JOUR {d.number ?? i + 1}
                    </span>
                    <span style={{ fontFamily: "var(--cst-display)", fontSize: 16, fontWeight: 700 }}>
                      {d.label || `Séance ${i + 1}`}
                    </span>
                  </div>
                  <ProgramBlocks exercises={d.exercises || []} />
                </div>
              ))}
              {(!week || (week.days || []).length === 0) && (
                <div style={{ opacity: 0.6, fontSize: 13 }}>Aucune séance dans cette semaine.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
