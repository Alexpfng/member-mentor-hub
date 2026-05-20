import { useNavigate } from 'react-router-dom';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTAvatar, CSTStatus, CSTBandWords, CSTDot } from '../../components/Atoms';

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle = {
  fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: 'var(--cst-text-muted)', textAlign: 'left', padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600,
};
const tdStyle = { padding: '14px 16px', color: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const metricCard = {
  background: '#243029', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
  padding: '22px 22px', display: 'flex', flexDirection: 'column', gap: 6,
  position: 'relative', overflow: 'hidden',
};

const membres = [
  { init:'JF', name:'Jordan F.',  dot:'#3A6B42', prog:'Force Fondamentale · S04', last:'Hier · PUSH A · RPE 8.1', adh:94, next:"Aujourd'hui · PULL B" },
  { init:'MR', name:'Marie R.',   dot:'#3A6B42', prog:'Hypertrophie · S06',       last:"Aujourd'hui · LEGS C",    adh:88, next:'Vendredi · UPPER A' },
  { init:'PB', name:'Paul B.',    dot:'#B5830A', prog:'Beginner Strength · S02',  last:'4 jours · FULL BODY',      adh:62, next:"Aujourd'hui · PULL B" },
  { init:'SC', name:'Sophie C.',  dot:'#8B2318', prog:'Marathon Vichy · S08',     last:'6 jours · LONG RUN',       adh:41, next:'Samedi · TEMPO 8K' },
  { init:'AM', name:'Antoine M.', dot:'#3A6B42', prog:'Force Fondamentale · S03', last:'Hier · LEGS C · RPE 9.2',  adh:91, next:'Demain · REST' },
  { init:'ER', name:'Émilie R.',  dot:'#3A6B42', prog:'Mobility Reset · S02',     last:'2 jours · MOB FLOW',       adh:77, next:'Demain · UPPER B' },
];

export default function CoachDashboard() {
  const navigate = useNavigate();
  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <CSTSectionNum num={1} label="TABLEAU DE BORD" sub="MAI 2026" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cst-mono">MER. 20 MAI · 09:51</span>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate('/coach/import')}>IMPORTER EXCEL ▲</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate('/coach/builder')}>NOUVEAU PROGRAMME →</button>
          </div>
        </div>

        {/* Welcome */}
        <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
          <CSTDuoTitle top="BONJOUR, LÉO." bottom="12 athlètes en mouvement." size={42} />
          <CSTBandWords items={['LIBERTÉ', 'MOUVEMENT', 'NATURE', 'PROGRESSION']} />
        </div>

        {/* Metrics */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            ['12', 'MEMBRES ACTIFS',      '+2 ce mois',           'up'],
            ['03', "SÉANCES AUJOURD'HUI", '1 complétée · 2 à faire', null],
            ['87%','TAUX D\'ADHÉRENCE',   '30 jours · vs. 82% avr.','up'],
            ['05', 'MESSAGES NON LUS',    '2 importants',           'warn'],
          ].map(([n, l, sub, kind], i) => (
            <div key={i} className="cst-hatch" style={metricCard}>
              <span className="cst-mono" style={{ fontSize: 9 }}>★ {String(i+1).padStart(2,'0')}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--cst-display)', fontWeight: 800, fontSize: 64, lineHeight: 0.9 }}>{n}</span>
                {kind === 'up'   && <span className="cst-tag cst-tag-success" style={{ fontSize: 9 }}>▲</span>}
                {kind === 'warn' && <span className="cst-tag cst-tag-warn" style={{ fontSize: 9 }}>!</span>}
              </div>
              <span className="cst-mono" style={{ fontSize: 9, letterSpacing: '0.22em' }}>{l}</span>
              <span style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Sessions today */}
        <div style={{ padding: '8px 32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <CSTSectionNum num={2} label="SÉANCES" sub="AUJOURD'HUI" />
            <span className="cst-mono" style={{ cursor: 'pointer' }}>VOIR TOUT →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { i:'JF', n:'Jordan F.',  s:'PUSH A',   w:'SEM 04 · J2', k:'done',   t:'07:42 · 58 MIN',  rpe:'RPE 8.1' },
              { i:'MR', n:'Marie R.',   s:'LEGS C',   w:'SEM 06 · J4', k:'active', t:'EN COURS · 32 MIN',rpe:'RPE 7.6' },
              { i:'PB', n:'Paul B.',    s:'PULL B',   w:'SEM 02 · J2', k:'todo',   t:'18:00 ATTENDU',   rpe:'—' },
              { i:'SC', n:'Sophie C.',  s:'CARDIO Z2',w:'SEM 08 · J5', k:'skip',   t:'PAS DE LOG · 24H',rpe:'—' },
            ].map((m, i) => (
              <div key={i} className="cst-hatch" style={{ ...metricCard, padding: 18, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CSTAvatar initials={m.i} size={32} />
                    <div className="cst-col">
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.n}</span>
                      <span className="cst-mono" style={{ fontSize: 9 }}>{m.w}</span>
                    </div>
                  </div>
                  <CSTStatus kind={m.k} />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="cst-display" style={{ fontSize: 18 }}>{m.s}</span>
                  <span className="cst-mono" style={{ fontSize: 9, color: m.k === 'done' ? 'var(--cst-mid-green)' : 'inherit' }}>{m.rpe}</span>
                </div>
                <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>{m.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Members table */}
        <div style={{ padding: '32px 32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <CSTSectionNum num={3} label="MES ADHÉRENTS" sub="12 ACTIFS" />
          </div>
          <div className="cst-card-dark" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 220 }}>MEMBRE</th>
                  <th style={thStyle}>PROGRAMME</th>
                  <th style={thStyle}>DERNIÈRE SÉANCE</th>
                  <th style={thStyle}>ADHÉRENCE 30J</th>
                  <th style={thStyle}>PROCHAINE</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {membres.map((r, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CSTDot color={r.dot} />
                        <CSTAvatar initials={r.init} size={28} />
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{r.prog}</td>
                    <td style={{ ...tdStyle, opacity: 0.7 }}>{r.last}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${r.adh}%`, height: '100%', background: r.adh > 80 ? 'var(--cst-success)' : r.adh > 60 ? 'var(--cst-warning)' : 'var(--cst-danger)' }} />
                        </div>
                        <span className="cst-mono" style={{ fontSize: 11 }}>{r.adh}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, opacity: 0.7 }}>{r.next}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ marginRight: 6 }} onClick={() => navigate('/coach/membre')}>VOIR</button>
                      <button className="cst-btn cst-btn-secondary cst-btn-sm" style={{ color: '#6EAB76', borderColor: 'rgba(110,171,118,0.4)' }}>ENVOYER →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feed + Alertes */}
        <div style={{ padding: '32px 32px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <CSTSectionNum num={4} label="RETOURS RÉCENTS" sub="MEMBRES" />
            <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
              {[
                ['JF','Jordan F.','il y a 2h','« Séance Squat complétée – RPE 9/10, difficile mais ok. »','PUSH A · SEM 04'],
                ['AM','Antoine M.','il y a 4h',"« Léo j'ai fait +5kg sur le développé sans pb. On peut pousser ? »",'PR · DÉVELOPPÉ 87,5 KG'],
                ['ER','Émilie R.','hier · 21:14','« Mobilité épaule beaucoup mieux. Je sens la différence. »','MOB FLOW · SEM 02'],
              ].map((f, i) => (
                <div key={i} className="cst-card-dark cst-hatch" style={{ padding: 16, display: 'flex', gap: 14 }}>
                  <CSTAvatar initials={f[0]} size={36} />
                  <div className="cst-col" style={{ flex: 1, gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{f[1]}</span>
                        <span className="cst-mono" style={{ fontSize: 9 }}>{f[2]}</span>
                      </div>
                      <span className="cst-tag" style={{ fontSize: 9 }}>{f[4]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, opacity: 0.8 }}>{f[3]}</p>
                    <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', cursor: 'pointer' }}>VOIR LA SÉANCE →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <CSTSectionNum num={5} label="ALERTES" sub="À TRAITER" />
            <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
              <div className="cst-card-dark" style={{ padding: 16, borderColor: 'rgba(139,35,24,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CSTDot color="#C56A60" />
                  <span className="cst-mono" style={{ fontSize: 9, color: '#C56A60' }}>ABSENCE PROLONGÉE</span>
                </div>
                <div className="cst-display" style={{ fontSize: 15 }}>SOPHIE C.</div>
                <p style={{ margin: '6px 0 10px', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>3 séances sautées · adhérence tombée à 41%.</p>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ width: '100%' }}>ENVOYER UN MESSAGE →</button>
              </div>
              <div className="cst-card-dark" style={{ padding: 16, borderColor: 'rgba(181,131,10,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CSTDot color="#D4A53B" />
                  <span className="cst-mono" style={{ fontSize: 9, color: '#D4A53B' }}>RPE ÉLEVÉ · 3 SÉANCES</span>
                </div>
                <div className="cst-display" style={{ fontSize: 15 }}>ANTOINE M.</div>
                <p style={{ margin: '6px 0 10px', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>Moyenne RPE 9.1. Envisager un déload ?</p>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ width: '100%' }}>ADAPTER LA SEMAINE →</button>
              </div>
              <div className="cst-card-dark cst-hatch" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CSTDot color="var(--cst-mid-green)" />
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>NOUVEAU PR</span>
                </div>
                <div className="cst-display" style={{ fontSize: 15 }}>JORDAN F. · SQUAT 102.5KG</div>
                <p style={{ margin: '6px 0', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>+5kg sur le 1RM. À célébrer.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
