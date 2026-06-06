import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTBandWords } from '../../components/Atoms';
import { listMembers, listPrograms } from '@/lib/coach.functions';
import { createInvitation } from '@/lib/invitations.functions';
import { seedColosmartData } from '@/lib/seed.functions';
import { getDashboardMetrics } from '@/lib/coach-dashboard.functions';
import PriorityFeed from '@/components/coach/PriorityFeed';
import RecentSessionsList from '@/components/coach/RecentSessionsList';
import MembersTable from '@/components/coach/MembersTable';
import { supabase } from '@/integrations/supabase/client';


function InviteModal({ onClose, onDone }) {
  const createFn = useServerFn(createInvitation);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await createFn({
        data: {
          email: email.trim().toLowerCase() || null,
        },
      });
      setLink(res.signup_url);
      try {
        await navigator.clipboard.writeText(res.signup_url);
        setCopied(true);
      } catch {}
    } catch (ex) {
      setErr(ex?.message || "Erreur lors de l'invitation");
    } finally {
      setLoading(false);
    }
  }

  async function copyAgain() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="cst-screen cst-hatch" style={{ width: 460, padding: 28, borderRadius: 14 }}>
        <h2 className="cst-display" style={{ fontSize: 22, marginBottom: 4 }}>INVITER</h2>
        <div className="cst-italic" style={{ fontSize: 14, color: 'var(--cst-mid-green)', marginBottom: 18 }}>un nouvel adhérent.</div>
        <div className="cst-col" style={{ gap: 12 }}>
          <div>
            <label className="cst-label">EMAIL (OPTIONNEL)</label>
            <input className="cst-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adherent@email.com" />
          </div>
          {err && <div style={{ padding: '8px 12px', background: 'rgba(139,35,24,0.15)', border: '1px solid rgba(139,35,24,0.4)', borderRadius: 6, fontSize: 12, color: '#C56A60' }}>{err}</div>}
          {!link && (
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
              Un lien d'inscription sera généré. Tu pourras le transmettre toi-même à l'adhérent.
            </div>
          )}
          {link && (
            <div className="cst-col" style={{ gap: 6 }}>
              <span className="cst-label">LIEN À TRANSMETTRE</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="cst-input" value={link} readOnly onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, fontSize: 11, fontFamily: 'var(--cst-mono)' }} />
                <button type="button" className="cst-btn" onClick={copyAgain} style={{ fontSize: 11 }}>{copied ? '✓ COPIÉ' : 'COPIER'}</button>
              </div>
              <span className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>Valable 14 jours, utilisable une seule fois.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => { if (link) onDone(email || 'adhérent', link); else onClose(); }} className="cst-btn cst-btn-ghost-dark" style={{ flex: 1 }}>{link ? 'FERMER' : 'ANNULER'}</button>
            {!link && (
              <button type="submit" disabled={loading} className="cst-btn cst-btn-primary" style={{ flex: 1 }}>{loading ? '...' : "GÉNÉRER LE LIEN →"}</button>
            )}
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

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

