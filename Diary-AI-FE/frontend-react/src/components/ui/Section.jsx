import React from 'react';

const Section = ({ title, subtitle, actions, children, style, className='' }) => (
  <section className={`section ${className}`} style={style}>
    {(title || subtitle || actions) && (
      <header className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          {title && <h2 className="section-title">{title}</h2>}
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
    )}
    <div className="section-content">
      {children}
    </div>
  </section>
);

export default Section;
