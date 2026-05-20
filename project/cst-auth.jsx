// Auth screens — Login + 4 onboarding steps (mobile, 390 wide)

const authStyles = {
  screen: { padding: '20px 24px 28px' },
  hatchOverlay: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 11px)',
  },
  progressTrack: {
    height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flex: 1,
  },
  progressFill: { height: '100%', background: 'var(--cst-mid-green)' },
  chipCard: {
    border: '1px solid rgba(0,0,0,0.10)',
    background: '#fff',
    borderRadius: 10,
    padding: '14px 14px',
    display: 'flex', flexDirection: 'column', gap: 4,
    cursor: 'pointer',
  },
  chipCardActive: {
    borderColor: 'var(--cst-mid-green)',
    borderWidth: 2,
    background: 'rgba(45,90,53,0.04)',
  },
  metricCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
};

function CSTLogin() {
  return (
    <div className="cst-screen cst-hatch" style={authStyles.screen}>
      <div style={authStyles.hatchOverlay} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <CSTLogo />
        </div>

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          <div className="cst-col" style={{ gap: 10, alignItems: 'flex-start' }}>
            <CSTSectionNum num={1} label="ACCÈS · L'ESPACE" />
            <CSTDuoTitle top="TON ESPACE." bottom="Connecte-toi." size={48} />
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.55, maxWidth: 280 }}>
              Entraîne-toi. Note. Progresse. L'outil pour les membres de l'équipage.
            </p>
          </div>

          {/* Form card */}
          <div className="cst-card-dark cst-hatch" style={{ padding: 22 }}>
            <div className="cst-col" style={{ gap: 14 }}>
              <div>
                <span className="cst-label">EMAIL</span>
                <input className="cst-input" placeholder="ton.email@domaine.fr" />
              </div>
              <div>
                <span className="cst-label">MOT DE PASSE</span>
                <input className="cst-input" type="password" placeholder="••••••••••" />
              </div>
              <button className="cst-btn cst-btn-primary" style={{ width: '100%', marginTop: 4 }}>
                SE CONNECTER →
              </button>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--cst-text-muted)' }}>
                Mot de passe oublié ?
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cst-col" style={{ gap: 12, alignItems: 'center', paddingTop: 16 }}>
          <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div className="cst-mono" style={{ fontSize: 9 }}>
            COACH ? <span style={{ color: 'var(--cst-mid-green)', textDecoration: 'underline' }}>SE CONNECTER ICI</span>
          </div>
          <div className="cst-mono" style={{ fontSize: 8, opacity: 0.4 }}>
            COLOSMARTRAINING™ — VICHY · FR · EST. 2024
          </div>
        </div>
      </div>
    </div>
  );
}

function CSTOnboardingNav({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 22 }}>
      <span className="cst-mono" style={{ fontSize: 9 }}>{String(step).padStart(2, '0')} / 04</span>
      <div style={authStyles.progressTrack}>
        <div style={{ ...authStyles.progressFill, width: `${(step / 4) * 100}%` }} />
      </div>
      <span className="cst-mono" style={{ fontSize: 9 }}>ONBOARDING</span>
    </div>
  );
}