export default function CoachDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listMembersFn = useServerFn(listMembers);
  const listProgramsFn = useServerFn(listPrograms);
  const metricsFn = useServerFn(getDashboardMetrics);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteOk, setInviteOk] = useState('');
  const [realMembers, setRealMembers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [firstName, setFirstName] = useState('Coach');

  const seedFn = useServerFn(seedColosmartData);
  const { data: metrics } = useQuery({ queryKey: ['coach', 'metrics'], queryFn: () => metricsFn() });

  async function reload() {
    try {
      const [m, p] = await Promise.all([listMembersFn(), listProgramsFn()]);
      setRealMembers(m.members || []);
      setPrograms(p.programs || []);
    } catch {}
  }

  useEffect(() => {
    (async () => {
      try { await seedFn(); } catch {}
      reload();
    })();
  }, []);

  // Realtime — invalidate coach queries on relevant changes
  useEffect(() => {
    const ch = supabase.channel('coach-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => qc.invalidateQueries({ queryKey: ['coach'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pain_reports' }, () => qc.invalidateQueries({ queryKey: ['coach'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exercise_feedbacks' }, () => qc.invalidateQueries({ queryKey: ['coach'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technique_videos' }, () => qc.invalidateQueries({ queryKey: ['coach'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => qc.invalidateQueries({ queryKey: ['coach'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) return;
        const { data: prof } = await supabase
          .from('profiles').select('first_name').eq('id', u.user.id).maybeSingle();
        if (prof?.first_name) setFirstName(prof.first_name);
      } catch {}
    })();
  }, []);

  const now = new Date();
  const dateLabel = `${['DIM','LUN','MAR','MER','JEU','VEN','SAM'][now.getDay()]}. ${now.getDate()} ${MONTHS[now.getMonth()]} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const kpis = [
    [String(metrics?.activeMembers ?? realMembers.length).padStart(2, '0'), 'COACHÉS ACTIFS'],
    [String(metrics?.sessionsThisWeek ?? 0).padStart(2, '0'), 'SÉANCES CETTE SEMAINE'],
    [String(metrics?.toTreat ?? 0).padStart(2, '0'), 'À TRAITER'],
    [metrics?.adherence7d != null ? `${metrics.adherence7d}%` : '—', 'ADHÉRENCE 7J'],
  ];

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={(e) => { setShowInvite(false); setInviteOk(`Lien d'invitation généré pour ${e} — copié dans le presse-papiers.`); setTimeout(() => setInviteOk(''), 5000); reload(); }} />}
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
          <CSTSectionNum num={1} label="TABLEAU DE BORD" sub={monthLabel} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="cst-mono">{dateLabel}</span>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach/import' })}>IMPORTER EXCEL ▲</button>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => setShowInvite(true)}>+ INVITER</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate({ to: '/coach/builder' })}>NOUVEAU PROGRAMME →</button>
          </div>
        </div>
        {inviteOk && (
          <div style={{ margin: '12px 32px 0', padding: '10px 14px', background: 'rgba(45,90,53,0.15)', border: '1px solid rgba(45,90,53,0.4)', borderRadius: 8, fontSize: 12, color: '#6EAB76' }}>{inviteOk}</div>
        )}

        {/* Welcome */}
        <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' }}>
          <CSTDuoTitle
            top={`BONJOUR, ${firstName.toUpperCase()}.`}
            bottom={realMembers.length === 0
              ? 'Aucun coaché pour l\'instant.'
              : `${realMembers.length} ${realMembers.length > 1 ? 'athlètes' : 'athlète'} en mouvement.`}
            size={42}
          />
          <CSTBandWords items={['LIBERTÉ', 'MOUVEMENT', 'NATURE', 'PROGRESSION']} />
        </div>

        {/* Metrics */}
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {kpis.map(([n, l], i) => (
            <div key={i} className="cst-hatch" style={metricCard}>
              <span className="cst-mono" style={{ fontSize: 9 }}>★ {String(i+1).padStart(2,'0')}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--cst-display)', fontWeight: 800, fontSize: 56, lineHeight: 0.9, color: i === 2 && metrics?.toTreat > 0 ? '#E07B39' : '#fff' }}>{n}</span>
              </div>
              <span className="cst-mono" style={{ fontSize: 9, letterSpacing: '0.22em' }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Two-column: Priority feed + Recent sessions */}
        <div style={{ padding: '8px 32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 24 }}>
          <div>
            <div style={{ marginBottom: 14 }}>
              <CSTSectionNum num={2} label="À TRAITER EN PRIORITÉ" sub={metrics?.toTreat ? `${metrics.toTreat} ITEMS` : 'TOUT EST À JOUR'} />
            </div>
            <PriorityFeed />
          </div>
          <div>
            <div style={{ marginBottom: 14 }}>
              <CSTSectionNum num={3} label="SÉANCES RÉCENTES" sub="TEMPS RÉEL" />
            </div>
            <RecentSessionsList />
          </div>
        </div>

        {/* Members overview */}
        <div style={{ padding: '24px 32px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <CSTSectionNum num={4} label="MES COACHÉS" sub={`${realMembers.length} INSCRITS`} />
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => setShowInvite(true)}>+ INVITER</button>
          </div>
          {realMembers.length === 0 ? (
            <div className="cst-card-dark" style={{ padding: 32, textAlign: 'center', opacity: 0.7 }}>
              Aucun coaché pour l'instant. <span style={{ color: 'var(--cst-mid-green)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowInvite(true)}>Inviter le premier →</span>
            </div>
          ) : (
            <MembersTable />
          )}
        </div>

        {programs.length === 0 && (
          <div style={{ padding: '0 32px 32px' }}>
            <div className="cst-card-dark cst-hatch" style={{ padding: 24, textAlign: 'center' }}>
              <div className="cst-display" style={{ fontSize: 22, marginBottom: 6 }}>AUCUN PROGRAMME ENCORE</div>
              <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>
                Crée ton premier programme pour pouvoir l'assigner à tes coachés.
              </p>
              <button className="cst-btn cst-btn-primary" onClick={() => navigate({ to: '/coach/builder' })}>
                CRÉER UN PROGRAMME →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

