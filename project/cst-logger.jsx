// Member: Session Logger (in progress) + History + Progression

const logStyles = {
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  exBlock: {
    paddingBottom: 22, marginBottom: 22,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  setsTable: {
    width: '100%', borderCollapse: 'collapse', marginTop: 8,
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden',
  },
  setsTh: {
    fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: 'var(--cst-text-muted)',
    padding: '10px 0', textAlign: 'center', fontWeight: 600,
    background: 'rgba(0,0,0,0.2)',
  },
  setsTd: {
    padding: '8px 0', textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  setInput: {
    width: 48, padding: '6px 4px', textAlign: 'center',
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 13,
    fontWeight: 600,
  },
};

function CSTSessionLogger() {
  return (
    <div className="cst-screen">
      <div style={logStyles.topBar}>
        <span style={{ fontSize: 20, opacity: 0.7 }}>←</span>
        <div className="cst-col" style={{ alignItems: 'center', gap: 0 }}>
          <span className="cst-mono" style={{ fontSize: 9 }}>EN COURS · SEM 04 · J2</span>
          <span className="cst-display" style={{ fontSize: 16 }}>PULL B</span>
        </div>
        <div className="cst-col" style={{ alignItems: 'flex-end', gap: 0 }}>
          <span className="cst-mono" style={{ fontSize: 8 }}>TIMER</span>
          <span className="cst-display" style={{ fontSize: 14, color: 'var(--cst-mid-green)' }}>32:14</span>
        </div>
      </div>

      {/* Sub progress */}
      <div style={{ padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="cst-mono" style={{ fontSize: 9 }}>02 / 07</span>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${(2/7)*100}%`, height: '100%', background: 'var(--cst-mid-green)' }} />
        </div>
        <span className="cst-mono" style={{ fontSize: 9 }}>EXERCICES</span>
      </div>

      <div className="cst-scroll" style={{ flex: 1, padding: '20px 22px 100px' }}>
        {/* COMPLETED — Tractions */}
        <div style={logStyles.exBlock}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div className="cst-col" style={{ gap: 4, flex: 1 }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>— 01 · COMPLÉTÉ ✓</span>
              <span className="cst-display" style={{ fontSize: 18 }}>TRACTIONS PRONATION</span>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>4 × 6-10 · RPE 8 · REPOS 3:00</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 11, opacity: 0.7 }}>
            <span className="cst-mono">SÉRIES: 4/4 ✓</span>
            <span className="cst-mono">VOLUME: 280 KG</span>
            <span className="cst-mono">RPE MOY: 7.8</span>
          </div>
        </div>

        {/* ACTIVE — Row Barre */}
        <div style={{ ...logStyles.exBlock, borderColor: 'var(--cst-mid-green)' }}>
          <div className="cst-col" style={{ gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>— 02 · EN COURS</span>
              <span className="cst-mono" style={{ fontSize: 9 }}>3/4 SÉRIES</span>
            </div>
            <span className="cst-display" style={{ fontSize: 22 }}>ROW BARRE</span>
            <span className="cst-mono" style={{ fontSize: 9, opacity: 0.7 }}>OBJECTIF · 4 × 8 · RPE 8 · REPOS 2:00</span>
          </div>

          <div style={{
            marginTop: 12, padding: 10,
            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <div className="cst-col" style={{ gap: 2 }}>
              <span className="cst-mono" style={{ fontSize: 9 }}>DERNIÈRE FOIS · 7 JOURS</span>
              <span className="cst-display" style={{ fontSize: 14 }}>57.5 KG × 8</span>
            </div>
            <div className="cst-col" style={{ gap: 2, alignItems: 'flex-end' }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>COACH</span>
              <span className="cst-italic" style={{ fontSize: 12 }}>“Tire avec le dos.”</span>
            </div>
          </div>

          <table style={logStyles.setsTable}>
            <thead>
              <tr>
                <th style={logStyles.setsTh}>SÉR</th>
                <th style={logStyles.setsTh}>KG</th>
                <th style={logStyles.setsTh}>REPS</th>
                <th style={logStyles.setsTh}>RPE</th>
                <th style={logStyles.setsTh}>✓</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1','60','8','8',true],
                ['2','60','8','8',true],
                ['3','60','7','9',true],
                ['4','—','—','—',false],
              ].map((r, i) => {
                const active = !r[4] && i === 3;
                return (
                  <tr key={i} style={{ background: active ? 'rgba(45,90,53,0.12)' : 'transparent' }}>
                    <td style={{ ...logStyles.setsTd, fontFamily: 'var(--cst-mono)', fontSize: 11, color: 'var(--cst-text-muted)', fontWeight: 600 }}>{r[0]}</td>
                    {[1,2,3].map(idx => (
                      <td key={idx} style={logStyles.setsTd}>
                        {r[4] ? (
                          <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 13, fontWeight: 600, color: '#fff' }}>{r[idx]}</span>
                        ) : active ? (
                          <input style={{ ...logStyles.setInput, borderColor: 'var(--cst-mid-green)' }} placeholder={idx === 1 ? '60' : idx === 2 ? '8' : '8'} />
                        ) : (
                          <span style={{ opacity: 0.3 }}>—</span>
                        )}
                      </td>
                    ))}
                    <td style={logStyles.setsTd}>
                      {r[4] ? (
                        <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: 'var(--cst-mid-green)', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                      ) : (
                        <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--cst-mid-green)' }}></span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button className="cst-btn cst-btn-secondary cst-btn-sm" style={{ color: '#6EAB76', borderColor: 'rgba(110,171,118,0.4)', flex: 1 }}>+ SÉRIE</button>
            <div style={{
              flex: 1.4,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 100,
              background: 'rgba(45,90,53,0.18)', border: '1px solid var(--cst-mid-green)',
            }}>
              <span style={{ color: 'var(--cst-mid-green)' }}>◷</span>
              <div className="cst-col" style={{ gap: 0, flex: 1 }}>
                <span className="cst-mono" style={{ fontSize: 8 }}>REPOS</span>
                <span className="cst-display" style={{ fontSize: 16, color: 'var(--cst-mid-green)' }}>1:42</span>
              </div>
              <span style={{ opacity: 0.7, fontSize: 14 }}>⏸</span>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 10, background: 'rgba(181,131,10,0.08)', border: '1px solid rgba(181,131,10,0.3)', borderRadius: 8, fontSize: 11, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#D4A53B' }}>!</span>
            <span style={{ flex: 1, opacity: 0.85 }}>RPE 9 sur la 3e série. Garde la même charge pour la 4 — n'augmente pas.</span>
          </div>
        </div>

        {/* NEXT — Face Pull */}
        <div style={{ opacity: 0.5 }}>
          <div className="cst-col" style={{ gap: 4 }}>
            <span className="cst-mono" style={{ fontSize: 9 }}>— 03 · À VENIR</span>
            <span className="cst-display" style={{ fontSize: 18 }}>FACE PULL</span>
            <span className="cst-mono" style={{ fontSize: 9 }}>3 × 15 · RPE 7 · REPOS 1:00</span>
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 22px 22px',
        background: 'linear-gradient(180deg, rgba(27,46,31,0) 0%, rgba(27,46,31,0.95) 50%)',
        display: 'flex', gap: 8,
      }}>
        <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">SAUTER</button>
        <button className="cst-btn cst-btn-primary" style={{ flex: 1 }}>VALIDER SÉRIE 03 ●</button>
      </div>
    </div>
  );
}

function CSTHistory() {
  const months = [
    {
      m: 'MAI 2026',
      entries: [
        { d: '20', day: 'MER', s: 'PULL B', sub: '8 ex · 62 min · RPE 8.2', note: '« Bonne séance, tractions+++ »', coach: null, sem: 'SEM 04 · J2' },
        { d: '18', day: 'LUN', s: 'PUSH A', sub: '7 ex · 55 min · RPE 7.8', note: null, coach: '« Bien ! Augmente 2.5kg la semaine prochaine. »', sem: 'SEM 04 · J1' },
        { d: '15', day: 'VEN', s: 'LEGS C', sub: '6 ex · 70 min · RPE 9.1', note: '« Squat dur aujourd\'hui, bonne douleur. »', coach: null, sem: 'SEM 03 · J4', pr: 'PR · SQUAT 95KG' },
        { d: '13', day: 'MER', s: 'PULL B', sub: '8 ex · 60 min · RPE 8.0', note: null, coach: null, sem: 'SEM 03 · J2' },
        { d: '11', day: 'LUN', s: 'PUSH A', sub: '7 ex · 56 min · RPE 8.1', note: null, coach: null, sem: 'SEM 03 · J1' },
      ],
    },
    {
      m: 'AVRIL 2026',
      entries: [
        { d: '28', day: 'LUN', s: 'PUSH A', sub: '7 ex · 58 min · RPE 7.5', note: null, coach: null, sem: 'SEM 02 · J1' },
        { d: '26', day: 'SAM', s: 'CARDIO Z2', sub: '45 min · HR 138 avg', note: null, coach: null, sem: 'SEM 01 · J5' },
      ],
    },
  ];
  return (
    <div className="cst-screen">
      <div style={memStyles.topNav}>
        <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
        <span className="cst-mono" style={{ color: '#fff' }}>HISTORIQUE</span>
        <span style={{ fontSize: 18, opacity: 0.7 }}>⌕</span>
      </div>

      <div style={memStyles.contentScroll} className="cst-scroll">
        <CSTSectionNum num={1} label="MON HISTORIQUE" sub="28 SÉANCES" />
        <CSTDuoTitle top="DERRIÈRE" bottom="moi." size={36} />

        <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          {[['Tout', true], ['Ce mois', false], ['3 mois', false], ['6 mois', false], ['1 an', false]].map(([t, on]) => (
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
                      <div className="cst-col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                        <span className="cst-display" style={{ fontSize: 16 }}>{e.s}</span>
                        <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>{e.sub}</span>
                      </div>
                      <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>↗</span>
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

      <CSTMemberNav active="hist" />
    </div>
  );
}

function CSTProgression() {
  // SVG chart path
  const points = [10, 22, 18, 35, 42, 38, 55, 60, 70, 75, 88, 95, 102];
  const w = 320, h = 140, max = 110, pad = 8;
  const pts = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `M${pts[0][0]},${h - pad} ${line} L${pts[pts.length-1][0]},${h - pad} Z`;

  return (
    <div className="cst-screen">
      <div style={memStyles.topNav}>
        <span style={{ fontSize: 18, opacity: 0.7 }}>←</span>
        <span className="cst-mono" style={{ color: '#fff' }}>PROGRESSION</span>
        <span style={{ fontSize: 18, opacity: 0.7 }}>↗</span>
      </div>

      <div style={memStyles.contentScroll} className="cst-scroll">
        <CSTSectionNum num={1} label="MA PROGRESSION" sub="69 JOURS" />
        <CSTDuoTitle top="DEVANT" bottom="moi." size={36} />

        {/* Exercise selector */}
        <div style={{
          marginTop: 18, padding: 14,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="cst-col" style={{ gap: 2 }}>
            <span className="cst-mono" style={{ fontSize: 9 }}>EXERCICE</span>
            <span className="cst-display" style={{ fontSize: 18 }}>SQUAT BARRE</span>
          </div>
          <span style={{ opacity: 0.5 }}>▾</span>
        </div>

        {/* Chart card */}
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

          <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="cst-prog-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3A6B42" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3A6B42" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[0, 0.33, 0.66, 1].map((p, i) => (
              <line key={i} x1={pad} x2={w - pad} y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
            ))}
            <path d={area} fill="url(#cst-prog-fill)" />
            <path d={line} stroke="#3A6B42" strokeWidth="2" fill="none" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2} fill={i === pts.length - 1 ? '#fff' : '#3A6B42'} stroke={i === pts.length - 1 ? '#3A6B42' : 'none'} strokeWidth="2" />
            ))}
          </svg>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {['12 MAR','01 AVR','22 AVR','12 MAI'].map(d => (
              <span key={d} className="cst-mono" style={{ fontSize: 8, opacity: 0.5 }}>{d}</span>
            ))}
          </div>
        </div>

        {/* PRs */}
        <div style={{ marginTop: 24 }}>
          <CSTSectionNum num={2} label="RECORDS PERSONNELS" sub="04 PR" />
          <div className="cst-col" style={{ gap: 8, marginTop: 12 }}>
            {[
              ['SQUAT BARRE',     102.5, 110, '12 MAI'],
              ['DÉVELOPPÉ COUCHÉ', 87.5, 100, '08 MAI'],
              ['TRACTIONS LESTÉES','+15 KG', null, '03 MAI'],
              ['OVERHEAD PRESS',   62.5,  80, '28 AVR'],
            ].map((p, i) => {
              const pct = p[2] ? (p[1] / p[2]) * 100 : 70;
              return (
                <div key={i} className="cst-card-dark" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p[0]}</span>
                    <span className="cst-display" style={{ fontSize: 16, color: 'var(--cst-mid-green)' }}>{typeof p[1] === 'number' ? `${p[1]} KG` : p[1]}</span>
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
            {[
              ['SÉANCES TOTALES', '28'],
              ['VOLUME · TONNES', '186.4'],
              ['EXERCICES LOGUÉS', '312'],
              ['ADHÉRENCE', '89%'],
              ['SÉRIE EN COURS', '38 SEM'],
              ['MEMBRE DEPUIS', '69 J'],
            ].map(([k, v]) => (
              <div key={k} className="cst-card-dark" style={{ padding: 12 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                <div className="cst-display" style={{ fontSize: 22, marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CSTMemberNav active="prog2" />
    </div>
  );
}

Object.assign(window, { CSTSessionLogger, CSTHistory, CSTProgression });
