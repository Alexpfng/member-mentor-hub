import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import CoachSidebar from "../../components/CoachSidebar";
import { CSTSectionNum } from "../../components/Atoms";
import { localDateISO } from "@/lib/local-date";
import {
  listPrograms,
  duplicateProgram,
  deleteProgram,
  listMembers,
  assignProgram,
} from "@/lib/coach.functions";
import { seedColosmartData } from "@/lib/seed.functions";
import AssignmentTimingFields from "@/components/coach/AssignmentTimingFields";
import { deriveAssignmentStartDate } from "@/lib/assignment-start";

type Program = {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  frequency_per_week: number | null;
  objective: string | null;
  level: string | null;
};

type Member = { id: string; first_name: string | null; last_name: string | null; email: string | null };

function todayISO(): string {
  return localDateISO();
}

function AssignModal({
  program,
  members,
  onClose,
  onDone,
}: {
  program: Program;
  members: Member[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const assignFn = useServerFn(assignProgram);
  const [busy, setBusy] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [startWeek, setStartWeek] = useState(1);
  const effectiveStartDate = deriveAssignmentStartDate(startDate, startWeek);

  async function pick(memberId: string) {
    setBusy(memberId);
    try {
      await assignFn({
        data: {
          member_id: memberId,
          program_id: program.id,
          start_date: effectiveStartDate,
        },
      });
      const m = members.find((x) => x.id === memberId);
      const label = [m?.first_name, m?.last_name].filter(Boolean).join(" ") || m?.email || "membre";
      onDone(`« ${program.name} » assigné à ${label}.`);
    } catch (ex: any) {
      alert(ex?.message || "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{ width: 440, padding: 24, borderRadius: 12 }}
      >
        <div className="cst-display" style={{ fontSize: 22, marginBottom: 4 }}>
          ASSIGNER
        </div>
        <div className="cst-italic" style={{ fontSize: 13, color: "var(--cst-mid-green)", marginBottom: 16 }}>
          {program.name}
        </div>
        {members.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Aucun adhérent à assigner. Invite d'abord un membre depuis le tableau de bord.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AssignmentTimingFields
              durationWeeks={program.duration_weeks}
              startDate={startDate}
              onStartDateChange={setStartDate}
              startWeek={startWeek}
              onStartWeekChange={setStartWeek}
              effectiveStartDate={effectiveStartDate}
            />
            {members.map((m) => {
              const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "—";
              return (
                <button
                  key={m.id}
                  disabled={!!busy}
                  onClick={() => pick(m.id)}
                  className="cst-btn cst-btn-ghost-dark"
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                >
                  {busy === m.id ? "..." : name}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={onClose}
          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
          style={{ marginTop: 16 }}
        >
          ANNULER
        </button>
      </div>
    </div>
  );
}

export default function ProgrammesPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listPrograms);
  const dupFn = useServerFn(duplicateProgram);
  const delFn = useServerFn(deleteProgram);
  const seedFn = useServerFn(seedColosmartData);
  const listMembersFn = useServerFn(listMembers);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignTarget, setAssignTarget] = useState<Program | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [p, m] = await Promise.all([listFn(), listMembersFn()]);
    setPrograms((p.programs || []) as Program[]);
    setMembers(((m.members || []) as Member[]).map((x) => ({
      id: x.id, first_name: x.first_name, last_name: x.last_name, email: x.email,
    })));
  }

  useEffect(() => {
    (async () => {
      try { await seedFn(); } catch { /* seed best-effort (déjà fait) */ }
      try {
        await reload();
      } catch (e) {
        console.error("reload programmes", e);
        notify("Impossible de charger les programmes. Recharge la page.");
      }
      setLoading(false);
    })();
  }, []);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleDuplicate(p: Program) {
    try {
      await dupFn({ data: { id: p.id } });
      notify(`Programme dupliqué.`);
      reload();
    } catch (ex: any) {
      alert(ex?.message || "Erreur");
    }
  }

  async function handleDelete(p: Program) {
    if (!window.confirm(`Supprimer définitivement le programme « ${p.name} » ?\nCette action est irréversible.`)) return;
    try {
      await delFn({ data: { id: p.id } });
      notify("Programme supprimé.");
      reload();
    } catch (ex: any) {
      alert(ex?.message || "Erreur");
    }
  }

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      {assignTarget && (
        <AssignModal
          program={assignTarget}
          members={members}
          onClose={() => setAssignTarget(null)}
          onDone={(msg) => {
            setAssignTarget(null);
            notify(msg);
            reload();
          }}
        />
      )}
      <div className="cst-col cst-scroll-visible" style={{ flex: 1, minWidth: 0 }}>
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
          <CSTSectionNum num={3} label="PROGRAMMES" sub={`${programs.length} DISPONIBLES`} />
          <button
            className="cst-btn cst-btn-primary cst-btn-sm"
            onClick={() => navigate({ to: "/coach/builder" })}
          >
            + NOUVEAU PROGRAMME
          </button>
        </div>

        {toast && (
          <div
            style={{
              margin: "12px 32px 0",
              padding: "10px 14px",
              background: "rgba(45,90,53,0.15)",
              border: "1px solid rgba(45,90,53,0.4)",
              borderRadius: 8,
              fontSize: 12,
              color: "#6EAB76",
            }}
          >
            {toast}
          </div>
        )}

        <div
          style={{
            padding: "24px 32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {loading && (
            <div style={{ opacity: 0.6, fontSize: 13 }}>Chargement…</div>
          )}
          {!loading && programs.length === 0 && (
            <div className="cst-card-dark cst-hatch" style={{ padding: 24, textAlign: "center", gridColumn: "1 / -1" }}>
              <div className="cst-display" style={{ fontSize: 20, marginBottom: 6 }}>
                AUCUN PROGRAMME
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
                Crée ton premier programme pour pouvoir l'assigner à tes adhérents.
              </p>
              <button
                className="cst-btn cst-btn-primary"
                onClick={() => navigate({ to: "/coach/builder" })}
              >
                CRÉER UN PROGRAMME →
              </button>
            </div>
          )}
          {programs.map((p) => {
            const struct = p as any;
            return (
              <div
                key={p.id}
                className="cst-card-dark"
                style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: 80 }}>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
                    {p.level?.toUpperCase() || "PROGRAMME"}
                  </span>
                  <div style={{ fontFamily: "var(--cst-display)", fontSize: 18, fontWeight: 700, lineHeight: 1.15 }}>
                    {p.name}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{p.description}</div>
                  )}
                </div>
                <div
                  className="cst-mono"
                  style={{ fontSize: 10, opacity: 0.75, display: "flex", gap: 12 }}
                >
                  <span>{p.duration_weeks ? `${p.duration_weeks} SEM.` : "— SEM."}</span>
                  <span>{p.frequency_per_week ? `${p.frequency_per_week} J/SEM.` : "— J/SEM."}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    onClick={() => navigate({ to: "/coach/programmes/$id", params: { id: p.id } })}
                  >
                    VOIR
                  </button>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    onClick={() => navigate({ to: "/coach/builder/$id", params: { id: p.id } })}
                  >
                    ÉDITER
                  </button>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    onClick={() => handleDuplicate(p)}
                  >
                    DUPLIQUER
                  </button>
                  <button
                    className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                    onClick={() => handleDelete(p)}
                    style={{ color: "#C56A60", borderColor: "rgba(197,106,96,0.45)" }}
                    title="Supprimer le programme"
                  >
                    SUPPRIMER
                  </button>
                  <button
                    className="cst-btn cst-btn-primary cst-btn-sm"
                    onClick={() => setAssignTarget(p)}
                    style={{ marginLeft: "auto" }}
                  >
                    ASSIGNER →
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