function CSTOnboard1() {
  return (
    <div className="cst-screen cst-hatch" style={authStyles.screen}>
      <div style={authStyles.hatchOverlay} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CSTOnboardingNav step={1} />

        <div className="cst-col" style={{ gap: 12, marginTop: 8 }}>
          <CSTSectionNum num={1} label="BIENVENUE" />
          <CSTDuoTitle top="BIENVENUE" bottom="dans l'équipage." size={48} />
        </div>

        <div className="cst-col" style={{ gap: 14, marginTop: 32 }}>
          {[
            ['01', 'CONSULTE', "Ton programme du jour, semaine par semaine."],
            ['02', 'LOGGE',    'Charge, reps, RPE — tout est tracé sans friction.'],
            ['03', 'PROGRESSE', "Tes records, ton volume, ton adhérence — en clair."],
          ].map(([n, t, d]) => (
            <div key={n} style={{
              display: 'flex', gap: 14,
              padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
            }}>
              <span className="cst-mono" style={{ fontSize: 10, color: 'var(--cst-mid-green)', flexShrink: 0 }}>— {n}</span>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-display" style={{ fontSize: 16 }}>{t}</span>
                <span style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.45 }}>{d}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button className="cst-btn cst-btn-primary" style={{ width: '100%' }}>COMMENCER →</button>
          <div className="cst-mono" style={{ textAlign: 'center', marginTop: 12, fontSize: 9, opacity: 0.5 }}>
            ≈ 2 MIN — 4 ÉTAPES
          </div>
        </div>
      </div>
    </div>
  );
}

function CSTOnboard2() {
  const levels = [
    { id: 'deb', label: 'DÉBUTANT', sub: '0–1 an' },
    { id: 'int', label: 'INTERMÉDIAIRE', sub: '1–3 ans', active: true },
    { id: 'av',  label: 'AVANCÉ', sub: '3+ ans' },
  ];
  const goals = [
    { id: 'force', label: 'Prise de force', icon: '▲', active: true },
    { id: 'hyp',   label: 'Hypertrophie',   icon: '◆' },
    { id: 'end',   label: 'Endurance',      icon: '◯' },
    { id: 'mob',   label: 'Mobilité',       icon: '◢' },
  ];
  return (
    <div className="cst-screen cst-light" style={{ padding: '20px 24px' }}>
      <div className="cst-hatch-light" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CSTOnboardingNav step={2} />

        <CSTSectionNum num={2} label="TON PROFIL" />
        <h1 className="cst-display" style={{ fontSize: 36, margin: '10px 0 0' }}>QUI ES-TU ?</h1>
        <div className="cst-italic" style={{ fontSize: 22, marginTop: -2, color: 'var(--cst-mid-green)' }}>
          On commence par le terrain.
        </div>

        <div className="cst-col" style={{ gap: 18, marginTop: 22 }}>
          <div>
            <label className="cst-label">PRÉNOM · NOM</label>
            <div className="cst-flex cst-gap-8">
              <input className="cst-input cst-input-light" placeholder="Jordan" />
              <input className="cst-input cst-input-light" placeholder="F." />
            </div>
          </div>

          <div>
            <label className="cst-label">NIVEAU</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {levels.map(l => (
                <div key={l.id} style={{ ...authStyles.chipCard, ...(l.active ? authStyles.chipCardActive : {}), padding: '10px 8px', alignItems: 'flex-start' }}>
                  <span className="cst-display" style={{ fontSize: 13 }}>{l.label}</span>
                  <span className="cst-mono" style={{ fontSize: 9 }}>{l.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="cst-label">OBJECTIF PRINCIPAL</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {goals.map(g => (
                <div key={g.id} style={{ ...authStyles.chipCard, ...(g.active ? authStyles.chipCardActive : {}), gap: 6 }}>
                  <span style={{ color: 'var(--cst-mid-green)', fontSize: 18, lineHeight: 1 }}>{g.icon}</span>
                  <span className="cst-display" style={{ fontSize: 14 }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-light">← RETOUR</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1 }}>CONTINUER →</button>
        </div>
      </div>
    </div>
  );
}

function CSTOnboard3() {
  return (
    <div className="cst-screen cst-light" style={{ padding: '20px 24px' }}>
      <div className="cst-hatch-light" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CSTOnboardingNav step={3} />

        <CSTSectionNum num={3} label="TES INFOS · PHYSIQUE" />
        <h1 className="cst-display" style={{ fontSize: 36, margin: '10px 0 0' }}>LE TERRAIN.</h1>
        <div className="cst-italic" style={{ fontSize: 22, marginTop: -2, color: 'var(--cst-mid-green)' }}>
          Ton point de départ.
        </div>

        <div className="cst-col" style={{ gap: 18, marginTop: 22 }}>
          <div className="cst-flex cst-gap-12">
            <div style={{ flex: 1 }}>
              <label className="cst-label">POIDS · KG</label>
              <input className="cst-input cst-input-light" defaultValue="76" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="cst-label">TAILLE · CM</label>
              <input className="cst-input cst-input-light" defaultValue="180" />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="cst-label" style={{ marginBottom: 4 }}>FRÉQUENCE / SEMAINE</label>
              <span className="cst-display" style={{ fontSize: 22, color: 'var(--cst-mid-green)' }}>4 <span className="cst-mono" style={{ fontSize: 10, color: 'inherit' }}>JOURS</span></span>
            </div>
            <div style={{ position: 'relative', height: 28, marginTop: 8 }}>
              <div style={{ position: 'absolute', top: 13, left: 0, right: 0, height: 2, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }} />
              <div style={{ position: 'absolute', top: 13, left: 0, width: '57%', height: 2, background: 'var(--cst-mid-green)', borderRadius: 2 }} />
              <div style={{ position: 'absolute', top: 4, left: 'calc(57% - 10px)', width: 20, height: 20, borderRadius: '50%', background: 'var(--cst-mid-green)', border: '3px solid #F5F2EA', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
              <div style={{ position: 'absolute', top: 28, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <span key={n} className="cst-mono" style={{ fontSize: 9, opacity: n === 4 ? 1 : 0.4, color: n === 4 ? 'var(--cst-mid-green)' : 'inherit' }}>{n}</span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="cst-label">BLESSURES · CONTRE-INDICATIONS</label>
            <textarea className="cst-input cst-input-light" rows="4" placeholder="Décris ce qui pourrait limiter l'entraînement — épaule droite, lombaires…" style={{ resize: 'none', fontFamily: 'var(--cst-ui)' }} defaultValue="Épaule droite — tendinite légère, j'évite les développés au-dessus de la tête." />
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-light">← RETOUR</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1 }}>CONTINUER →</button>
        </div>
      </div>
    </div>
  );
}

function CSTOnboard4() {
  const summary = [
    ['NIVEAU', 'INTERMÉDIAIRE'],
    ['OBJECTIF', 'PRISE DE FORCE'],
    ['POIDS', '76 KG'],
    ['FRÉQUENCE', '4 J / SEM'],
  ];
  return (
    <div className="cst-screen cst-hatch" style={authStyles.screen}>
      <div style={authStyles.hatchOverlay} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CSTOnboardingNav step={4} />

        <div className="cst-col" style={{ gap: 12, marginTop: 6 }}>
          <CSTSectionNum num={4} label="PRÊT À DÉMARRER" />
          <CSTDuoTitle top="TOUT EST" bottom="en place." size={48} />
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.55, maxWidth: 300 }}>
            Ton profil est créé. Léo va te bâtir un programme sur mesure dans les prochaines 24h.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          marginTop: 24,
        }}>
          {summary.map(([k, v]) => (
            <div key={k} style={authStyles.metricCard}>
              <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
              <span className="cst-display" style={{ fontSize: 16 }}>{v}</span>
            </div>
          ))}
        </div>

        <div className="cst-card-dark cst-hatch" style={{ marginTop: 18, padding: 16, borderColor: 'rgba(45,90,53,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <CSTAvatar initials="LC" size={28} />
            <div className="cst-col">
              <span className="cst-display" style={{ fontSize: 13 }}>LÉO COLOGNESI</span>
              <span className="cst-mono" style={{ fontSize: 9 }}>TON COACH</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, opacity: 0.8 }}>
            « Bienvenue Jordan. <span className="cst-italic">Construis un corps fort, peu importe où tu te trouves.</span> On démarre. »
          </p>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button className="cst-btn cst-btn-primary" style={{ width: '100%' }}>VOIR MON PROGRAMME →</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CSTLogin, CSTOnboard1, CSTOnboard2, CSTOnboard3, CSTOnboard4 });
