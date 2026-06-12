import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum } from '../../components/Atoms';
import MembersTable from '@/components/coach/MembersTable';
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
          <CSTSectionNum num={1} label="MES COACHÉS" sub={`${metrics?.activeMembers ?? '—'} ACTIFS`} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach' })}>← TABLEAU DE BORD</button>
            <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => navigate({ to: '/coach/invitations' })}>+ INVITER</button>
          </div>
        </div>

        {/* Members table */}
        <div style={{ padding: '24px 32px 32px' }}>
          <MembersTable />
        </div>

      </div>
    </div>
  );
}
