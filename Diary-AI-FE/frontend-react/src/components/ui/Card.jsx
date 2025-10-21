import React from 'react';

const Card = ({ title, subtitle, headerExtra, children, style, className = '' }) => (
  <div className={`card ${className}`} style={{ position: 'relative', overflow: 'hidden', ...style }}>
    {(title || subtitle || headerExtra) && (
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {headerExtra}
      </div>
    )}
    <div className="card-content">
        <div aria-hidden className="glass-sheen" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(200px 120px at 0% -10%, rgba(255,255,255,0.5), transparent 60%)'
        }} />
      {children}
    </div>
  </div>
);

export default Card;
