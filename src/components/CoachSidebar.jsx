import { useNavigate, useLocation } from 'react-router-dom';
import { CSTLogo, CSTAvatar } from './Atoms';

const items = [
  { id: 'dashboard',  label: 'Tableau de bord', icon: '⧉', path: '/coach' },
  { id: 'membres',    label: 'Membres',          icon: '○', path: '/coach/membre' },
  { id: 'programmes', label: 'Programmes',       icon: '◤', path: '/coach/builder' },
  { id: 'import',     label: 'Import Excel',     icon: '◥', path: '/coach/import' },
  { id: 'messages',   label: 'Messages',         icon: '◌', path: '/coach/messages' },
];

export default function CoachSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeId = items.find(it =>
    it.path !== '/coach'
      ? pathname.startsWith(it.path)
      : pathname === '/coach'
  )?.id || 'dashboard';

  return (
    <aside style={{
      width: 240, flex: '0 0 240px',
      background: '#16261A',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 16px',
    }} className="cst-hatch">
      <div style={{ padding: '0 8px 24px' }}>
        <CSTLogo />
        <div className="cst-mono" style={{ marginTop: 6, fontSize: 9, opacity: 0.55 }}>L'ESPACE · COACH</div>
      </div>
      <nav className="cst-col" style={{ gap: 2, flex: 1 }}>
        {items.map(it => {
          const on = it.id === activeId;
          return (
            <div key={it.id} onClick={() => navigate(it.path)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', borderRadius: 8,
              background: on ? 'rgba(45,90,53,0.18)' : 'transparent',
              color: on ? '#fff' : 'rgba(255,255,255,0.65)',
              fontSize: 13, fontWeight: on ? 600 : 400,
              cursor: 'pointer',
              borderLeft: on ? '2px solid var(--cst-mid-green)' : '2px solid transparent',
            }}>
              <span style={{ width: 16, opacity: on ? 1 : 0.55, color: on ? 'var(--cst-mid-green)' : 'inherit' }}>{it.icon}</span>
              <span style={{ letterSpacing: 0.2 }}>{it.label}</span>
            </div>
          );
        })}
      </nav>
      <div style={{
        marginTop: 16, padding: 12, borderRadius: 8,
        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <CSTAvatar initials="LC" size={32} />
        <div className="cst-col" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Léo Colognesi</div>
          <div className="cst-mono" style={{ fontSize: 9 }}>COACH · ADMIN</div>
        </div>
      </div>
    </aside>
  );
}
