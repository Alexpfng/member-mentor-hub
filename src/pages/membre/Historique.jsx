import MemberNav from '../../components/MemberNav';
import { CSTSectionNum, CSTDuoTitle } from '../../components/Atoms';

const months = [
  { m: 'MAI 2026', entries: [
    { d:'20', day:'MER', s:'PULL B',    sub:'8 ex · 62 min · RPE 8.2', note:'« Bonne séance, tractions+++ »', coach:null,   sem:'SEM 04 · J2' },
    { d:'18', day:'LUN', s:'PUSH A',    sub:'7 ex · 55 min · RPE 7.8', note:null, coach:'« Bien ! Augmente 2.5kg la semaine prochaine. »', sem:'SEM 04 · J1' },
    { d:'15', day:'VEN', s:'LEGS C',    sub:'6 ex · 70 min · RPE 9.1', note:'« Squat dur, bonne douleur. »', coach:null, sem:'SEM 03 · J4', pr:'PR · SQUAT 95KG' },
    { d:'13', day:'MER', s:'PULL B',    sub:'8 ex · 60 min · RPE 8.0', note:null, coach:null, sem:'SEM 03 · J2' },
    { d:'11', day:'LUN', s:'PUSH A',    sub:'7 ex · 56 min · RPE 8.1', note:null, coach:null, sem:'SEM 03 · J1' },
  ]},
  { m: 'AVRIL 2026', entries: [
    { d:'28', day:'LUN', s:'PUSH A',    sub:'7 ex · 58 min · RPE 7.5', note:null, coach:null, sem:'SEM 02 · J1' },
    { d:'26', day:'SAM', s:'CARDIO Z2', sub:'45 min · HR 138 avg',      note:null, coach:null, sem:'SEM 01 · J5' },
  ]},
];

export default function Historique() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ width: 390, height: 780, position: 'relative' }}>
        <div className="cst-screen" style={{ height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 8px' }}>
            <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
            <span className="cst-mono" style={{ color: '#fff' }}>HISTORIQUE</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>⌕</span>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '0 22px 90px' }}>
            <CSTSectionNum num={1} label="MON HISTORIQUE" sub="28 SÉANCES" />
            <CSTDuoTitle top="DERRIÈRE" bottom="moi." size={36} />

            <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 18, flexWrap: 'wrap' }}>
              {[['Tout',true],['Ce mois',false],['3 mois',false],['6 mois',false]].map(([t,on]) => (
                <span key={t} className={on ? 'cst-tag' : 'cst-tag cst-tag-dark'} style={{ padding: '6px 12px', cursor: 'pointer' }}>{t}</span>
              ))}
            </div>

            {months.map((mo, mi) => (
              <div key={mi} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span className="cst-display" style={{ fontSize: 14, letterSpacing: '0.1em' }}>{mo.m}</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <div className="cst-col" style={{ gap: 8 }}>
                  {mo.entries.map((e, ei) => (
                    <div key={ei} style={{ display: 'flex', gap: 12 }}>
                      <div className="cst-col" style={{ alignItems: 'center', width: 38, flexShrink: 0, paddingTop: 4 }}>
                        <span className="cst-display" style={{ fontSize: 18 }}>{e.d}</span>
                        <span className="cst-mono" style={{ fontSize: 8 }}>{e.day}</span>
                      </div>
                      <div className="cst-card-dark cst-hatch" style={{ flex: 1, padding: 14, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div className="cst-col" style={{ gap: 2, flex: 1 }}>
                            <span className="cst-display" style={{ fontSize: 16 }}>{e.s}</span>
                            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>{e.sub}</span>
                          </div>
                          <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>✓</span>
                        </div>
                        {e.pr && (
                          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(45,90,53,0.15)', borderRadius: 4, display: 'inline-block' }}>
                            <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ {e.pr}</span>
                          </div>
                        )}
                        {e.note && (
                          <div style={{ marginTop: 10, paddingLeft: 10, borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: 11, opacity: 0.7, fontStyle: 'italic' }}>{e.note}</span>
                          </div>
                        )}
                        {e.coach && (
                          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(45,90,53,0.12)', borderRadius: 6 }}>
                            <span className="cst-mono" style={{ fontSize: 8, color: 'var(--cst-mid-green)' }}>NOTE COACH</span>
                            <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.85 }}>{e.coach}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <MemberNav />
        </div>
      </div>
    </div>
  );
}
