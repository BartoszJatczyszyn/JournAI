import React from 'react';

const COLORS = {
  neutral: { bg: '#f1f5f9', color: '#334155', darkBg: '#334155', darkColor: '#e2e8f0' },
  success: { bg: '#dcfce7', color: '#166534', darkBg: '#14532d', darkColor: '#bbf7d0' },
  info: { bg: '#dbeafe', color: '#1d4ed8', darkBg: '#1e3a8a', darkColor: '#93c5fd' },
  warning: { bg: '#fef3c7', color: '#92400e', darkBg: '#451a03', darkColor: '#fbbf24' },
  danger: { bg: '#fee2e2', color: '#dc2626', darkBg: '#7f1d1d', darkColor: '#fca5a5' },
};

const Badge = ({ color = 'neutral', children, style, className = '' }) => {
  const c = COLORS[color] || COLORS.neutral;
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
    background: c.bg, color: c.color, border: '1px solid rgba(0,0,0,0.04)'
  };
  const dark = {
    background: c.darkBg, color: c.darkColor, border: '1px solid rgba(255,255,255,0.08)'
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
