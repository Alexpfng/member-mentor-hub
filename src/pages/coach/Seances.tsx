import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum } from '../../components/Atoms';
import PriorityFeed from '@/components/coach/PriorityFeed';
import RecentSessionsList from '@/components/coach/RecentSessionsList';
import ArchivedSessionsPanel from '@/components/coach/ArchivedSessionsPanel';
import { getDashboardMetrics } from '@/lib/coach-dashboard.functions';

export default function CoachSeances() {
  return <CoachSeancesInner />;
}

function CoachSeancesInner() {
  const navigate = useNavigate();
  const metricsFn = useServerFn(getDashboardMetrics);
  const { data: metrics } = useQuery({ queryKey: ['coach', 'metrics'], queryFn: () => metricsFn() });

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
          <CSTSectionNum num={1} label="SÉANCES" sub="PRIORITÉS & ACTIVITÉ RÉCENTE" />
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach' })}>
            ← TABLEAU DE BORD
          </button>
        </div>

        {/* Content: 2 columns */}
        <div style={{ padding: '24px 32px 32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 24 }}>
          <div>
            <div style={{ marginBottom: 14 }}>
              <CSTSectionNum num={2} label="À TRAITER EN PRIORITÉ" sub={metrics?.toTreat ? `${metrics.toTreat} ITEMS` : 'TOUT EST À JOUR'} />
            </div>
            <PriorityFeed />
            <div style={{ marginTop: 16 }}>
              <ArchivedSessionsPanel />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 14 }}>
              <CSTSectionNum num={3} label="SÉANCES RÉCENTES" sub="TEMPS RÉEL" />
            </div>
            <RecentSessionsList />
          </div>
        </div>

      </div>
    </div>
  );
}
