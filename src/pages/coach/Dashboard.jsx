import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTAvatar, CSTStatus, CSTBandWords, CSTDot } from '../../components/Atoms';
import { listMembers, inviteMember, listPrograms, assignProgram } from '@/lib/coach.functions';
import { BETA_MODE } from '@/lib/site';


function InviteModal({ onClose, onDone }) {
  const inviteFn = useServerFn(inviteMember);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await inviteFn({
        data: {
          email: email.trim().toLowerCase(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      onDone(email);
    } catch (ex) {
      setErr(ex?.message || 'Erreur lors de l\'invitation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="cst-screen cst-hatch" style={{ width: 420, padding: 28, borderRadius: 14 }}>
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 4 }}>INVITER</h2>
        <div className="cst-italic" style={{ fontSize: 14, color: 'var(--cst-mid-green)', marginBottom: 18 }}>un nouvel adhérent.</div>
        <div className="cst-col" style={{ gap: 12 }}>
          <div>
            <label className="cst-label">EMAIL</label>
            <input className="cst-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adherent@email.com" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="cst-label">PRÉNOM</label>
              <input className="cst-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="cst-label">NOM</label>
              <input className="cst-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          {err && <div style={{ padding: '8px 12px', background: 'rgba(139,35,24,0.15)', border: '1px solid rgba(139,35,24,0.4)', borderRadius: 6, fontSize: 12, color: '#C56A60' }}>{err}</div>}
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            L'adhérent recevra un email avec un lien pour définir son mot de passe.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1 }}>ANNULER</button>
            <button type="submit" disabled={loading} className="cst-btn cst-btn-primary" style={{ flex: 1 }}>{loading ? '...' : 'ENVOYER L\'INVITATION →'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AssignSelect({ memberId, programs, currentProgramId, onAssigned }) {
  const assignFn = useServerFn(assignProgram);
  const [val, setVal] = useState(currentProgramId || '');
  const [busy, setBusy] = useState(false);
  async function handleChange(e) {
    const pid = e.target.value;
    setVal(pid);
    if (!pid) return;
    setBusy(true);
    try {
      await assignFn({ data: { member_id: memberId, program_id: pid } });
      onAssigned();
    } catch (ex) {
      alert(ex?.message || 'Erreur');
    } finally { setBusy(false); }
  }
  return (
    <select className="cst-input" disabled={busy} value={val} onChange={handleChange} style={{ fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}>
      <option value="">— Assigner un programme —</option>
      {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}


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
  const listMembersFn = useServerFn(listMembers);
  const listProgramsFn = useServerFn(listPrograms);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteOk, setInviteOk] = useState('');
  const [realMembers, setRealMembers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (BETA_MODE && typeof window !== 'undefined') {
      if (!localStorage.getItem('beta_welcome_seen_coach')) setShowWelcome(true);
    }
  }, []);

  function dismissWelcome() {
    if (typeof window !== 'undefined') localStorage.setItem('beta_welcome_seen_coach', '1');
    setShowWelcome(false);
  }


  async function reload() {
    try {
      const [m, p] = await Promise.all([listMembersFn(), listProgramsFn()]);
      setRealMembers(m.members || []);
      setPrograms(p.programs || []);
    } catch {}
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={(e) => { setShowInvite(false); setInviteOk(`Invitation envoyée à ${e}`); setTimeout(() => setInviteOk(''), 4000); reload(); }} />}
      {showWelcome && (
        <div onClick={dismissWelcome} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="cst-screen cst-hatch" style={{ width: 480, padding: 32, borderRadius: 14 }}>
            <h2 className="cst-display" style={{ fontSize: 26, marginBottom: 4 }}>BIENVENUE, LÉO. 👋</h2>
            <div className="cst-italic" style={{ fontSize: 15, color: 'var(--cst-mid-green)', marginBottom: 16 }}>Ton espace coach est prêt.</div>
            <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
              Teddy Morin est déjà dans ta liste d'adhérents.
            </p>
            <div style={{ background: 'rgba(45,90,53,0.12)', border: '1px solid rgba(45,90,53,0.3)', borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 12, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Pour commencer :</div>
              <div>1. Crée un programme pour Teddy</div>
              <div>2. Assigne-le lui</div>
              <div>3. Envoie-lui un message</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="cst-btn cst-btn-ghost-dark" style={{ flex: '0 0 auto', padding: '0 18px' }} onClick={dismissWelcome}>Fermer</button>
              <button className="cst-btn cst-btn-primary" style={{ flex: 1 }} onClick={() => { dismissWelcome(); navigate({ to: '/coach/builder' }); }}>CRÉER UN PROGRAMME POUR TEDDY →</button>
            </div>
          </div>
        </div>
      )}
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <CSTSectionNum num={1} label="TABLEAU DE BORD" sub="MAI 2026" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cst-mono">MER. 20 MAI · 09:51</span>
            {!BETA_MODE && <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach/import' })}>IMPORTER EXCEL ▲</button>}
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => setShowInvite(true)}>+ INVITER UN ADHÉRENT</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate({ to: '/coach/builder' })}>NOUVEAU PROGRAMME →</button>
          </div>
        </div>
        {inviteOk && (
          <div style={{ margin: '12px 32px 0', padding: '10px 14px', background: 'rgba(45,90,53,0.15)', border: '1px solid rgba(45,90,53,0.4)', borderRadius: 8, fontSize: 12, color: '#6EAB76' }}>{inviteOk}</div>
        )}


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

        {/* Real Members table */}
        <div style={{ padding: '32px 32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <CSTSectionNum num={3} label="MES ADHÉRENTS" sub={`${realMembers.length} INSCRITS`} />
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => setShowInvite(true)}>+ INVITER</button>
          </div>
          <div className="cst-card-dark" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 260 }}>MEMBRE</th>
                  <th style={thStyle}>EMAIL</th>
                  <th style={thStyle}>PROGRAMME ASSIGNÉ</th>
                  <th style={thStyle}>INSCRIT LE</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {realMembers.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '32px 16px', opacity: 0.6 }}>
                    Aucun adhérent pour l'instant. <span style={{ color: 'var(--cst-mid-green)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowInvite(true)}>Inviter le premier →</span>
                  </td></tr>
                )}
                {realMembers.map((r) => {
                  const init = `${(r.first_name?.[0] || r.email?.[0] || '?')}${(r.last_name?.[0] || '')}`.toUpperCase();
                  const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
                  return (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CSTAvatar initials={init} size={28} />
                          <span style={{ fontWeight: 600 }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, opacity: 0.7, fontSize: 12 }}>{r.email}</td>
                      <td style={tdStyle}>
                        <AssignSelect memberId={r.id} programs={programs} currentProgramId={r.program_id} onAssigned={reload} />
                      </td>
                      <td style={{ ...tdStyle, opacity: 0.6, fontSize: 11 }} className="cst-mono">{r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach/membre' })}>VOIR</button>
                      </td>
                    </tr>
                  );
                })}
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
