import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import MemberNav from "../../components/MemberNav";
import {
  listWeekPlan,
  upsertPlannedSession,
  deletePlannedSession,
  markDayRest,
} from "@/lib/planning.functions";
import { createFreeSession } from "@/lib/free-session.functions";

const DAY_LABELS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const FR_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function DroppableDay({
  date,
  label,
  isToday,
  children,
}: {
  date: string;
  label: string;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}` });
  const dayNum = new Date(date).getDate();
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border p-2 min-h-[120px] transition-colors ${
        isOver ? "border-primary bg-primary/10" : isToday ? "border-primary/60" : "border-border"
      }`}
    >
      <div className="text-[10px] font-mono opacity-60 tracking-widest">{label}</div>
      <div className="text-sm font-semibold mb-2">{dayNum}</div>
      <div className="flex-1 flex flex-col gap-1">{children}</div>
    </div>
  );
}

function DraggableSession({
  id,
  label,
  status,
  done,
  onTap,
}: {
  id: string;
  label: string;
  status: string;
  done?: boolean;
  onTap?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as const;
  const color =
    done || status === "done"
      ? "bg-emerald-600 text-white"
      : status === "rest"
        ? "bg-muted text-muted-foreground"
        : status === "planned"
          ? "bg-primary/20 text-primary border border-primary/40"
          : "bg-card border border-border";
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className={`text-left rounded-md px-2 py-1 text-xs touch-none ${color}`}
    >
      {done ? "✓ " : status === "rest" ? "— " : "● "}
      {label}
    </button>
  );
}

/* ── Modal bottom-sheet ── */

type ModalState =
  | { kind: "empty"; date: string; dayIdx: number }
  | { kind: "planned"; date: string; dayIdx: number; planned: any }
  | null;

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40, touchAction: "none" }}
    />
  );
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
      background: "var(--cst-dark-green, #1a2e20)",
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      padding: "8px 0 env(safe-area-inset-bottom,16px)",
      boxShadow: "0 -4px 40px rgba(0,0,0,0.45)",
      maxHeight: "82vh", overflowY: "auto",
    }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", margin: "0 auto 16px" }} />
      {children}
    </div>
  );
}

function ModalTitle({ text }: { text: string }) {
  return (
    <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.55, padding: "0 20px 8px", textTransform: "uppercase", color: "#fff" }}>
      {text}
    </div>
  );
}

