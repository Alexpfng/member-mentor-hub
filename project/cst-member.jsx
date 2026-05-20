// Member screens — Dashboard, Programme view, Session Logger, History, Progression
// Mobile artboards (390 wide)

const memStyles = {
  topNav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px 8px',
  },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(22,38,26,0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    padding: '12px 12px 22px',
  },
  navItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    fontFamily: 'var(--cst-mono)', fontSize: 8, letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
  },
  contentScroll: {
    flex: 1, overflowY: 'auto', padding: '0 22px 90px',
  },
};

function CSTMemberNav({ active = 'home' }) {
  const items = [
    ['home','◧','HOME'],
    ['prog','▤','PROGRAMME'],
    ['hist','◯','HISTORIQUE'],
    ['prog2','▲','PROGRÈS'],
    ['profile','◉','PROFIL'],
  ];
  return (
    <div style={memStyles.bottomNav}>
      {items.map(([id, icon, label]) => {
        const on = id === active;
        return (
          <div key={id} style={{ ...memStyles.navItem, color: on ? '#fff' : memStyles.navItem.color }}>
            <span style={{ fontSize: 16, color: on ? 'var(--cst-mid-green)' : 'inherit' }}>{icon}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CSTMemberDashboard() {
  return (
    <div className="cst-screen cst-hatch">
      <div style={{ ...memStyles.topNav, paddingTop: 22 }}>
        <CSTLogo size={11} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ position: 'relative', fontSize: 16 }}>◌<span style={{ position: 'absolute', top: -2, right: -3, width: 6, height: 6, background: 'var(--cst-danger)', borderRadius: '50%' }} /></span>
          <CSTAvatar initials="JF" size={28} />
        </div>
      </div>

      <div style={memStyles.contentScroll} className="cst-scroll">
        <div style={{ paddingTop: 14 }}>
          <CSTSectionNum num={1} label="MER. 20 MAI" sub="SEM 04 · J2 · FORCE" />
          <div style={{ marginTop: 14 }}>
            <h1 className="cst-display" style={{ fontSize: 38, margin: 0 }}>BON MATIN,</h1>
            <div className="cst-italic" style={{ fontSize: 30, marginTop: -2 }}>Jordan.</div>
          </div>
        </div>

        {/* HERO session */}
        <div className="cst-card-dark cst-hatch" style={{ marginTop: 18, padding: 20, borderColor: 'var(--cst-mid-green)', borderWidth: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="cst-col" style={{ gap: 2 }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>● AUJOURD'HUI · 18:00</span>
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
              ['TRACTIONS PRONATION', '4 × 6-10', 'RPE 8'],
              ['ROW BARRE',            '4 × 8',    'RPE 8'],
              ['FACE PULL',            '3 × 15',   'RPE 7'],
              ['CURL BARRE',           '3 × 10',   'RPE 7'],
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}><span style={{ color: 'var(--cst-mid-green)', marginRight: 8 }}>●</span>{e[0]}</span>
                <span className="cst-mono" style={{ fontSize: 10 }}>{e[1]} <span style={{ color: 'var(--cst-mid-green)' }}>@ {e[2]}</span></span>
              </div>
            ))}
            <div style={{ fontSize: 11, opacity: 0.5, paddingLeft: 18 }}>· · ·  + 3 exercices</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="cst-btn cst-btn-primary" style={{ flex: 1 }}>COMMENCER ●</button>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">VOIR →</button>
          </div>
        </div>

        {/* Week strip */}
        <div style={{ marginTop: 22 }}>
          <CSTSectionNum num={2} label="MA SEMAINE" sub="03 / 04 SÉANCES" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
            {[
              ['LUN','PUSH A','done'],
              ['MAR','REST','rest'],
              ['MER','PULL B','today'],
              ['JEU','REST','rest'],
              ['VEN','LEGS C','coming'],
              ['SAM','CARDIO','coming'],
              ['DIM','REST','rest'],
            ].map(([d,l,s], i) => {
              const today = s === 'today';
              const done = s === 'done';
              const rest = s === 'rest';
              return (
                <div key={i} style={{
                  padding: '10px 4px',
                  textAlign: 'center',
                  borderRadius: 8,
                  background: today ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.03)',
                  border: today ? 'none' : `1px solid rgba(255,255,255,0.06)`,
                }}>
                  <div className="cst-mono" style={{ fontSize: 8, color: today ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)' }}>{d}</div>
                  <div style={{ marginTop: 6, fontSize: 14, color: today ? '#fff' : done ? 'var(--cst-mid-green)' : rest ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)' }}>
                    {done ? '✓' : today ? '→' : rest ? '·' : '○'}
                  </div>
                  <div className="cst-mono" style={{ fontSize: 7, marginTop: 4, color: today ? 'rgba(255,255,255,0.7)' : rest ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)' }}>{l}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two metric cards */}
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
            <div className="cst-col" style={{ gap: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Léo Colognesi</span>
              <span className="cst-mono" style={{ fontSize: 8 }}>HIER · 21:14 · ÉPINGLÉ ★</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, opacity: 0.85 }}>
            « Belle séance Push hier. Sur PULL B aujourd'hui, focus sur la <span className="cst-italic">contraction haute</span> des tractions. Pas besoin d'aller à l'échec — RPE 8 max. »
          </p>
        </div>
      </div>

      <CSTMemberNav active="home" />
    </div>
  );
}

function CSTMemberProgramme() {
  return (
    <div className="cst-screen cst-hatch">
      <div style={memStyles.topNav}>
        <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
        <span className="cst-mono" style={{ color: '#fff' }}>MON PROGRAMME</span>
        <span style={{ fontSize: 18, opacity: 0.7 }}>⋯</span>
      </div>

      <div style={memStyles.contentScroll} className="cst-scroll">
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
          {[
            { n: '01', t: 'INTRODUCTION', s: 'done', open: false },
            { n: '02', t: 'CHARGE +5%',   s: 'done', open: false },
            { n: '03', t: 'CHARGE +5%',   s: 'done', open: false },
            { n: '04', t: 'CHARGE +5%',   s: 'active', open: true },
            { n: '05', t: 'CHARGE +5%',   s: 'coming', open: false },
            { n: '06', t: 'DÉLOAD -40%',  s: 'coming', open: false },
            { n: '07', t: 'PEAK',         s: 'coming', open: false },
            { n: '08', t: 'TEST 1RM',     s: 'coming', open: false },
          ].map((w, i) => (
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
                    ['J1 · PUSH A',     '✓ Complété il y a 2j', 'done'],
                    ['J2 · PULL B',     '→ Aujourd\'hui',         'active'],
                    ['J3 · REST',       '—',                       'rest'],
                    ['J4 · LEGS C',     'Vendredi 22/05',          'coming'],
                    ['J5 · REST + CARDIO','Samedi 23/05',          'coming'],
                  ].map((d, di) => (
                    <div key={di} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', fontSize: 12,
                      borderBottom: di < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      color: d[2] === 'active' ? '#fff' : d[2] === 'rest' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.75)',
                    }}>
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

      <CSTMemberNav active="prog" />
    </div>
  );
}

Object.assign(window, { CSTMemberDashboard, CSTMemberProgramme, CSTMemberNav });
