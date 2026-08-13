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
import { localDateISO } from "@/lib/local-date";
import MemberNav from "../../components/MemberNav";
import {
  listWeekPlan,
  upsertPlannedSession,
  deletePlannedSession,
  markDayRest,
  abandonSession,
} from "@/lib/planning.functions";
import { createFreeSession } from "@/lib/free-session.functions";
import { useI18n } from "@/lib/i18n";

// Libellé du jour déduit de la DATE réelle (et non de la position dans la grille).
// Le programme peut démarrer un autre jour que lundi ; la case doit afficher le vrai
// jour de la semaine — sinon décalage (la séance du jour s'affichait sous « MARDI »
// et le mercredi passait pour « en avance »).
const WD_SHORT = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const WD_LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
function weekdayShortISO(iso: string) {
  return WD_SHORT[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}
function weekdayLongISO(iso: string) {
  return WD_LONG[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function displayDateFR(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" });
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
      className={`flex flex-row sm:flex-col items-stretch gap-3 sm:gap-0 rounded-lg border p-2 sm:min-h-[120px] transition-colors ${
        isOver ? "border-primary bg-primary/10" : isToday ? "border-primary/60" : "border-border"
      }`}
    >
      <div className="flex flex-col items-center sm:items-start shrink-0 w-11 sm:w-auto">
        <div className="text-[10px] font-mono opacity-60 tracking-widest">{label}</div>
        <div className="text-sm font-semibold sm:mb-2">{dayNum}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">{children}</div>
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
      className={`text-left rounded-md px-2 py-1 text-xs touch-none max-w-full break-words ${color}`}
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
  | { kind: "place"; def: any }
  // Déplacer une séance DÉJÀ placée sans passer par le glisser-déposer : sur
  // mobile le drag est inutilisable pour une partie des membres.
  | { kind: "move"; planned: any }
  // Séance commencée puis abandonnée : sans cette entrée, son jour devenait
  // une case morte (ni carte, ni bouton +).
  | { kind: "running"; date: string; sess: any }
  | null;

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 40,
        touchAction: "none",
      }}
    />
  );
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: "var(--cst-dark-green, #1a2e20)",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: "8px 0 env(safe-area-inset-bottom,16px)",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.45)",
        maxHeight: "82vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.18)",
          margin: "0 auto 16px",
        }}
      />
      {children}
    </div>
  );
}

function ModalTitle({ text }: { text: string }) {
  return (
    <div
      className="font-mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.18em",
        opacity: 0.55,
        padding: "0 20px 8px",
        textTransform: "uppercase",
        color: "#fff",
      }}
    >
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
        display: "block",
        width: "100%",
        textAlign: "left",
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

/**
 * Choix du jour au doigt, sans glisser-déposer : c'est la voie de secours (et
 * en pratique la voie principale sur mobile) pour placer ou déplacer une séance.
 */
