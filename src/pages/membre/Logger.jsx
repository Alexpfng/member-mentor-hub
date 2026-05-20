import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const exBlock = { paddingBottom: 22, marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.08)' };
const setInput = { width: 48, padding: '6px 4px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 13, fontWeight: 600 };

export default function SessionLogger() {
  const navigate = useNavigate();
  const [timer] = useState('32:14');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: 390, height: 780, position: 'relative' }}>
        <div className="cst-screen" style={{ height: '100%' }}>
          <div style={topBar}>
            <span style={{ fontSize: 20, opacity: 0.7, cursor: 'pointer' }} onClick={() => navigate('/membre')}>←</span>
            <div className="cst-col" style={{ alignItems: 'center' }}>
              <span className="cst-mono" style={{ fontSize: 9 }}>EN COURS · SEM 04 · J2</span>
              <span className="cst-display" style={{ fontSize: 16 }}>PULL B</span>
            </div>
            <div className="cst-col" style={{ alignItems: 'flex-end' }}>
              <span className="cst-mono" style={{ fontSize: 8 }}>TIMER</span>
              <span className="cst-display" style={{ fontSize: 14, color: 'var(--cst-mid-green)' }}>{timer}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="cst-mono" style={{ fontSize: 9 }}>02 / 07</span>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(2/7)*100}%`, height: '100%', background: 'var(--cst-mid-green)' }} />
            </div>
            <span className="cst-mono" style={{ fontSize: 9 }}>EXERCICES</span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '20px 22px 100px' }}>
            {/* Completed */}
            <div style={exBlock}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ 01 · COMPLÉTÉ ✓</span>
              <div className="cst-display" style={{ fontSize: 18, marginTop: 4 }}>TRACTIONS PRONATION</div>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>4 × 6-10 · RPE 8 · REPOS 3:00</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 11, opacity: 0.7 }}>
                <span className="cst-mono">SÉRIES: 4/4 ✓</span>
                <span className="cst-mono">VOLUME: 280 KG</span>
                <span className="cst-mono">RPE MOY: 7.8</span>
              </div>
            </div>

            {/* Active */}
            <div style={{ ...exBlock, borderColor: 'var(--cst-mid-green)' }}>
              <div className="cst-col" style={{ gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ 02 · EN COURS</span>
                  <span className="cst-mono" style={{ fontSize: 9 }}>3/4 SÉRIES</span>
                </div>
                <span className="cst-display" style={{ fontSize: 22 }}>ROW BARRE</span>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.7 }}>OBJECTIF · 4 × 8 · RPE 8 · REPOS 2:00</span>
              </div>

              <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <div className="cst-col" style={{ gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 9 }}>DERNIÈRE FOIS · 7 JOURS</span>
                  <span className="cst-display" style={{ fontSize: 14 }}>57.5 KG × 8</span>
                </div>
                <div className="cst-col" style={{ gap: 2, alignItems: 'flex-end' }}>
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>COACH</span>
                  <span className="cst-italic" style={{ fontSize: 12 }}>«Tire avec le dos.»</span>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr>
                    {['SÉR','KG','REPS','RPE','✓'].map(h => (
                      <th key={h} style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', padding: '10px 0', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['1','60','8','8',true],['2','60','8','8',true],['3','60','7','9',true],['4','—','—','—',false]].map((r,i) => {
                    const isActive = i === 3;
                    return (
                      <tr key={i} style={{ background: isActive ? 'rgba(45,90,53,0.12)' : 'transparent', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 0', textAlign: 'center', fontFamily: 'var(--cst-mono)', fontSize: 11, color: 'var(--cst-text-muted)', fontWeight: 600 }}>{r[0]}</td>
                        {[1,2,3].map(idx => (
                          <td key={idx} style={{ padding: '8px 0', textAlign: 'center' }}>
                            {r[4] ? (
                              <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 13, fontWeight: 600 }}>{r[idx]}</span>
                            ) : isActive ? (
                              <input style={{ ...setInput, borderColor: 'var(--cst-mid-green)' }} placeholder={idx === 1 ? '60' : '8'} />
                            ) : (
                              <span style={{ opacity: 0.3 }}>—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '8px 0', textAlign: 'center' }}>
                          {r[4] ? (
                            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: 'var(--cst-mid-green)', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                          ) : (
                            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--cst-mid-green)' }} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button className="cst-btn cst-btn-secondary cst-btn-sm" style={{ color: '#6EAB76', borderColor: 'rgba(110,171,118,0.4)', flex: 1 }}>+ SÉRIE</button>
                <div style={{ flex: 1.4, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 100, background: 'rgba(45,90,53,0.18)', border: '1px solid var(--cst-mid-green)' }}>
                  <span style={{ color: 'var(--cst-mid-green)' }}>⏱</span>
                  <div className="cst-col" style={{ gap: 0, flex: 1 }}>
                    <span className="cst-mono" style={{ fontSize: 8 }}>REPOS</span>
                    <span className="cst-display" style={{ fontSize: 16, color: 'var(--cst-mid-green)' }}>1:42</span>
                  </div>
                  <span style={{ opacity: 0.7, fontSize: 14 }}>⏸</span>
                </div>
              </div>

              <div style={{ marginTop: 12, padding: 10, background: 'rgba(181,131,10,0.08)', border: '1px solid rgba(181,131,10,0.3)', borderRadius: 8, fontSize: 11, display: 'flex', gap: 10 }}>
                <span style={{ color: '#D4A53B' }}>!</span>
                <span style={{ flex: 1, opacity: 0.85 }}>RPE 9 sur la 3e série. Garde la même charge pour la 4 — n'augmente pas.</span>
              </div>
            </div>

            {/* Next */}
            <div style={{ opacity: 0.5 }}>
              <span className="cst-mono" style={{ fontSize: 9 }}>★ 03 · À VENIR</span>
              <div className="cst-display" style={{ fontSize: 18, marginTop: 4 }}>FACE PULL</div>
              <span className="cst-mono" style={{ fontSize: 9 }}>3 × 15 · RPE 7 · REPOS 1:00</span>
            </div>
          </div>

          {/* Bottom action */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 22px 22px', background: 'linear-gradient(180deg,rgba(27,46,31,0) 0%,rgba(27,46,31,0.95) 50%)', display: 'flex', gap: 8 }}>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">SAUTER</button>
            <button className="cst-btn cst-btn-primary" style={{ flex: 1 }}>VALIDER SÉRIE 03 →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
