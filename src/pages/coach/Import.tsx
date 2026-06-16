import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import CoachSidebar from "../../components/CoachSidebar";
import { CSTSectionNum } from "../../components/Atoms";
import AssignmentTimingFields from "@/components/coach/AssignmentTimingFields";
import { parseExcelFile, type ParsedExcel, type ImportedExercise } from "@/lib/excel-import/parser";
import { saveProgram, listMembers, assignProgram } from "@/lib/coach.functions";
import { deriveAssignmentStartDate } from "@/lib/assignment-start";

const COLOR_DOT: Record<string, string> = {
  red: "#C44A3A",
  green: "#5BA85A",
  yellow: "#D4A82E",
  blue: "#4A8BC4",
};

function nextMondayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const add = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function val(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function ExerciseRow({ ex }: { ex: ImportedExercise }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px 36px minmax(0,1fr) auto",
        gap: 10,
        padding: "8px 12px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        alignItems: "center",
        color: "#fff",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: ex.color ? COLOR_DOT[ex.color] : "rgba(255,255,255,0.18)",
        }}
      />
      <span className="cst-mono" style={{ fontSize: 10, opacity: 0.65 }}>
        {ex.code || "—"}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>
        <span className="cst-mono" style={{ fontSize: 10, opacity: 0.7 }}>
          {val(ex.series)} × {val(ex.reps)} · {val(ex.charge)} · TEMPO {val(ex.tempo)} · RÉCUP{" "}
          {val(ex.recup)} · RPE {val(ex.rpe_target)}
        </span>
        {ex.coach_notes && (
          <span style={{ fontSize: 11, opacity: 0.75, fontStyle: "italic" }}>
            {ex.coach_notes}
          </span>
        )}
      </div>
      <span
        title={ex.youtube_url || "Pas de vidéo"}
        style={{
          fontSize: 11,
          padding: "3px 7px",
          borderRadius: 4,
          border: `1px solid ${ex.youtube_url ? "var(--cst-mid-green)" : "rgba(255,255,255,0.12)"}`,
          color: ex.youtube_url ? "var(--cst-mid-green)" : "rgba(255,255,255,0.35)",
        }}
      >
        🎬
      </span>
    </div>
  );
}

// ─── DROPZONE ────────────────────────────────────────────────────────────────
function Dropzone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 20 Mo).");
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      toast.error("Ce fichier n'est pas un Excel valide (.xlsx, .xls, .csv).");
      return;
    }
    onFile(f);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      style={{
        border: `2px dashed ${hover ? "var(--cst-mid-green)" : "rgba(45,90,53,0.5)"}`,
        background: hover ? "rgba(45,90,53,0.18)" : "rgba(45,90,53,0.07)",
        borderRadius: 12,
        padding: "60px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "center",
        color: "#fff",
        transition: "all 120ms ease",
      }}
    >
      <div style={{ fontSize: 44, color: "var(--cst-mid-green)" }}>▲</div>
      <div className="cst-display" style={{ fontSize: 20, color: "#fff" }}>
        {busy ? "ANALYSE DU FICHIER…" : "GLISSE TON FICHIER EXCEL ICI"}
      </div>
      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>OU</div>
      <button
        className="cst-btn cst-btn-secondary cst-btn-sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        PARCOURIR LES FICHIERS
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <div className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
        .XLSX · .XLS · .CSV · MAX 20 MO
      </div>
    </div>
  );
}

