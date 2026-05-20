// Coach screens — Dashboard, Member fiche, Programme Builder, Excel Import
// Desktop layout (1440 wide artboards)

const coachStyles = {
  metricCard: {
    background: '#243029',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '22px 22px',
    display: 'flex', flexDirection: 'column', gap: 6,
    position: 'relative', overflow: 'hidden',
  },
  metricBig: { fontFamily: 'var(--cst-display)', fontWeight: 800, fontSize: 64, lineHeight: 0.9, letterSpacing: 0 },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
  },
  tableHead: {
    fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'var(--cst-text-muted)', textAlign: 'left', padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    fontWeight: 600,
  },
  tableRow: { borderBottom: '1px solid rgba(255,255,255,0.05)' },
  tableCell: { padding: '14px 16px', color: 'rgba(255,255,255,0.85)' },
};

function CSTDot({ color = '#3A6B42', size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function CSTCoachDashboard() {
  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CSTCoachSidebar active="dashboard" />

      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        <CSTPageHeader
          num={1}
          label="TABLEAU DE BORD"
          sub="MAI 2026"
          dateRight="MER. 20 MAI · 09:51"
          action={<>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">IMPORTER EXCEL ↥</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm">NOUVEAU PROGRAMME →</button>
          </>}
        />

        {/* Welcome strip */}
        <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
          <CSTDuoTitle top="BONJOUR, LÉO." bottom="12 athlètes en mouvement." size={42} />
          <CSTBandWords items={['LIBERTÉ', 'MOUVEMENT', 'NATURE', 'PROGRESSION']} />
        </div>

        {/* Metrics row */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            ['12', 'MEMBRES ACTIFS', '+2 ce mois', 'up'],
            ['03', 'SÉANCES AUJOURD\'HUI', '1 complétée · 2 à faire', null],
            ['87%', 'TAUX D\'ADHÉRENCE', '30 jours · vs. 82% avr.', 'up'],
            ['05', 'MESSAGES NON LUS', '2 importants', 'warn'],
          ].map(([n, l, sub, kind], i) => (
            <div key={i} className="cst-hatch" style={coachStyles.metricCard}>
              <span className="cst-mono" style={{ fontSize: 9 }}>— {String(i + 1).padStart(2, '0')}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={coachStyles.metricBig}>{n}</span>
                {kind === 'up' && <span className="cst-tag cst-tag-success" style={{ fontSize: 9 }}>▲</span>}
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
            <span className="cst-mono">VOIR TOUT →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { i: 'JF', n: 'Jordan F.',  s: 'PUSH A',  w: 'SEM 04 · J2', k: 'done', t: '07:42 · 58 MIN', rpe: 'RPE 8.1' },
              { i: 'MR', n: 'Marie R.',   s: 'LEGS C',  w: 'SEM 06 · J4', k: 'active', t: 'EN COURS · 32 MIN', rpe: 'RPE 7.6' },
              { i: 'PB', n: 'Paul B.',    s: 'PULL B',  w: 'SEM 02 · J2', k: 'todo', t: '18:00 ATTENDU', rpe: '—' },
              { i: 'SC', n: 'Sophie C.',  s: 'CARDIO Z2',w: 'SEM 08 · J5', k: 'skip', t: 'PAS DE LOG · 24H', rpe: '—' },
            ].map((m, i) => (
              <div key={i} className="cst-hatch" style={{ ...coachStyles.metricCard, padding: 18, gap: 10 }}>
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="cst-mono">FILTRER</span>
              <span className="cst-mono" style={{ color: '#fff' }}>TOUS · ACTIFS · ALERTES</span>
            </div>
          </div>
          <div className="cst-card-dark" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={coachStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...coachStyles.tableHead, width: 220 }}>MEMBRE</th>
                  <th style={coachStyles.tableHead}>PROGRAMME</th>
                  <th style={coachStyles.tableHead}>DERNIÈRE SÉANCE</th>
                  <th style={coachStyles.tableHead}>ADHÉRENCE 30J</th>
                  <th style={coachStyles.tableHead}>PROCHAINE</th>
                  <th style={coachStyles.tableHead}></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['JF','Jordan F.',     '#3A6B42', 'Force Fondamentale · S04', 'Hier · PUSH A · RPE 8.1', 94, 'Aujourd\'hui · PULL B'],
                  ['MR','Marie R.',      '#3A6B42', 'Hypertrophie · S06',       'Aujourd\'hui · LEGS C',    88, 'Vendredi · UPPER A'],
                  ['PB','Paul B.',       '#B5830A', 'Beginner Strength · S02',  '4 jours · FULL BODY',      62, 'Aujourd\'hui · PULL B'],
                  ['SC','Sophie C.',     '#8B2318', 'Marathon Vichy · S08',     '6 jours · LONG RUN',       41, 'Samedi · TEMPO 8K'],
                  ['AM','Antoine M.',    '#3A6B42', 'Force Fondamentale · S03', 'Hier · LEGS C · RPE 9.2',  91, 'Demain · REST'],
                  ['ER','Émilie R.',     '#3A6B42', 'Mobility Reset · S02',     '2 jours · MOB FLOW',       77, 'Demain · UPPER B'],
                ].map((r, i) => (
                  <tr key={i} style={coachStyles.tableRow}>
                    <td style={coachStyles.tableCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CSTDot color={r[2]} />
                        <CSTAvatar initials={r[0]} size={28} />
                        <span style={{ fontWeight: 600 }}>{r[1]}</span>
                      </div>
                    </td>
                    <td style={coachStyles.tableCell}>{r[3]}</td>
                    <td style={{ ...coachStyles.tableCell, opacity: 0.7 }}>{r[4]}</td>
                    <td style={coachStyles.tableCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${r[5]}%`, height: '100%', background: r[5] > 80 ? 'var(--cst-success)' : r[5] > 60 ? 'var(--cst-warning)' : 'var(--cst-danger)' }} />
                        </div>
                        <span className="cst-mono" style={{ fontSize: 11, color: '#fff' }}>{r[5]}%</span>
                      </div>
                    </td>
                    <td style={{ ...coachStyles.tableCell, opacity: 0.7 }}>{r[6]}</td>
                    <td style={{ ...coachStyles.tableCell, textAlign: 'right' }}>
                      <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ marginRight: 6 }}>VOIR</button>
                      <button className="cst-btn cst-btn-secondary cst-btn-sm" style={{ color: '#6EAB76', borderColor: 'rgba(110,171,118,0.4)' }}>ENVOYER →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feed */}
        <div style={{ padding: '32px 32px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <CSTSectionNum num={4} label="RETOURS RÉCENTS" sub="MEMBRES" />
            <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
              {[
                ['JF', 'Jordan F.', 'il y a 2h', '« Séance Squat complétée — RPE 9/10, difficile mais ok. La barre s\'est sentie lourde sur la 3e série. »', 'PUSH A · SEM 04 · J1'],
                ['AM', 'Antoine M.', 'il y a 4h', '« Léo j\'ai fait +5kg sur le développé sans pb. On peut pousser la semaine prochaine ? »', 'PR · DÉVELOPPÉ 87,5 KG'],
                ['ER', 'Émilie R.', 'hier · 21:14', '« Mobilité épaule beaucoup mieux. Je sens la différence après 2 semaines. »', 'MOB FLOW · SEM 02 · J3'],
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
                    <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                      <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>VOIR LA SÉANCE →</span>
                      <span className="cst-mono" style={{ fontSize: 9 }}>RÉPONDRE</span>
                    </div>
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
                <p style={{ margin: '6px 0 10px', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
                  3 séances sautées · adhérence tombée à 41%.
                </p>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ width: '100%' }}>ENVOYER UN MESSAGE →</button>
              </div>

              <div className="cst-card-dark" style={{ padding: 16, borderColor: 'rgba(181,131,10,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CSTDot color="#D4A53B" />
                  <span className="cst-mono" style={{ fontSize: 9, color: '#D4A53B' }}>RPE ÉLEVÉ · 3 SÉANCES</span>
                </div>
                <div className="cst-display" style={{ fontSize: 15 }}>ANTOINE M.</div>
                <p style={{ margin: '6px 0 10px', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
                  Moyenne RPE 9.1 sur les 3 dernières. Envisager un déload ?
                </p>
                <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" style={{ width: '100%' }}>ADAPTER LA SEMAINE →</button>
              </div>

              <div className="cst-card-dark cst-hatch" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CSTDot color="var(--cst-mid-green)" />
                  <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>NOUVEAU PR</span>
                </div>
                <div className="cst-display" style={{ fontSize: 15 }}>JORDAN F. · SQUAT 102.5KG</div>
                <p style={{ margin: '6px 0 10px', fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
                  +5kg sur le 1RM. À célébrer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CSTCoachMember() {
  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CSTCoachSidebar active="membres" />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* breadcrumb */}
        <div style={{ padding: '20px 32px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="cst-mono" style={{ color: '#fff', cursor: 'pointer' }}>MEMBRES</span>
          <span className="cst-mono">/</span>
          <span className="cst-mono" style={{ color: 'var(--cst-mid-green)' }}>JORDAN F.</span>
        </div>

        {/* Hero */}
        <div className="cst-hatch" style={{ padding: '28px 32px 32px', background: 'linear-gradient(180deg, #1F2D24 0%, #1B2E1F 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{
              width: 110, height: 110, borderRadius: 8,
              background: 'linear-gradient(135deg, #3A6B42, #1B2E1F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--cst-display)', fontSize: 42, fontWeight: 800,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>JF</div>
            <div className="cst-col" style={{ gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="cst-tag cst-tag-success">MEMBRE · ACTIF</span>
                <span className="cst-mono">DEPUIS LE 12 MARS 2026</span>
              </div>
              <h1 className="cst-display" style={{ fontSize: 56, margin: 0 }}>JORDAN FERRER.</h1>
              <div className="cst-italic" style={{ fontSize: 22, color: 'rgba(255,255,255,0.65)', marginTop: -4 }}>
                Force, sentier, voyage.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className="cst-btn cst-btn-primary cst-btn-sm">MESSAGE →</button>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">ADAPTER LA SEMAINE</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, marginTop: 26, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
            {[
              ['OBJECTIF', 'FORCE'],
              ['POIDS', '76 KG'],
              ['NIVEAU', 'INTERMÉDIAIRE'],
              ['ANCIENNETÉ', '69 JOURS'],
              ['SÉANCES', '28 TOTAL'],
            ].map(([k, v], i) => (
              <div key={k} className="cst-col" style={{ gap: 4, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingLeft: i > 0 ? 20 : 0 }}>
                <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
                <span className="cst-display" style={{ fontSize: 22 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 32px', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            ['Programme actuel', true],
            ['Historique', false],
            ['Progression', false],
            ['Profil', false],
            ['Messages', false, 2],
          ].map(([t, on, badge], i) => (
            <div key={t} style={{
              padding: '16px 20px',
              fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: on ? 700 : 500,
              color: on ? '#fff' : 'rgba(255,255,255,0.5)',
              borderBottom: on ? '2px solid var(--cst-mid-green)' : '2px solid transparent',
              fontFamily: 'var(--cst-ui)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', opacity: on ? 1 : 0.4 }}>{String(i + 1).padStart(2, '0')}</span>
              {t}
              {badge && <span style={{ background: 'var(--cst-mid-green)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontFamily: 'var(--cst-mono)' }}>{badge}</span>}
            </div>
          ))}
        </div>

        {/* Programme content */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <CSTSectionNum num={1} label="PROGRAMME ACTUEL" sub="FORCE FONDAMENTALE" />
                <h2 className="cst-display" style={{ fontSize: 32, margin: '8px 0 4px' }}>SEMAINE 04 / 08</h2>
                <span className="cst-mono">CHARGE +10% · DÉLOAD W06</span>
              </div>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">CHANGER →</button>
            </div>

            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: '50%', height: '100%', background: 'var(--cst-mid-green)' }} />
            </div>

            <div className="cst-col" style={{ gap: 10 }}>
              {[
                { d: 'LUN 18/05', l: 'PUSH A', s: 'done', sub: '7 exercices · 55 min · RPE 7.8', last: 'DERNIÈRE · Développé 80kg × 7' },
                { d: 'MER 20/05', l: 'PULL B', s: 'active', sub: 'À FAIRE · attendu 18:00', last: 'EN ATTENTE' },
                { d: 'JEU 21/05', l: 'REST',    s: 'rest',   sub: 'Récupération active · 30 min marche', last: '—' },
                { d: 'VEN 22/05', l: 'LEGS C',  s: 'coming', sub: '6 exercices · ~70 min',               last: 'PR · SQUAT 102.5KG' },
                { d: 'SAM 23/05', l: 'CARDIO Z2',s: 'coming', sub: '45 min · zone 2',                    last: '—' },
              ].map((d, i) => (
                <div key={i} className="cst-card-dark cst-hatch" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div className="cst-mono" style={{ width: 72, fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{d.d}</div>
                  <div className="cst-col" style={{ flex: 1, gap: 2 }}>
                    <span className="cst-display" style={{ fontSize: 18 }}>{d.l}</span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>{d.sub}</span>
                  </div>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6 }}>{d.last}</span>
                  <CSTStatus kind={d.s === 'rest' ? 'coming' : d.s} label={d.s === 'rest' ? 'REPOS' : undefined} />
                </div>
              ))}
            </div>
          </div>

          {/* Right: tendances */}
          <div className="cst-col" style={{ gap: 20 }}>
            <div>
              <CSTSectionNum num={2} label="TENDANCES" sub="EXERCICES CLÉS" />
              <div className="cst-col" style={{ gap: 10, marginTop: 14 }}>
                {[
                  ['DÉVELOPPÉ COUCHÉ', '+ 7.5 KG', '80 → 87.5', 'up'],
                  ['SQUAT BARRE',      '+ 12.5 KG', '90 → 102.5', 'up'],
                  ['TRACTIONS',        '+ 3 REPS',  '7 → 10',     'up'],
                  ['OVERHEAD PRESS',   '+ 0 KG',    '60 → 60',    'flat'],
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
              <textarea className="cst-input" rows="5" style={{ marginTop: 12, resize: 'none', fontFamily: 'var(--cst-ui)', fontSize: 12 }} defaultValue="J. progresse vite — corps répond bien sur le compound. Garder l'oeil sur l'épaule (tendinite légère mentionnée à l'onboarding). Pousser sur le squat. Faire un déload W06 ferme." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CSTCoachDashboard, CSTCoachMember, CSTDot });
