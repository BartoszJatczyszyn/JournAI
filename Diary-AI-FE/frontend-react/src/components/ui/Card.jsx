import React from 'react';

const Card = ({ title, subtitle, headerExtra, children, style, className = '' }) => (
  <div className={`card ${className}`} style={style}>
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
      {children}
    </div>
  </div>
);

export default Card;
