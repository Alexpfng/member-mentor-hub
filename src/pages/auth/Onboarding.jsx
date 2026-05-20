import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CSTLogo, CSTSectionNum, CSTDuoTitle, CSTAvatar } from '../../components/Atoms';

const hatchOverlay = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 11px)',
};

function Nav({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 22 }}>
      <span className="cst-mono" style={{ fontSize: 9 }}>{String(step).padStart(2, '0')} / 04</span>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
        <div style={{ height: '100%', background: 'var(--cst-mid-green)', width: `${(step / 4) * 100}%` }} />
      </div>
      <span className="cst-mono" style={{ fontSize: 9 }}>ONBOARDING</span>
    </div>
  );
}

function Step1({ onNext }) {
  return (
    <div className="cst-screen cst-hatch" style={{ padding: '20px 24px 28px', position: 'relative' }}>
      <div style={hatchOverlay} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Nav step={1} />
        <div className="cst-col" style={{ gap: 12, marginTop: 8 }}>
          <CSTSectionNum num={1} label="BIENVENUE" />
          <CSTDuoTitle top="BIENVENUE" bottom="dans l'équipage." size={48} />
        </div>
        <div className="cst-col" style={{ gap: 14, marginTop: 32 }}>
          {[
            ['01', 'CONSULTE', "Ton programme du jour, semaine par semaine."],
            ['02', 'LOGGE', 'Charge, reps, RPE — tout est tracé sans friction.'],
            ['03', 'PROGRESSE', "Tes records, ton volume, ton adhérence — en clair."],
          ].map(([n, t, d]) => (
            <div key={n} style={{ display: 'flex', gap: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
              <span className="cst-mono" style={{ fontSize: 10, color: 'var(--cst-mid-green)', flexShrink: 0 }}>★ {n}</span>
              <div className="cst-col" style={{ gap: 2 }}>
                <span className="cst-display" style={{ fontSize: 16 }}>{t}</span>
                <span style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.45 }}>{d}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button className="cst-btn cst-btn-primary" style={{ width: '100%' }} onClick={onNext}>COMMENCER →</button>
          <div className="cst-mono" style={{ textAlign: 'center', marginTop: 12, fontSize: 9, opacity: 0.5 }}>≈ 2 MIN · 4 ÉTAPES</div>
        </div>
      </div>
    </div>
  );
}

function Step2({ data, setData, onNext, onBack }) {
  const [err, setErr] = useState('');
  const levels = [
    { id: 'deb', label: 'DÉBUTANT', sub: '0–1 an' },
    { id: 'int', label: 'INTERMÉDIAIRE', sub: '1–3 ans' },
    { id: 'av', label: 'AVANCÉ', sub: '3+ ans' },
  ];
  const goals = [
    { id: 'force', label: 'Prise de force', icon: '▲' },
    { id: 'hyp', label: 'Hypertrophie', icon: '◉' },
    { id: 'end', label: 'Endurance', icon: '○' },
    { id: 'mob', label: 'Mobilité', icon: '◎' },
  ];

  function validate() {
    if (!data.firstName?.trim() || !data.lastName?.trim()) { setErr('Renseigne ton prénom et ton nom.'); return false; }
    if (!data.level) { setErr('Sélectionne ton niveau.'); return false; }
    if (!data.goal) { setErr('Sélectionne ton objectif.'); return false; }
    return true;
  }

  return (
    <div className="cst-screen cst-light" style={{ padding: '20px 24px', position: 'relative' }}>
      <div className="cst-hatch-light" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Nav step={2} />
        <CSTSectionNum num={2} label="TON PROFIL" />
        <h1 className="cst-display" style={{ fontSize: 36, margin: '10px 0 0' }}>QUI ES-TU ?</h1>
        <div className="cst-italic" style={{ fontSize: 22, marginTop: -2, color: 'var(--cst-mid-green)' }}>On commence par le terrain.</div>

        <div className="cst-col" style={{ gap: 18, marginTop: 22 }}>
          <div>
            <label className="cst-label">PRÉNOM · NOM</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="cst-input cst-input-light" placeholder="Jordan" style={{ flex: 1 }}
                value={data.firstName || ''} onChange={e => { setData({ ...data, firstName: e.target.value }); setErr(''); }} />
              <input className="cst-input cst-input-light" placeholder="Ferrer" style={{ flex: 1 }}
                value={data.lastName || ''} onChange={e => { setData({ ...data, lastName: e.target.value }); setErr(''); }} />
            </div>
          </div>
          <div>
            <label className="cst-label">NIVEAU</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {levels.map(l => (
                <div key={l.id} onClick={() => { setData({ ...data, level: l.id }); setErr(''); }} style={{
                  border: data.level === l.id ? '2px solid var(--cst-mid-green)' : '1px solid rgba(0,0,0,0.10)',
                  background: data.level === l.id ? 'rgba(45,90,53,0.04)' : '#fff',
                  borderRadius: 10, padding: '10px 8px',
                  display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
                }}>
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
                <div key={g.id} onClick={() => { setData({ ...data, goal: g.id }); setErr(''); }} style={{
                  border: data.goal === g.id ? '2px solid var(--cst-mid-green)' : '1px solid rgba(0,0,0,0.10)',
                  background: data.goal === g.id ? 'rgba(45,90,53,0.04)' : '#fff',
                  borderRadius: 10, padding: '14px 14px',
                  display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
                }}>
                  <span style={{ color: 'var(--cst-mid-green)', fontSize: 18 }}>{g.icon}</span>
                  <span className="cst-display" style={{ fontSize: 14 }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {err && <div style={{ marginTop: 12, padding: 10, background: 'rgba(139,35,24,0.08)', border: '1px solid rgba(139,35,24,0.3)', borderRadius: 8, fontSize: 12, color: '#8B2318' }}>{err}</div>}
        <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-light" onClick={onBack}>← RETOUR</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1 }} onClick={() => { if (validate()) onNext(); }}>CONTINUER →</button>
        </div>
      </div>
    </div>
  );
}

function Step3({ data, setData, onNext, onBack }) {
  const [err, setErr] = useState('');
  function validate() {
    const w = Number(data.weight); const h = Number(data.height);
    if (!w || w < 30 || w > 250) { setErr('Poids invalide (30–250 kg).'); return false; }
    if (!h || h < 120 || h > 230) { setErr('Taille invalide (120–230 cm).'); return false; }
    return true;
  }
  return (
    <div className="cst-screen cst-light" style={{ padding: '20px 24px', position: 'relative' }}>
      <div className="cst-hatch-light" style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Nav step={3} />
        <CSTSectionNum num={3} label="TES INFOS · PHYSIQUE" />
        <h1 className="cst-display" style={{ fontSize: 36, margin: '10px 0 0' }}>LE TERRAIN.</h1>
        <div className="cst-italic" style={{ fontSize: 22, marginTop: -2, color: 'var(--cst-mid-green)' }}>Ton point de départ.</div>

        <div className="cst-col" style={{ gap: 18, marginTop: 22 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="cst-label">POIDS · KG</label>
              <input className="cst-input cst-input-light" type="number" inputMode="decimal"
                value={data.weight || ''} onChange={e => { setData({ ...data, weight: e.target.value }); setErr(''); }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="cst-label">TAILLE · CM</label>
              <input className="cst-input cst-input-light" type="number" inputMode="numeric"
                value={data.height || ''} onChange={e => { setData({ ...data, height: e.target.value }); setErr(''); }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="cst-label" style={{ marginBottom: 4 }}>FRÉQUENCE / SEMAINE</label>
              <span className="cst-display" style={{ fontSize: 22, color: 'var(--cst-mid-green)' }}>{data.freq || 4} <span className="cst-mono" style={{ fontSize: 10 }}>JOURS</span></span>
            </div>
            <input type="range" min="1" max="7" value={data.freq || 4} onChange={e => setData({ ...data, freq: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--cst-mid-green)', marginTop: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <span key={n} className="cst-mono" style={{ fontSize: 9, opacity: n === (data.freq || 4) ? 1 : 0.4, color: n === (data.freq || 4) ? 'var(--cst-mid-green)' : 'inherit' }}>{n}</span>
              ))}
            </div>
          </div>

          <div>
            <label className="cst-label">BLESSURES · CONTRE-INDICATIONS</label>
            <textarea className="cst-input cst-input-light" rows="4"
              placeholder="Décris ce qui pourrait limiter l'entraînement…"
              value={data.injuries || ''} onChange={e => setData({ ...data, injuries: e.target.value })}
              style={{ resize: 'none', fontFamily: 'var(--cst-ui)' }} />
          </div>
        </div>

        {err && <div style={{ marginTop: 12, padding: 10, background: 'rgba(139,35,24,0.08)', border: '1px solid rgba(139,35,24,0.3)', borderRadius: 8, fontSize: 12, color: '#8B2318' }}>{err}</div>}
        <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-light" onClick={onBack}>← RETOUR</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1 }} onClick={() => { if (validate()) onNext(); }}>CONTINUER →</button>
        </div>
      </div>
    </div>
  );
}

const GOAL_LABELS = { force: 'PRISE DE FORCE', hyp: 'HYPERTROPHIE', end: 'ENDURANCE', mob: 'MOBILITÉ' };
const LEVEL_LABELS = { deb: 'DÉBUTANT', int: 'INTERMÉDIAIRE', av: 'AVANCÉ' };

function Step4({ data, onFinish, onBack, saving }) {
  const summary = [
    ['NIVEAU', LEVEL_LABELS[data.level] || '—'],
    ['OBJECTIF', GOAL_LABELS[data.goal] || '—'],
    ['POIDS', data.weight ? `${data.weight} KG` : '—'],
    ['FRÉQUENCE', `${data.freq || 4} J / SEM`],
  ];
  return (
    <div className="cst-screen cst-hatch" style={{ padding: '20px 24px 28px', position: 'relative' }}>
      <div style={hatchOverlay} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Nav step={4} />
        <div className="cst-col" style={{ gap: 12, marginTop: 6 }}>
          <CSTSectionNum num={4} label="PRÊT À DÉMARRER" />
          <CSTDuoTitle top="TOUT EST" bottom="en place." size={48} />
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.55, maxWidth: 300 }}>
            Ton profil est créé. Léo va te bâtir un programme sur mesure dans les prochaines 24h.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 24 }}>
          {summary.map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>
              <span className="cst-mono" style={{ fontSize: 9 }}>{k}</span>
              <span className="cst-display" style={{ fontSize: 16, display: 'block', marginTop: 4 }}>{v}</span>
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
            « Bienvenue {data.firstName || ''}. <span className="cst-italic">Construis un corps fort, peu importe où tu te trouves.</span> On démarre. »
          </p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost" onClick={onBack} disabled={saving}>← RETOUR</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }} disabled={saving} onClick={onFinish}>
            {saving ? '...' : 'VOIR MON PROGRAMME →'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = 'cst_onboarding_draft';

export default function Onboarding() {
  const { step } = useParams();
  const navigate = useNavigate();
  const currentStep = Number(step) || 1;
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : { freq: 4, level: 'int', goal: 'force' };
    } catch { return { freq: 4, level: 'int', goal: 'force' }; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
  }, [data]);

  const next = () => navigate(`/onboarding/${currentStep + 1}`);
  const back = () => currentStep > 1 ? navigate(`/onboarding/${currentStep - 1}`) : navigate('/');

  async function finish() {
    setSaving(true);
    try {
      const { data: userData, error: uerr } = await supabase.auth.getUser();
      if (uerr || !userData.user) throw new Error('Non connecté.');
      const uid = userData.user.id;

      // Update profile names
      await supabase.from('profiles').update({
        first_name: data.firstName || null,
        last_name: data.lastName || null,
      }).eq('id', uid);

      // Upsert member_profiles
      const payload = {
        user_id: uid,
        weight_kg: data.weight ? Number(data.weight) : null,
        height_cm: data.height ? Number(data.height) : null,
        level: LEVEL_LABELS[data.level] || null,
        goal: GOAL_LABELS[data.goal] || null,
        injuries: data.injuries || null,
      };

      // Check if row exists
      const { data: existing } = await supabase
        .from('member_profiles').select('id').eq('user_id', uid).maybeSingle();
      if (existing?.id) {
        await supabase.from('member_profiles').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('member_profiles').insert(payload);
      }

      // Log initial weight
      if (data.weight) {
        await supabase.from('weight_logs').insert({
          member_id: uid,
          weight_kg: Number(data.weight),
        });
      }

      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      toast.success('Profil enregistré ✓');
      navigate('/membre');
    } catch (e) {
      toast.error(e?.message || 'Erreur lors de l\'enregistrement.');
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cst-dark-green)' }}>
      <div style={{ width: 390, height: 780, position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
        {currentStep === 1 && <Step1 onNext={next} />}
        {currentStep === 2 && <Step2 data={data} setData={setData} onNext={next} onBack={back} />}
        {currentStep === 3 && <Step3 data={data} setData={setData} onNext={next} onBack={back} />}
        {currentStep === 4 && <Step4 data={data} onFinish={finish} onBack={back} saving={saving} />}
      </div>
    </div>
  );
}