function DayChoiceList({
  dates,
  todayISO,
  currentDate,
  busy,
  isOccupied,
  isUnavailable,
  onPick,
}: {
  dates: string[];
  todayISO: string;
  currentDate?: string | null;
  busy: boolean;
  isOccupied: (date: string) => boolean;
  isUnavailable?: (date: string) => boolean;
  onPick: (date: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {dates.map((date) => {
        const isCurrent = currentDate === date;
        const unavailable = isUnavailable?.(date) ?? false;
        const occupied = !isCurrent && isOccupied(date);
        const suffix = isCurrent
          ? t(" · actuel")
          : unavailable
            ? t(" · indisponible")
          : occupied
            ? t(" · occupé")
            : date === todayISO
              ? t(" · aujourd'hui")
              : "";
        return (
          <SheetBtn
            key={date}
            onClick={() => onPick(date)}
            disabled={busy || isCurrent || unavailable}
            muted={occupied || isCurrent || unavailable}
          >
            {t(weekdayLongISO(date))} {new Date(`${date}T00:00:00Z`).getUTCDate()}
            {suffix}
          </SheetBtn>
        );
      })}
    </>
  );
}

/* ── Main component ── */

export default function MemberPlanning() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const listFn = useServerFn(listWeekPlan);
  const upsertFn = useServerFn(upsertPlannedSession);
  const deleteFn = useServerFn(deletePlannedSession);
  const restFn = useServerFn(markDayRest);
  const createFree = useServerFn(createFreeSession);
  const abandonFn = useServerFn(abandonSession);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 10 } }),
  );

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listFn({ data: weekOffset !== undefined ? { weekNumber: weekOffset } : {} });
      setData(r);
      if (weekOffset === undefined) setWeekOffset(r.weekNumber);
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
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

  const todayISO = localDateISO();
  const assignmentStartISO = data?.assignment?.start_date?.slice(0, 10) ?? null;

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

  // Une séance planifiée n'est visible que si sa date tombe dans la fenêtre
  // affichée. Une ligne sans date, ou datée hors de cette fenêtre, n'apparaissait
  // nulle part TOUT EN consommant sa pastille « À planifier » : la séance
  // devenait introuvable, sans aucun moyen de la replacer.
  const weekDateSet = useMemo(() => new Set(weekDates), [weekDates]);
  const strandedPlanned = useMemo(
    () =>
      (data?.planned ?? []).filter(
        (p: any) => !p.planned_date || !weekDateSet.has(p.planned_date),
      ),
    [data, weekDateSet],
  );

  const unplanned = useMemo(() => {
    const defs = (data?.dayDefs ?? []).filter((d: any) => d.type !== "Repos") as any[];
    // Déduplication PAR OCCURRENCE (et non par label) : si une séance est définie
    // plusieurs fois avec le même libellé, on n'en masque qu'une par séance déjà
    // planifiée/faite — sinon un jour disparaissait à tort (bug Brice : 2 affichées sur 3).
    const usedCount = new Map<string, number>();
    [
      // Seules les séances réellement posées sur un jour de la semaine
      // consomment leur pastille.
      ...(data?.planned ?? [])
        .filter((p: any) => p.planned_date && weekDateSet.has(p.planned_date))
        .map((p: any) => p.day_label),
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
  }, [data, weekDateSet]);

  const programChoices = useMemo(() => {
    const defs = (data?.dayDefs ?? []).filter((d: any) => d.type !== "Repos" && d.label) as any[];
    const seen = new Set<string>();
    return defs.filter((d: any) => {
      const key = String(d.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);

  // Un jour est « occupé » s'il porte déjà une carte : séance faite/en cours ou
  // séance planifiée. On le signale sans l'interdire — le membre reste maître
  // de son planning (deux séances le même jour, ça arrive).
  const isDayOccupied = (date: string) => {
    const sess = sessionByDate.get(date);
    const taken = sess?.status === "completed" || sess?.status === "in_progress";
    return taken || plannedByDate.has(date);
  };

  const isBeforeAssignmentStart = (date: string) =>
    assignmentStartISO != null && data?.weekNumber === 1 && date < assignmentStartISO;

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
      toast.error(err?.message ?? t("Erreur"));
    }
  };

  /* ── Modal actions ── */

  async function scheduleDayDef(def: any, date: string) {
    if (busy) return;
    setBusy(true);
    try {
      // Si une ligne orpheline traînait pour cette séance, on la répare en la
      // datant plutôt que d'en créer une seconde à côté.
      const stranded = strandedPlanned.find((p: any) => p.day_label === def.label);
      await upsertFn({
        data: {
          id: stranded?.id,
          programId: data.assignment?.program_id ?? null,
          weekNumber: data.weekNumber,
          dayLabel: def.label,
          plannedDate: date,
        },
      });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
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
      toast.error(e?.message ?? t("Erreur"));
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
      toast.error(e?.message ?? t("Erreur"));
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
      toast.error(e?.message ?? t("Erreur"));
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
      toast.error(e?.message ?? t("Erreur"));
    } finally {
      setBusy(false);
    }
  }

  async function movePlanned(planned: any, date: string) {
    if (busy) return;
    setBusy(true);
    try {
      await upsertFn({
        data: {
          id: planned.id,
          programId: planned.program_id ?? null,
          weekNumber: planned.week_number ?? data.weekNumber,
          dayLabel: planned.day_label,
          plannedDate: date,
        },
      });
      setModal(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
    } finally {
      setBusy(false);
    }
  }

  async function abandonRunning(sess: any) {
    if (busy) return;
    setBusy(true);
    try {
      await abandonFn({ data: { id: sess.id } });
      setModal(null);
      await reload();
      toast.success(t("Séance annulée — tu peux la replanifier"));
    } catch (e: any) {
      toast.error(e?.message ?? t("Erreur"));
    } finally {
      setBusy(false);
    }
  }

  function resumeRunning(sess: any) {
    setModal(null);
    navigate({ to: "/membre/seance/$sessionId", params: { sessionId: sess.id } });
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
    const d = new Date(`${date}T00:00:00Z`);
    const month = d.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      month: "long",
      timeZone: "UTC",
    });
    return `${t(weekdayLongISO(date))} ${d.getUTCDate()} ${month}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto pb-24 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/membre" })}
            className="text-sm opacity-60 hover:opacity-100"
            aria-label={t("Retour")}
          >
            {t("← Retour")}
          </button>
          <h1 className="font-mono text-xs tracking-widest">{t("MON PLANNING")}</h1>
          <div className="w-10" />
        </div>

        {data && (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekOffset((w) => Math.max(1, (w ?? data.weekNumber) - 1))}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              {t("← Sem. préc.")}
            </button>
            <div className="text-sm font-semibold">
              {t("Semaine")} {data.weekNumber}{" "}
              <span className="opacity-60 text-xs">
                ({displayDateFR(data.weekStart)} → {displayDateFR(data.weekEnd)})
              </span>
            </div>
            <div className="text-[10px] font-mono opacity-45 tracking-widest uppercase">
              {t("Semaine perso :")} {data.weekWindowLabel}
            </div>
            <button
              onClick={() => setWeekOffset((w) => (w ?? data.weekNumber) + 1)}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              {t("Suivante →")}
            </button>
          </div>
        )}

        {loading && <div className="opacity-60 text-sm py-8 text-center">{t("Chargement…")}</div>}

        {data && !loading && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {unplanned.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <div className="text-[10px] font-mono opacity-60 tracking-widest mb-2">
                  {t("À PLANIFIER · Tape une séance pour la placer (ou glisse-la sur un jour)")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {unplanned.map((d: any) => (
                    <DraggableSession
                      key={d.label}
                      id={`def-${d.label}`}
                      label={d.label}
                      status="planned"
                      onTap={() => setModal({ kind: "place", def: d })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-7">
              {weekDates.map((date) => {
                const sess = sessionByDate.get(date);
                const planned = plannedByDate.get(date);
                // Seules une séance faite ou en cours occupent réellement le jour.
                // Tout autre statut (abandonnée, valeur inattendue) ne doit PAS
                // bloquer la case : sinon elle n'affiche ni carte ni bouton +,
                // et la séance devient irrécupérable depuis le planning.
                const isDone = sess?.status === "completed";
                const isRunning = sess?.status === "in_progress";
                const dayTaken = isDone || isRunning;
                // Une séance faite ce jour-là ne solde la carte planifiée que si
                // c'est LA MÊME séance. Sinon (le membre en a fait une autre à la
                // place), la carte restait masquée derrière le ✓ tout en
                // consommant sa pastille « À planifier » : elle n'existait plus
                // nulle part et ne pouvait plus être replacée.
                const plannedAlreadyDone =
                  !!planned && !!sess && planned.day_label === sess.session_label;
                const showPlanned = !!planned && !plannedAlreadyDone;
                return (
                  <DroppableDay
                    key={date}
                    date={date}
                    label={t(weekdayShortISO(date))}
                    isToday={date === todayISO}
                  >
                    {isDone && (
                      <div className="rounded-md px-2 py-1 text-xs bg-emerald-600 text-white break-words">
                        ✓ {sess.session_label ?? t("Séance")}
                      </div>
                    )}
                    {isRunning && (
                      <button
                        onClick={() => setModal({ kind: "running", date, sess })}
                        className="text-left rounded-md px-2 py-1 text-xs break-words bg-amber-500/20 text-amber-500 border border-amber-500/50"
                      >
                        ▶ {sess.session_label ?? t("Séance")}
                        {t(" · en cours")}
                      </button>
                    )}
                    {showPlanned && (
                      <DraggableSession
                        id={`plan-${planned.id}`}
                        label={planned.day_label}
                        status={planned.status}
                        onTap={() => openPlannedDay(date, planned)}
                      />
                    )}
                    {!dayTaken && !planned && !isBeforeAssignmentStart(date) && (
                      <button
                        onClick={() => openEmptyDay(date)}
                        className="w-full sm:w-auto rounded-md px-2 py-1 text-xs opacity-40 hover:opacity-100 border border-dashed border-border"
                      >
                        +
                      </button>
                    )}
                    {!dayTaken && !planned && isBeforeAssignmentStart(date) && (
                      <div className="rounded-md px-2 py-1 text-xs opacity-35 border border-dashed border-border">
                        {t("Indispo")}
                      </div>
                    )}
                  </DroppableDay>
                );
              })}
            </div>

            {unplanned.length === 0 &&
              (data.planned ?? []).length === 0 &&
              (data.sessions ?? []).length === 0 && (
                <div className="mt-6 text-center text-sm opacity-60">
                  {t("Aucune séance prévue cette semaine.")}
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
              <div
                className="font-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  padding: "8px 20px 4px",
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                }}
              >
                {t("Depuis mon programme")}
              </div>
              {unplanned.map((def: any) => (
                <SheetBtn
                  key={def.label}
                  onClick={() => scheduleDayDef(def, modal.date)}
                  disabled={busy}
                >
                  ● {def.label}
                </SheetBtn>
              ))}
            </>
          )}

          {programChoices.length > 0 && (
            <>
              <div
                className="font-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  padding: `${unplanned.length > 0 ? "12px" : "8px"} 20px 4px`,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                }}
              >
                {t("Toutes mes séances programme")}
              </div>
              {programChoices.map((def: any) => (
                <SheetBtn
                  key={`all-${def.label}`}
                  onClick={() => scheduleDayDef(def, modal.date)}
                  disabled={busy}
                >
                  ● {def.label}
                </SheetBtn>
              ))}
            </>
          )}

          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "12px 20px 4px",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}
          >
            {t("Autre")}
          </div>
          <SheetBtn onClick={() => startFreeSession(modal.date)} disabled={busy}>
            {t("✦ Séance libre hors programme")}
          </SheetBtn>
          <SheetBtn onClick={() => scheduleRest(modal.date)} disabled={busy} muted>
            {t("— Marquer comme repos")}
          </SheetBtn>
          <SheetBtn onClick={() => setModal(null)} muted>
            {t("Annuler")}
          </SheetBtn>
        </BottomSheet>
      )}

      {modal?.kind === "place" && (
        <BottomSheet>
          <ModalTitle text={`${t("Placer :")} ${modal.def.label}`} />
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "8px 20px 4px",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}
          >
            {t("Choisis un jour")}
          </div>
          <DayChoiceList
            dates={weekDates}
            todayISO={todayISO}
            busy={busy}
            isOccupied={isDayOccupied}
            isUnavailable={isBeforeAssignmentStart}
            onPick={(date) => scheduleDayDef(modal.def, date)}
          />
          <SheetBtn onClick={() => setModal(null)} muted>
            {t("Annuler")}
          </SheetBtn>
        </BottomSheet>
      )}

      {modal?.kind === "move" && (
        <BottomSheet>
          <ModalTitle text={`${t("Déplacer :")} ${modal.planned.day_label}`} />
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "8px 20px 4px",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}
          >
            {t("Choisis un nouveau jour")}
          </div>
          <DayChoiceList
            dates={weekDates}
            todayISO={todayISO}
            currentDate={modal.planned.planned_date}
            busy={busy}
            isOccupied={isDayOccupied}
            isUnavailable={isBeforeAssignmentStart}
            onPick={(date) => movePlanned(modal.planned, date)}
          />
          <SheetBtn onClick={() => setModal(null)} muted>
            {t("Annuler")}
          </SheetBtn>
        </BottomSheet>
      )}

      {modal?.kind === "running" && (
        <BottomSheet>
          <ModalTitle
            text={`${modal.sess.session_label ?? t("Séance")} · ${frDate(modal.date)}`}
          />
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "8px 20px 4px",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
            }}
          >
            {t("Séance commencée, pas terminée")}
          </div>
          <SheetBtn onClick={() => resumeRunning(modal.sess)} disabled={busy}>
            {t("▶ Reprendre là où j'en étais")}
          </SheetBtn>
          <SheetBtn onClick={() => abandonRunning(modal.sess)} disabled={busy} danger>
            {t("↩︎ Annuler cette séance et la replanifier")}
          </SheetBtn>
          <SheetBtn onClick={() => setModal(null)} muted>
            {t("Fermer")}
          </SheetBtn>
        </BottomSheet>
      )}

      {modal?.kind === "planned" && (
        <BottomSheet>
          <ModalTitle text={`${modal.planned.day_label} · ${frDate(modal.date)}`} />

          {/* Démarrable même si planifiée plus tard : le membre a le droit d'avancer
              sa séance (c'était le seul écran sans porte d'entrée pour la lancer). */}
          <SheetBtn onClick={() => startPlannedNow(modal.planned)} disabled={busy}>
            {modal.date <= todayISO ? t("▶ Démarrer maintenant") : t("▶ Démarrer en avance")}
          </SheetBtn>
          <SheetBtn
            onClick={() => setModal({ kind: "move", planned: modal.planned })}
            disabled={busy}
          >
            {t("📅 Déplacer à un autre jour")}
          </SheetBtn>
          <SheetBtn onClick={() => deletePlanned(modal.planned.id)} disabled={busy} danger>
            {t("Supprimer du planning")}
          </SheetBtn>
          <SheetBtn onClick={() => replaceWithRest(modal.planned)} disabled={busy} muted>
            {t("— Remplacer par repos")}
          </SheetBtn>
          <SheetBtn onClick={() => setModal(null)} muted>
            {t("Annuler")}
          </SheetBtn>
        </BottomSheet>
      )}

      <MemberNav />
    </div>
  );
}