function SheetBtn({
  onClick,
  children,
  danger,
  muted,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "14px 20px",
        background: "transparent",
        border: "none",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        color: danger ? "#E07070" : muted ? "rgba(255,255,255,0.45)" : "#fff",
        fontSize: 15,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ── Main component ── */

export default function MemberPlanning() {
  const navigate = useNavigate();
  const listFn = useServerFn(listWeekPlan);
  const upsertFn = useServerFn(upsertPlannedSession);
  const deleteFn = useServerFn(deletePlannedSession);
  const restFn = useServerFn(markDayRest);
  const createFree = useServerFn(createFreeSession);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listFn({ data: weekOffset !== undefined ? { weekNumber: weekOffset } : {} });
      setData(r);
      if (weekOffset === undefined) setWeekOffset(r.weekNumber);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const weekDates = useMemo(() => {
    if (!data?.weekStart) return [];
    const start = new Date(data.weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return isoDay(d);
    });
  }, [data?.weekStart]);

  const todayISO = isoDay(new Date());

  const plannedByDate = useMemo(() => {
    const map = new Map<string, any>();
    (data?.planned ?? []).forEach((p: any) => {
      if (p.planned_date) map.set(p.planned_date, p);
    });
    return map;
  }, [data]);

  const sessionByDate = useMemo(() => {
    const map = new Map<string, any>();
    (data?.sessions ?? []).forEach((s: any) => {
      if (s.date) map.set(s.date, s);
    });
    return map;
  }, [data]);

  const unplanned = useMemo(() => {
    const defs = (data?.dayDefs ?? []).filter((d: any) => d.type !== "Repos") as any[];
    // Déduplication PAR OCCURRENCE (et non par label) : si une séance est définie
    // plusieurs fois avec le même libellé, on n'en masque qu'une par séance déjà
    // planifiée/faite — sinon un jour disparaissait à tort (bug Brice : 2 affichées sur 3).
    const usedCount = new Map<string, number>();
    [
      ...(data?.planned ?? []).map((p: any) => p.day_label),
      // in_progress compte aussi : une séance commencée ne doit pas réapparaître
      // « à planifier » (elle se reprend depuis Commencer / le Dashboard).
      ...(data?.sessions ?? [])
        .filter((s: any) => s.status === "completed" || s.status === "in_progress")
        .map((s: any) => s.session_label)
        .filter(Boolean),
    ].forEach((l: string) => usedCount.set(l, (usedCount.get(l) ?? 0) + 1));
    const result: any[] = [];
    for (const d of defs) {
      const remaining = usedCount.get(d.label) ?? 0;
      if (remaining > 0) {
        usedCount.set(d.label, remaining - 1); // consomme une occurrence déjà planifiée
        continue;
      }
      result.push(d);
    }
    return result;
  }, [data]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("day-")) return;
    const targetDate = overId.slice(4);
    const activeId = String(active.id);

    try {
      if (activeId.startsWith("def-")) {
        const dayLabel = activeId.slice(4);
        await upsertFn({
          data: {
            programId: data.assignment?.program_id ?? null,
            weekNumber: data.weekNumber,
            dayLabel,
            plannedDate: targetDate,
          },
        });
      } else if (activeId.startsWith("plan-")) {
        const id = activeId.slice(5);
        const existing = (data.planned ?? []).find((p: any) => p.id === id);
        if (!existing) return;
        await upsertFn({
          data: {
            id,
            programId: existing.program_id ?? null,
            weekNumber: existing.week_number ?? data.weekNumber,
            dayLabel: existing.day_label,
            plannedDate: targetDate,
          },
        });
      }
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur");
    }
  };

  /* ── Modal actions ── */

  async function scheduleDayDef(def: any, date: string) {
    if (busy) return;
    setBusy(true);
    try {
      await upsertFn({
        data: {
          programId: data.assignment?.program_id ?? null,
          weekNumber: data.weekNumber,
          dayLabel: def.label,
          plannedDate: date,
        },
      });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function scheduleRest(date: string) {
    if (busy) return;
    setBusy(true);
    try {
      await restFn({ data: { weekNumber: data.weekNumber, plannedDate: date } });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function startFreeSession(date: string) {
    if (busy) return;
    setBusy(true);
    try {
      // La session d'abord : si createFree échoue, aucune ligne planning orpheline.
      // (Et createFree réutilise une séance libre in_progress, donc pas de doublon.)
      const r = (await createFree({ data: {} })) as { sessionId: string };
      try {
        await upsertFn({
          data: {
            programId: null,
            weekNumber: data.weekNumber,
            dayLabel: "Séance libre",
            plannedDate: date,
          },
        });
      } catch {
        /* le marquage planning est cosmétique : ne bloque pas la séance */
      }
      setModal(null);
      navigate({ to: "/membre/seance-libre/$sessionId", params: { sessionId: r.sessionId } });
    } catch (e: any) {
      setBusy(false);
      toast.error(e?.message ?? "Erreur");
    }
  }

  async function deletePlanned(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function replaceWithRest(planned: any) {
    if (busy) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: planned.id } });
      await restFn({ data: { weekNumber: data.weekNumber, plannedDate: planned.planned_date } });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function startPlannedNow(planned: any) {
    setModal(null);
    navigate({
      to: "/membre/logger",
      search: { day: planned.day_label, week: planned.week_number ?? data.weekNumber },
    });
  }

  /* ── Day click handler (opens modal) ── */

  function openEmptyDay(date: string) {
    const dayIdx = weekDates.indexOf(date);
    setModal({ kind: "empty", date, dayIdx });
  }

  function openPlannedDay(date: string, planned: any) {
    const dayIdx = weekDates.indexOf(date);
    setModal({ kind: "planned", date, dayIdx, planned });
  }

  /* ── Render ── */

  const frDate = (date: string) => {
    const d = new Date(date);
    const dayIdx = weekDates.indexOf(date);
    return `${FR_DAYS[dayIdx] ?? ""} ${d.getDate()} ${d.toLocaleDateString("fr-FR", { month: "long" })}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto pb-24 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/membre" })}
            className="text-sm opacity-60 hover:opacity-100"
            aria-label="Retour"
          >
            ← Retour
          </button>
          <h1 className="font-mono text-xs tracking-widest">MON PLANNING</h1>
          <div className="w-10" />
        </div>

        {data && (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekOffset((w) => Math.max(1, (w ?? data.weekNumber) - 1))}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              ← Sem. préc.
            </button>
            <div className="text-sm font-semibold">
              Semaine {data.weekNumber}{" "}
              <span className="opacity-60 text-xs">
                ({new Date(data.weekStart).toLocaleDateString("fr-FR")} →{" "}
                {new Date(data.weekEnd).toLocaleDateString("fr-FR")})
              </span>
            </div>
            <button
              onClick={() => setWeekOffset((w) => (w ?? data.weekNumber) + 1)}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              Suivante →
            </button>
          </div>
        )}

        {loading && <div className="opacity-60 text-sm py-8 text-center">Chargement…</div>}

        {data && !loading && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {unplanned.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <div className="text-[10px] font-mono opacity-60 tracking-widest mb-2">
                  À PLANIFIER · Glisse sur un jour ou tape sur un jour vide
                </div>
                <div className="flex flex-wrap gap-2">
                  {unplanned.map((d: any) => (
                    <DraggableSession
                      key={d.label}
                      id={`def-${d.label}`}
                      label={d.label}
                      status="planned"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, i) => {
                const sess = sessionByDate.get(date);
                const planned = plannedByDate.get(date);
                return (
                  <DroppableDay
                    key={date}
                    date={date}
                    label={DAY_LABELS[i]}
                    isToday={date === todayISO}
                  >
                    {sess?.status === "completed" && (
                      <div className="rounded-md px-2 py-1 text-xs bg-emerald-600 text-white">
                        ✓ {sess.session_label ?? "Séance"}
                      </div>
                    )}
                    {!sess && planned && (
                      <DraggableSession
                        id={`plan-${planned.id}`}
                        label={planned.day_label}
                        status={planned.status}
                        onTap={() => openPlannedDay(date, planned)}
                      />
                    )}
                    {!sess && !planned && (
                      <button
                        onClick={() => openEmptyDay(date)}
                        className="rounded-md py-1 text-xs opacity-40 hover:opacity-100 border border-dashed border-border"
                      >
                        +
                      </button>
                    )}
                  </DroppableDay>
                );
              })}
            </div>

            {unplanned.length === 0 &&
              (data.planned ?? []).length === 0 &&
              (data.sessions ?? []).length === 0 && (
                <div className="mt-6 text-center text-sm opacity-60">
                  Aucune séance prévue cette semaine.
                </div>
              )}
          </DndContext>
        )}
      </div>

      {/* ── Modals ── */}
      {modal && <Overlay onClose={() => !busy && setModal(null)} />}

      {modal?.kind === "empty" && (
        <BottomSheet>
          <ModalTitle text={frDate(modal.date)} />

          {unplanned.length > 0 && (
            <>
              <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.16em", padding: "8px 20px 4px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
                Depuis mon programme
              </div>
              {unplanned.map((def: any) => (
                <SheetBtn key={def.label} onClick={() => scheduleDayDef(def, modal.date)} disabled={busy}>
                  ● {def.label}
                </SheetBtn>
              ))}
            </>
          )}

          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.16em", padding: "12px 20px 4px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
            Autre
          </div>
          <SheetBtn onClick={() => startFreeSession(modal.date)} disabled={busy}>
            ✦ Séance libre hors programme
          </SheetBtn>
          <SheetBtn onClick={() => scheduleRest(modal.date)} disabled={busy} muted>
            — Marquer comme repos
          </SheetBtn>
          <SheetBtn onClick={() => setModal(null)} muted>
            Annuler
          </SheetBtn>
        </BottomSheet>
      )}

      {modal?.kind === "planned" && (
        <BottomSheet>
          <ModalTitle text={`${modal.planned.day_label} · ${frDate(modal.date)}`} />

          {/* Démarrable même si planifiée plus tard : le membre a le droit d'avancer
              sa séance (c'était le seul écran sans porte d'entrée pour la lancer). */}
          <SheetBtn onClick={() => startPlannedNow(modal.planned)} disabled={busy}>
            {modal.date <= todayISO ? "▶ Démarrer maintenant" : "▶ Démarrer en avance"}
          </SheetBtn>
          <SheetBtn onClick={() => deletePlanned(modal.planned.id)} disabled={busy} danger>
            Supprimer du planning
          </SheetBtn>
          <SheetBtn onClick={() => replaceWithRest(modal.planned)} disabled={busy} muted>
            — Remplacer par repos
          </SheetBtn>
          <SheetBtn onClick={() => setModal(null)} muted>
            Annuler
          </SheetBtn>
        </BottomSheet>
      )}

      <MemberNav />
    </div>
  );
}
