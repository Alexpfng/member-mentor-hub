import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTAvatar, CSTStatus } from '../../components/Atoms';

export default function CoachMember() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = ['Programme actuel', 'Historique', 'Progression', 'Profil', 'Messages'];

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Breadcrumb */}
        <div style={{ padding: '20px 32px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cst-mono" style={{ color: '#fff', cursor: 'pointer' }} onClick={() => navigate('/coach')}>MEMBRES</span>
          <span className="cst-mono">/</span>
          <span className="cst-mono" style={{ color: 'var(--cst-mid-green)' }}>JORDAN F.</span>
        </div>

        {/* Hero */}
        <div className="cst-hatch" style={{ padding: '28px 32px 32px', background: 'linear-gradient(180deg,#1F2D24 0%,#1B2E1F 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 110, height: 110, borderRadius: 8, background: 'linear-gradient(135deg,#3A6B42,#1B2E1F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--cst-display)', fontSize: 42, fontWeight: 800, border: '1px solid rgba(255,255,255,0.08)' }}>JF</div>
            <div className="cst-col" style={{ gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="cst-tag cst-tag-success">MEMBRE · ACTIF</span>
                <span className="cst-mono">DEPUIS LE 12 MARS 2026</span>
              </div>
              <h1 className="cst-display" style={{ fontSize: 56, margin: 0 }}>JORDAN FERRER.</h1>
              <div className="cst-italic" style={{ fontSize: 22, color: 'rgba(255,255,255,0.65)', marginTop: -4 }}>Force, sentier, voyage.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className="cst-btn cst-btn-primary cst-btn-sm">MESSAGE →</button>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">ADAPTER LA SEMAINE</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0, marginTop: 26, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
            {[['OBJECTIF','FORCE'],['POIDS','76 KG'],['NIVEAU','INTERMÉDIAIRE'],['ANCIENNETÉ','69 JOURS'],['SÉANCES','28 TOTAL']].map(([k,v],i) => (
              <div key={k} className="cst-col" style={{ gap: 4, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: i > 0 ? 20 : 0 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                <span className="cst-display" style={{ fontSize: 22 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 32px', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map((t, i) => (
            <div key={t} onClick={() => setActiveTab(i)} style={{
              padding: '16px 20px', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: activeTab === i ? 700 : 500,
              color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)',
              borderBottom: activeTab === i ? '2px solid var(--cst-mid-green)' : '2px solid transparent',
              fontFamily: 'var(--cst-ui)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', opacity: activeTab === i ? 1 : 0.4 }}>{String(i+1).padStart(2,'0')}</span>
              {t}
              {t === 'Messages' && <span style={{ background: 'var(--cst-mid-green)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontFamily: 'var(--cst-mono)' }}>2</span>}
            </div>
          ))}
        </div>

        {/* Programme tab content */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <CSTSectionNum num={1} label="PROGRAMME ACTUEL" sub="FORCE FONDAMENTALE" />
                <h2 className="cst-display" style={{ fontSize: 32, margin: '8px 0 4px' }}>SEMAINE 04 / 08</h2>
                <span className="cst-mono">CHARGE +10% · DÉLOAD W06</span>
              </div>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate('/coach/builder')}>CHANGER →</button>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: '50%', height: '100%', background: 'var(--cst-mid-green)' }} />
            </div>
            <div className="cst-col" style={{ gap: 10 }}>
              {[
                { d:'LUN 18/05', l:'PUSH A',    s:'done',   sub:'7 exercices · 55 min · RPE 7.8', last:'DERNIÈRE · Développé 80kg × 7' },
                { d:'MER 20/05', l:'PULL B',    s:'active', sub:'À FAIRE · attendu 18:00',         last:'EN ATTENTE' },
                { d:'JEU 21/05', l:'REST',      s:'rest',   sub:'Récupération active · 30 min',    last:'—' },
                { d:'VEN 22/05', l:'LEGS C',    s:'coming', sub:'6 exercices · ~70 min',            last:'PR · SQUAT 102.5KG' },
                { d:'SAM 23/05', l:'CARDIO Z2', s:'coming', sub:'45 min · zone 2',                  last:'—' },
              ].map((d, i) => (
                <div key={i} className="cst-card-dark cst-hatch" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div className="cst-mono" style={{ width: 72, fontSize: 10 }}>{d.d}</div>
                  <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                    <span className="cst-display" style={{ fontSize: 18 }}>{d.l}</span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>{d.sub}</span>
                  </div>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>{d.last}</span>
                  <CSTStatus kind={d.s} />
                </div>
              ))}
            </div>
          </div>

          <div className="cst-col" style={{ gap: 20 }}>
            <div>
              <CSTSectionNum num={2} label="TENDANCES" sub="EXERCICES CLÉS" />
              <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                {[
                  ['DÉVELOPPÉ COUCHÉ', '+ 7.5 KG', '80 → 87.5', 'up'],
                  ['SQUAT BARRE',      '+ 12.5 KG','90 → 102.5','up'],
                  ['TRACTIONS',        '+ 3 REPS', '7 → 10',    'up'],
                  ['OVERHEAD PRESS',   '+ 0 KG',   '60 → 60',   'flat'],
                ].map((e, i) => (
                  <div key={i} className="cst-card-dark" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="cst-col" style={{ gap: 2 }}>
                      <span className="cst-display" style={{ fontSize: 14 }}>{e[0]}</span>
                      <span className="cst-mono" style={{ fontSize: 10 }}>{e[2]} · 4 SEM</span>
                    </div>
                    <span className="cst-display" style={{ fontSize: 18, color: e[3] === 'up' ? 'var(--cst-success)' : '#fff' }}>{e[1]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cst-card-dark cst-hatch" style={{ padding: 18 }}>
              <CSTSectionNum num={3} label="NOTE PRIVÉE" sub="NON VISIBLE PAR LE MEMBRE" />
              <textarea className="cst-input" rows="5" style={{ marginTop: 12, resize: 'none', fontFamily: 'var(--cst-ui)', fontSize: 12 }}
                defaultValue="J. progresse vite — corps répond bien sur le compound. Garder l'œil sur l'épaule (tendinite légère mentionnée à l'onboarding). Pousser sur le squat. Faire un déload W06 ferme." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
