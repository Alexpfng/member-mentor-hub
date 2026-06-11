import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MemberNav from '../../components/MemberNav';
import { CSTSectionNum, CSTDuoTitle } from '../../components/Atoms';
import { sanitizeDurationMin } from '@/lib/format';

const MONTH_LABELS = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
];
const DAY_LABELS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

const FILTERS = [
  { key: 'all', label: 'Tout', days: null },
  { key: 'month', label: 'Ce mois', days: 30 },
  { key: '3m', label: '3 mois', days: 90 },
  { key: '6m', label: '6 mois', days: 180 },
];

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export default function Historique() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [exCountBySession, setExCountBySession] = useState({});
  const [prsBySession, setPrsBySession] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { navigate('/login'); return; }
        const uid = u.user.id;

        const { data: sess } = await supabase
          .from('sessions')
          .select('id, date, session_label, duration_minutes, average_rpe, total_volume_kg, week_number, day_number, member_note, coach_note, ended_at, session_type, free_title')
          .eq('member_id', uid)
          .eq('status', 'completed')
          .order('date', { ascending: false, nullsFirst: false })
          .order('ended_at', { ascending: false, nullsFirst: false });

        const list = sess ?? [];
        setSessions(list);

        const ids = list.map((s) => s.id);
        if (ids.length) {
          const [{ data: sets }, { data: prs }] = await Promise.all([
            supabase.from('set_logs').select('session_id, exercise_name').in('session_id', ids),
            supabase.from('personal_records').select('session_id, exercise_name, weight_kg, reps').in('session_id', ids),
          ]);

          const exMap = {};
          for (const sl of sets ?? []) {
            if (!sl.session_id || !sl.exercise_name) continue;
            if (!exMap[sl.session_id]) exMap[sl.session_id] = new Set();
            exMap[sl.session_id].add(sl.exercise_name);
          }
          const exCounts = {};
          for (const k of Object.keys(exMap)) exCounts[k] = exMap[k].size;
          setExCountBySession(exCounts);

          const prMap = {};
          for (const pr of prs ?? []) {
            if (!pr.session_id) continue;
            if (!prMap[pr.session_id]) prMap[pr.session_id] = [];
            prMap[pr.session_id].push(pr);
          }
          setPrsBySession(prMap);
        } else {
          setExCountBySession({});
          setPrsBySession({});
        }
      } catch (e) {
        console.error('historique load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filterDef = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const cutoffISO = (() => {
    if (!filterDef.days) return null;
    const d = new Date();
    d.setDate(d.getDate() - filterDef.days);
    return isoDay(d);
  })();

  const filtered = sessions.filter((s) => {
    if (!cutoffISO) return true;
    if (!s.date) return false;
    return s.date >= cutoffISO;
  });

  // Group by year-month
  const groups = [];
  const groupIdx = new Map();
  for (const s of filtered) {
    if (!s.date) continue;
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groupIdx.has(key)) {
      groupIdx.set(key, groups.length);
      groups.push({
        key,
        label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
        entries: [],
      });
    }
    groups[groupIdx.get(key)].entries.push(s);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cst-dark-green)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>
        <div className="cst-screen" style={{ minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 8px' }}>
            <button
              onClick={() => navigate('/membre')}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', padding: 0 }}
              aria-label="Retour"
            >
              ←
            </button>
            <span className="cst-mono" style={{ color: '#fff' }}>HISTORIQUE</span>
            <span style={{ width: 18 }} />
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            <CSTSectionNum
              num={1}
              label="MON HISTORIQUE"
              sub={`${sessions.length} SÉANCE${sessions.length > 1 ? 'S' : ''}`}
            />
            <CSTDuoTitle top="DERRIÈRE" bottom="moi." size={36} />

            <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 18, flexWrap: 'wrap' }}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <span
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={on ? 'cst-tag' : 'cst-tag cst-tag-dark'}
                    style={{ padding: '6px 12px', cursor: 'pointer' }}
                  >
                    {f.label}
                  </span>
                );
              })}
            </div>

            {loading ? (
              <div className="cst-mono" style={{ opacity: 0.5, fontSize: 11, padding: '24px 0' }}>
                CHARGEMENT…
              </div>
            ) : groups.length === 0 ? (
              <div
                className="cst-card-dark"
                style={{ padding: 24, textAlign: 'center', marginTop: 16 }}
              >
                <div className="cst-display" style={{ fontSize: 16, marginBottom: 8 }}>
                  AUCUNE SÉANCE
                </div>
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
                  {sessions.length === 0
                    ? 'Aucune séance terminée pour le moment. Lance ta première séance depuis le tableau de bord.'
                    : 'Aucune séance terminée sur cette période.'}
                </p>
              </div>
            ) : (
              groups.map((mo) => (
                <div key={mo.key} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span className="cst-display" style={{ fontSize: 14, letterSpacing: '0.1em' }}>{mo.label}</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div className="cst-col" style={{ gap: 8 }}>
                    {mo.entries.map((s) => {
                      const d = new Date(s.date);
                      const dayNum = String(d.getDate()).padStart(2, '0');
                      const dayLabel = DAY_LABELS[d.getDay()];
                      const exCount = exCountBySession[s.id];
                      const prs = prsBySession[s.id] ?? [];
                      const subParts = [];
                      if (typeof exCount === 'number' && exCount > 0) subParts.push(`${exCount} ex`);
                      const dMin = sanitizeDurationMin(s.duration_minutes);
                      if (dMin) subParts.push(`${dMin} min`);
                      if (s.average_rpe != null) subParts.push(`RPE ${Number(s.average_rpe).toFixed(1)}`);
                      else if (s.total_volume_kg != null && Number(s.total_volume_kg) > 0) {
                        subParts.push(`${Math.round(Number(s.total_volume_kg))} kg`);
                      }
                      const sub = subParts.join(' · ');
                      const sem = (s.week_number != null && s.day_number != null)
                        ? `SEM ${String(s.week_number).padStart(2, '0')} · J${s.day_number}`
                        : null;

                      return (
                        <div key={s.id} style={{ display: 'flex', gap: 12 }}>
                          <div className="cst-col" style={{ alignItems: 'center', width: 38, flexShrink: 0, paddingTop: 4 }}>
                            <span className="cst-display" style={{ fontSize: 18 }}>{dayNum}</span>
                            <span className="cst-mono" style={{ fontSize: 8 }}>{dayLabel}</span>
                          </div>
                          <div className="cst-card-dark cst-hatch" style={{ flex: 1, padding: 14, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div className="cst-col" style={{ gap: 2, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className="cst-display" style={{ fontSize: 16 }}>
                                    {(s.free_title || s.session_label || 'SÉANCE').toUpperCase()}
                                  </span>
                                  {s.session_type === 'free' && (
                                    <span className="cst-mono" style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: 'rgba(245,166,35,0.15)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.35)', letterSpacing: '0.14em' }}>
                                      LIBRE
                                    </span>
                                  )}
                                </div>
                                {sub && (
                                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>{sub}</span>
                                )}
                                {sem && (
                                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.45 }}>{sem}</span>
                                )}
                              </div>
                              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>✓</span>
                            </div>

                            {prs.map((pr, i) => {
                              const detail = pr.weight_kg != null
                                ? `${pr.weight_kg}KG`
                                : pr.reps != null
                                  ? `${pr.reps} REPS`
                                  : null;
                              const label = [pr.exercise_name?.toUpperCase(), detail].filter(Boolean).join(' ');
                              if (!label) return null;
                              return (
                                <div
                                  key={`${pr.exercise_name}-${i}`}
                                  style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(45,90,53,0.15)', borderRadius: 4, display: 'inline-block' }}
                                >
                                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ PR · {label}</span>
                                </div>
                              );
                            })}

                            {s.member_note && (
                              <div style={{ marginTop: 10, paddingLeft: 10, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ fontSize: 11, opacity: 0.7, fontStyle: 'italic' }}>« {s.member_note} »</span>
                              </div>
                            )}
                            {s.coach_note && (
                              <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(45,90,53,0.12)', borderRadius: 6 }}>
                                <span className="cst-mono" style={{ fontSize: 8, color: 'var(--cst-mid-green)' }}>NOTE COACH</span>
                                <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.85 }}>{s.coach_note}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
