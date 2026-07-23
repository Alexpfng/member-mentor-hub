import { useState, useEffect, useMemo, useRef } from "react";
import AssignmentTimingFields from "@/components/coach/AssignmentTimingFields";
import { deriveAssignmentStartDate } from "@/lib/assignment-start";
import { localDateISO } from "@/lib/local-date";

function normalize(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function todayISO() {
  return localDateISO();
}

function ProgramPicker({
  programs,
  excludeId,
  placeholder = "Rechercher un programme…",
  disabled,
  onPick,
  size = "md",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const base = (programs || []).filter((p) => p.id !== excludeId);
    const list = q
      ? base.filter((p) => normalize(p.name).includes(q) || normalize(p.objective).includes(q))
      : base;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [programs, excludeId, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p) {
    if (!p) return;
    setQuery("");
    setOpen(false);
    onPick?.(p.id);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const compact = size === "sm";

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        className="cst-input"
        disabled={disabled || (programs || []).length === 0}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        style={{
          width: "100%",
          fontSize: compact ? 11 : 13,
          padding: compact ? "6px 10px" : "10px 12px",
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--cst-card-bg)",
            border: "1px solid var(--cst-card-border)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            maxHeight: 280,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div className="cst-mono" style={{ padding: "12px 10px", fontSize: 11, opacity: 0.6 }}>
              Aucun programme trouvé.
            </div>
          ) : (
            filtered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: i === active ? "rgba(45,90,53,0.12)" : "transparent",
                  borderLeft:
                    i === active ? "2px solid var(--cst-mid-green)" : "2px solid transparent",
                  color: "var(--cst-text)",
                  border: "none",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
                  {p.duration_weeks
                    ? `${p.duration_weeks} SEM.`
                    : (p.objective || "").toUpperCase()}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AssignProgramModal({ program, busy, defaultWeek, onClose, onConfirm }) {
  const [startDate, setStartDate] = useState(todayISO());
  const [startWeek, setStartWeek] = useState(() =>
    Math.max(1, Math.min(defaultWeek || 1, program.duration_weeks || 1)),
  );
  const effectiveStartDate = deriveAssignmentStartDate(startDate, startWeek);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cst-screen cst-hatch"
        style={{
          width: 440,
          padding: 24,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="cst-display" style={{ fontSize: 22 }}>
          ASSIGNER
        </div>
        <div className="cst-italic" style={{ fontSize: 13, color: "var(--cst-mid-green)" }}>
          {program.name}
        </div>
        <AssignmentTimingFields
          durationWeeks={program.duration_weeks}
          startDate={startDate}
          onStartDateChange={setStartDate}
          startWeek={startWeek}
          onStartWeekChange={setStartWeek}
          effectiveStartDate={effectiveStartDate}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ flex: 1 }}
          >
            ANNULER
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(program.id, effectiveStartDate)}
            className="cst-btn cst-btn-primary cst-btn-sm"
            style={{ flex: 1 }}
          >
            {busy ? "ASSIGNATION…" : "ASSIGNER →"}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import CoachSidebar from "../../components/CoachSidebar";
import { CSTSectionNum, CSTAvatar, CSTStatus } from "../../components/Atoms";
import {
  getMemberDetail,
  updateMemberNotes,
  updateMemberProfile,
  assignProgram,
  removeMemberProgram,
  listPrograms,
  setAssignmentSessionMode,
  getUpcomingPlannedSessions,
  togglePlannedSessionRest,
} from "@/lib/coach.functions";
import { VideoReviewPanel } from "../../components/coach/VideoReviewPanel";
import MemberFollowupTab from "../../components/coach/MemberFollowupTab";
import WeeksManagerPanel from "../../components/coach/WeeksManagerPanel";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeDurationMin } from "@/lib/format";

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function formatDateFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d
    .toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function shortDateFR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function statusKind(s) {
  if (s === "completed" || s === "done") return "done";
  if (s === "in_progress") return "active";
  if (s === "skipped" || s === "rest") return "rest";
  return "coming";
}

// Slugs des onglets, alignés sur `tabs` plus bas — utilisés pour le deep link ?tab=…
const TAB_SLUGS = [
  "programme",
  "suivi",
  "historique",
  "videos",
  "progression",
  "profil",
  "messages",
];

export default function CoachMember() {
  const { memberId } = useParams({ from: "/_authenticated/coach/membre/$memberId" });
  const search = useSearch({ from: "/_authenticated/coach/membre/$memberId" });
  const navigate = useNavigate();
  const getDetailFn = useServerFn(getMemberDetail);
  const saveNotesFn = useServerFn(updateMemberNotes);
  const saveProfileFn = useServerFn(updateMemberProfile);
  const listProgramsFn = useServerFn(listPrograms);
  const assignFn = useServerFn(assignProgram);
  const removeFn = useServerFn(removeMemberProgram);
  const setModeFn = useServerFn(setAssignmentSessionMode);
  const getUpcomingFn = useServerFn(getUpcomingPlannedSessions);
  const toggleRestFn = useServerFn(togglePlannedSessionRest);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(() => Math.max(0, TAB_SLUGS.indexOf(search?.tab)));

  // Deep link : si ?tab= change (ex. clic « Ouvrir » sur une autre vidéo à revoir),
  // on bascule sur l'onglet demandé.
  useEffect(() => {
    const i = TAB_SLUGS.indexOf(search?.tab);
    if (i >= 0) setActiveTab(i);
  }, [search?.tab, search?.video]);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignProgramChoice, setAssignProgramChoice] = useState(null);
  const [form, setForm] = useState(null);
  const [savingForm, setSavingForm] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [logWeight, setLogWeight] = useState(false);
  const [sessionModeBusy, setSessionModeBusy] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [skipBusy, setSkipBusy] = useState(null);

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const d = await getDetailFn({ data: { member_id: memberId } });
      setData(d);
      setNotes(d.member_profile?.coach_private_notes || "");
      setForm({
        first_name: d.profile?.first_name || "",
        last_name: d.profile?.last_name || "",
        weight_kg: d.member_profile?.weight_kg ?? "",
        height_cm: d.member_profile?.height_cm ?? "",
        level: d.member_profile?.level || "",
        goal: d.member_profile?.goal || "",
        injuries: d.member_profile?.injuries || "",
      });
      setLogWeight(false);
    } catch (ex) {
      setErr(ex?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    listProgramsFn()
      .then((p) => setPrograms(p.programs || []))
      .catch(() => {});
    getUpcomingFn({ data: { member_id: memberId } })
      .then((rows) => setUpcomingSessions(rows))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function handleToggleRest(plannedSessionId) {
    setSkipBusy(plannedSessionId);
    try {
      const res = await toggleRestFn({ data: { planned_session_id: plannedSessionId } });
      setUpcomingSessions((prev) =>
        prev.map((s) => (s.id === plannedSessionId ? { ...s, status: res.status } : s)),
      );
    } catch {
      // ignore
    } finally {
      setSkipBusy(null);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await saveNotesFn({ data: { member_id: memberId, coach_private_notes: notes } });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (ex) {
      alert(ex?.message || "Erreur");
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveForm(e) {
    e?.preventDefault?.();
    if (!form) return;
    setSavingForm(true);
    setFormSaved(false);
    try {
      const payload = {
        member_id: memberId,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg),
        height_cm: form.height_cm === "" ? null : parseInt(form.height_cm, 10),
        level: form.level?.trim() || null,
        goal: form.goal?.trim() || null,
        injuries: form.injuries?.trim() || null,
        log_weight: logWeight && form.weight_kg !== "" ? true : false,
      };
      await saveProfileFn({ data: payload });
      setFormSaved(true);
      setTimeout(() => setFormSaved(false), 2500);
      await reload();
    } catch (ex) {
      alert(ex?.message || "Erreur");
    } finally {
      setSavingForm(false);
    }
  }

  async function confirmAssign(programId, startDate) {
    if (!programId) return;
    setAssignBusy(true);
    try {
      await assignFn({
        data: { member_id: memberId, program_id: programId, start_date: startDate },
      });
      setAssignProgramChoice(null);
      await reload();
    } catch (ex) {
      alert(ex?.message || "Erreur");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleRemoveProgram() {
    if (!data?.program) return;
    const who = data.profile?.first_name || fullName;
    if (
      !window.confirm(
        `Retirer « ${data.program.name} » de ${who} ?\n\nLe planning à venir sera effacé (l'historique des séances déjà faites est conservé). Tu pourras assigner un nouveau programme ensuite.`,
      )
    )
      return;
    setAssignBusy(true);
    try {
      await removeFn({ data: { member_id: memberId } });
      await reload();
    } catch (ex) {
      alert(ex?.message || "Erreur");
    } finally {
      setAssignBusy(false);
    }
  }

  const tabs = [
    "Programme actuel",
    "Suivi",
    "Historique",
    "Vidéos",
    "Progression",
    "Profil",
    "Messages",
  ];
  const [coachUid, setCoachUid] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCoachUid(data.user?.id ?? null));
  }, []);

  // Computed derived values
  const fullName = useMemo(() => {
    if (!data?.profile) return "";
    return (
      [data.profile.first_name, data.profile.last_name].filter(Boolean).join(" ") ||
      data.profile.email
    );
  }, [data]);

  const initials = useMemo(() => {
    if (!data?.profile) return "?";
    const f = data.profile.first_name?.[0] || data.profile.email?.[0] || "?";
    const l = data.profile.last_name?.[0] || "";
    return (f + l).toUpperCase();
  }, [data]);

  const seniority = useMemo(() => {
    if (!data?.profile?.created_at) return 0;
    return daysBetween(new Date(data.profile.created_at), new Date());
  }, [data]);

  const currentWeek = useMemo(() => {
    // Use the actual highest week_number from assignment_weeks (authoritative)
    // Falls back to date-based calculation only if no weeks exist yet
    if (data?.current_week_number != null) return data.current_week_number;
    if (!data?.assignment?.start_date || !data?.program?.duration_weeks) return null;
    const elapsed = daysBetween(new Date(data.assignment.start_date), new Date());
    if (elapsed < 0) return 1;
    return Math.min(Math.floor(elapsed / 7) + 1, data.program.duration_weeks);
  }, [data]);

  const weekDays = useMemo(() => {
    if (!data?.program?.structure || !currentWeek) return [];
    const weeks = data.program.structure.weeks || [];
    const w = weeks[currentWeek - 1];
    if (!w) return [];
    return w.days || [];
  }, [data, currentWeek]);

  const sessionByDay = useMemo(() => {
    const map = new Map();
    (data?.sessions || []).forEach((s) => {
      if (s.week_number && s.day_number) {
        map.set(`${s.week_number}-${s.day_number}`, s);
      }
    });
    return map;
  }, [data]);

  const trends = useMemo(() => {
    if (!data?.set_logs?.length) return [];
    const byEx = new Map();
    data.set_logs.forEach((sl) => {
      if (!sl.exercise_name || sl.weight_kg == null) return;
      if (!byEx.has(sl.exercise_name)) byEx.set(sl.exercise_name, []);
      byEx.get(sl.exercise_name).push(sl);
    });
    const items = [];
    for (const [name, logs] of byEx.entries()) {
      const sorted = [...logs].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
      const first = Number(sorted[0].weight_kg);
      const lastMax = Math.max(...sorted.map((l) => Number(l.weight_kg) || 0));
      const delta = lastMax - first;
      items.push({ name, count: logs.length, first, lastMax, delta });
    }
    items.sort((a, b) => b.count - a.count);
    return items.slice(0, 4);
  }, [data]);

  function handleAssign(programId) {
    if (!programId) return;
    const pickedProgram = programs.find((program) => program.id === programId);
    if (!pickedProgram) return;
    const maxWeeks = Math.max(1, pickedProgram.duration_weeks || 1);
    const suggestedWeek = Math.max(1, Math.min(currentWeek || 1, maxWeeks));
    setAssignProgramChoice({
      id: pickedProgram.id,
      name: pickedProgram.name,
      duration_weeks: pickedProgram.duration_weeks || 1,
      defaultWeek: suggestedWeek,
    });
  }

  if (loading) {
    return (
      <div className="cst-screen" style={{ flexDirection: "row" }}>
        <CoachSidebar />
        <div className="cst-col" style={{ flex: 1, padding: 48 }}>
          <span className="cst-mono" style={{ opacity: 0.6 }}>
            CHARGEMENT…
          </span>
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="cst-screen" style={{ flexDirection: "row" }}>
        <CoachSidebar />
        <div className="cst-col" style={{ flex: 1, padding: 48, gap: 16 }}>
          <span className="cst-display" style={{ fontSize: 24 }}>
            ADHÉRENT INTROUVABLE
          </span>
          <span style={{ opacity: 0.7 }}>{err || "Aucune donnée"}</span>
          <button
            className="cst-btn cst-btn-ghost-dark cst-btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => navigate({ to: "/coach" })}
          >
            ← RETOUR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      {assignProgramChoice && (
        <AssignProgramModal
          program={assignProgramChoice}
          busy={assignBusy}
          defaultWeek={assignProgramChoice.defaultWeek}
          onClose={() => setAssignProgramChoice(null)}
          onConfirm={confirmAssign}
        />
      )}
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Breadcrumb */}
        <div style={{ padding: "20px 32px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="cst-mono"
            style={{ color: "#fff", cursor: "pointer" }}
            onClick={() => navigate({ to: "/coach" })}
          >
            MEMBRES
          </span>
          <span className="cst-mono">/</span>
          <span className="cst-mono" style={{ color: "var(--cst-mid-green)" }}>
            {fullName.toUpperCase()}
          </span>
        </div>

        {/* Hero */}
        <div
          className="cst-hatch"
          style={{
            padding: "28px 32px 32px",
            background: "linear-gradient(180deg,#1F2D24 0%,#1B2E1F 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 8,
                background: "linear-gradient(135deg,#3A6B42,#1B2E1F)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--cst-display)",
                fontSize: 42,
                fontWeight: 800,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {initials}
            </div>
            <div className="cst-col" style={{ gap: 6, flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="cst-tag cst-tag-success">MEMBRE · ACTIF</span>
                <span className="cst-mono">INSCRIT LE {formatDateFR(data.profile.created_at)}</span>
              </div>
              <h1 className="cst-display" style={{ fontSize: 48, margin: 0 }}>
                {fullName.toUpperCase()}.
              </h1>
              <div
                className="cst-italic"
                style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginTop: -4 }}
              >
                {data.profile.email}
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}
            >
              <button
                className="cst-btn cst-btn-primary cst-btn-sm"
                onClick={() => navigate({ to: "/coach/messages", search: { partner: memberId } })}
              >
                MESSAGE →
              </button>
              {data.program && currentWeek && (
                <button
                  onClick={() =>
                    navigate({
                      to: "/coach/membre/$memberId/adapter",
                      params: { memberId },
                      search: { week: currentWeek },
                    })
                  }
                  className="cst-btn cst-btn-primary cst-btn-sm"
                  style={{
                    background: "rgba(212,168,46,0.18)",
                    border: "1px solid rgba(212,168,46,0.5)",
                    color: "#D4A82E",
                  }}
                >
                  ✏ ADAPTER S{String(currentWeek).padStart(2, "0")} →
                </button>
              )}
              {data.program && (
                <button
                  onClick={() =>
                    navigate({
                      to: "/coach/membre/$memberId/adapter",
                      params: { memberId },
                      search: {},
                    })
                  }
                  className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                >
                  + SEMAINE SUIVANTE
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
              gap: 0,
              marginTop: 26,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 18,
            }}
          >
            {[
              ["OBJECTIF", data.member_profile?.goal?.toUpperCase() || "—"],
              ["POIDS", data.last_weight_kg != null ? `${data.last_weight_kg} KG` : "—"],
              ["NIVEAU", data.member_profile?.level?.toUpperCase() || "—"],
              ["ANCIENNETÉ", `${seniority} J`],
              ["SÉANCES", String(data.sessions.length).padStart(2, "0")],
            ].map(([k, v], i) => (
              <div
                key={k}
                className="cst-col"
                style={{
                  gap: 4,
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  paddingLeft: i > 0 ? 20 : 0,
                }}
              >
                <span className="cst-mono" style={{ fontSize: 9 }}>
                  {k}
                </span>
                <span className="cst-display" style={{ fontSize: 22 }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            padding: "0 32px",
            display: "flex",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            overflowX: "auto",
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--cst-bg)",
          }}
        >
          {tabs.map((t, i) => (
            <div
              key={t}
              onClick={() => setActiveTab(i)}
              style={{
                padding: "16px 20px",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: activeTab === i ? 700 : 500,
                color: activeTab === i ? "#fff" : "rgba(255,255,255,0.5)",
                borderBottom:
                  activeTab === i ? "2px solid var(--cst-mid-green)" : "2px solid transparent",
                fontFamily: "var(--cst-ui)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                className="cst-mono"
                style={{
                  fontSize: 9,
                  color: "var(--cst-mid-green)",
                  opacity: activeTab === i ? 1 : 0.4,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {t}
              {t === "Messages" && data.unread_messages_count > 0 && (
                <span
                  style={{
                    background: "var(--cst-mid-green)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 9,
                    fontFamily: "var(--cst-mono)",
                  }}
                >
                  {data.unread_messages_count}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div
          style={{
            padding: "24px 32px",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 24,
          }}
        >
          <div>
            {activeTab === 1 && <MemberFollowupTab memberId={memberId} />}
            {activeTab === 0 && (
              <>
                {!data.program ? (
                  <div
                    className="cst-card-dark cst-hatch"
                    style={{ padding: 28, textAlign: "center", overflow: "visible" }}
                  >
                    <div className="cst-display" style={{ fontSize: 22, marginBottom: 8 }}>
                      AUCUN PROGRAMME ASSIGNÉ
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
                      Choisis un programme à assigner à {data.profile.first_name || fullName}.
                    </p>
                    <div style={{ maxWidth: 360, margin: "0 auto" }}>
                      <ProgramPicker
                        programs={programs}
                        placeholder="Rechercher un programme…"
                        disabled={assignBusy}
                        onPick={handleAssign}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 12,
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <CSTSectionNum
                          num={1}
                          label="PROGRAMME ACTUEL"
                          sub={(data.program.objective || data.program.name).toUpperCase()}
                        />
                        <h2 className="cst-display" style={{ fontSize: 32, margin: "8px 0 4px" }}>
                          {data.program.duration_weeks
                            ? `SEMAINE ${String(currentWeek || 1).padStart(2, "0")} / ${String(data.program.duration_weeks).padStart(2, "0")}`
                            : data.program.name.toUpperCase()}
                        </h2>
                        <span className="cst-mono">{data.program.name.toUpperCase()}</span>
                      </div>
                      <div style={{ width: 260 }}>
                        <ProgramPicker
                          programs={programs}
                          excludeId={data.program.id}
                          placeholder="CHANGER DE PROGRAMME…"
                          disabled={assignBusy}
                          onPick={handleAssign}
                          size="sm"
                        />
                        <button
                          onClick={handleRemoveProgram}
                          disabled={assignBusy}
                          className="cst-btn cst-btn-sm"
                          style={{
                            marginTop: 8,
                            width: "100%",
                            background: "transparent",
                            border: "1px solid rgba(196,74,58,0.4)",
                            color: "#C44A3A",
                            cursor: assignBusy ? "default" : "pointer",
                          }}
                        >
                          ⌫ Retirer le programme
                        </button>
                      </div>
                    </div>
                    {data.program.duration_weeks && (
                      <div
                        style={{
                          height: 4,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 2,
                          overflow: "hidden",
                          marginBottom: 20,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round(((currentWeek || 1) / data.program.duration_weeks) * 100)}%`,
                            height: "100%",
                            background: "var(--cst-mid-green)",
                          }}
                        />
                      </div>
                    )}
                    <WeeksManagerPanel memberId={memberId} />

                    {/* Séances à venir — skip / repos */}
                    {upcomingSessions.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <CSTSectionNum num={2} label="SÉANCES À VENIR" sub="14 PROCHAINS JOURS" />
                        <div className="cst-col" style={{ gap: 6, marginTop: 10 }}>
                          {upcomingSessions.map((s) => {
                            const isRest = s.status === "rest";
                            const busy = skipBusy === s.id;
                            const d = new Date(s.planned_date + "T00:00:00");
                            const daysFR = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
                            const dateLabel = `${daysFR[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                            return (
                              <div
                                key={s.id}
                                className="cst-card-dark"
                                style={{
                                  padding: "10px 14px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 14,
                                }}
                              >
                                <div
                                  className="cst-mono"
                                  style={{ width: 70, fontSize: 10, opacity: 0.6 }}
                                >
                                  {dateLabel}
                                </div>
                                <div className="cst-col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                                  <span
                                    className="cst-display"
                                    style={{
                                      fontSize: 14,
                                      opacity: isRest ? 0.4 : 1,
                                      textDecoration: isRest ? "line-through" : "none",
                                    }}
                                  >
                                    {(s.day_label || "Séance").toUpperCase()}
                                  </span>
                                  {isRest && (
                                    <span
                                      className="cst-mono"
                                      style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}
                                    >
                                      REPOS / SAUTÉ
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleToggleRest(s.id)}
                                  disabled={busy}
                                  className="cst-btn cst-btn-sm"
                                  style={{
                                    fontSize: 10,
                                    background: isRest ? "rgba(90,168,90,0.12)" : "transparent",
                                    border: `1px solid ${isRest ? "rgba(90,168,90,0.4)" : "rgba(255,255,255,0.15)"}`,
                                    color: isRest
                                      ? "var(--cst-mid-green)"
                                      : "rgba(255,255,255,0.55)",
                                    opacity: busy ? 0.5 : 1,
                                  }}
                                >
                                  {busy ? "…" : isRest ? "↩ RÉTABLIR" : "⊘ REPOS"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Session mode toggle */}
                    {data.assignment &&
                      (() => {
                        const currentMode = data.assignment.session_mode || "debutant";
                        async function toggleMode() {
                          const next = currentMode === "expert" ? "debutant" : "expert";
                          setSessionModeBusy(true);
                          try {
                            await setModeFn({ data: { member_id: memberId, session_mode: next } });
                            setData((d) =>
                              d ? { ...d, assignment: { ...d.assignment, session_mode: next } } : d,
                            );
                          } catch {
                            /* ignore */
                          } finally {
                            setSessionModeBusy(false);
                          }
                        }
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 8,
                              marginTop: 10,
                            }}
                          >
                            <div>
                              <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
                                MODE SÉANCE
                              </div>
                              <div className="cst-display" style={{ fontSize: 13, marginTop: 2 }}>
                                {currentMode === "expert"
                                  ? "EXPÉRIMENTÉ — sans saisie"
                                  : "SUIVI — avec poids & reps"}
                              </div>
                            </div>
                            <button
                              onClick={toggleMode}
                              disabled={sessionModeBusy}
                              className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                              style={{ fontSize: 10, opacity: sessionModeBusy ? 0.5 : 1 }}
                            >
                              {sessionModeBusy
                                ? "…"
                                : currentMode === "expert"
                                  ? "→ SUIVI"
                                  : "→ EXPÉRIMENTÉ"}
                            </button>
                          </div>
                        );
                      })()}

                    {/* Recap semaine precedente */}
                    {(() => {
                      const prevWeek = (currentWeek || 1) - 1;
                      const prevSessions =
                        prevWeek > 0 ? data.sessions.filter((s) => s.week_number === prevWeek) : [];
                      const recentFallback =
                        prevWeek <= 0
                          ? data.sessions.filter((s) => s.status === "done").slice(0, 5)
                          : [];
                      const toShow = prevSessions.length > 0 ? prevSessions : recentFallback;
                      const label =
                        prevWeek > 0
                          ? `RECAP S${String(prevWeek).padStart(2, "0")}`
                          : "DERNIERES SEANCES";
                      const sub = prevWeek > 0 ? "SEMAINE PRECEDENTE" : "ACTIVITE RECENTE";
                      return (
                        <div style={{ marginTop: 16 }}>
                          <CSTSectionNum num={2} label={label} sub={sub} />
                          <div className="cst-col" style={{ gap: 8, marginTop: 10 }}>
                            {toShow.length === 0 ? (
                              <div
                                className="cst-card-dark"
                                style={{ padding: 16, opacity: 0.6, fontSize: 12 }}
                              >
                                Aucune seance effectuee la semaine{" "}
                                {prevWeek > 0 ? prevWeek : "precedente"}.
                              </div>
                            ) : (
                              toShow.map((s) => {
                                const kind = statusKind(s.status);
                                const rpe = s.average_rpe != null ? Number(s.average_rpe) : null;
                                const rpeColor =
                                  rpe == null
                                    ? "inherit"
                                    : rpe >= 9
                                      ? "#C0392B"
                                      : rpe >= 7
                                        ? "#E07B39"
                                        : "#5BA85A";
                                return (
                                  <div
                                    key={s.id}
                                    className="cst-card-dark cst-hatch"
                                    style={{
                                      padding: "12px 18px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 18,
                                    }}
                                  >
                                    <div className="cst-mono" style={{ width: 56, fontSize: 10 }}>
                                      J{String(s.day_number || "-").padStart(2, "0")}
                                    </div>
                                    <div
                                      className="cst-col"
                                      style={{ flex: 1, gap: 2, minWidth: 0 }}
                                    >
                                      <span className="cst-display" style={{ fontSize: 15 }}>
                                        {(
                                          s.session_label || `Jour ${s.day_number || "?"}`
                                        ).toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: 11, opacity: 0.75 }}>
                                        {sanitizeDurationMin(s.duration_minutes)
                                          ? `${sanitizeDurationMin(s.duration_minutes)} min`
                                          : "--"}
                                        {rpe != null && (
                                          <span style={{ color: rpeColor, fontWeight: 700 }}>
                                            {" "}
                                            · RPE {rpe.toFixed(1)}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <CSTStatus kind={kind} />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}

            {activeTab === 2 && (
              <>
                <CSTSectionNum
                  num={1}
                  label="HISTORIQUE"
                  sub={`${data.sessions.length} DERNIÈRES SÉANCES`}
                />
                <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                  {data.sessions.length === 0 && (
                    <div
                      className="cst-card-dark"
                      style={{ padding: 18, opacity: 0.6, fontSize: 13 }}
                    >
                      Aucune séance enregistrée.
                    </div>
                  )}
                  {data.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="cst-card-dark"
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                      }}
                    >
                      <div className="cst-mono" style={{ width: 90, fontSize: 10 }}>
                        {shortDateFR(s.date)}
                      </div>
                      <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                        <span className="cst-display" style={{ fontSize: 15 }}>
                          {(
                            s.session_label || `S${s.week_number || "-"} · J${s.day_number || "-"}`
                          ).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.55 }}>
                          {sanitizeDurationMin(s.duration_minutes)
                            ? `${sanitizeDurationMin(s.duration_minutes)} min`
                            : "—"}
                          {s.average_rpe ? ` · RPE ${Number(s.average_rpe).toFixed(1)}` : ""}
                        </span>
                      </div>
                      <CSTStatus kind={statusKind(s.status)} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 3 && (
              <>
                <CSTSectionNum num={1} label="VIDÉOS TECHNIQUE" sub="ENVOIS DU COACHÉ" />
                <div style={{ marginTop: 14 }}>
                  {coachUid && (
                    <VideoReviewPanel
                      memberId={memberId}
                      coachUserId={coachUid}
                      initialVideoId={search?.video}
                    />
                  )}
                </div>
              </>
            )}

            {activeTab === 4 && (
              <>
                <CSTSectionNum num={1} label="PROGRESSION" sub="EXERCICES CLÉS" />
                <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                  {trends.length === 0 && (
                    <div
                      className="cst-card-dark"
                      style={{ padding: 18, opacity: 0.6, fontSize: 13 }}
                    >
                      Pas encore assez de données. Les tendances apparaîtront après quelques
                      séances.
                    </div>
                  )}
                  {trends.map((t) => (
                    <div
                      key={t.name}
                      className="cst-card-dark"
                      style={{
                        padding: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div className="cst-col" style={{ gap: 2 }}>
                        <span className="cst-display" style={{ fontSize: 14 }}>
                          {t.name.toUpperCase()}
                        </span>
                        <span className="cst-mono" style={{ fontSize: 10 }}>
                          {t.first} → {t.lastMax} KG · {t.count} SÉRIES
                        </span>
                      </div>
                      <span
                        className="cst-display"
                        style={{ fontSize: 18, color: t.delta > 0 ? "var(--cst-success)" : "#fff" }}
                      >
                        {t.delta > 0 ? "+ " : ""}
                        {t.delta.toFixed(1)} KG
                      </span>
                    </div>
                  ))}
                </div>
                {data.weight_logs.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <CSTSectionNum
                      num={2}
                      label="POIDS CORPOREL"
                      sub={`${data.weight_logs.length} MESURES`}
                    />
                    <div className="cst-card-dark" style={{ padding: 16, marginTop: 14 }}>
                      {data.weight_logs.slice(0, 6).map((w) => (
                        <div
                          key={w.date}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            fontSize: 12,
                          }}
                        >
                          <span className="cst-mono">{shortDateFR(w.date)}</span>
                          <span className="cst-display">{w.weight_kg} KG</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 5 && form && (
              <>
                <CSTSectionNum num={1} label="PROFIL" sub="ÉDITER LES INFOS ADHÉRENT" />
                <form
                  onSubmit={saveForm}
                  className="cst-card-dark"
                  style={{
                    padding: 20,
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      PRÉNOM
                    </label>
                    <input
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      NOM
                    </label>
                    <input
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      EMAIL
                    </label>
                    <input
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4, opacity: 0.6 }}
                      value={data.profile.email || ""}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      NIVEAU
                    </label>
                    <select
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                    >
                      <option value="">— Non renseigné —</option>
                      <option value="débutant">Débutant</option>
                      <option value="intermédiaire">Intermédiaire</option>
                      <option value="avancé">Avancé</option>
                      <option value="élite">Élite</option>
                    </select>
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      POIDS (KG)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="20"
                      max="400"
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      value={form.weight_kg}
                      onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      TAILLE (CM)
                    </label>
                    <input
                      type="number"
                      min="80"
                      max="260"
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      value={form.height_cm}
                      onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      OBJECTIF
                    </label>
                    <input
                      className="cst-input"
                      style={{ width: "100%", marginTop: 4 }}
                      placeholder="Ex. Préparation combat / Perte de gras / Hypertrophie…"
                      value={form.goal}
                      onChange={(e) => setForm({ ...form, goal: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                      BLESSURES / NOTES SANTÉ
                    </label>
                    <textarea
                      rows="4"
                      className="cst-input"
                      style={{
                        width: "100%",
                        marginTop: 4,
                        resize: "vertical",
                        fontFamily: "var(--cst-ui)",
                      }}
                      value={form.injuries}
                      onChange={(e) => setForm({ ...form, injuries: e.target.value })}
                      placeholder="Pathologies, contre-indications, points de vigilance…"
                    />
                  </div>
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <input
                      id="logw"
                      type="checkbox"
                      checked={logWeight}
                      onChange={(e) => setLogWeight(e.target.checked)}
                    />
                    <label htmlFor="logw" style={{ opacity: 0.8 }}>
                      Ajouter le poids saisi à l'historique de pesées
                    </label>
                  </div>
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <button type="submit" className="cst-btn cst-btn-primary" disabled={savingForm}>
                      {savingForm ? "ENREGISTREMENT…" : "ENREGISTRER LE PROFIL"}
                    </button>
                    {formSaved && (
                      <span style={{ color: "var(--cst-success)", fontSize: 12 }}>
                        ✓ Profil mis à jour
                      </span>
                    )}
                  </div>
                </form>
              </>
            )}

            {activeTab === 6 && (
              <>
                <CSTSectionNum
                  num={1}
                  label="MESSAGES"
                  sub={
                    data.unread_messages_count > 0
                      ? `${data.unread_messages_count} NON LUS`
                      : "AUCUN NOUVEAU"
                  }
                />
                <div
                  className="cst-card-dark"
                  style={{ padding: 24, marginTop: 14, textAlign: "center" }}
                >
                  <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
                    Ouvre la messagerie pour échanger avec {data.profile.first_name || fullName}.
                  </p>
                  <button
                    className="cst-btn cst-btn-primary"
                    onClick={() =>
                      navigate({ to: "/coach/messages", search: { partner: memberId } })
                    }
                  >
                    OUVRIR LA MESSAGERIE →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* SIDEBAR — private notes (always visible) */}
          <div className="cst-col" style={{ gap: 20 }}>
            <div className="cst-card-dark cst-hatch" style={{ padding: 18 }}>
              <CSTSectionNum num={9} label="NOTE PRIVÉE" sub="NON VISIBLE PAR LE MEMBRE" />
              <textarea
                className="cst-input"
                rows="6"
                style={{
                  marginTop: 12,
                  resize: "vertical",
                  fontFamily: "var(--cst-ui)",
                  fontSize: 12,
                  width: "100%",
                }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, suivi, alertes…"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <button
                  className="cst-btn cst-btn-primary cst-btn-sm"
                  disabled={savingNotes}
                  onClick={saveNotes}
                >
                  {savingNotes ? "..." : "ENREGISTRER"}
                </button>
                {notesSaved && (
                  <span style={{ color: "var(--cst-success)", fontSize: 11 }}>✓ Enregistré</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
