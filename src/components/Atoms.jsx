// Shared UI atoms

export function CSTLogo({ size = 14, color = '#fff' }) {
  return (
    <div className="cst-logo" style={{ fontSize: size, color }}>
      <span className="cst-star" style={{ color: 'var(--cst-mid-green)', fontSize: 13, lineHeight: 1 }}>★</span>
      <span>COLOSMARTRAINING</span>
    </div>
  );
}

export function CSTSectionNum({ num, label, sub }) {
  return (
    <div className="cst-section-num">
      <span style={{ fontWeight: 600 }}>{String(num).padStart(2, '0')}</span>
      <span>{label}{sub ? <> · <span style={{ opacity: 0.7 }}>{sub}</span></> : null}</span>
    </div>
  );
}

export function CSTDuoTitle({ top, bottom, size = 56, color }) {
  return (
    <div className="cst-col" style={{ gap: 4, color }}>
      <h1 className="cst-display" style={{ fontSize: size, margin: 0, fontWeight: 800 }}>{top}</h1>
      <div className="cst-italic" style={{ fontSize: size * 0.78, marginTop: -size * 0.08 }}>{bottom}</div>
    </div>
  );
}

export function CSTAvatar({ initials = 'JF', size = 36, dark = false }) {
  return (
    <div className="cst-avatar" style={{
      width: size, height: size, fontSize: size * 0.36,
      background: dark ? '#1B2E1F' : 'linear-gradient(135deg, #3A6B42, #1B2E1F)',
      border: dark ? '1px solid rgba(255,255,255,0.08)' : 'none',
    }}>{initials}</div>
  );
}

export function CSTStatus({ kind = 'todo', label }) {
  const map = {
    todo:   { cls: 'cst-tag cst-tag-warn',    t: label || 'À FAIRE' },
    done:   { cls: 'cst-tag cst-tag-success',  t: label || 'COMPLÉTÉE' },
    skip:   { cls: 'cst-tag cst-tag-danger',   t: label || 'SAUTÉE' },
    active: { cls: 'cst-tag',                  t: label || 'EN COURS' },
    coming: { cls: 'cst-tag cst-tag-dark',     t: label || 'À VENIR' },
    rest:   { cls: 'cst-tag cst-tag-dark',     t: label || 'REPOS' },
  };
  const v = map[kind] || map.todo;
  return <span className={v.cls}>{v.t}</span>;
}

export function CSTPlaceholder({ label, dark = true, ratio, height, width = '100%', children }) {
  const bg = dark ? '#1F2A22' : '#E0DBC9';
  return (
    <div
      className={dark ? 'cst-hatch' : 'cst-hatch-light'}
      style={{
        width, height: height || 'auto', aspectRatio: ratio,
        background: bg,
        border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 8, display: 'flex', alignItems: 'flex-end',
        padding: 12, position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--cst-mono)', fontSize: 9,
        letterSpacing: '0.16em', textTransform: 'uppercase',
        color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
      }}
    >{children || `▪ ${label || 'image'}`}</div>
  );
}

export function CSTBandWords({ items, dark = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 28, padding: '14px 0',
      borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      flexWrap: 'wrap',
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span>{it}</span>
          {i < items.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
        </span>
      ))}
    </div>
  );
}

export function CSTDot({ color = '#3A6B42', size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}
