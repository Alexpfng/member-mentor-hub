import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import MemberNav from '../../components/MemberNav';

// ─── REST TIMER ──────────────────────────────────────────────────────────────

function RestTimerOverlay({ seconds, onSkip, onAdjust }) {
  const [remaining, setRemaining] = useState(seconds);
  const total = seconds;
  const radius = 90;
  const circ = 2 * Math.PI * radius;
  const progress = remaining / total;

  useEffect(() => {
    if (remaining <= 0) { onSkip(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onSkip]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="rest-timer-overlay">
      <span className="rest-timer-label">REPOS</span>

      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#2D5A35" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
          strokeLinecap="round" transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
        <text x="100" y="108" textAnchor="middle"
          style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 42, fontWeight: 800, fill: 'white' }}>
          {mm}:{ss}
        </text>
      </svg>

      <div className="rest-timer-controls">
        <button onClick={() => onAdjust(-15)}>− 15s</button>
        <button className="skip-btn" onClick={onSkip}>PASSER →</button>
        <button onClick={() => onAdjust(30)}>+ 30s</button>
      </div>
    </div>
  );
}

// ─── YOUTUBE MODAL ───────────────────────────────────────────────────────────

function YoutubeModal({ url, onClose }) {
  const id = url?.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!id) return null;
  return (
    <div className="youtube-modal" onClick={onClose}>
      <button className="youtube-modal-close" onClick={onClose}>✕</button>
      <div className="youtube-iframe-wrap" onClick={e => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_EXERCISES = [
  {
    id: 'ex1', name: 'TRACTIONS PRONATION', color: '🔴',
    sets: 4, reps: '6-10', rest: 120, rpe: 8,
    youtube_url: '', notes: 'Contraction haute max. Pas à l\'échec.',
    status: 'done', loggedSets: [
      { reps: 8, weight: 0, rpe: 8 }, { reps: 7, weight: 0, rpe: 8 },
      { reps: 7, weight: 0, rpe: 9 }, { reps: 6, weight: 0, rpe: 9 },
    ],
  },
  {
    id: 'ex2', name: 'ROW BARRE', color: '🔴',
    sets: 4, reps: '8', rest: 120, rpe: 8,
    youtube_url: '', notes: 'Tire avec le dos, pas les bras.',
    status: 'active', loggedSets: [
      { reps: 8, weight: 60, rpe: 8 }, { reps: 8, weight: 60, rpe: 8 },
      { reps: 7, weight: 60, rpe: 9 }, null,
    ],
  },
  {
    id: 'ex3', name: 'FACE PULL', color: '🟢',
    sets: 3, reps: '15', rest: 60, rpe: 7,
    youtube_url: '', notes: '',
    status: 'upcoming', loggedSets: [null, null, null],
  },
  {
    id: 'ex4', name: 'CURL BICEPS', color: '🟡',
    sets: 3, reps: '10', rest: 60, rpe: 7,
    youtube_url: '', notes: '',
    status: 'upcoming', loggedSets: [null, null, null],
  },
];

// ─── SET ROW ──────────────────────────────────────────────────────────────────

function SetRow({ setNum, data, isActive, onChange }) {
  const weightRef = useRef(null);

  useEffect(() => {
    if (isActive && weightRef.current) {
      setTimeout(() => {
        weightRef.current?.focus();
        weightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isActive]);

  if (!isActive && !data) {
    return (
      <tr style={{ opacity: 0.35 }}>
        <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 12, color: 'var(--cst-text-muted)' }}>{setNum}</td>
        <td colSpan={3} style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>—</td>
        <td />
      </tr>
    );
  }

  if (data && !isActive) {
    return (
      <tr style={{ background: 'rgba(45,90,53,0.08)' }}>
        <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 12, color: 'var(--cst-text-muted)', fontWeight: 600 }}>{setNum}</td>
        <td style={{ textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 16, fontWeight: 700, color: '#fff' }}>{data.weight || 'PC'}</td>
        <td style={{ textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 16, fontWeight: 700, color: '#fff' }}>{data.reps}</td>
        <td style={{ textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 14, color: 'var(--cst-mid-green)', fontWeight: 600 }}>{data.rpe}</td>
        <td style={{ textAlign: 'center', fontSize: 16 }}>✅</td>
      </tr>
    );
  }

  // Active row
  return (
    <tr style={{ background: 'rgba(45,90,53,0.12)', borderTop: '1px solid rgba(45,90,53,0.3)' }}>
      <td style={{ padding: '12px 6px', textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 12, color: 'var(--cst-mid-green)', fontWeight: 700 }}>{setNum}</td>
      <td style={{ padding: '8px 4px' }}>
        <input ref={weightRef} className="set-input" type="number" inputMode="decimal"
          placeholder="kg" defaultValue={data?.weight || ''}
          onChange={e => onChange({ ...data, weight: e.target.value })}
          style={{ fontFamily: 'var(--cst-mono)' }} />
      </td>
      <td style={{ padding: '8px 4px' }}>
        <input className="set-input" type="number" inputMode="numeric"
          placeholder="reps" defaultValue={data?.reps || ''}
          onChange={e => onChange({ ...data, reps: e.target.value })}
          style={{ fontFamily: 'var(--cst-mono)' }} />
      </td>
      <td style={{ padding: '8px 4px' }}>
        <input className="set-input" type="number" inputMode="numeric"
          placeholder="RPE" min="1" max="10" defaultValue={data?.rpe || ''}
          onChange={e => onChange({ ...data, rpe: Number(e.target.value) })}
          style={{ fontFamily: 'var(--cst-mono)' }} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <button onClick={() => onChange({ ...data, done: true })} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'transparent', border: '2px solid var(--cst-mid-green)',
          color: 'var(--cst-mid-green)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✓</button>
      </td>
    </tr>
  );
}

// ─── EXERCISE BLOCK ───────────────────────────────────────────────────────────

function ExerciseBlock({ ex, isActive, onValidateSet, onStartRest, onShowVideo }) {
  const ytId = ex.youtube_url?.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
  const activeSetIdx = ex.loggedSets.findIndex(s => s === null);

  return (
    <div style={{
      background: '#1F2A22',
      border: `1px solid ${isActive ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12, marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{ex.color}</span>
          <span style={{ fontFamily: 'var(--cst-display)', fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: '#fff' }}>
            {ex.name}
          </span>
          {ex.status === 'done' && <span style={{ marginLeft: 'auto', color: 'var(--cst-mid-green)', fontSize: 14 }}>✓ FAIT</span>}
        </div>
        <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 10, color: 'var(--cst-text-muted)' }}>
          {ex.sets} SÉRIES · {ex.reps} REPS · RPE {ex.rpe} · REPOS {ex.rest}s
        </div>
      </div>

      {/* YouTube button */}
      {ytId && (
        <button onClick={() => onShowVideo(ex.youtube_url)} style={{
          width: '100%', padding: '12px 16px',
          background: 'rgba(45,90,53,0.12)', border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--cst-mid-green)', fontFamily: 'var(--cst-mono)',
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ▶ VOIR LA DÉMO YOUTUBE
        </button>
      )}

      {/* Coach notes */}
      {ex.notes && (
        <div style={{ padding: '10px 16px', background: 'rgba(45,90,53,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-mid-green)', marginBottom: 4 }}>💡 CONSIGNES DU COACH</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{ex.notes}</div>
        </div>
      )}

      {/* Sets table */}
      {(isActive || ex.status === 'done') && (
        <div style={{ padding: '0 0 4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                {['SÉR', 'KG', 'REPS', 'RPE', ''].map(h => (
                  <th key={h} style={{ padding: '8px 6px', fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', textAlign: 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ex.loggedSets.map((s, i) => (
                <SetRow key={i} setNum={i + 1} data={s} isActive={isActive && i === activeSetIdx}
                  onChange={newData => onValidateSet(ex.id, i, newData)} />
              ))}
            </tbody>
          </table>

          {/* Add set */}
          <button style={{
            width: '100%', padding: '10px', background: 'transparent',
            border: 'none', borderTop: '1px dashed rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--cst-mono)',
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>+ AJOUTER UNE SÉRIE</button>
        </div>
      )}

      {/* Rest timer trigger */}
      {isActive && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => onStartRest(ex.rest)} className="session-primary-btn"
            style={{ background: 'rgba(45,90,53,0.25)', border: '1px solid var(--cst-mid-green)', color: '#fff' }}>
            ▶ DÉMARRER RÉCUP {Math.floor(ex.rest / 60)}:{String(ex.rest % 60).padStart(2, '0')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN LOGGER ──────────────────────────────────────────────────────────────

export default function SessionLogger() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState(MOCK_EXERCISES);
  const [restTimer, setRestTimer] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(1); // active exercise index

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const handleValidateSet = useCallback((exId, setIdx, data) => {
    setExercises(prev => prev.map(ex =>
      ex.id !== exId ? ex : {
        ...ex,
        loggedSets: ex.loggedSets.map((s, i) => i === setIdx ? data : s),
      }
    ));
  }, []);

  const handleStartRest = useCallback((seconds) => {
    setRestTimer(seconds);
  }, []);

  const handleSkipRest = useCallback(() => {
    setRestTimer(null);
  }, []);

  const handleAdjustRest = useCallback((delta) => {
    setRestTimer(t => Math.max(5, (t ?? 0) + delta));
  }, []);

  const totalEx = exercises.length;
  const doneEx = exercises.filter(e => e.status === 'done').length;
  const activeEx = exercises.find(e => e.status === 'active');

  const progressDots = exercises.map(e => e.status);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cst-dark-green)', color: '#fff', paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 80px)' }}>

      {/* Sticky header */}
      <div className="session-header">
        <button onClick={() => navigate({ to: '/membre' })} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer', padding: '4px 8px', marginLeft: -4 }}>←</button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)' }}>EN COURS · SEM 04 · J2</div>
          <div style={{ fontFamily: 'var(--cst-display)', fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>PULL B</div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {progressDots.map((s, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: s === 'done' ? '#2D5A35' : s === 'active' ? '#fff' : 'rgba(255,255,255,0.2)',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: 'var(--cst-text-muted)' }}>TIMER</div>
          <div style={{ fontFamily: 'var(--cst-display)', fontSize: 16, fontWeight: 800, color: 'var(--cst-mid-green)' }}>{mm}:{ss}</div>
        </div>

        <button onClick={() => navigate({ to: '/membre' })} style={{
          background: 'rgba(139,35,24,0.15)', border: '1px solid rgba(139,35,24,0.4)',
          color: '#C56A60', borderRadius: 6, padding: '6px 10px',
          fontSize: 10, cursor: 'pointer', fontFamily: 'var(--cst-mono)', letterSpacing: '0.1em',
        }}>FIN</button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 0' }}>
        {exercises.map((ex, i) => (
          <ExerciseBlock
            key={ex.id}
            ex={ex}
            isActive={ex.status === 'active'}
            onValidateSet={handleValidateSet}
            onStartRest={handleStartRest}
            onShowVideo={setVideoUrl}
          />
        ))}
      </div>

      {/* Fixed bottom nav bar */}
      <div className="session-nav-bar">
        <button className="session-nav-btn" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}>← EXERCICE PRÉC.</button>
        <button className="session-nav-btn" onClick={() => setCurrentIdx(i => Math.min(totalEx - 1, i + 1))}
          style={{ background: 'rgba(45,90,53,0.2)', borderColor: 'var(--cst-mid-green)', color: '#fff' }}>
          SUIVANT →
        </button>
      </div>

      {/* Rest timer overlay */}
      {restTimer !== null && (
        <RestTimerOverlay
          seconds={restTimer}
          onSkip={handleSkipRest}
          onAdjust={handleAdjustRest}
        />
      )}

      {/* YouTube modal */}
      {videoUrl && <YoutubeModal url={videoUrl} onClose={() => setVideoUrl(null)} />}

      <MemberNav />
    </div>
  );
}
