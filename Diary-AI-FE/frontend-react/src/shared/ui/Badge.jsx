import React from 'react';

const COLORS = {
  neutral: { bg: 'linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))', color: 'var(--text-primary)', border: 'var(--glass-border)' },
  success: { bg: 'linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.12))', color: '#065f46', border: 'rgba(16,185,129,0.35)' },
  info: { bg: 'linear-gradient(180deg, rgba(2,132,199,0.22), rgba(2,132,199,0.12))', color: '#0c4a6e', border: 'rgba(2,132,199,0.35)' },
  warning: { bg: 'linear-gradient(180deg, rgba(245,158,11,0.22), rgba(245,158,11,0.12))', color: '#92400e', border: 'rgba(245,158,11,0.35)' },
  danger: { bg: 'linear-gradient(180deg, rgba(239,68,68,0.22), rgba(239,68,68,0.12))', color: '#7f1d1d', border: 'rgba(239,68,68,0.35)' },
};

const Badge = ({ color = 'neutral', children, style, className = '' }) => {
  const c = COLORS[color] || COLORS.neutral;
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
    background: c.bg, color: c.color, border: `1px solid ${c.border || 'var(--glass-border)'}`,
    boxShadow: '0 6px 16px rgba(2,6,23,0.08)',
    backdropFilter: 'blur(10px) saturate(120%)', WebkitBackdropFilter: 'blur(10px) saturate(120%)',
  };
  return (
    <span className={`badge ${className}`} style={style}>
      <span className="badge-inner" style={base}>{children}</span>
      <style>{`
        .dark .badge .badge-inner { background: ${c.darkBg}; color: ${c.darkColor}; border-color: rgba(255,255,255,0.08); }
      `}</style>
    </span>
  );
};

export default Badge;