// ─── ASSIGN DIALOG ───────────────────────────────────────────────────────────
function AssignDialog({
  programId,
  programName,
  durationWeeks,
  onClose,
}: {
  programId: string;
  programName: string;
  durationWeeks: number | null;
  onClose: () => void;
}) {
  const listMembersFn = useServerFn(listMembers);
  const assignFn = useServerFn(assignProgram);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-members"],
    queryFn: () => listMembersFn({}),
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(nextMondayISO());
  const [startWeek, setStartWeek] = useState(1);
  const [saving, setSaving] = useState(false);
  const effectiveStartDate = deriveAssignmentStartDate(startDate, startWeek);

  const members = useMemo(() => {
    const arr = data?.members ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((m: any) =>
      `${m.first_name || ""} ${m.last_name || ""} ${m.email || ""}`.toLowerCase().includes(q),
    );
  }, [data, query]);

  const confirm = async () => {
    if (!selected) {
      toast.error("Sélectionne un coaché.");
      return;
    }
    setSaving(true);
    try {
      await assignFn({
        data: {
          program_id: programId,
          member_id: selected,
          start_date: effectiveStartDate,
        },
      });
      toast.success("Programme assigné.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'assignation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1F2A22",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          width: "min(560px, 100%)",
          padding: 24,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <CSTSectionNum num={4} label="ASSIGNER" sub={programName.toUpperCase()} />
        <h3 className="cst-display" style={{ fontSize: 22, margin: 0 }}>UN COACHÉ.</h3>
        <input
          placeholder="Rechercher un coaché…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "10px 12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
          }}
        />
        <div style={{ maxHeight: 260, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {isLoading && <div style={{ opacity: 0.5, padding: 8 }}>Chargement…</div>}
          {!isLoading && members.length === 0 && (
            <div style={{ opacity: 0.5, padding: 8 }}>Aucun coaché trouvé.</div>
          )}
          {members.map((m: any) => {
            const name = `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email;
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${active ? "var(--cst-mid-green)" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(45,90,53,0.25)" : "rgba(255,255,255,0.02)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                    {m.program_name ? `Programme actif : ${m.program_name}` : "Aucun programme actif"}
                  </span>
                </div>
                {active && <span style={{ color: "var(--cst-mid-green)" }}>✓</span>}
              </button>
            );
          })}
        </div>
        <AssignmentTimingFields
          durationWeeks={durationWeeks}
          startDate={startDate}
          onStartDateChange={setStartDate}
          startWeek={startWeek}
          onStartWeekChange={setStartWeek}
          effectiveStartDate={effectiveStartDate}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ flex: 1 }} onClick={onClose}>
            ANNULER
          </button>
          <button
            className="cst-btn cst-btn-primary cst-btn-sm"
            style={{ flex: 1 }}
            onClick={confirm}
            disabled={saving || !selected}
          >
            {saving ? "ASSIGNATION…" : "ASSIGNER →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function ExcelImport() {
  const navigate = useNavigate();
  const saveFn = useServerFn(saveProgram);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [programName, setProgramName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedProgram, setSavedProgram] = useState<{ id: string; name: string; durationWeeks: number | null } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      const res = await parseExcelFile(f);
      setParsed(res);
      setProgramName(res.metadata.objective || f.name.replace(/\.(xlsx|xls|csv)$/i, ""));
      if (res.warnings.length) res.warnings.forEach((w) => toast.warning(w));
    } catch (e: any) {
      toast.error(e?.message || "Échec du parsing");
      setFile(null);
      setParsed(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setProgramName("");
    setSavedProgram(null);
  };

  const handleSave = async () => {
    if (!parsed) return;
    if (!programName.trim()) {
      toast.error("Donne un nom au programme.");
      return;
    }
    setSaving(true);
    try {
      const r = await saveFn({
        data: {
          name: programName.trim(),
          description:
            [parsed.metadata.objective, parsed.metadata.split].filter(Boolean).join(" · ") || null,
          objective: parsed.metadata.objective || null,
          duration_weeks: parsed.weeks.length,
          frequency_per_week: parsed.weeks[0]?.days?.length || null,
          level: null,
          structure: {
            source: "excel_import",
            metadata: parsed.metadata,
            weeks: parsed.weeks,
          },
        },
      });
      setSavedProgram({
        id: r.program.id,
        name: r.program.name,
        durationWeeks: r.program.duration_weeks ?? parsed?.stats.weeks ?? null,
      });
      toast.success("Programme enregistré.");
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-scroll" style={{ flex: 1, padding: "24px 32px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <CSTSectionNum num={1} label="IMPORT EXCEL" sub="EXCEL → PROGRAMME INTERACTIF" />
            <h1 className="cst-display" style={{ fontSize: 44, margin: "10px 0 0", color: "#fff" }}>
              DU TABLEUR
            </h1>
            <div className="cst-italic" style={{ fontSize: 26, color: "var(--cst-mid-green)" }}>
              À l'action.
            </div>
          </div>
          <div className="cst-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
            {parsed ? "ÉTAPE 2/3 · APERÇU" : "ÉTAPE 1/3 · UPLOAD"}
          </div>
        </div>

        {/* STEP 1: Upload */}
        {!parsed && (
          <div
            style={{
              background: "#1F2A22",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <Dropzone onFile={handleFile} busy={parsing} />
          </div>
        )}

        {/* STEP 2: Preview */}
        {parsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Recap */}
            <div
              style={{
                background: "#1F2A22",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 20,
                color: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div className="cst-mono" style={{ fontSize: 11, color: "var(--cst-mid-green)" }}>
                  ✓ FICHIER ANALYSÉ · {file?.name}
                </div>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={reset}>
                  ← RECOMMENCER
                </button>
              </div>

              <label
                style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}
              >
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
                  NOM DU PROGRAMME
                </span>
                <input
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 8,
                }}
              >
                {[
                  ["ATHLÈTE", parsed.metadata.athlete || "—"],
                  ["OBJECTIF", parsed.metadata.objective || "—"],
                  ["SEMAINES", String(parsed.stats.weeks)],
                  ["SÉANCES/SEM", String(parsed.weeks[0]?.days?.length ?? 0)],
                  ["EXERCICES", String(parsed.stats.exercises)],
                  ["VIDÉOS", String(parsed.stats.videos)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column mapping (read-only display of detected layout) */}
            {parsed.layout && (
              <div
                style={{
                  background: "#1F2A22",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 20,
                  color: "#fff",
                }}
              >
                <CSTSectionNum num={2} label="MAPPING DES COLONNES" sub="DÉTECTÉ AUTOMATIQUEMENT" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {[
                    ["Nom exercice", parsed.layout.nameCol],
                    ["Séries", parsed.layout.seriesCol],
                    ["Répétitions", parsed.layout.repsCol],
                    ["Charge", parsed.layout.chargeCol],
                    ["Tempo", parsed.layout.tempoCol],
                    ["Récup", parsed.layout.recupCol],
                    ["RPE", parsed.layout.rpeCol],
                    ["Consignes", parsed.layout.notesCol],
                    ["Lien YouTube", parsed.layout.youtubeCol],
                  ].map(([label, col]) => (
                    <div
                      key={label as string}
                      style={{
                        background: "rgba(45,90,53,0.12)",
                        border: "1px solid rgba(45,90,53,0.3)",
                        padding: "8px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      <span
                        className="cst-mono"
                        style={{ fontSize: 10, color: "var(--cst-mid-green)" }}
                      >
                        COL {String.fromCharCode(65 + (col as number))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div
              style={{
                background: "#1F2A22",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 20,
                color: "#fff",
              }}
            >
              <CSTSectionNum num={3} label="APERÇU" sub="CE QUE VERRA LE COACHÉ" />
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 18 }}>
                {parsed.weeks.map((w) => (
                  <div key={w.sheet}>
                    <div
                      className="cst-display"
                      style={{ fontSize: 18, marginBottom: 8, color: "#fff" }}
                    >
                      SEMAINE {w.number}{" "}
                      <span className="cst-mono" style={{ fontSize: 10, opacity: 0.5 }}>
                        · {w.sheet}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {w.days.map((d) => (
                        <div
                          key={d.number}
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            className="cst-mono"
                            style={{
                              padding: "8px 12px",
                              fontSize: 11,
                              color: "var(--cst-mid-green)",
                              background: "rgba(45,90,53,0.12)",
                              letterSpacing: "0.15em",
                            }}
                          >
                            J{d.number} · {d.label.toUpperCase()} · {d.exercises.length} EX.
                          </div>
                          {d.exercises.map((ex, i) => (
                            <ExerciseRow key={i} ex={ex} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="cst-btn cst-btn-ghost-dark" onClick={reset} disabled={saving}>
                ← RECOMMENCER
              </button>
              {!savedProgram && (
                <button
                  className="cst-btn cst-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "ENREGISTREMENT…" : "CONVERTIR ET ENREGISTRER →"}
                </button>
              )}
              {savedProgram && (
                <>
                  <button
                    className="cst-btn cst-btn-secondary"
                    onClick={() =>
                      navigate({ to: "/coach/builder/$id", params: { id: savedProgram.id } })
                    }
                  >
                    MODIFIER DANS LE BUILDER
                  </button>
                  <button
                    className="cst-btn cst-btn-primary"
                    onClick={() => setAssignOpen(true)}
                  >
                    ASSIGNER À UN COACHÉ →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {assignOpen && savedProgram && (
        <AssignDialog
          programId={savedProgram.id}
          programName={savedProgram.name}
          durationWeeks={savedProgram.durationWeeks}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}
