import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const items = [
  { id: 'home',    icon: '⧉', label: 'HOME',      path: '/membre' },
  { id: 'prog',    icon: '◤', label: 'PROGRAMME',  path: '/membre/programme' },
  { id: 'hist',    icon: '◯', label: 'HISTORIQUE', path: '/membre/historique' },
  { id: 'prog2',   icon: '▲', label: 'PROGRÈS',    path: '/membre/progression' },
  { id: 'logout',  icon: '⎋', label: 'SORTIR',     path: '__logout__' },
];

export default function MemberNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeId = items.find(it =>
    it.path !== '/membre'
      ? pathname.startsWith(it.path)
      : pathname === '/membre'
  )?.id || 'home';

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(22,38,26,0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '12px 12px 22px',
      zIndex: 10,
    }}>
      {items.map(it => {
        const on = it.id === activeId;
        const onClick = async () => {
          if (it.path === '__logout__') {
            await supabase.auth.signOut();
            navigate('/login');
          } else {
            navigate(it.path);
          }
        };
        return (
          <div key={it.id} onClick={onClick} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontFamily: 'var(--cst-mono)', fontSize: 8, letterSpacing: '0.12em',
            color: on ? '#fff' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 16, color: on ? 'var(--cst-mid-green)' : 'inherit' }}>{it.icon}</span>
            <span>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}
