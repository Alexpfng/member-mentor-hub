import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum, CSTDuoTitle, CSTBandWords } from '../../components/Atoms';
import { listMembers, listPrograms } from '@/lib/coach.functions';
import { createInvitation } from '@/lib/invitations.functions';
import { seedColosmartData } from '@/lib/seed.functions';
import { getDashboardMetrics } from '@/lib/coach-dashboard.functions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';


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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
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

const metricCard = {
  background: '#243029', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
  padding: '22px 22px', display: 'flex', flexDirection: 'column', gap: 6,
  position: 'relative', overflow: 'hidden',
};

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

export default function CoachDashboard() {
  const { user, role, loading } = useAuth();
  if (loading || (user && role === null)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a2420', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'var(--cst-mono)' }}>
        CHARGEMENT…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (role !== 'coach') return <Navigate to="/membre" />;
  return <CoachDashboardInner />;
}

function CoachDashboardInner() {
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
    const ch = supabase.channel('coach:dashboard')
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

  const todayPlanned = metrics?.todayPlanned ?? 0;
  const todayCompleted = metrics?.todayCompleted ?? 0;
  const kpis = [
    [String(metrics?.activeMembers ?? realMembers.length).padStart(2, '0'), 'COACHÉS ACTIFS', '/coach/membres'],
    [String(metrics?.sessionsThisWeek ?? 0).padStart(2, '0'), 'SÉANCES CETTE SEMAINE', '/coach/seances'],
    [String(todayPlanned).padStart(2, '0'), 'PLANNING SEMAINE', '/coach/membres'],
    [String(todayCompleted).padStart(2, '0'), 'TERMINÉES SEMAINE', '/coach/seances'],
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
          {kpis.map(([n, l, anchor], i) => (
            <div
              key={i}
              className="cst-hatch"
              role="button"
              tabIndex={0}
              title="Voir le détail"
              onClick={() => navigate({ to: anchor })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate({ to: anchor }); }}
              style={{ ...metricCard, cursor: 'pointer' }}
            >
              <span className="cst-mono" style={{ fontSize: 9 }}>★ {String(i+1).padStart(2,'0')}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--cst-display)', fontWeight: 800, fontSize: 56, lineHeight: 0.9, color: i === 3 && todayCompleted > 0 ? '#6EAB76' : '#fff' }}>{n}</span>
              </div>
              <span className="cst-mono" style={{ fontSize: 9, letterSpacing: '0.22em' }}>{l} →</span>
            </div>
          ))}
        </div>

        {/* Quick nav to detail pages */}
        <div style={{ padding: '0 32px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="cst-btn cst-btn-ghost-dark" onClick={() => navigate({ to: '/coach/membres' })}>
            MES COACHÉS →
          </button>
          <button className="cst-btn cst-btn-ghost-dark" onClick={() => navigate({ to: '/coach/seances' })}>
            SÉANCES →
          </button>
          {todayPlanned > 0 && (
            <button className="cst-btn cst-btn-ghost-dark" onClick={() => navigate({ to: '/coach/membres' })}>
              {todayPlanned} SÉANCE{todayPlanned > 1 ? 'S' : ''} PLANIFIÉE{todayPlanned > 1 ? 'S' : ''} CETTE SEMAINE →
            </button>
          )}
          {todayCompleted > 0 && (
            <button className="cst-btn" style={{ background: 'rgba(45,90,53,0.15)', border: '1px solid rgba(45,90,53,0.4)', color: '#6EAB76' }} onClick={() => navigate({ to: '/coach/seances' })}>
              {todayCompleted} SÉANCE{todayCompleted > 1 ? 'S' : ''} TERMINÉE{todayCompleted > 1 ? 'S' : ''} CETTE SEMAINE →
            </button>
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

        {/* Légende intensités */}
        <div className="cst-card-dark" style={{ padding: 14, marginTop: 24, margin: '0 32px 32px' }}>
          <div className="cst-mono" style={{ fontSize: 9, letterSpacing: "0.15em", opacity: 0.5, marginBottom: 10 }}>
            LÉGENDE DES INTENSITÉS
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "#C44A3A", label: "Force / Épuisant" },
              { color: "#5BA85A", label: "Isolation" },
              { color: "#D4A82E", label: "Explosivité" },
              { color: "#E8D44A", label: "Mobilité" },
              { color: "#4A8BC4", label: "Technique" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, opacity: 0.8 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

