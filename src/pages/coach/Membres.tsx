import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum } from '../../components/Atoms';
import MembersTable from '@/components/coach/MembersTable';
import PriorityFeed from '@/components/coach/PriorityFeed';
import RecentSessionsList from '@/components/coach/RecentSessionsList';
import { getDashboardMetrics } from '@/lib/coach-dashboard.functions';

export default function CoachMembres() {
  return <CoachMembresInner />;
}

function CoachMembresInner() {
  const navigate = useNavigate();
  const metricsFn = useServerFn(getDashboardMetrics);
  const { data: metrics } = useQuery({ queryKey: ['coach', 'metrics'], queryFn: () => metricsFn() });

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
          <CSTSectionNum num={1} label="MES COACHÉS" sub="SUIVI & GESTION" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach' })}>← TABLEAU DE BORD</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate({ to: '/coach/invitations' })}>+ INVITER</button>
          </div>
        </div>

        {/* Stats band */}
        <div style={{ padding: '16px 32px 0', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            ['ACTIFS', String(metrics?.activeMembers ?? '—')],
            ['SÉANCES CETTE SEMAINE', String(metrics?.sessionsThisWeek ?? '—')],
            ['ADHÉRENCE 7J', metrics?.adherence7d != null ? `${metrics.adherence7d}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--cst-display)', fontWeight: 800, fontSize: 28, color: '#fff' }}>{value}</span>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.55, letterSpacing: '0.2em' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Priority + Recent */}
        <div style={{ padding: '24px 32px 8px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 24 }}>
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

        {/* Members table */}
        <div style={{ padding: '24px 32px 32px' }}>
          <div style={{ marginBottom: 14 }}>
            <CSTSectionNum num={4} label="LISTE DES COACHÉS" sub="TOUS LES MEMBRES" />
          </div>
          <MembersTable />
        </div>

      </div>
    </div>
  );
}
