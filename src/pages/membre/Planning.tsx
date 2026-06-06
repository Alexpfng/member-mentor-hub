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

const DAY_LABELS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

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

export default function MemberPlanning() {
  const navigate = useNavigate();
  const listFn = useServerFn(listWeekPlan);
  const upsertFn = useServerFn(upsertPlannedSession);
  const deleteFn = useServerFn(deletePlannedSession);
  const restFn = useServerFn(markDayRest);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState<number | undefined>(undefined);

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

  // Map plannedDate → planned row
  const plannedByDate = useMemo(() => {
    const map = new Map<string, any>();
    (data?.planned ?? []).forEach((p: any) => {
      if (p.planned_date) map.set(p.planned_date, p);
    });
    return map;
  }, [data]);

  // Sessions completed/in-progress by date
  const sessionByDate = useMemo(() => {
    const map = new Map<string, any>();
    (data?.sessions ?? []).forEach((s: any) => {
      if (s.date) map.set(s.date, s);
    });
    return map;
  }, [data]);

  // Unplanned day defs from program (not already planned and not done)
  const unplanned = useMemo(() => {
    const defs = (data?.dayDefs ?? []) as any[];
    const usedLabels = new Set(
      (data?.planned ?? []).map((p: any) => p.day_label).concat(
        (data?.sessions ?? []).map((s: any) => s.session_label).filter(Boolean),
      ),
    );
    return defs.filter((d) => d.type !== "Repos" && !usedLabels.has(d.label));
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

  const handlePlanClick = async (date: string) => {
    if (unplanned.length === 0) {
      // fallback: propose rest
      if (confirm("Marquer ce jour comme repos ?")) {
        await restFn({ data: { weekNumber: data.weekNumber, plannedDate: date } });
        reload();
      }
      return;
    }
    const choices = unplanned.map((d: any, i: number) => `${i + 1}. ${d.label}`).join("\n");
    const choice = prompt(`Planifier une séance le ${date}\n\n${choices}\n\nNuméro :`);
    if (!choice) return;
    const idx = Number(choice) - 1;
    const def = unplanned[idx];
    if (!def) return;
    await upsertFn({
      data: {
        programId: data.assignment?.program_id ?? null,
        weekNumber: data.weekNumber,
        dayLabel: def.label,
        plannedDate: date,
      },
    });
    reload();
  };

  const handlePlannedTap = async (p: any) => {
    const action = prompt(
      `${p.day_label}\n\n1. Supprimer du planning\n2. Marquer comme repos\n3. Annuler\n\nNuméro :`,
    );
    if (action === "1") {
      await deleteFn({ data: { id: p.id } });
      reload();
    } else if (action === "2") {
      await deleteFn({ data: { id: p.id } });
      await restFn({ data: { weekNumber: data.weekNumber, plannedDate: p.planned_date } });
      reload();
    }
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
              onClick={() => setWeekOffset((w) => Math.max(0, (w ?? data.weekNumber) - 1))}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              ← Sem. préc.
            </button>
            <div className="text-sm font-semibold">
              Semaine {data.weekNumber + 1}{" "}
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
            {/* Unplanned bag */}
            {unplanned.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <div className="text-[10px] font-mono opacity-60 tracking-widest mb-2">
                  À PLANIFIER · Glisse sur un jour
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
                        onTap={() => handlePlannedTap(planned)}
                      />
                    )}
                    {!sess && !planned && (
                      <button
                        onClick={() => handlePlanClick(date)}
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
      <MemberNav />
    </div>
  );
}
