// Shared atoms for ColosmartTraining screens
// All component-scoped style objects use unique names.

const cstAtomsStyles = {
  star: { color: 'var(--cst-mid-green)', fontSize: 13, lineHeight: 1 },
};

// Logo lockup ★ COLOSMARTRAINING
function CSTLogo({ size = 14, color = '#fff' }) {
  return (
    <div className="cst-logo" style={{ fontSize: size, color }}>
      <span className="cst-star" style={cstAtomsStyles.star}>★</span>
      <span>COLOSMARTRAINING</span>
    </div>
  );
}

// Section number heading ("— 01  LABEL · SUB-LABEL")
function CSTSectionNum({ num, label, sub }) {
  return (
    <div className="cst-section-num">
      <span style={{ fontWeight: 600 }}>{String(num).padStart(2, '0')}</span>
      <span>{label}{sub ? <> · <span style={{ opacity: 0.7 }}>{sub}</span></> : null}</span>
    </div>
  );
}

// Big display + italic serif duo (matches the site's H1 pattern)
function CSTDuoTitle({ top, bottom, size = 56, color }) {
  return (
    <div className="cst-col" style={{ gap: 4, color }}>
      <h1 className="cst-display" style={{ fontSize: size, margin: 0, fontWeight: 800 }}>{top}</h1>
      <div className="cst-italic" style={{ fontSize: size * 0.78, marginTop: -size * 0.08 }}>{bottom}</div>
    </div>
  );
}

// Avatar with initials
function CSTAvatar({ initials = 'JF', size = 36, dark = false }) {
  const styleObj = {
    width: size, height: size, fontSize: size * 0.36,
    background: dark ? '#1B2E1F' : 'linear-gradient(135deg, #3A6B42, #1B2E1F)',
    border: dark ? '1px solid rgba(255,255,255,0.08)' : 'none',
  };
  return <div className="cst-avatar" style={styleObj}>{initials}</div>;
}

// Status pill (small)
function CSTStatus({ kind = 'todo', label }) {
  const map = {
    todo: { cls: 'cst-tag cst-tag-warn', t: label || 'À FAIRE' },
    done: { cls: 'cst-tag cst-tag-success', t: label || 'COMPLÉTÉE' },
    skip: { cls: 'cst-tag cst-tag-danger', t: label || 'SAUTÉE' },
    active: { cls: 'cst-tag', t: label || 'EN COURS' },
    coming: { cls: 'cst-tag cst-tag-dark', t: label || 'À VENIR' },
  };
  const v = map[kind] || map.todo;
  return <span className={v.cls}>{v.t}</span>;
}

// Image placeholder slot (subtle, monospace label)
function CSTPlaceholder({ label, dark = true, ratio, height, width = '100%', children }) {
  const bg = dark ? '#1F2A22' : '#E0DBC9';
  return (
    <div
      className={dark ? 'cst-hatch' : 'cst-hatch-light'}
      style={{
        width,
        height: height || 'auto',
        aspectRatio: ratio,
        background: bg,
        border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'flex-end',
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--cst-mono)',
        fontSize: 9,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
      }}
    >
      {children || `■ ${label || 'image'}`}
    </div>
  );
}

// Marquee-style band of brand words (footer DNA)
function CSTBandWords({ items, dark = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 28,
      padding: '14px 0',
      borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      flexWrap: 'wrap',
    }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span>{it}</span>
          {i < items.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// Sidebar (Coach app shell)
function CSTCoachSidebar({ active = 'dashboard' }) {
  const items = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '◧' },
    { id: 'membres',   label: 'Membres',         icon: '◉' },
    { id: 'programmes',label: 'Programmes',      icon: '▤' },
    { id: 'import',    label: 'Import Excel',    icon: '↥' },
    { id: 'messages',  label: 'Messages',        icon: '◌' },
  ];
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
          const on = it.id === active;
          return (
            <div key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px',
              borderRadius: 8,
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

// Header bar (used inside artboards)
function CSTPageHeader({ num, label, sub, dateRight, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '24px 32px', gap: 24,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="cst-col" style={{ gap: 10 }}>
        <CSTSectionNum num={num} label={label} sub={sub} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {dateRight && <span className="cst-mono">{dateRight}</span>}
        {action}
      </div>
    </div>
  );
}

Object.assign(window, {
  CSTLogo, CSTSectionNum, CSTDuoTitle, CSTAvatar, CSTStatus,
  CSTPlaceholder, CSTBandWords, CSTCoachSidebar, CSTPageHeader,
});
