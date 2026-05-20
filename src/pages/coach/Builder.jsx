import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTPlaceholder } from '../../components/Atoms';
import { saveProgram } from '@/lib/coach.functions';

const panelStyle = { background: '#16261A', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 24 };
const exItem = { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 10px', background: '#1F2A22' };
const dayCard = {
  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 360,
};

const days = [
  { d:'JOUR 1', day:'LUNDI',    label:'PUSH A',  type:'FORCE', ex:[['DÉVELOPPÉ COUCHÉ','4 × 6-8','180 S','RPE 8'],['OVERHEAD PRESS','3 × 10','120 S','RPE 7'],['DIPS','3 × AMRAP','120 S','RPE 8+'],['ÉCARTÉS HALTÈRES','3 × 12','90 S','RPE 7']] },
  { d:'JOUR 2', day:'MERCREDI', label:'PULL B',  type:'FORCE', active:true, ex:[['TRACTIONS','4 × 6-10','180 S','RPE 8'],['ROW BARRE','4 × 8','120 S','RPE 8'],['FACE PULL','3 × 15','60 S','RPE 7'],['CURL BARRE','3 × 10','90 S','RPE 7']] },
  { d:'JOUR 3', day:'JEUDI',    label:'REST',    type:'RÉCUPÉRATION', rest:true },
  { d:'JOUR 4', day:'VENDREDI', label:'LEGS C',  type:'FORCE', ex:[['SQUAT BARRE','5 × 5','240 S','RPE 8.5'],['ROMANIAN DEADLIFT','4 × 8','180 S','RPE 8'],['LUNGES','3 × 12/c','90 S','RPE 7'],['CALF RAISES','4 × 15','60 S','RPE 8']] },
  { d:'JOUR 5', day:'SAMEDI',   label:'CARDIO',  type:'Z2 · 45 MIN', cardio:true },
];

const OBJECTIFS = ['Force', 'Hypertrophie', 'Endurance', 'Mobilité'];

export default function Builder() {
  const navigate = useNavigate();
  const saveFn = useServerFn(saveProgram);
  const [activeWeek, setActiveWeek] = useState(4);
  const [name, setName] = useState('Force Fondamentale – Cycle 1');
  const [duration, setDuration] = useState(8);
  const [frequency, setFrequency] = useState(4);
  const [objective, setObjective] = useState('Force');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSave() {
    setMsg(null);
    if (!name.trim()) { setMsg({ kind: 'err', text: 'Nom requis' }); return; }
    setSaving(true);
    try {
      await saveFn({
        data: {
          name: name.trim(),
          duration_weeks: duration,
          frequency_per_week: frequency,
          objective,
          structure: { days },
        },
      });
      setMsg({ kind: 'ok', text: 'Programme sauvegardé ✓' });
      setTimeout(() => navigate({ to: '/coach' }), 900);
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message || 'Erreur de sauvegarde' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />

      {/* Left panel */}
      <aside className="cst-scroll" style={{ ...panelStyle, width: 360, flex: '0 0 360px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="cst-mono" style={{ color: '#fff' }}>PROGRAMMES</span>
          <span className="cst-mono">/</span>
          <span className="cst-mono" style={{ color: 'var(--cst-mid-green)' }}>NOUVEAU</span>
        </div>
        <CSTSectionNum num={1} label="PARAMÈTRES" />
        <h2 className="cst-display" style={{ fontSize: 24, margin: '8px 0 16px' }}>LE PROGRAMME.</h2>
        <div className="cst-col" style={{ gap: 16 }}>
          <div>
            <label className="cst-label">NOM DU PROGRAMME</label>
            <input className="cst-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="cst-label">DURÉE</label>
              <select className="cst-input" style={{ cursor: 'pointer' }} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={4}>4 semaines</option>
                <option value={8}>8 semaines</option>
                <option value={12}>12 semaines</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="cst-label">FRÉQUENCE</label>
              <select className="cst-input" style={{ cursor: 'pointer' }} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>
                <option value={3}>3 jours / sem.</option>
                <option value={4}>4 jours / sem.</option>
                <option value={5}>5 jours / sem.</option>
              </select>
            </div>
          </div>
          <div>
            <label className="cst-label">OBJECTIF</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {OBJECTIFS.map((t) => {
                const on = t === objective;
                return (
                  <span key={t} onClick={() => setObjective(t)} className={on ? 'cst-tag' : 'cst-tag cst-tag-dark'} style={{ padding: '6px 12px', cursor: 'pointer' }}>{t}</span>
                );
              })}
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(45,90,53,0.10)', border: '1px solid rgba(45,90,53,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="cst-col" style={{ gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Progressive Overload</span>
              <span className="cst-mono" style={{ fontSize: 9 }}>+5% CHARGE / SEM · DÉLOAD W06</span>
            </div>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: 'var(--cst-mid-green)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>
          {msg && (
            <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msg.kind === 'ok' ? 'rgba(45,90,53,0.15)' : 'rgba(139,35,24,0.15)', border: msg.kind === 'ok' ? '1px solid rgba(45,90,53,0.4)' : '1px solid rgba(139,35,24,0.4)', color: msg.kind === 'ok' ? '#6EAB76' : '#C56A60' }}>{msg.text}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving} className="cst-btn cst-btn-primary" style={{ flex: 1 }}>{saving ? '...' : 'SAUVEGARDER →'}</button>
          </div>

        </div>

        {/* Library */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <CSTSectionNum num={2} label="BIBLIOTHÈQUE" sub="118 EX." />
          <div style={{ position: 'relative', margin: '12px 0' }}>
            <input className="cst-input" placeholder="Rechercher un exercice…" style={{ paddingLeft: 36 }} />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>⌕</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {['Tous','Push','Pull','Legs','Core','Cardio'].map((c,i) => (
              <span key={c} className={i === 0 ? 'cst-tag' : 'cst-tag cst-tag-dark'} style={{ padding: '4px 10px', fontSize: 9, cursor: 'pointer' }}>{c}</span>
            ))}
          </div>
          <div className="cst-col" style={{ gap: 6 }}>
            {[['Squat Barre','Legs · Compound'],['Développé Couché','Push · Compound'],['Soulevé de Terre','Pull · Compound'],['Traction Pronation','Pull · Compound'],['Overhead Press','Push · Compound'],['Row Barre','Pull · Compound']].map(([n,m]) => (
              <div key={n} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ opacity: 0.4, cursor: 'grab' }}>⠿</span>
                <div className="cst-col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{n}</span>
                  <span className="cst-mono" style={{ fontSize: 9 }}>{m}</span>
                </div>
                <span style={{ opacity: 0.4 }}>＋</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="cst-scroll" style={{ flex: 1, padding: '24px 32px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <CSTDuoTitle top="STRUCTURE" bottom={`Semaine ${String(activeWeek).padStart(2,'0')} / 08`} size={38} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">DUPLIQUER LA SEMAINE</button>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">PRÉVISUALISER →</button>
          </div>
        </div>

        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 18 }}>
          {[1,2,3,4,5,6,7,8].map(n => {
            const active = n === activeWeek;
            return (
              <div key={n} onClick={() => setActiveWeek(n)} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderRadius: 8, background: active ? 'var(--cst-mid-green)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                <div className="cst-mono" style={{ fontSize: 9 }}>SEM</div>
                <div className="cst-display" style={{ fontSize: 16, marginTop: 2 }}>{String(n).padStart(2,'0')}</div>
                {n === 6 && <div className="cst-mono" style={{ fontSize: 8, color: '#D4A53B', marginTop: 2 }}>DÉLOAD</div>}
              </div>
            );
          })}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {days.map((day, i) => (
            <div key={i} style={{ ...dayCard, borderColor: day.active ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.06)' }}>
              <div className="cst-col" style={{ gap: 2, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="cst-mono" style={{ fontSize: 9 }}>{day.d}</span>
                  <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>{day.day}</span>
                </div>
                <span className="cst-display" style={{ fontSize: 18, color: day.rest ? 'rgba(255,255,255,0.5)' : '#fff' }}>{day.label}</span>
                <span className="cst-mono" style={{ fontSize: 9, color: day.active ? 'var(--cst-mid-green)' : 'inherit' }}>{day.type}</span>
              </div>
              {day.rest && (
                <div className="cst-col" style={{ gap: 8, opacity: 0.55, textAlign: 'center', margin: 'auto' }}>
                  <span style={{ fontSize: 36, color: 'var(--cst-mid-green)' }}>◯</span>
                  <span className="cst-mono" style={{ fontSize: 10 }}>RÉCUPÉRATION</span>
                </div>
              )}
              {day.cardio && (
                <div className="cst-col" style={{ gap: 10, marginTop: 8 }}>
                  <div style={exItem}>
                    <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ Z2</span>
                    <div className="cst-display" style={{ fontSize: 13, marginTop: 4 }}>RUN CONTINU</div>
                    <div className="cst-mono" style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>45 MIN · HR 130-145</div>
                  </div>
                </div>
              )}
              {day.ex && day.ex.map((e, ei) => (
                <div key={ei} style={{ ...exItem, borderColor: day.active && ei === 0 ? 'rgba(45,90,53,0.5)' : 'rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>★ {String(ei+1).padStart(2,'0')}</span>
                  </div>
                  <div className="cst-display" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.1 }}>{e[0]}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="cst-mono" style={{ fontSize: 9, color: '#fff' }}>{e[1]}</span>
                    <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>{e[2]}</span>
                    <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>{e[3]}</span>
                  </div>
                </div>
              ))}
              {!day.rest && (
                <div style={{ border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 6, padding: 10, textAlign: 'center', marginTop: 'auto' }}>
                  <span className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>+ EXERCICE</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Edit panel */}
        <div style={{ marginTop: 24, padding: 20, background: '#1A2620', border: '1px solid rgba(45,90,53,0.4)', borderRadius: 12, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
          <div>
            <CSTSectionNum num={3} label="ÉDITION EXERCICE" sub="POP-OVER" />
            <h3 className="cst-display" style={{ fontSize: 22, margin: '8px 0 4px' }}>SQUAT BARRE</h3>
            <div className="cst-italic" style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>Legs · Compound · Cycle 1</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[['SÉRIES','4'],['REPS','6-8'],['REPOS','3 MIN'],['RPE CIBLE','8/10']].map(([k,v]) => (
                <div key={k}>
                  <label className="cst-label">{k}</label>
                  <input className="cst-input" defaultValue={v} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="cst-label">NOTES POUR LE MEMBRE</label>
              <textarea className="cst-input" rows="3" style={{ resize: 'none', fontFamily: 'var(--cst-ui)', fontSize: 12 }} defaultValue="Focus: descente contrôlée 3s, pas de rebond en bas." />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm">ANNULER</button>
              <button className="cst-btn cst-btn-primary cst-btn-sm" style={{ flex: 1 }}>AJOUTER →</button>
            </div>
          </div>
          <div className="cst-col" style={{ gap: 14 }}>
            <CSTPlaceholder label="vidéo · technique squat" ratio="16/9" />
            <div className="cst-card-dark" style={{ padding: 14 }}>
              <span className="cst-mono" style={{ fontSize: 9 }}>DERNIÈRE DE JORDAN</span>
              <div className="cst-display" style={{ fontSize: 16, marginTop: 6 }}>95 KG × 7 · RPE 8.5</div>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.6, marginTop: 4, display: 'block' }}>IL Y A 7 JOURS · PROGRESSION +5KG</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
