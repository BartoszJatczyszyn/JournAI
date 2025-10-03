import React, { useState, useRef, useEffect } from 'react';

/**
 * Unified Tooltip component with consistent styling used across the app.
 * Props:
 *  - content: ReactNode|string
 *  - placement: 'top'|'bottom'|'left'|'right' (default 'top')
 *  - delay: number (ms, default 250)
 *  - maxWidth: string (default '280px')
 */
const Tooltip = ({ children, content, placement = 'top', delay = 250, maxWidth = '280px' }) => {
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (hover) {
      timer.current = setTimeout(() => setVisible(true), delay);
    } else {
      clearTimeout(timer.current);
      setVisible(false);
    }
    return () => clearTimeout(timer.current);
  }, [hover, delay]);

  const posStyles = () => {
    const isTop = placement === 'top';
    const isBottom = placement === 'bottom';
    const isLeft = placement === 'left';
    const isRight = placement === 'right';
    const base = {
      position: 'absolute', zIndex: 1000, maxWidth,
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      backdropFilter: 'blur(12px) saturate(120%)',
      WebkitBackdropFilter: 'blur(12px) saturate(120%)',
      boxShadow: 'var(--glass-shadow)',
      borderRadius: 10,
      padding: '10px 12px',
      color: 'var(--text-primary)',
      fontSize: '0.80rem',
      lineHeight: 1.35,
      pointerEvents: 'none'
    };
    if (isTop || isBottom) {
      return { ...base, left: '50%', transform: 'translateX(-50%)', [isTop ? 'bottom' : 'top']: '100%', marginTop: isTop ? 0 : 8, marginBottom: isTop ? 8 : 0 };
    }
    return { ...base, top: '50%', transform: 'translateY(-50%)', [isLeft ? 'right' : 'left']: '100%', marginLeft: isLeft ? 0 : 8, marginRight: isLeft ? 8 : 0 };
  };

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrapper"
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {children}
      {visible && (
        <span role="tooltip" className={`tooltip-glass tooltip-${placement}`} style={posStyles()}>
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
