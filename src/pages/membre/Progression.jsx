import MemberNav from '../../components/MemberNav';
import { CSTSectionNum, CSTDuoTitle } from '../../components/Atoms';

const points = [10,22,18,35,42,38,55,60,70,75,88,95,102];
const W = 320, H = 140, MAX = 110, PAD = 8;
const pts = points.map((v, i) => ({
  x: PAD + (i / (points.length - 1)) * (W - PAD * 2),
  y: H - PAD - (v / MAX) * (H - PAD * 2),
}));
const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
const area = `M${pts[0].x},${H - PAD} ${line} L${pts[pts.length-1].x},${H - PAD} Z`;

export default function Progression() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: 390, height: 780, position: 'relative' }}>
        <div className="cst-screen" style={{ height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 8px' }}>
            <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
            <span className="cst-mono" style={{ color: '#fff' }}>PROGRESSION</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>⌕</span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            <CSTSectionNum num={1} label="MA PROGRESSION" sub="69 JOURS" />
            <CSTDuoTitle top="DEVANT" bottom="moi." size={36} />

            {/* Exercise selector */}
            <div style={{ marginTop: 18, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>EXERCICE</span>
                <span className="cst-display" style={{ fontSize: 18 }}>SQUAT BARRE</span>
              </div>
              <span style={{ opacity: 0.5 }}>▾</span>
            </div>

            {/* Chart */}
            <div className="cst-card-dark cst-hatch" style={{ marginTop: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div className="cst-col">
                  <span className="cst-mono" style={{ fontSize: 9 }}>1RM ESTIMÉ · KG</span>
                  <span className="cst-display" style={{ fontSize: 36 }}>102.5</span>
                </div>
                <div className="cst-col" style={{ alignItems: 'flex-end' }}>
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>▲ + 12.5 KG</span>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>4 SEMAINES</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="prog-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3A6B42" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#3A6B42" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0,0.33,0.66,1].map((p,i) => <line key={i} x1={PAD} x2={W-PAD} y1={PAD + p*(H-PAD*2)} y2={PAD + p*(H-PAD*2)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />)}
                <path d={area} fill="url(#prog-fill)" />
                <path d={line} stroke="#3A6B42" strokeWidth="2" fill="none" />
                {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length-1 ? 4 : 2} fill={i === pts.length-1 ? '#fff' : '#3A6B42'} stroke={i === pts.length-1 ? '#3A6B42' : 'none'} strokeWidth="2" />)}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                {['12 MAR','01 AVR','22 AVR','12 MAI'].map(d => <span key={d} className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>{d}</span>)}
              </div>
            </div>

            {/* PRs */}
            <div style={{ marginTop: 24 }}>
              <CSTSectionNum num={2} label="RECORDS PERSONNELS" sub="04 PR" />
              <div className="cst-col" style={{ gap: 8, marginTop: 12 }}>
                {[
                  ['SQUAT BARRE',      102.5, 110, '12 MAI'],
                  ['DÉVELOPPÉ COUCHÉ', 87.5,  100, '08 MAI'],
                  ['TRACTIONS LESTÉES',null,  null,'03 MAI', '+15 KG'],
                  ['OVERHEAD PRESS',   62.5,   80, '28 AVR'],
                ].map((p, i) => {
                  const pct = p[2] ? (p[1] / p[2]) * 100 : 70;
                  const val = p[4] || (typeof p[1] === 'number' ? `${p[1]} KG` : '—');
                  return (
                    <div key={i} className="cst-card-dark" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{p[0]}</span>
                        <span className="cst-display" style={{ fontSize: 16, color: 'var(--cst-mid-green)' }}>{val}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cst-mid-green)' }} />
                        </div>
                        <span className="cst-mono" style={{ fontSize: 9 }}>{p[3]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 24 }}>
              <CSTSectionNum num={3} label="STATS GLOBALES" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {[['SÉANCES TOTALES','28'],['VOLUME · TONNES','186.4'],['EXERCICES LOGUÉS','312'],['ADHÉRENCE','89%'],['SÉRIE EN COURS','38 SEM'],['MEMBRE DEPUIS','69 J']].map(([k,v]) => (
                  <div key={k} className="cst-card-dark" style={{ padding: 12 }}>
                    <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                    <div className="cst-display" style={{ fontSize: 22, marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
