import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import MemberNav from '../../components/MemberNav';
import { CSTSectionNum, CSTDuoTitle } from '../../components/Atoms';
import { getMyAssignedProgram } from '@/lib/coach.functions';
import { ProgramBlocks } from '../../components/cst/ProgramBlocks';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_ENABLED } from '@/lib/app-mode';

function diffDays(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

export default function MemberProgramme() {
  const navigate = useNavigate();
  const fn = useServerFn(getMyAssignedProgram);
  const [data, setData] = useState(null);
  const [openWeek, setOpenWeek] = useState(null);
  const [openDaysByWeek, setOpenDaysByWeek] = useState({});
  const [loading, setLoading] = useState(true);
  const [sessionsByKey, setSessionsByKey] = useState({}); // "w-d" -> { status, id }
  const [plannedByKey, setPlannedByKey] = useState({}); // "w-d" -> planned_date
  const [currentWeek, setCurrentWeek] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fn();
        setData(r);
        const start = r.assignment?.start_date ? new Date(r.assignment.start_date) : null;
        const w = start ? Math.max(0, Math.floor(diffDays(new Date(), start) / 7)) : 0;
        setOpenWeek(w);
        setCurrentWeek(w);

        if (SUPABASE_ENABLED) {
          const { data: u } = await supabase.auth.getUser();
          if (u?.user) {
            const [{ data: sessions }, { data: planned }] = await Promise.all([
              supabase.from('sessions').select('id, status, week_number, day_number').eq('member_id', u.user.id),
              supabase.from('planned_sessions').select('week_number, day_label, planned_date').eq('member_id', u.user.id),
            ]);
            const sMap = {};
            for (const s of sessions ?? []) {
              const k = `${s.week_number}-${s.day_number}`;
              // prefer in_progress > completed > scheduled
              const prev = sMap[k];
              if (!prev || s.status === 'in_progress') sMap[k] = { status: s.status, id: s.id };
              else if (prev.status !== 'in_progress' && s.status === 'completed') sMap[k] = { status: s.status, id: s.id };
            }
            setSessionsByKey(sMap);
            const pMap = {};
            for (const p of planned ?? []) {
              if (p.week_number != null) pMap[`${p.week_number}-${p.day_label}`] = p.planned_date;
            }
            setPlannedByKey(pMap);
          }
        }
      } catch (e) {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const program = data?.program;
  const weeks = program?.structure?.weeks || [];
  const startDate = data?.assignment?.start_date ? new Date(data.assignment.start_date) : null;

  function toggleDay(weekIndex, dayIndex) {
    setOpenDaysByWeek((prev) => ({
      ...prev,
      [weekIndex]: prev[weekIndex] === dayIndex ? null : dayIndex,
    }));
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: '100%', maxWidth: 390, minHeight: 780, position: 'relative' }}>
        <div className="cst-screen cst-hatch" style={{ minHeight: 780 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 8px' }}>
            <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
            <span className="cst-mono" style={{ color: '#fff' }}>MON PROGRAMME</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>◯</span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            {loading && (
              <div style={{ padding: 24, opacity: 0.6, fontSize: 13 }}>Chargement…</div>
            )}

            {!loading && !program && (
              <div className="cst-card-dark cst-hatch" style={{ padding: 22, marginTop: 24, textAlign: 'center' }}>
                <div className="cst-display" style={{ fontSize: 20, marginBottom: 6 }}>AUCUN PROGRAMME</div>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
                  Ton coach ne t'a pas encore assigné de programme. Reviens plus tard.
                </p>
              </div>
            )}

            {!loading && program && (
              <>
                <CSTSectionNum num={1} label="PROGRAMME" sub={(program.objective || 'TRAINING').toUpperCase()} />
                <CSTDuoTitle top={program.name.split(' ')[0]?.toUpperCase() || 'PROGRAMME'} bottom={program.name.split(' ').slice(1).join(' ').toLowerCase() || ''} size={32} />
                <div className="cst-mono" style={{ fontSize: 9, marginTop: 8 }}>
                  {weeks.length} SEMAINES{startDate ? ` · DÉMARRÉ LE ${startDate.toLocaleDateString('fr-FR')}` : ''}
                </div>

                {/* Global progress */}
                {(() => {
                  const totalDays = weeks.reduce((a, w) => a + (w.days || []).filter((d) => d.type !== 'Repos').length, 0);
                  const doneDays = Object.values(sessionsByKey).filter((s) => s.status === 'completed').length;
                  const pct = totalDays ? Math.round((doneDays / totalDays) * 100) : 0;
                  return (
                    <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="cst-mono" style={{ fontSize: 9 }}>PROGRESSION GLOBALE</span>
                        <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>{doneDays}/{totalDays} · {pct}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cst-mid-green)' }} />
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={() => navigate({ to: '/membre/planning' })}
                  className="cst-btn cst-btn-ghost-dark"
                  style={{ marginTop: 10, width: '100%', fontSize: 11 }}
                >
                  📅 PLANIFIER MA SEMAINE →
                </button>

                <div className="cst-col" style={{ gap: 8, marginTop: 18 }}>
                  {weeks.map((w, i) => {
                    const isOpen = openWeek === i;
                    const openDayIndex = openDaysByWeek[i] ?? null;
                    // Numéro basé sur la position : les semaines adaptées (assignment_weeks)
                    // n'ont pas de champ `number`, et certains templates ont des numéros
                    // dupliqués → on affichait « Semaine 01 » deux fois.
                    const weekNum = i + 1;
                    return (
                      <div key={i} className="cst-card-dark" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          onClick={() => setOpenWeek(isOpen ? null : i)}
                          style={{ all: 'unset', cursor: 'pointer', width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: isOpen ? 'rgba(45,90,53,0.10)' : 'transparent', borderBottom: isOpen ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                        >
                          <span style={{ opacity: 0.5 }}>{isOpen ? '▼' : '▶'}</span>
                          <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                            <span className="cst-mono" style={{ fontSize: 9 }}>
                              SEMAINE {String(weekNum).padStart(2, '0')}
                              {i === currentWeek && <span style={{ color: 'var(--cst-mid-green)', marginLeft: 6 }}>· EN COURS</span>}
                            </span>
                            <span className="cst-display" style={{ fontSize: 15 }}>{(w.days || []).length} SÉANCE{(w.days || []).length > 1 ? 'S' : ''}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="cst-col" style={{ padding: '10px 14px 14px', gap: 14 }}>
                            {(w.days || []).map((d, di) => {
                              const dayNum = d.number ?? di + 1;
                              const dayLabel = d.label || String(dayNum);
                              const isDayOpen = openDayIndex === di;
                              const sess = sessionsByKey[`${weekNum}-${dayNum}`] || sessionsByKey[`${i + 1}-${di + 1}`];
                              const plannedDate = plannedByKey[`${weekNum}-J${dayNum}`] || plannedByKey[`${weekNum}-${d.label}`];
                              const isDone = sess?.status === 'completed';
                              const isInProgress = sess?.status === 'in_progress';
                              const icon = d.type === 'Repos' ? '🛌' : isDone ? '✓' : isInProgress ? '⏱' : plannedDate ? '◐' : '○';
                              const iconColor = isDone ? 'var(--cst-mid-green)' : isInProgress ? '#F5A623' : plannedDate ? '#6EAB76' : 'rgba(255,255,255,0.4)';
                              return (
                                <div key={di} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: isDayOpen ? 8 : 0, gap: 8 }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleDay(i, di)}
                                      style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}
                                    >
                                      <span style={{ fontSize: 12, opacity: 0.5, width: 12, textAlign: 'center' }}>{isDayOpen ? '▼' : '▶'}</span>
                                      <span style={{ fontSize: 14, color: iconColor }}>{icon}</span>
                                      <div className="cst-col" style={{ gap: 2, minWidth: 0 }}>
                                        <span className="cst-display" style={{ fontSize: 13 }}>
                                          J{dayNum} · {(d.label || 'Séance').toUpperCase()}
                                        </span>
                                        {plannedDate && (
                                          <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>
                                            📅 {new Date(plannedDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                    {d.type !== 'Repos' && (d.exercises?.length ?? 0) > 0 && !isDone && (
                                      <button
                                        className={isInProgress ? 'cst-btn cst-btn-primary cst-btn-sm' : 'cst-btn cst-btn-ghost-dark cst-btn-sm'}
                                        onClick={() => {
                                          if (isInProgress && sess?.id) navigate({ to: `/membre/seance/${sess.id}` });
                                          else navigate({ to: '/membre/logger', search: { week: i, day: dayLabel } });
                                        }}
                                        style={{ fontSize: 9, padding: '4px 8px' }}
                                      >
                                        {isInProgress ? 'REPRENDRE →' : 'DÉMARRER →'}
                                      </button>
                                    )}
                                  </div>
                                  {isDayOpen && (
                                    d.type === 'Repos' ? (
                                      <div className="cst-mono" style={{ fontSize: 10, opacity: 0.5, padding: '8px 0' }}>RÉCUPÉRATION</div>
                                    ) : (
                                      <ProgramBlocks exercises={d.exercises || []} />
                                    )
                                  )}
                                </div>
                              );
                            })}
                            {(w.days || []).length === 0 && (
                              <div style={{ opacity: 0.5, fontSize: 12 }}>Aucune séance.</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {weeks.length === 0 && (
                    <div style={{ opacity: 0.5, fontSize: 13 }}>Le programme est encore vide.</div>
                  )}
                </div>
              </>
            )}
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
