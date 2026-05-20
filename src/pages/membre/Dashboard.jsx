import { useNavigate } from 'react-router-dom';
import MemberNav from '../../components/MemberNav';
import { CSTLogo, CSTSectionNum, CSTAvatar } from '../../components/Atoms';

export default function MemberDashboard() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: 390, height: 780, position: 'relative' }}>
        <div className="cst-screen cst-hatch" style={{ height: '100%' }}>
          {/* Top nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 22px 8px' }}>
            <CSTLogo size={11} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ position: 'relative', fontSize: 16 }}>
                🔔
                <span style={{ position: 'absolute', top: -2, right: -3, width: 6, height: 6, background: 'var(--cst-danger)', borderRadius: '50%' }} />
              </span>
              <CSTAvatar initials="JF" size={28} />
            </div>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            <div style={{ paddingTop: 14 }}>
              <CSTSectionNum num={1} label="MER. 20 MAI" sub="SEM 04 · J2 · FORCE" />
              <div style={{ marginTop: 14 }}>
                <h1 className="cst-display" style={{ fontSize: 38, margin: 0 }}>BON MATIN,</h1>
                <div className="cst-italic" style={{ fontSize: 30, marginTop: -2 }}>Jordan.</div>
              </div>
            </div>

            {/* Hero session */}
            <div className="cst-card-dark cst-hatch" style={{ marginTop: 18, padding: 20, borderColor: 'var(--cst-mid-green)', borderWidth: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="cst-col" style={{ gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ AUJOURD'HUI · 18:00</span>
                  <div className="cst-display" style={{ fontSize: 22, marginTop: 6 }}>PULL B</div>
                  <div className="cst-italic" style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>force · 07 exercices.</div>
                </div>
                <div className="cst-col" style={{ alignItems: 'flex-end', gap: 2 }}>
                  <span className="cst-mono" style={{ fontSize: 9 }}>≈ DURÉE</span>
                  <span className="cst-display" style={{ fontSize: 18 }}>55–65 MIN</span>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 0' }} />
              <div className="cst-col" style={{ gap: 8 }}>
                {[
                  ['TRACTIONS PRONATION','4 × 6-10','RPE 8'],
                  ['ROW BARRE','4 × 8','RPE 8'],
                  ['FACE PULL','3 × 15','RPE 7'],
                  ['CURL BARRE','3 × 10','RPE 7'],
                ].map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                    <span><span style={{ color: 'var(--cst-mid-green)', marginRight: 8 }}>★</span>{e[0]}</span>
                    <span className="cst-mono" style={{ fontSize: 10 }}>{e[1]} <span style={{ color: 'var(--cst-mid-green)' }}>@ {e[2]}</span></span>
                  </div>
                ))}
                <div style={{ fontSize: 11, opacity: 0.5, paddingLeft: 18 }}>· · ·  + 3 exercices</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="cst-btn cst-btn-primary" style={{ flex: 1 }} onClick={() => navigate('/membre/logger')}>COMMENCER →</button>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate('/membre/programme')}>VOIR →</button>
              </div>
            </div>

            {/* Week strip */}
            <div style={{ marginTop: 22 }}>
              <CSTSectionNum num={2} label="MA SEMAINE" sub="03 / 04 SÉANCES" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginTop: 12 }}>
                {[['LUN','PUSH A','done'],['MAR','REST','rest'],['MER','PULL B','today'],['JEU','REST','rest'],['VEN','LEGS C','coming'],['SAM','CARDIO','coming'],['DIM','REST','rest']].map(([d,l,s],i) => {
                  const today = s === 'today', done = s === 'done', rest = s === 'rest';
                  return (
                    <div key={i} style={{ padding: '10px 4px', textAlign: 'center', borderRadius: 8, background: today ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.03)', border: today ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="cst-mono" style={{ fontSize: 8, color: today ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)' }}>{d}</div>
                      <div style={{ marginTop: 6, fontSize: 14, color: today ? '#fff' : done ? 'var(--cst-mid-green)' : rest ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)' }}>
                        {done ? '✓' : today ? '●' : rest ? '·' : '○'}
                      </div>
                      <div className="cst-mono" style={{ fontSize: 7, marginTop: 4, color: today ? 'rgba(255,255,255,0.7)' : rest ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)' }}>{l}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="cst-card-dark" style={{ padding: 14 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>ADHÉRENCE · SEMAINE</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                  <span className="cst-display" style={{ fontSize: 28 }}>3<span style={{ opacity: 0.4 }}>/4</span></span>
                  <span className="cst-mono" style={{ fontSize: 10, color: 'var(--cst-mid-green)' }}>75%</span>
                </div>
              </div>
              <div className="cst-card-dark" style={{ padding: 14 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>DERNIER PR</span>
                <div className="cst-display" style={{ fontSize: 18, marginTop: 6 }}>SQUAT 90KG</div>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>IL Y A 3 JOURS</span>
              </div>
            </div>

            {/* Coach message */}
            <div style={{ marginTop: 18, padding: 14, background: 'rgba(45,90,53,0.10)', border: '1px solid rgba(45,90,53,0.3)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <CSTAvatar initials="LC" size={28} />
                <div className="cst-col">
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Léo Colognesi</span>
                  <span className="cst-mono" style={{ fontSize: 8 }}>HIER · 21:14 · ÉPINGLÉ ★</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, opacity: 0.85 }}>
                « Belle séance Push hier. Sur PULL B aujourd'hui, focus sur la <span className="cst-italic">contraction haute</span> des tractions. Pas besoin d'aller à l'échec — RPE 8 max. »
              </p>
            </div>
          </div>

          <MemberNav />
        </div>
      </div>
    </div>
  );
}
