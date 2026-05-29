import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTAvatar, CSTStatus } from '../../components/Atoms';
import { getMemberDetail, updateMemberNotes, updateMemberProfile, assignProgram, listPrograms } from '@/lib/coach.functions';
import { VideoReviewPanel } from '../../components/coach/VideoReviewPanel';
import { supabase } from '@/integrations/supabase/client';

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function formatDateFR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function shortDateFR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = ['DIM','LUN','MAR','MER','JEU','VEN','SAM'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function statusKind(s) {
  if (s === 'completed' || s === 'done') return 'done';
  if (s === 'in_progress') return 'active';
  if (s === 'skipped' || s === 'rest') return 'rest';
  return 'coming';
}

export default function CoachMember() {
  const { memberId } = useParams({ from: '/_authenticated/coach/membre/$memberId' });
  const navigate = useNavigate();
  const getDetailFn = useServerFn(getMemberDetail);
  const saveNotesFn = useServerFn(updateMemberNotes);
  const saveProfileFn = useServerFn(updateMemberProfile);
  const listProgramsFn = useServerFn(listPrograms);
  const assignFn = useServerFn(assignProgram);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [savingForm, setSavingForm] = useState(false);
  const [formSaved, setFormSaved] = useState(false);
  const [logWeight, setLogWeight] = useState(false);

  async function reload() {
    setLoading(true);
    setErr('');
    try {
      const d = await getDetailFn({ data: { member_id: memberId } });
      setData(d);
      setNotes(d.member_profile?.coach_private_notes || '');
      setForm({
        first_name: d.profile?.first_name || '',
        last_name: d.profile?.last_name || '',
        weight_kg: d.member_profile?.weight_kg ?? '',
        height_cm: d.member_profile?.height_cm ?? '',
        level: d.member_profile?.level || '',
        goal: d.member_profile?.goal || '',
        injuries: d.member_profile?.injuries || '',
      });
      setLogWeight(false);
    } catch (ex) {
      setErr(ex?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    listProgramsFn().then((p) => setPrograms(p.programs || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function saveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await saveNotesFn({ data: { member_id: memberId, coach_private_notes: notes } });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (ex) {
      alert(ex?.message || 'Erreur');
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
        weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        height_cm: form.height_cm === '' ? null : parseInt(form.height_cm, 10),
        level: form.level?.trim() || null,
        goal: form.goal?.trim() || null,
        injuries: form.injuries?.trim() || null,
        log_weight: logWeight && form.weight_kg !== '' ? true : false,
      };
      await saveProfileFn({ data: payload });
      setFormSaved(true);
      setTimeout(() => setFormSaved(false), 2500);
      await reload();
    } catch (ex) {
      alert(ex?.message || 'Erreur');
    } finally {
      setSavingForm(false);
    }
  }

  async function handleAssign(programId) {
    if (!programId) return;
    setAssignBusy(true);
    try {
      await assignFn({ data: { member_id: memberId, program_id: programId } });
      await reload();
    } catch (ex) {
      alert(ex?.message || 'Erreur');
    } finally {
      setAssignBusy(false);
    }
  }

  const tabs = ['Programme actuel', 'Historique', 'Progression', 'Profil', 'Messages'];

  // Computed derived values
  const fullName = useMemo(() => {
    if (!data?.profile) return '';
    return [data.profile.first_name, data.profile.last_name].filter(Boolean).join(' ') || data.profile.email;
  }, [data]);

  const initials = useMemo(() => {
    if (!data?.profile) return '?';
    const f = data.profile.first_name?.[0] || data.profile.email?.[0] || '?';
    const l = data.profile.last_name?.[0] || '';
    return (f + l).toUpperCase();
  }, [data]);

  const seniority = useMemo(() => {
    if (!data?.profile?.created_at) return 0;
    return daysBetween(new Date(data.profile.created_at), new Date());
  }, [data]);

  const currentWeek = useMemo(() => {
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

  if (loading) {
    return (
      <div className="cst-screen" style={{ flexDirection: 'row' }}>
        <CoachSidebar />
        <div className="cst-col" style={{ flex: 1, padding: 48 }}>
          <span className="cst-mono" style={{ opacity: 0.6 }}>CHARGEMENT…</span>
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="cst-screen" style={{ flexDirection: 'row' }}>
        <CoachSidebar />
        <div className="cst-col" style={{ flex: 1, padding: 48, gap: 16 }}>
          <span className="cst-display" style={{ fontSize: 24 }}>ADHÉRENT INTROUVABLE</span>
          <span style={{ opacity: 0.7 }}>{err || 'Aucune donnée'}</span>
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate({ to: '/coach' })}>← RETOUR</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Breadcrumb */}
        <div style={{ padding: '20px 32px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cst-mono" style={{ color: '#fff', cursor: 'pointer' }} onClick={() => navigate({ to: '/coach' })}>MEMBRES</span>
          <span className="cst-mono">/</span>
          <span className="cst-mono" style={{ color: 'var(--cst-mid-green)' }}>{fullName.toUpperCase()}</span>
        </div>

        {/* Hero */}
        <div className="cst-hatch" style={{ padding: '28px 32px 32px', background: 'linear-gradient(180deg,#1F2D24 0%,#1B2E1F 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 110, height: 110, borderRadius: 8, background: 'linear-gradient(135deg,#3A6B42,#1B2E1F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--cst-display)', fontSize: 42, fontWeight: 800, border: '1px solid rgba(255,255,255,0.08)' }}>{initials}</div>
            <div className="cst-col" style={{ gap: 6, flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="cst-tag cst-tag-success">MEMBRE · ACTIF</span>
                <span className="cst-mono">INSCRIT LE {formatDateFR(data.profile.created_at)}</span>
              </div>
              <h1 className="cst-display" style={{ fontSize: 48, margin: 0 }}>{fullName.toUpperCase()}.</h1>
              <div className="cst-italic" style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginTop: -4 }}>{data.profile.email}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate({ to: '/coach/messages' })}>MESSAGE →</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 0, marginTop: 26, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
            {[
              ['OBJECTIF', data.member_profile?.goal?.toUpperCase() || '—'],
              ['POIDS', data.last_weight_kg != null ? `${data.last_weight_kg} KG` : '—'],
              ['NIVEAU', data.member_profile?.level?.toUpperCase() || '—'],
              ['ANCIENNETÉ', `${seniority} J`],
              ['SÉANCES', String(data.sessions.length).padStart(2, '0')],
            ].map(([k, v], i) => (
              <div key={k} className="cst-col" style={{ gap: 4, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: i > 0 ? 20 : 0 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                <span className="cst-display" style={{ fontSize: 22 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 32px', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {tabs.map((t, i) => (
            <div key={t} onClick={() => setActiveTab(i)} style={{
              padding: '16px 20px', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: activeTab === i ? 700 : 500,
              color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)',
              borderBottom: activeTab === i ? '2px solid var(--cst-mid-green)' : '2px solid transparent',
              fontFamily: 'var(--cst-ui)', cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', opacity: activeTab === i ? 1 : 0.4 }}>{String(i+1).padStart(2,'0')}</span>
              {t}
              {t === 'Messages' && data.unread_messages_count > 0 && (
                <span style={{ background: 'var(--cst-mid-green)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontFamily: 'var(--cst-mono)' }}>{data.unread_messages_count}</span>
              )}
            </div>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          <div>
            {activeTab === 0 && (
              <>
                {!data.program ? (
                  <div className="cst-card-dark cst-hatch" style={{ padding: 28, textAlign: 'center' }}>
                    <div className="cst-display" style={{ fontSize: 22, marginBottom: 8 }}>AUCUN PROGRAMME ASSIGNÉ</div>
                    <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>Choisis un programme à assigner à {data.profile.first_name || fullName}.</p>
                    <select
                      className="cst-input"
                      disabled={assignBusy || programs.length === 0}
                      defaultValue=""
                      onChange={(e) => handleAssign(e.target.value)}
                      style={{ maxWidth: 360, margin: '0 auto' }}
                    >
                      <option value="">— Sélectionner un programme —</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <CSTSectionNum num={1} label="PROGRAMME ACTUEL" sub={(data.program.objective || data.program.name).toUpperCase()} />
                        <h2 className="cst-display" style={{ fontSize: 32, margin: '8px 0 4px' }}>
                          {data.program.duration_weeks ? `SEMAINE ${String(currentWeek || 1).padStart(2,'0')} / ${String(data.program.duration_weeks).padStart(2,'0')}` : data.program.name.toUpperCase()}
                        </h2>
                        <span className="cst-mono">{data.program.name.toUpperCase()}</span>
                      </div>
                      <select
                        className="cst-input"
                        disabled={assignBusy}
                        defaultValue=""
                        onChange={(e) => handleAssign(e.target.value)}
                        style={{ fontSize: 11, padding: '6px 8px', maxWidth: 240 }}
                      >
                        <option value="">CHANGER DE PROGRAMME…</option>
                        {programs.filter((p) => p.id !== data.program.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {data.program.duration_weeks && (
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
                        <div style={{ width: `${Math.round(((currentWeek || 1) / data.program.duration_weeks) * 100)}%`, height: '100%', background: 'var(--cst-mid-green)' }} />
                      </div>
                    )}
                    <div className="cst-col" style={{ gap: 10 }}>
                      {weekDays.length === 0 && (
                        <div className="cst-card-dark" style={{ padding: 18, opacity: 0.6, fontSize: 12 }}>Pas de jours définis pour cette semaine.</div>
                      )}
                      {weekDays.map((d, i) => {
                        const dayNum = d.day_number || i + 1;
                        const s = sessionByDay.get(`${currentWeek}-${dayNum}`);
                        const kind = s ? statusKind(s.status) : 'coming';
                        return (
                          <div key={i} className="cst-card-dark cst-hatch" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div className="cst-mono" style={{ width: 56, fontSize: 10 }}>J{String(dayNum).padStart(2, '0')}</div>
                            <div className="cst-col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                              <span className="cst-display" style={{ fontSize: 16 }}>{(d.name || d.label || `Jour ${dayNum}`).toUpperCase()}</span>
                              <span style={{ fontSize: 11, opacity: 0.55 }}>{(d.exercises?.length || 0)} exercices{s?.duration_minutes ? ` · ${s.duration_minutes} min` : ''}{s?.average_rpe ? ` · RPE ${Number(s.average_rpe).toFixed(1)}` : ''}</span>
                            </div>
                            <CSTStatus kind={kind} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === 1 && (
              <>
                <CSTSectionNum num={1} label="HISTORIQUE" sub={`${data.sessions.length} DERNIÈRES SÉANCES`} />
                <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                  {data.sessions.length === 0 && (
                    <div className="cst-card-dark" style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>Aucune séance enregistrée.</div>
                  )}
                  {data.sessions.map((s) => (
                    <div key={s.id} className="cst-card-dark" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
                      <div className="cst-mono" style={{ width: 90, fontSize: 10 }}>{shortDateFR(s.date)}</div>
                      <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                        <span className="cst-display" style={{ fontSize: 15 }}>{(s.session_label || `S${s.week_number || '-'} · J${s.day_number || '-'}`).toUpperCase()}</span>
                        <span style={{ fontSize: 11, opacity: 0.55 }}>
                          {s.duration_minutes ? `${s.duration_minutes} min` : '—'}{s.average_rpe ? ` · RPE ${Number(s.average_rpe).toFixed(1)}` : ''}
                        </span>
                      </div>
                      <CSTStatus kind={statusKind(s.status)} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 2 && (
              <>
                <CSTSectionNum num={1} label="PROGRESSION" sub="EXERCICES CLÉS" />
                <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                  {trends.length === 0 && (
                    <div className="cst-card-dark" style={{ padding: 18, opacity: 0.6, fontSize: 13 }}>Pas encore assez de données. Les tendances apparaîtront après quelques séances.</div>
                  )}
                  {trends.map((t) => (
                    <div key={t.name} className="cst-card-dark" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="cst-col" style={{ gap: 2 }}>
                        <span className="cst-display" style={{ fontSize: 14 }}>{t.name.toUpperCase()}</span>
                        <span className="cst-mono" style={{ fontSize: 10 }}>{t.first} → {t.lastMax} KG · {t.count} SÉRIES</span>
                      </div>
                      <span className="cst-display" style={{ fontSize: 18, color: t.delta > 0 ? 'var(--cst-success)' : '#fff' }}>
                        {t.delta > 0 ? '+ ' : ''}{t.delta.toFixed(1)} KG
                      </span>
                    </div>
                  ))}
                </div>
                {data.weight_logs.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <CSTSectionNum num={2} label="POIDS CORPOREL" sub={`${data.weight_logs.length} MESURES`} />
                    <div className="cst-card-dark" style={{ padding: 16, marginTop: 14 }}>
                      {data.weight_logs.slice(0, 6).map((w) => (
                        <div key={w.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                          <span className="cst-mono">{shortDateFR(w.date)}</span>
                          <span className="cst-display">{w.weight_kg} KG</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 3 && form && (
              <>
                <CSTSectionNum num={1} label="PROFIL" sub="ÉDITER LES INFOS ADHÉRENT" />
                <form onSubmit={saveForm} className="cst-card-dark" style={{ padding: 20, marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>PRÉNOM</label>
                    <input className="cst-input" style={{ width: '100%', marginTop: 4 }} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>NOM</label>
                    <input className="cst-input" style={{ width: '100%', marginTop: 4 }} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>EMAIL</label>
                    <input className="cst-input" style={{ width: '100%', marginTop: 4, opacity: 0.6 }} value={data.profile.email || ''} disabled />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>NIVEAU</label>
                    <select className="cst-input" style={{ width: '100%', marginTop: 4 }} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                      <option value="">— Non renseigné —</option>
                      <option value="débutant">Débutant</option>
                      <option value="intermédiaire">Intermédiaire</option>
                      <option value="avancé">Avancé</option>
                      <option value="élite">Élite</option>
                    </select>
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>POIDS (KG)</label>
                    <input type="number" step="0.1" min="20" max="400" className="cst-input" style={{ width: '100%', marginTop: 4 }} value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
                  </div>
                  <div>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>TAILLE (CM)</label>
                    <input type="number" min="80" max="260" className="cst-input" style={{ width: '100%', marginTop: 4 }} value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>OBJECTIF</label>
                    <input className="cst-input" style={{ width: '100%', marginTop: 4 }} placeholder="Ex. Préparation combat / Perte de gras / Hypertrophie…" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>BLESSURES / NOTES SANTÉ</label>
                    <textarea rows="4" className="cst-input" style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'var(--cst-ui)' }} value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} placeholder="Pathologies, contre-indications, points de vigilance…" />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <input id="logw" type="checkbox" checked={logWeight} onChange={(e) => setLogWeight(e.target.checked)} />
                    <label htmlFor="logw" style={{ opacity: 0.8 }}>Ajouter le poids saisi à l'historique de pesées</label>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button type="submit" className="cst-btn cst-btn-primary" disabled={savingForm}>
                      {savingForm ? 'ENREGISTREMENT…' : 'ENREGISTRER LE PROFIL'}
                    </button>
                    {formSaved && <span style={{ color: 'var(--cst-success)', fontSize: 12 }}>✓ Profil mis à jour</span>}
                  </div>
                </form>
              </>
            )}

            {activeTab === 4 && (
              <>
                <CSTSectionNum num={1} label="MESSAGES" sub={data.unread_messages_count > 0 ? `${data.unread_messages_count} NON LUS` : 'AUCUN NOUVEAU'} />
                <div className="cst-card-dark" style={{ padding: 24, marginTop: 14, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>Ouvre la messagerie pour échanger avec {data.profile.first_name || fullName}.</p>
                  <button className="cst-btn cst-btn-primary" onClick={() => navigate({ to: '/coach/messages' })}>OUVRIR LA MESSAGERIE →</button>
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
                style={{ marginTop: 12, resize: 'vertical', fontFamily: 'var(--cst-ui)', fontSize: 12, width: '100%' }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, suivi, alertes…"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <button className="cst-btn cst-btn-primary cst-btn-sm" disabled={savingNotes} onClick={saveNotes}>
                  {savingNotes ? '...' : 'ENREGISTRER'}
                </button>
                {notesSaved && <span style={{ color: 'var(--cst-success)', fontSize: 11 }}>✓ Enregistré</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
