import MemberNav from '../../components/MemberNav';
import { CSTSectionNum, CSTDuoTitle, CSTStatus } from '../../components/Atoms';

const weeks = [
  { n:'01', t:'INTRODUCTION',  s:'done',   open:false },
  { n:'02', t:'CHARGE +5%',   s:'done',   open:false },
  { n:'03', t:'CHARGE +5%',   s:'done',   open:false },
  { n:'04', t:'CHARGE +5%',   s:'active', open:true  },
  { n:'05', t:'CHARGE +5%',   s:'coming', open:false },
  { n:'06', t:'DÉLOAD -40%',  s:'coming', open:false },
  { n:'07', t:'PEAK',         s:'coming', open:false },
  { n:'08', t:'TEST 1RM',     s:'coming', open:false },
];

export default function MemberProgramme() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: 390, height: 780, position: 'relative' }}>
        <div className="cst-screen cst-hatch" style={{ height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 8px' }}>
            <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
            <span className="cst-mono" style={{ color: '#fff' }}>MON PROGRAMME</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>◯</span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            <CSTSectionNum num={1} label="PROGRAMME" sub="FORCE FONDAMENTALE" />
            <CSTDuoTitle top="FORCE" bottom="fondamentale." size={36} />
            <div className="cst-mono" style={{ fontSize: 9, marginTop: 8 }}>8 SEMAINES · DÉMARRÉ LE 12 MAI 2026</div>

            <div style={{ marginTop: 18, marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span className="cst-mono" style={{ color: '#fff' }}>SEMAINE 04 / 08</span>
                <span className="cst-display" style={{ fontSize: 16, color: 'var(--cst-mid-green)' }}>50%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '50%', height: '100%', background: 'var(--cst-mid-green)' }} />
              </div>
            </div>

            <div className="cst-col" style={{ gap: 8 }}>
              {weeks.map((w, i) => (
                <div key={i} className="cst-card-dark" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: w.open ? 'rgba(45,90,53,0.10)' : 'transparent', borderBottom: w.open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={{ opacity: 0.5 }}>{w.open ? '▼' : '▶'}</span>
                    <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                      <span className="cst-mono" style={{ fontSize: 9 }}>SEMAINE {w.n}</span>
                      <span className="cst-display" style={{ fontSize: 15 }}>{w.t}</span>
                    </div>
                    <CSTStatus kind={w.s} />
                  </div>
                  {w.open && (
                    <div className="cst-col" style={{ padding: '6px 16px 14px', gap: 0 }}>
                      {[
                        ['J1 · PUSH A',       '✓ Complété il y a 2j',  'done'],
                        ["J2 · PULL B",       "● Aujourd'hui",          'active'],
                        ['J3 · REST',         '—',                       'rest'],
                        ['J4 · LEGS C',       'Vendredi 22/05',          'coming'],
                        ['J5 · REST + CARDIO','Samedi 23/05',            'coming'],
                      ].map((d, di) => (
                        <div key={di} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 12, borderBottom: di < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none', color: d[2] === 'active' ? '#fff' : d[2] === 'rest' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.75)' }}>
                          <span style={{ fontWeight: d[2] === 'active' ? 600 : 400 }}>{d[0]}</span>
                          <span className="cst-mono" style={{ fontSize: 9, color: d[2] === 'active' ? 'var(--cst-mid-green)' : 'inherit' }}>{d[1]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
